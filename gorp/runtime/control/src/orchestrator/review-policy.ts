/**
 * Review policy plug-in (Sprint 3C): auto-approve is dead.
 *
 * The scheduler no longer approves anything on its own: every approval goes
 * through an explicit ReviewPolicy. The policy sees only re-discovered facts
 * (worker adapter, gate verdict, artifact hash, changed files) and returns a
 * machine decision: approve — or stop and hand the review to a human.
 *
 * Only the fixture policy exists today:
 *   - workerAdapter "fixture" AND gate passed  -> approve (the fixture worker
 *     is deterministic; its gate-passed output is by construction the
 *     expected artifact set, so machine approval is defensible);
 *   - anything else -> stop (a non-deterministic worker's output must be
 *     reviewed by a human; no policy may pretend otherwise yet).
 *
 * Like the scheduler, this module imports ONLY node builtins/types — no
 * runtime internals.
 */

export interface ReviewPolicyContext {
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId: string;
  readonly workerAdapter: string;
  readonly gateStatus: "passed" | "failed" | "unknown";
  readonly artifactHash: string | null;
  readonly changedFiles: readonly string[];
}

export type ReviewPolicyDecision =
  | { readonly action: "approve"; readonly reason: string }
  | { readonly action: "stop"; readonly reason: string };

export interface ReviewPolicy {
  readonly name: string;
  decide(ctx: ReviewPolicyContext): ReviewPolicyDecision;
}

/** Approve deterministic fixture output with a passed gate; stop for all else. */
export const fixtureReviewPolicy: ReviewPolicy = {
  name: "fixture",
  decide(ctx) {
    if (ctx.gateStatus !== "passed") {
      return { action: "stop", reason: `gate status is '${ctx.gateStatus}', not 'passed'` };
    }
    if (!ctx.artifactHash) {
      return { action: "stop", reason: "no artifact hash to bind an approval to" };
    }
    if (ctx.workerAdapter !== "fixture") {
      return {
        action: "stop",
        reason: `worker adapter '${ctx.workerAdapter}' requires human review; the fixture policy only approves deterministic fixture output`,
      };
    }
    return {
      action: "approve",
      reason: "fixture policy: deterministic fixture worker output with a passed gate",
    };
  },
};

const POLICIES: ReadonlyMap<string, ReviewPolicy> = new Map([[fixtureReviewPolicy.name, fixtureReviewPolicy]]);

export function implementedReviewPolicies(): readonly string[] {
  return [...POLICIES.keys()];
}

/** Resolve by name; unknown policy is a hard error (never a silent default). */
export function resolveReviewPolicy(name: string): ReviewPolicy {
  const policy = POLICIES.get(name);
  if (!policy) {
    throw new Error(
      `unknown review policy '${name}' (implemented: ${implementedReviewPolicies().join(", ")})`,
    );
  }
  return policy;
}
