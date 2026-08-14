/**
 * Git-worktree sandbox (Wave B).
 *
 * The sandbox directory lives under the machine-local Gorp state root — never
 * inside the consumer working tree. Creating a worktree necessarily registers
 * git-native metadata (a branch ref and .git/worktrees entry) in the consumer
 * repository's .git directory; the consumer WORKING TREE is never touched and
 * `git status` in the consumer stays clean.
 *
 * Lifecycle: destroy on failure (worktree + branch removed); keep on success
 * so `gorp review` can present the diff.
 *
 * Shell is used only at this operating-system boundary (git invocation); all
 * git calls are synchronous — no background jobs.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { GorpError } from "../errors/index.js";

export interface GitResult {
  readonly stdout: string;
}

/**
 * Max stdout buffer for sandbox git commands. `git diff` (read-only, used by
 * review/inspect) can legitimately produce multi-MB output for a large worker
 * diff (e.g. a 4.9 MB lighthouse/verification JSON). Node's default 1 MiB
 * maxBuffer would overflow it; the diff is bounded DOWNSTREAM in review.ts,
 * so this only raises the fetch ceiling. Matches guava-os callGorp's 10 MiB.
 */
const GIT_MAX_BUFFER = 10 * 1024 * 1024;

export function git(args: readonly string[], cwd: string, env?: Readonly<Record<string, string>>): GitResult {
  try {
    const stdout = execFileSync("git", args as string[], {
      cwd,
      encoding: "utf8",
      maxBuffer: GIT_MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
      env: env ? { ...process.env, ...env } : process.env,
    });
    return { stdout };
  } catch (e) {
    const err = e as { status?: number; stderr?: string; message?: string };
    throw new GorpError("SANDBOX_FAILURE", `git ${args[0] ?? ""} failed`, {
      args,
      cwd,
      exitCode: err.status ?? null,
      stderr: (err.stderr ?? err.message ?? "").toString().slice(0, 2000),
    });
  }
}

export interface Sandbox {
  readonly dir: string;
  readonly branch: string;
  readonly repositoryPath: string;
  readonly baseCommit: string;
}

/** Fail-closed preconditions: repo is a git repo, base commit exists in it. */
export function assertSandboxPreconditions(repositoryPath: string, baseCommit: string): void {
  if (!existsSync(repositoryPath)) {
    throw new GorpError("SANDBOX_FAILURE", "repository path does not exist", { repositoryPath });
  }
  git(["rev-parse", "--git-dir"], repositoryPath);
  const type = git(["cat-file", "-t", baseCommit], repositoryPath).stdout.trim();
  if (type !== "commit") {
    throw new GorpError("SANDBOX_FAILURE", "base commit is not a commit in the repository", {
      baseCommit,
      objectType: type,
    });
  }
}

/** Create an isolated worktree on a new branch at the recorded base commit. */
export function createSandbox(
  repositoryPath: string,
  baseCommit: string,
  dir: string,
  branch: string,
): Sandbox {
  assertSandboxPreconditions(repositoryPath, baseCommit);
  if (existsSync(dir)) {
    throw new GorpError("SANDBOX_FAILURE", "sandbox directory already exists", { dir });
  }
  git(["worktree", "add", "-b", branch, dir, baseCommit], repositoryPath);
  return { dir, branch, repositoryPath, baseCommit };
}

/** Destroy the sandbox: remove the worktree and its branch. Best-effort but loud on git errors we can detect. */
export function destroySandbox(sandbox: Sandbox): void {
  try {
    git(["worktree", "remove", "--force", sandbox.dir], sandbox.repositoryPath);
  } catch {
    // Fall back to raw removal + prune so a broken worktree cannot linger.
    rmSync(sandbox.dir, { recursive: true, force: true });
    try {
      git(["worktree", "prune"], sandbox.repositoryPath);
    } catch {
      /* best-effort */
    }
  }
  try {
    git(["branch", "-D", sandbox.branch], sandbox.repositoryPath);
  } catch {
    /* branch may not exist if creation failed early */
  }
}

/** HEAD commit of the sandbox. */
export function sandboxHead(sandbox: Sandbox): string {
  return git(["rev-parse", "HEAD"], sandbox.dir).stdout.trim();
}

/** True when the sandbox has no uncommitted or untracked changes. */
export function sandboxIsClean(sandbox: Sandbox): boolean {
  return git(["status", "--porcelain"], sandbox.dir).stdout.trim() === "";
}

/**
 * Changed files between the recorded base and the sandbox HEAD, independently
 * computed from git (never trusted from the worker's own claim).
 */
export function sandboxChangedFiles(sandbox: Sandbox): readonly string[] {
  const out = git(["diff", "--name-only", `${sandbox.baseCommit}..HEAD`], sandbox.dir).stdout;
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort();
}

/** Full patch between base and HEAD (read-only; used by review). */
export function sandboxDiff(sandbox: Sandbox): string {
  return git(["diff", `${sandbox.baseCommit}..HEAD`], sandbox.dir).stdout;
}

/**
 * Every path with ANY change against the base commit — committed, modified in
 * the worktree, or untracked. Unlike `sandboxChangedFiles` (which only sees
 * `base..HEAD`, i.e. committed changes), this also captures the uncommitted
 * work a worker leaves behind when it fails mid-flight (e.g. an OMP worker
 * that wrote files but timed out before the adapter could commit them).
 *
 * Used by the failure path (GOS-51) to preserve partial in-scope artifacts as
 * reviewable evidence before the sandbox is destroyed.
 */
export function sandboxAllChangedFiles(sandbox: Sandbox): readonly string[] {
  const committed = git(["diff", "--name-only", `${sandbox.baseCommit}..HEAD`], sandbox.dir).stdout;
  // `status --porcelain` covers modified + untracked worktree entries (the
  // commit never happened, so base..HEAD is empty). The two-space-status
  // prefix is stripped; renames (`R  old -> new`) collapse to the new path.
  const status = git(["status", "--porcelain"], sandbox.dir).stdout;

  const files = new Set<string>();
  for (const line of committed.split("\n")) {
    const f = line.trim();
    if (f.length > 0) files.add(f);
  }
  for (const line of status.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length < 4) continue;
    const path = trimmed.slice(3);
    if (path.length > 0) files.add(path);
  }
  return [...files].sort();
}
