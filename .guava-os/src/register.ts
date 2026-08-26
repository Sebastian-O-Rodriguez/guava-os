/**
 * Project registration (GOS-34 / GUA-116).
 *
 * Canonical bootstrap order for any governed project:
 *
 *   1. create minimal repo        (git init a real directory)
 *   2. register (with git_remote)  (record the canonical remote, GOS-31)
 *   3. execute/scaffold            (only now is an execution-ready issue present)
 *
 * `register` enforces steps 1–2: it creates-or-checks the repo directory
 * (git init when missing) and records the canonical git_remote both in the
 * local `origin` and in the project registry (`.guava-os/registry/
 * projects.yml`). It then converges the repo at birth — migrating the config
 * to the new-schema domain model (domains / domainAgents / types / readiness)
 * and linking the canonical skill store into `.omp/skills`. Execution still
 * fails closed — never invents a path and refuses to run against a repo dir
 * that does not exist.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { resolveRegistryPath } from "./registry.js";
import { migrateConfig, reconcileSymlinks } from "./sync.js";

export interface RegisterResult {
  readonly id: string;
  /** repo_path as recorded in the registry (as passed by the caller). */
  readonly repoPath: string;
  /** Absolute, `~`-expanded repo directory on this machine. */
  readonly repoPathAbs: string;
  readonly gitRemote?: string;
  /** True when the repo directory (or its .git) did not already exist. */
  readonly createdRepo: boolean;
  /** True when a new registry entry was appended (false = existing entry updated). */
  readonly entryCreated: boolean;
  readonly registryPath: string;
}

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Ensure the repo directory exists and is a git repository. Creates the
 * directory and `git init`s it when missing. Returns true when the directory
 * had to be created.
 */
function ensureRepoDir(abs: string): boolean {
  if (existsSync(abs)) {
    if (!existsSync(join(abs, ".git"))) {
      execFileSync("git", ["init", "-q"], { cwd: abs, stdio: "ignore" });
    }
    return false;
  }
  mkdirSync(abs, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: abs, stdio: "ignore" });
  return true;
}

/** Record the canonical remote as `origin` (add or update). */
function setOrigin(abs: string, url: string): void {
  try {
    execFileSync("git", ["-C", abs, "remote", "set-url", "origin", url], {
      stdio: "ignore",
    });
  } catch {
    execFileSync("git", ["-C", abs, "remote", "add", "origin", url], {
      stdio: "ignore",
    });
  }
}

const ID_RE = /^(\s*)-\s+id:\s*(.+?)\s*$/;
const FIELD_RE = /^(\s*)([A-Za-z0-9_]+):\s*(.*)$/;

/**
 * Append or update a registry entry. Returns whether a NEW entry was appended
 * (false = an existing entry was updated in place). Additive: existing entries
 * (including their git_remote backfill) are left untouched.
 */
function upsertRegistryEntry(
  registryPath: string,
  id: string,
  repoPath: string,
  gitRemote: string | undefined,
): { created: boolean } {
  const raw = existsSync(registryPath)
    ? readFileSync(registryPath, "utf8")
    : "projects:\n";
  const lines = raw.split("\n");

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(ID_RE);
    if (m && m[2] === id) {
      start = i;
      break;
    }
  }

  if (start >= 0) {
    // Locate the end of this entry block (next `- id:`, or a top-level key).
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      const nextEntry = lines[i].match(ID_RE);
      const topLevel = /^[A-Za-z0-9_-]+:/.test(lines[i]) && !/^\s/.test(lines[i]);
      if (nextEntry || topLevel) {
        end = i;
        break;
      }
    }

    const idLine = lines[start];
    const indent = idLine.match(/^(\s*)/)?.[1] ?? "";
    const fieldIndent = `${indent}  `;
    const kept: string[] = [];
    for (let i = start + 1; i < end; i++) {
      const m = lines[i].match(FIELD_RE);
      if (m && m[2] === "repo_path") continue; // always replaced
      if (m && m[2] === "git_remote" && gitRemote) continue; // replaced when provided
      kept.push(lines[i]);
    }
    const block = [
      idLine,
      `${fieldIndent}repo_path: ${repoPath}`,
      ...(gitRemote ? [`${fieldIndent}git_remote: ${gitRemote}`] : []),
      ...kept,
    ];
    const next = [...lines.slice(0, start), ...block, ...lines.slice(end)];
    writeFileSync(registryPath, next.join("\n") + "\n", "utf8");
    return { created: false };
  }

  // New entry: append after the last line (entries are contiguous in projects.yml).
  const trimmed = [...lines];
  while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") {
    trimmed.pop();
  }
  trimmed.push(
    `  - id: ${id}`,
    `    repo_path: ${repoPath}`,
    ...(gitRemote ? [`    git_remote: ${gitRemote}`] : []),
    `    lifecycle: active`,
  );
  writeFileSync(registryPath, trimmed.join("\n") + "\n", "utf8");
  return { created: true };
}

/** Canonical skill store — the single source of truth every repo links from. */
const DEFAULT_CANONICAL_SKILLS_DIR = join(homedir(), ".agents", "skills");

/**
 * Converge a freshly registered repo at birth, reusing the sync engine:
 *
 *   - migrate the raw config to the new-schema domain model
 *     (domains / domainAgents / types / readiness); write it back on drift
 *   - link every canonical skill into the repo's `.omp/skills`
 *
 * Labels need no write here: Linear issue labels are workspace-global, so the
 * canonical type/readiness/domain set already exists for any repo in the same
 * workspace. A new-schema config therefore makes the repo label-complete.
 */
function convergeRepo(abs: string, canonicalSkillsDir: string): void {
  // Config → new-schema (idempotent; only rewritten on drift or first write).
  const configDir = join(abs, ".guava-os");
  const configPath = join(configDir, "config.json");
  const raw: unknown = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf8"))
    : {};
  const migrated = migrateConfig(raw);
  if (migrated.changes.length > 0 || !existsSync(configPath)) {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify(migrated.config, null, 2) + "\n", "utf8");
  }

  // Canonical skills → `<repo>/.omp/skills` (the dir `sync` reconciles).
  const skillsDir = join(abs, ".omp", "skills");
  const { add } = reconcileSymlinks(skillsDir, canonicalSkillsDir);
  if (add.length === 0) return;
  mkdirSync(skillsDir, { recursive: true });
  for (const name of add) {
    const link = join(skillsDir, name);
    if (!existsSync(link)) {
      symlinkSync(join(canonicalSkillsDir, name), link);
    }
  }
}

/**
 * Register a project: create-or-check the repo, record the canonical remote,
 * and append/update the registry entry. Pure core — no stdout.
 */
export function registerProject(
  id: string,
  repoPath: string,
  gitRemote?: string,
  registryPath?: string,
  canonicalSkillsDir?: string,
): RegisterResult {
  const abs = isAbsolute(expandHome(repoPath))
    ? expandHome(repoPath)
    : resolve(expandHome(repoPath));
  const createdRepo = ensureRepoDir(abs);
  if (gitRemote) setOrigin(abs, gitRemote);

  const regPath = resolveRegistryPath(registryPath);
  const { created } = upsertRegistryEntry(regPath, id, repoPath, gitRemote);

  convergeRepo(abs, canonicalSkillsDir ?? DEFAULT_CANONICAL_SKILLS_DIR);

  return {
    id,
    repoPath,
    repoPathAbs: abs,
    gitRemote,
    createdRepo,
    entryCreated: created,
    registryPath: regPath,
  };
}

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function formatRegister(r: RegisterResult): string {
  const lines = [
    `registered ${r.id}`,
    `repo:      ${r.repoPathAbs}${r.createdRepo ? " (created — git init)" : ""}`,
    `remote:    ${r.gitRemote ?? "(none)"}`,
    `registry:  ${r.registryPath} (${r.entryCreated ? "entry added" : "entry updated"})`,
  ];
  return lines.join("\n");
}

/**
 * Run `guava-os register <id> --repo <path> [--remote <url>]`.
 */
export function runRegister(args: string[], jsonMode: boolean): RegisterResult {
  const id = args[0];
  if (!id) {
    throw new Error(
      "register: <id> is required — guava-os register <id> --repo <path> [--remote <url>]",
    );
  }
  const repoPath = flag(args, "--repo");
  if (!repoPath) {
    throw new Error("register: --repo <path> is required (the repo dir to create-or-check)");
  }
  const gitRemote = flag(args, "--remote");
  const result = registerProject(id, repoPath, gitRemote);

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatRegister(result));
  }
  return result;
}
