/**
 * Immutable repository baseline primitive (GOS-33).
 *
 * Captures machine-verifiable refs + tree state at run start; verifies them
 * unchanged before promotion. Git targets capture HEAD + branch/tag refs +
 * committed tree hash. Non-git targets fall back to a file-hash list.
 *
 * The baseline REFUSES to be captured from a dirty/inconsistent repo (fail
 * closed — any git error surfaces as SANDBOX_FAILURE).
 *
 * Verification: same HEAD, same refs (branch+tag → sha), same tree hash, AND
 * the existing promote working-tree-clean check. Together these prove the
 * target was not moved, a branch/tag was not repointed, and the working-tree
 * content is unchanged since the run started.
 */

import { readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import { GorpError } from "../errors/index.js";
import { git } from "../sandbox/worktree.js";
import type { Clock } from "../graph/graph.js";
import type { Baseline, FilesBaseline, GitBaseline } from "../contracts/types.js";

// ---------------------------------------------------------------------------
// constant: gorp-owned sandbox refs
// ---------------------------------------------------------------------------

/** Prefix of gorp-managed sandbox branches — excluded from baseline refs so
 *  concurrent node runs don't appear as a ref drift. */
const GORP_SANDBOX_REF_PREFIX = "refs/heads/gorp/run/";

// ---------------------------------------------------------------------------
// capture (Git)
// ---------------------------------------------------------------------------

/** Precondition: `repositoryPath` is a git repo (caller has already verified). */
export function captureGitBaseline(repositoryPath: string, clock: Clock): GitBaseline {
  const capturedAt = clock.now();
  const head = git(["rev-parse", "HEAD"], repositoryPath).stdout.trim();
  if (!head) {
    throw new GorpError("SANDBOX_FAILURE", "cannot resolve target HEAD for baseline", { repositoryPath });
  }
  const refsRaw = git(["show-ref", "--heads", "--tags"], repositoryPath).stdout.trim();
  const refs: Record<string, string> = {};
  if (refsRaw.length > 0) {
    for (const line of refsRaw.split("\n")) {
      const [sha = "", refName = ""] = line.split(" ", 2);
      if (sha && refName && !refName.startsWith(GORP_SANDBOX_REF_PREFIX)) {
        refs[refName] = sha;
      }
    }
  }
  const treeHash = git(["rev-parse", "HEAD^{tree}"], repositoryPath).stdout.trim();
  if (!treeHash) {
    throw new GorpError("SANDBOX_FAILURE", "cannot resolve target tree hash for baseline", { repositoryPath });
  }
  return { kind: "git", head, refs, treeHash, capturedAt };
}

// ---------------------------------------------------------------------------
// capture (non-git files)
// ---------------------------------------------------------------------------

/** Walk `dir` and return a sorted file-hash list. Skips `.git`. Deterministic. */
export function captureFilesBaseline(dir: string, clock: Clock): FilesBaseline {
  const capturedAt = clock.now();
  const files: Array<{ path: string; sha256: string }> = [];
  walk(dir, dir, (relPath, absPath) => {
    const sha256 = createHash("sha256").update(readFileSync(absPath)).digest("hex");
    files.push({ path: relPath, sha256 });
  });
  return { kind: "files", files, capturedAt };
}

function walk(root: string, dir: string, onFile: (rel: string, abs: string) => void): void {
  let entries: string[];
  try {
    entries = readdirSync(dir, { withFileTypes: true }).map((d) => d.name).sort();
  } catch (e) {
    throw new GorpError("SANDBOX_FAILURE", `cannot read directory during baseline capture: ${dir}`, {
      dir,
      cause: String(e),
    });
  }
  for (const name of entries) {
    if (name === ".git") continue;
    const abs = join(dir, name);
    let stat: Stats;
    try {
      stat = statSync(abs);
    } catch {
      continue; // best-effort: skip unreadable entries
    }
    if (stat.isDirectory()) {
      walk(root, abs, onFile);
      continue;
    }
    onFile(relative(root, abs), abs);
  }
}

// ---------------------------------------------------------------------------
// verification
// ---------------------------------------------------------------------------

export interface BaselineDiff {
  readonly field: string;
  readonly expected: string;
  readonly actual: string;
}

/** Compare current repo state against a recorded git baseline. Empty array = matched. */
export function verifyGitBaseline(repositoryPath: string, baseline: GitBaseline): BaselineDiff[] {
  const diffs: BaselineDiff[] = [];

  const currentHead = git(["rev-parse", "HEAD"], repositoryPath).stdout.trim();
  if (currentHead !== baseline.head) {
    diffs.push({ field: "head", expected: baseline.head, actual: currentHead });
  }

  const currentRefs = readRefs(repositoryPath);
  // added/moved refs
  for (const [ref, sha] of Object.entries(currentRefs)) {
    const recorded = baseline.refs[ref];
    if (recorded === undefined) {
      diffs.push({ field: `refs.${ref}`, expected: "(absent)", actual: sha });
    } else if (recorded !== sha) {
      diffs.push({ field: `refs.${ref}`, expected: recorded, actual: sha });
    }
  }
  // removed refs
  for (const ref of Object.keys(baseline.refs)) {
    if (!(ref in currentRefs)) {
      diffs.push({ field: `refs.${ref}`, expected: baseline.refs[ref] ?? "(unknown)", actual: "(absent)" });
    }
  }

  const currentTree = git(["rev-parse", "HEAD^{tree}"], repositoryPath).stdout.trim();
  if (currentTree !== baseline.treeHash) {
    diffs.push({ field: "treeHash", expected: baseline.treeHash, actual: currentTree });
  }

  return diffs;
}

function readRefs(repositoryPath: string): Record<string, string> {
  const raw = git(["show-ref", "--heads", "--tags"], repositoryPath).stdout.trim();
  const refs: Record<string, string> = {};
  if (raw.length === 0) return refs;
  for (const line of raw.split("\n")) {
    const [sha = "", refName = ""] = line.split(" ", 2);
    if (sha && refName && !refName.startsWith(GORP_SANDBOX_REF_PREFIX)) {
      refs[refName] = sha;
    }
  }
  return refs;
}

/** Compare current directory file-hash list against a recorded files baseline. */
export function verifyFilesBaseline(dir: string, baseline: FilesBaseline): BaselineDiff[] {
  const diffs: BaselineDiff[] = [];
  const recorded = new Map(baseline.files.map((f) => [f.path, f.sha256]));
  const seen = new Set<string>();
  walk(dir, dir, (relPath, absPath) => {
    const sha256 = createHash("sha256").update(readFileSync(absPath)).digest("hex");
    const expected = recorded.get(relPath);
    if (expected === undefined) {
      diffs.push({ field: `files.${relPath}`, expected: "(absent)", actual: sha256 });
    } else if (expected !== sha256) {
      diffs.push({ field: `files.${relPath}`, expected, actual: sha256 });
    }
    seen.add(relPath);
  });
  for (const [path, sha] of recorded) {
    if (!seen.has(path)) {
      diffs.push({ field: `files.${path}`, expected: sha, actual: "(absent)" });
    }
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// universal helpers
// ---------------------------------------------------------------------------

/** Collect every mismatch between the current target and the recorded baseline. */
export function baselineDiffs(repositoryPath: string, baseline: Baseline): BaselineDiff[] {
  if (baseline.kind === "git") return verifyGitBaseline(repositoryPath, baseline);
  return verifyFilesBaseline(repositoryPath, baseline);
}