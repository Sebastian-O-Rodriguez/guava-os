/**
 * Project registry resolution.
 *
 * Execution state stores PROJECT IDENTITY ONLY (projectId) — never an
 * absolute repository path. The path is resolved at command time from the
 * project registry, which is owned by guava-os (`.guava-os/registry/
 * projects.yml`). gorp receives the registry path as explicit input
 * (`GORP_PROJECT_REGISTRY` env); gorp has no internal default — fail closed
 * if unset.
 *
 *   override: GORP_PROJECT_REGISTRY (path to a registry file)
 *
 * The registry is the single id -> repo_path authority. Fail closed on a
 * missing registry, an unregistered project, or a missing repo_path — never
 * guess a path.
 *
 * Parsing: the registry is a deliberately small YAML subset (a `projects:`
 * list of flat scalar maps). This module parses exactly that shape and
 * nothing more; anything unexpected for the fields it needs fails closed.
 */


import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { GorpError } from "../errors/index.js";

/** Canonical bootstrap order referenced by every fail-closed error. */
const BOOTSTRAP_ORDER =
  "bootstrap order: create minimal repo → register (with git_remote) → execute/scaffold";
export interface RegisteredProject {
  readonly id: string;
  readonly repoPath: string;
}

export function registryPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env["GORP_PROJECT_REGISTRY"];
  if (!override || override.trim().length === 0) {
    throw new GorpError(
      "PROJECT_NOT_REGISTERED",
      "GORP_PROJECT_REGISTRY is not set — gorp has no internal default; the registry is owned by guava-os",
      {},
    );
  }
  return resolve(override.trim());
}

function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Parse the `projects:` list out of the registry file. Only `- id:` items and
 * their scalar `key: value` lines are read; unknown keys are ignored.
 */
export function parseProjectsRegistry(raw: string): readonly RegisteredProject[] {
  const projects: Array<{ id?: string; repoPath?: string }> = [];
  let inProjects = false;
  let current: { id?: string; repoPath?: string } | null = null;
  for (const line of raw.split("\n")) {
    const noComment = line.replace(/\s+#.*$/, "");
    if (/^projects:\s*$/.test(noComment)) {
      inProjects = true;
      continue;
    }
    if (!inProjects) continue;
    // A new top-level key ends the projects list.
    if (/^[A-Za-z0-9_-]+:/.test(noComment)) {
      inProjects = false;
      continue;
    }
    const item = noComment.match(/^\s*-\s+id:\s*(\S+)\s*$/);
    if (item && item[1]) {
      current = { id: item[1] };
      projects.push(current);
      continue;
    }
    const kv = noComment.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv && current && kv[1] === "repo_path") {
      current.repoPath = (kv[2] ?? "").trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return projects.filter((p): p is { id: string; repoPath: string } => Boolean(p.id));
}

/**
 * Resolve a projectId to its absolute repository path. Fail closed on any
 * miss: an execution command must never invent or guess a repository path.
 */
export function resolveProjectRepoPath(projectId: string, env: NodeJS.ProcessEnv = process.env): string {
  const path = registryPath(env);
  if (!existsSync(path)) {
    throw new GorpError("PROJECT_NOT_REGISTERED", `project registry file not found — ${BOOTSTRAP_ORDER}`, {
      projectId,
      registry: path,
    });
  }
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new GorpError("PROJECT_NOT_REGISTERED", "cannot read project registry", {
      projectId,
      registry: path,
      cause: String(e),
    });
  }
  const entry = parseProjectsRegistry(raw).find((p) => p.id === projectId);
  if (!entry) {
    throw new GorpError("PROJECT_NOT_REGISTERED", `project is not registered in the project registry — ${BOOTSTRAP_ORDER}`, {
      projectId,
      registry: path,
    });
  }
  if (!entry.repoPath || entry.repoPath.length === 0) {
    throw new GorpError("PROJECT_NOT_REGISTERED", `registered project has no repo_path — ${BOOTSTRAP_ORDER}`, {
      projectId,
      registry: path,
    });
  }
  const expanded = expandHome(entry.repoPath);
  const abs = isAbsolute(expanded) ? expanded : resolve(expanded);
  if (!existsSync(abs)) {
    throw new GorpError("PROJECT_NOT_REGISTERED", `registered repo_path does not exist on this machine — ${BOOTSTRAP_ORDER}`, {
      projectId,
      registry: path,
      repoPath: abs,
    });
  }
  return abs;
}
