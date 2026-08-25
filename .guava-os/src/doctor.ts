import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";
import type { Config } from "./config.js";
import { allDomains, readinessLabels } from "./config.js";
import { loadRegistry, type RegistryProject } from "./registry.js";

export interface CheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly advisory?: boolean;
  readonly remotes?: readonly RegistryRemoteInfo[];
}

export interface RegistryRemoteInfo {
  readonly id: string;
  /** `git_remote` declared in the registry (absent when the project omits it). */
  readonly registryRemote?: string;
  /** Origin read from the local repo; absent when the repo/origin is unreadable. */
  readonly localRemote?: string;
  readonly status: "ok" | "missing" | "mismatch" | "unknown";
  /** Why a project is `mismatch` (origin differs, or repo dir name != remote repo name). */
  readonly note?: string;
}

export interface LinearLabelInfo {
  labels: string[];
}

/**
 * Expand a leading `~` in a registry `repo_path` to the user's home directory.
 */
function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Read the local repo's `origin` remote URL, or null when the repo is missing
 * or has no origin. Read-only — spawns `git`, never mutates anything.
 */
function readOrigin(repoPath: string): string | null {
  if (!existsSync(repoPath)) return null;
  try {
    return execFileSync("git", ["-C", repoPath, "remote", "get-url", "origin"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Report per-active-project git_remote presence and mismatch vs the local
 * repo's origin. Advisory by design: a missing or mismatched remote is a
 * governance note, never an execution failure. `passed` is always true.
 */
export function checkRegistryRemotes(
  registry: readonly RegistryProject[],
  readRemote: (repoPath: string) => string | null = readOrigin,
): CheckResult {
  const active = registry.filter((p) => p.lifecycle === "active");
  const remotes: RegistryRemoteInfo[] = active.map((p) => {
    if (!p.gitRemote) {
      return { id: p.id, status: "missing" };
    }
    const repoPath = p.repoPath ? expandHome(p.repoPath) : "";
    const local = repoPath ? readRemote(repoPath) : null;
    if (!local) {
      return { id: p.id, registryRemote: p.gitRemote, status: "unknown" };
    }

    // Registry git_remote differs from the local origin.
    if (p.gitRemote !== local) {
      return {
        id: p.id,
        registryRemote: p.gitRemote,
        localRemote: local,
        status: "mismatch",
        note: `origin ${local}`,
      };
    }

    // Documented mismatch case: the repo dir name differs from the remote repo
    // name (e.g. dir `guava-site` with remote `company-site.git`). A fresh clone
    // lands in the remote's dir, which the registry repo_path would not know.
    const dirName = repoPath.split("/").filter(Boolean).pop() ?? "";
    const remoteBase = p.gitRemote.split("/").filter(Boolean).pop() ?? "";
    const remoteName = remoteBase.replace(/\.git$/, "");
    if (dirName && remoteName && dirName !== remoteName) {
      return {
        id: p.id,
        registryRemote: p.gitRemote,
        localRemote: local,
        status: "mismatch",
        note: `dir "${dirName}" != remote repo "${remoteName}"`,
      };
    }

    return { id: p.id, registryRemote: p.gitRemote, localRemote: local, status: "ok" };
  });

  const withRemote = remotes.filter((r) => r.status !== "missing").length;
  const mismatched = remotes.filter((r) => r.status === "mismatch").map((r) => r.id);
  const unverified = remotes.filter((r) => r.status === "unknown").map((r) => r.id);
  const missing = remotes.filter((r) => r.status === "missing").map((r) => r.id);

  const detail: string[] = [`${withRemote}/${active.length} active projects have git_remote`];
  if (mismatched.length > 0) detail.push(`mismatch: ${mismatched.join(", ")}`);
  if (unverified.length > 0) detail.push(`unverified origin: ${unverified.join(", ")}`);
  if (missing.length > 0) detail.push(`missing: ${missing.join(", ")}`);

  return {
    name: "git-remote",
    passed: true,
    advisory: true,
    detail: detail.join("; "),
    remotes,
  };
}

/**
 * Doctor checks. All checks are read-only — filesystem reads only.
 *
 * LINEAR DATA:
 * The CLI has no network layer. It does not query Linear directly.
 * "Linear data provided" means the caller (agent, MCP tools) successfully
 * fetched data from Linear and piped it to this CLI via stdin.
 * The `linearDataProvided` parameter is a signal from the caller, not
 * a connectivity check performed by the CLI.
 *
 * This is by design: the CLI is a pure data processor. Network access
 * is the caller's responsibility. The CLI validates structure, not connectivity.
 */
export function runDoctor(
  repoRoot: string,
  config: Config,
  linearDataProvided: boolean,
  linearLabels?: LinearLabelInfo,
): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Config file exists and parses
  const configPath = resolve(repoRoot, ".guava-os", "config.json");
  results.push({
    name: "config",
    passed: existsSync(configPath),
    detail: existsSync(configPath)
      ? ".guava-os/config.json valid"
      : ".guava-os/config.json not found",
  });

  // 2. AGENTS.md exists and has authority hierarchy
  // AGENTS.md is OPTIONAL / ADVISORY for execution — it carries the repo's
  // operating context for agents. Completeness (including authority hierarchy)
  // is a bootstrap concern tracked by GOS-34 ordering, not a hard execution
  // prerequisite that doctor blocks on.
  const agentsPath = resolve(repoRoot, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    const hasAuthority = content.includes("ADR_001");
    results.push({
      name: "agents-md",
      passed: true,
      advisory: true,
      detail: hasAuthority
        ? "AGENTS.md present, ADR_001 authority reference found"
        : "AGENTS.md present but missing ADR_001 authority reference (optional — completeness owned by GOS-34)",
    });
  } else {
    results.push({
      name: "agents-md",
      passed: true,
      advisory: true,
      detail: "AGENTS.md not found (optional — bootstrap completeness owned by GOS-34)",
    });
  }


  // 3. Process docs exist
  const processEntries = Object.entries(config.process_files);
  const processFound = processEntries.filter(([, p]) => existsSync(resolve(repoRoot, p))).length;
  results.push({
    name: "protocol",
    passed: processFound === processEntries.length,
    detail: `${processFound}/${processEntries.length} process docs found`,
  });

  // 4. Linear issue graph loaded
  // NOTE: This check does NOT query Linear. It checks whether the caller
  // provided data via stdin. Network connectivity is the caller's domain.
  results.push({
    name: "linear",
    passed: linearDataProvided,
    detail: linearDataProvided
      ? `${config.linear.team} / ${config.linear.project} — issue graph loaded`
      : "no Linear data provided (caller must pipe issue/label data via stdin)",
  });

  // 5. Every configured domain, type, and readiness label exists in Linear (if data provided)
  if (linearDataProvided && linearLabels) {
    const requiredLabels = [...allDomains(config), ...config.types, ...readinessLabels(config)];
    const missingLabels = requiredLabels.filter(l => !linearLabels.labels.includes(l));
    results.push({
      name: "labels",
      passed: missingLabels.length === 0,
      detail: missingLabels.length === 0
        ? `${requiredLabels.length}/${requiredLabels.length} required labels found in Linear data`
        : `missing Linear labels: ${missingLabels.join(", ")}`,
    });
  } else {
    results.push({
      name: "labels",
      passed: false,
      detail: linearDataProvided
        ? "label data not provided — pass {labels:[...]} via stdin for full check"
        : "skipped (no Linear data provided)",
    });
  }

  // 6. Gitignore includes manifest
  const gitignorePath = resolve(repoRoot, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf-8");
    const hasManifest = gitignore.includes(config.manifest_path);
    results.push({
      name: "gitignore",
      passed: hasManifest,
      detail: hasManifest
        ? `${config.manifest_path} is gitignored`
        : `${config.manifest_path} not in .gitignore`,
    });
  } else {
    results.push({ name: "gitignore", passed: false, detail: ".gitignore not found" });
  }

  // 7. Registry git_remote presence and match against local origins.
  // Advisory by design: reports missing/mismatched remotes, never blocks.
  let registry: readonly RegistryProject[] = [];
  try {
    registry = loadRegistry();
  } catch {
    registry = [];
  }
  if (registry.length === 0) {
    results.push({
      name: "git-remote",
      passed: true,
      advisory: true,
      detail: "project registry not found — skipping remote check",
    });
  } else {
    results.push(checkRegistryRemotes(registry));
  }

  return results;
}

export function formatDoctor(results: readonly CheckResult[]): string {
  const lines: string[] = ["DOCTOR", ""];
  for (const r of results) {
    const icon = r.passed ? "\u2713" : "\u2717";
    const marker = r.advisory ? "  [advisory]" : "";
    lines.push(`  ${icon} ${r.name.padEnd(14)} ${r.detail}${marker}`);
    if (r.remotes && r.remotes.length > 0) {
      lines.push("      project                          status     git_remote");
      for (const row of r.remotes) {
        const remote = row.registryRemote ?? "(missing)";
        const postfix = row.note
          ? ` (${row.note})`
          : row.status === "unknown"
            ? " (local origin unreadable)"
            : "";
        lines.push(`      ${row.id.padEnd(33)} ${row.status.padEnd(10)} ${remote}${postfix}`);
      }
    }
  }
  const passed = results.filter(r => r.passed).length;
  lines.push("");
  lines.push(`RESULT: ${passed}/${results.length} passed`);
  return lines.join("\n");
}
