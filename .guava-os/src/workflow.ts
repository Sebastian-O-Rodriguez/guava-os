/**
 * guava-os workflow surface — thin wrappers over gorp CLI primitives.
 *
 * guava-os decides; gorp enforces (ADR_001). All wf commands dispatch the
 * gorp CLI through the SAME TypeScript loader guava-os itself runs under
 * (tsx). Gorp source uses ESM `.js` specifiers over `.ts` files, which
 * `--experimental-strip-types` cannot remap — the previous invocation broke
 * every wf command with ERR_MODULE_NOT_FOUND (GOS-27). `node --import tsx`
 * resolves those specifiers the same way the guava-os CLI is loaded.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// Resolve tsx from the repo root node_modules (same place guava-os CLI
// itself is loaded from). Cwd-based: the CLI documents running from the
// repo root, and gorpCli() below resolves the same way.
const requireFromRepo = createRequire(resolve(process.cwd(), "noop.js"));

/** Resolve the gorp CLI entrypoint. */
function gorpCli(): string {
  // From repo root: gorp/runtime/control/src/cli/main.ts
  const candidates = [
    resolve(process.cwd(), "gorp", "runtime", "control", "src", "cli", "main.ts"),
    resolve(process.cwd(), "..", "gorp", "runtime", "control", "src", "cli", "main.ts"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error("gorp CLI not found — run from the guava-os repo root");
}

let tsxLoader: string | undefined;
/** Resolve the tsx loader entry once (same loader the guava-os CLI uses). */
function resolveTsxLoader(): string {
  if (!tsxLoader) {
    try {
      tsxLoader = requireFromRepo.resolve("tsx");
    } catch {
      throw new Error(
        "tsx not installed — run `npm ci` at the guava-os repo root " +
        "(the wf surface spawns gorp through tsx; GOS-27)",
      );
    }
  }
  return tsxLoader;
}

/** Call gorp CLI with args; return parsed JSON result. */
function callGorp(args: string[]): unknown {
  const cli = gorpCli();
  const env = {
    ...process.env,
    // Ensure gorp can find the registry (owned by guava-os)
    GORP_PROJECT_REGISTRY: process.env.GORP_PROJECT_REGISTRY ?? "",
  };
  if (!env.GORP_PROJECT_REGISTRY) {
    throw new Error(
      "GORP_PROJECT_REGISTRY is not set — set it to .guava-os/registry/projects.yml",
    );
  }
  const stdout = execFileSync(
    process.execPath,
    ["--import", resolveTsxLoader(), cli, ...args],
    { env, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

// ── Workflow commands ─────────────────────────────────────────────────────

/** plan — build an approved execution request, compile it to a draft graph. */
export function plan(from: string, opts: { baseCommit?: string; overwrite?: boolean } = {}): unknown {
  const args = ["compile-graph", "--from", from];
  if (opts.baseCommit) args.push("--base-commit", opts.baseCommit);
  if (opts.overwrite) args.push("--overwrite");
  return callGorp(args);
}

/** orchestrate — start the scheduler loop on an approved graph. */
export function orchestrate(projectId: string, graphId: string): unknown {
  return callGorp(["orchestrate", "--project-id", projectId, "--graph-id", graphId]);
}

/** orchestrate-status — check scheduler state. */
export function orchestrateStatus(projectId: string, graphId: string): unknown {
  return callGorp(["orchestrate-status", "--project-id", projectId, "--graph-id", graphId]);
}

/** review — read-only inspection of a run. */
export function review(projectId: string, graphId: string, nodeId: string, opts: { runId?: string } = {}): unknown {
  const args = ["review", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}

/** approve — operator review decision: approve. */
export function approve(projectId: string, graphId: string, nodeId: string, actorId: string, reviewedCommit: string, reason: string, opts: { runId?: string } = {}): unknown {
  const args = ["approve", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId, "--actor-id", actorId, "--reviewed-commit", reviewedCommit, "--reason", reason];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}

/** reject — operator review decision: reject. */
export function reject(projectId: string, graphId: string, nodeId: string, actorId: string, reason: string, opts: { runId?: string } = {}): unknown {
  const args = ["reject", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId, "--actor-id", actorId, "--reason", reason];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}

/** retry — operator review decision: retry. */
export function retry(projectId: string, graphId: string, nodeId: string, actorId: string, reason: string, opts: { runId?: string } = {}): unknown {
  const args = ["retry", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId, "--actor-id", actorId, "--reason", reason];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}

/** promote — promote an approved, reviewed commit onto the target. */
export function promote(projectId: string, graphId: string, nodeId: string, actorId: string, opts: { runId?: string } = {}): unknown {
  const args = ["promote", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId, "--actor-id", actorId];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}