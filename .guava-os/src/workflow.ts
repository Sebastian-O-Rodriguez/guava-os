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
import { resolve, join } from "node:path";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { findRepoRoot } from "./config.js";
import { resolvePersona } from "./persona.js";

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
function callGorp(args: string[], extraEnv: Readonly<Record<string, string>> = {}): unknown {
  const cli = gorpCli();
  const env = {
    ...process.env,
    // Ensure gorp can find the registry (owned by guava-os)
    GORP_PROJECT_REGISTRY: process.env.GORP_PROJECT_REGISTRY ?? "",
    // Worker-profile env (GOS-46) resolved by the caller (e.g. orchestrate).
    ...extraEnv,
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

/** Resolve a worker profile (model + persona body) for EVERY persona used by a
 * graph, keyed by persona label (multi-persona orchestration).
 *
 * Fail closed: any missing persona file or unresolvable model is surfaced as
 * an error before the gorp orchestrate call — the scheduler never starts with
 * a missing or ambiguous profile.
 */
/** Resolve worker profiles (model + persona body) for every persona, keyed by
 * persona label (multi-persona orchestration). Pure: fails closed on a missing
 * persona file, missing model, or empty body.
 */
export function resolvePersonasBundle(
  personas: readonly string[],
  repoRoot: string,
): Record<string, { model: string; systemPrompt: string }> {
  const bundle: Record<string, { model: string; systemPrompt: string }> = {};
  for (const p of personas) {
    const resolved = resolvePersona(p, repoRoot); // fails closed on missing file/model/body
    bundle[p] = { model: resolved.model, systemPrompt: resolved.systemPrompt };
  }
  return bundle;
}

/** Resolve worker profiles for EVERY persona used by a graph (multi-persona). */
function resolveGraphPersonaBundle(
  projectId: string,
  graphId: string,
  repoRoot: string,
): Record<string, { model: string; systemPrompt: string }> {
  const show = callGorp(["graph", "show", "--project-id", projectId, "--graph-id", graphId]) as {
    data?: { nodes?: ReadonlyArray<{ persona?: string }> };
  };
  const personas = [
    ...new Set(
      (show?.data?.nodes ?? [])
        .map((n) => n?.persona)
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0),
    ),
  ].sort();
  return resolvePersonasBundle(personas, repoRoot);
}

/** orchestrate — start the scheduler loop on an approved graph.
 *
 * Resolves a worker profile for EVERY persona in the graph and passes the
 * bundle to gorp so each node's `run` dispatches under ITS OWN persona
 * (multi-persona graphs supported; the scheduler injects per-node env from the
 * bundle). A node with no persona (fixture) runs without profile env.
 */
export function orchestrate(projectId: string, graphId: string): unknown {
  const repoRoot = findRepoRoot();
  const bundle = resolveGraphPersonaBundle(projectId, graphId, repoRoot);
  if (Object.keys(bundle).length === 0) {
    return callGorp(["orchestrate", "--project-id", projectId, "--graph-id", graphId]);
  }
  const dir = mkdtempSync(join(tmpdir(), "gos-pers-"));
  const path = join(dir, "personas.json");
  writeFileSync(path, JSON.stringify(bundle), "utf-8");
  try {
    return callGorp(
      ["orchestrate", "--project-id", projectId, "--graph-id", graphId, "--persona-profiles", path],
      {},
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
export function orchestrateStatus(projectId: string, graphId: string): unknown {
  return callGorp(["orchestrate-status", "--project-id", projectId, "--graph-id", graphId]);
}

/** review — read-only inspection of a run. */
export function review(projectId: string, graphId: string, nodeId: string, opts: { runId?: string } = {}): unknown {
  const args = ["review", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId];
  if (opts.runId) args.push("--run-id", opts.runId);
  return callGorp(args);
}

/** inspect — read-only audit view of a run (incl. deterministic trace). */
export function inspect(projectId: string, graphId: string, nodeId: string, opts: { runId?: string } = {}): unknown {
  const args = ["inspect", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId];
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
export function promote(projectId: string, graphId: string, nodeId: string, actorId: string, opts: { runId?: string; overrideBaseline?: boolean } = {}): unknown {
  const args = ["promote", "--project-id", projectId, "--graph-id", graphId, "--node-id", nodeId, "--actor-id", actorId];
  if (opts.runId) args.push("--run-id", opts.runId);
  if (opts.overrideBaseline) args.push("--override-baseline");
  return callGorp(args);
}

/**
 * reconcile — desired-state reconciliation (GOS-43). Default (no --adopt /
 * --regenerate) is a READ-ONLY drift report over a compiled graph vs. a
 * current SprintDocument. Mutation requires an explicit operator decision
 * (--adopt overwrites the graph id; --regenerate writes a fresh graph) and
 * is refused on a running graph. Re-planning a fresh graph (sprint generate
 * -> wf plan) remains the supported baseline reconcile path; this surface
 * makes drift visible + explicit.
 */
export function reconcile(
  projectId: string,
  graphId: string,
  from: string,
  opts: { adopt?: boolean; regenerate?: boolean; actorId?: string; baseCommit?: string } = {},
): unknown {
  const args = ["reconcile", "--project-id", projectId, "--graph-id", graphId, "--from", from];
  if (opts.adopt) args.push("--adopt");
  if (opts.regenerate) args.push("--regenerate");
  if (opts.actorId) args.push("--actor-id", opts.actorId);
  if (opts.baseCommit) args.push("--base-commit", opts.baseCommit);
  return callGorp(args);
}