/**
 * Minimum deterministic validation gate (Wave B): scope only.
 *
 *  - sandbox-clean: every change is captured in the sandbox commit
 *  - changed-files-in-allowed-scope: each changed file matches allowedPaths
 *  - no-forbidden-paths: no changed file matches forbiddenPaths
 *
 * Changed files are computed independently from git — the worker's own claim
 * is never trusted. Fails closed: any indeterminate condition is a failure.
 */

import type { GateCheck, GateRecord, GraphNode } from "../contracts/types.js";

/**
 * Minimal deterministic glob: `**` matches across path separators, `*` matches
 * within a segment. All other characters are literal.
 */
export function globToRegExp(pattern: string): RegExp {
  let rx = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        rx += ".*";
        i++;
      } else {
        rx += "[^/]*";
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      rx += `\\${c}`;
    } else {
      rx += c;
    }
  }
  return new RegExp(`^${rx}$`);
}

export function matchesAny(file: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(file));
}

export interface ScopeGateInput {
  readonly graphId: string;
  readonly node: GraphNode;
  readonly runId: string;
  readonly changedFiles: readonly string[]; // computed from git, not the worker
  readonly sandboxClean: boolean;
  readonly artifactHash: string; // sandbox HEAD commit
}

/** The three deterministic scope checks. Pure. */
export function scopeChecks(input: ScopeGateInput): GateCheck[] {
  const { node, changedFiles } = input;
  const checks: GateCheck[] = [];

  checks.push(
    input.sandboxClean
      ? { name: "sandbox-clean", status: "passed" }
      : {
          name: "sandbox-clean",
          status: "failed",
          detail: "sandbox has uncommitted or untracked changes; changed-file set is indeterminate",
        },
  );

  const outOfScope = changedFiles.filter((f) => !matchesAny(f, node.allowedPaths));
  checks.push(
    outOfScope.length === 0
      ? { name: "changed-files-in-allowed-scope", status: "passed" }
      : {
          name: "changed-files-in-allowed-scope",
          status: "failed",
          detail: `out of scope: ${outOfScope.join(", ")}`,
        },
  );

  const forbidden = changedFiles.filter((f) => matchesAny(f, node.forbiddenPaths));
  checks.push(
    forbidden.length === 0
      ? { name: "no-forbidden-paths", status: "passed" }
      : {
          name: "no-forbidden-paths",
          status: "failed",
          detail: `forbidden: ${forbidden.join(", ")}`,
        },
  );

  return checks;
}

/** Assemble the (schema-shaped) gate record from any check set. Pure. */
export function buildGateRecord(input: ScopeGateInput, checks: readonly GateCheck[]): GateRecord {
  const status = checks.every((c) => c.status === "passed") ? "passed" : "failed";
  return {
    schemaVersion: 1,
    graphId: input.graphId,
    nodeId: input.node.nodeId,
    runId: input.runId,
    validation: { status, checks: [...checks], artifactHash: input.artifactHash },
    review: { status: "pending" },
  };
}

/** Scope-only gate (used by run before command checks, and by promote's live rerun). */
export function runScopeGate(input: ScopeGateInput): GateRecord {
  return buildGateRecord(input, scopeChecks(input));
}
