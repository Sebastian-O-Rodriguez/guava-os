/**
 * First orchestrator (Sprint 3A): a single-process, single-graph,
 * no-concurrency scheduler loop.
 *
 *   find ready node -> run -> (inspect) -> approve path -> promote -> repeat;
 *   when all nodes terminal -> complete graph.
 *
 * DESIGN CONSTRAINT — public surface only: this module imports NOTHING from
 * the runtime (only node builtins). Every action is a `node <cli> …`
 * subprocess; every decision is derived from re-discovered state (`graph
 * show`, `review`, `inspect`). The scheduler keeps NO memory between steps
 * beyond its own step log: each iteration is equivalent to a crash + restart,
 * which is exactly what the orchestrator-readiness proof validated. The
 * runtime's invariants (duplicate refusal, dependency policy, completion
 * guard) — not scheduler memory — are what make this safe.
 *
 * Stop conditions (machine state printed, no guessing): graph cancelled
 * (reject path), graph failed, interrupted-run recovery state, blocked node,
 * any refused/failed command, wedge (no derivable action), step cap.
 *
 * No external worker retries, no concurrency, no operator judgement: the approve
 * path re-reads the reviewed commit from the read-only `review` output and
 * approves it verbatim (single-operator automation; a human review policy
 * replaces this hook later).
 */

import { execFileSync } from "node:child_process";
import { fixtureReviewPolicy, type ReviewPolicy } from "./review-policy.js";

export interface SchedulerOptions {
  /** Path to the compiled CLI (dist/cli/main.js). */
  readonly cli: string;
  readonly projectId: string;
  readonly graphId: string;
  readonly actorId?: string;
  /** Extra environment (e.g. GORP_STATE_HOME) merged over process.env. */
  readonly env?: Readonly<Record<string, string>>;
  /** Safety cap; also enables crash simulation (run N steps, then restart). */
  readonly maxSteps?: number;
  /**
   * Review policy (Sprint 3C). There is NO auto-approve: every approval goes
   * through the policy; a `stop` decision halts the scheduler with machine
   * state so a human can review. Default: fixture policy (approves only
   * deterministic fixture output with a passed gate).
   */
  readonly reviewPolicy?: ReviewPolicy;
}

export interface CliEnvelope {
  readonly exitCode: number;
  readonly success: boolean;
  readonly command?: string;
  readonly data?: unknown;
  readonly error?: { code: string; message: string; details: Record<string, unknown> };
}

export type StepAction =
  | { readonly kind: "run"; readonly nodeId: string }
  | { readonly kind: "approve"; readonly nodeId: string }
  | { readonly kind: "promote"; readonly nodeId: string }
  | { readonly kind: "complete" };

export interface StepRecord {
  readonly step: number;
  readonly action: StepAction;
  readonly ok: boolean;
  /** Error envelope when ok is false. */
  readonly error?: CliEnvelope["error"];
  /** Node states after the step (re-discovered, not remembered). */
  readonly nodeStates: Readonly<Record<string, string>>;
  readonly graphStatus: string;
}

export type StopReason =
  | "graph-cancelled"
  | "graph-failed"
  | "graph-not-runnable"
  | "interrupted-run"
  | "node-blocked"
  | "node-rejected"
  | "review-policy-stop"
  | "command-failed"
  | "wedged"
  | "max-steps";

export interface SchedulerResult {
  readonly outcome: "completed" | "stopped";
  readonly reason: StopReason | null;
  readonly graphStatus: string;
  readonly nodeStates: Readonly<Record<string, string>>;
  readonly steps: readonly StepRecord[];
  /** Machine-readable stop evidence (recovery state, error envelope, …). */
  readonly stopState: Record<string, unknown> | null;
}

interface NodeView {
  readonly nodeId: string;
  readonly state: string;
  readonly dependencies: readonly string[];
  readonly workerAdapter: string;
  readonly attempt?: number;
}
interface GraphView {
  readonly status: string;
  readonly nodes: readonly NodeView[];
}

function nodeStatesOf(g: GraphView): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of g.nodes) out[n.nodeId] = n.state;
  return out;
}

export function runSchedulerLoop(opts: SchedulerOptions): SchedulerResult {
  const actorId = opts.actorId ?? "orchestrator:sched";
  const maxSteps = opts.maxSteps ?? 100;
  const reviewPolicy = opts.reviewPolicy ?? fixtureReviewPolicy;
  const steps: StepRecord[] = [];

  const cli = (argv: string[]): CliEnvelope => {
    try {
      const stdout = execFileSync(process.execPath, [opts.cli, ...argv], {
        env: { ...process.env, ...(opts.env ?? {}) },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      const parsed = JSON.parse(stdout) as Omit<CliEnvelope, "exitCode">;
      return { exitCode: 0, ...parsed };
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      try {
        const parsed = JSON.parse(err.stdout ?? "") as Omit<CliEnvelope, "exitCode">;
        return { exitCode: err.status ?? -1, ...parsed };
      } catch {
        return {
          exitCode: err.status ?? -1,
          success: false,
          error: { code: "UNPARSEABLE_OUTPUT", message: String(err.stdout ?? "no output"), details: {} },
        };
      }
    }
  };

  const show = (): GraphView | CliEnvelope => {
    const r = cli(["graph", "show", "--project-id", opts.projectId, "--graph-id", opts.graphId]);
    if (!r.success) return r;
    return r.data as GraphView;
  };

  const stopped = (
    reason: StopReason,
    g: GraphView | null,
    stopState: Record<string, unknown> | null,
  ): SchedulerResult => ({
    outcome: "stopped",
    reason,
    graphStatus: g?.status ?? "unknown",
    nodeStates: g ? nodeStatesOf(g) : {},
    steps,
    stopState,
  });

  for (let step = 0; step < maxSteps; step++) {
    // --- restart point: rediscover EVERYTHING; nothing is remembered --------
    const shown = show();
    if (!("nodes" in shown)) {
      return stopped("command-failed", null, { failedCommand: "graph.show", error: shown.error ?? null });
    }
    const g = shown;

    // terminal / stop states first
    if (g.status === "completed") {
      return { outcome: "completed", reason: null, graphStatus: g.status, nodeStates: nodeStatesOf(g), steps, stopState: null };
    }
    if (g.status === "cancelled") {
      const rejected = g.nodes.filter((n) => n.state === "rejected").map((n) => n.nodeId);
      return stopped(rejected.length > 0 ? "node-rejected" : "graph-cancelled", g, { rejectedNodes: rejected });
    }
    if (g.status === "failed") {
      const failed = g.nodes.filter((n) => n.state === "failed").map((n) => n.nodeId);
      return stopped("graph-failed", g, { failedNodes: failed });
    }
    if (g.status !== "approved" && g.status !== "running") {
      return stopped("graph-not-runnable", g, { status: g.status });
    }

    // in-flight node at rest == interrupted run: expose recovery, stop
    const inflight = g.nodes.find((n) => n.state === "ready" || n.state === "running");
    if (inflight) {
      const view = cli(["inspect", "--project-id", opts.projectId, "--graph-id", opts.graphId, "--node-id", inflight.nodeId]);
      const recovery =
        view.success && view.data && typeof view.data === "object"
          ? (view.data as { recovery?: unknown }).recovery ?? null
          : null;
      return stopped("interrupted-run", g, { nodeId: inflight.nodeId, recovery });
    }

    const blocked = g.nodes.find((n) => n.state === "blocked");
    if (blocked) {
      return stopped("node-blocked", g, { nodeId: blocked.nodeId });
    }

    // --- derive exactly ONE next action (mechanical; document order breaks ties)
    let action: StepAction | null = null;
    const awaiting = g.nodes.find((n) => n.state === "awaiting_review");
    const approved = g.nodes.find((n) => n.state === "approved");
    const byId = new Map(g.nodes.map((n) => [n.nodeId, n] as const));
    const runnable = g.nodes.find(
      (n) => n.state === "pending" && n.dependencies.every((d) => byId.get(d)?.state === "promoted"),
    );
    const terminal = new Set(["promoted", "rejected", "cancelled", "failed"]);

    if (awaiting) action = { kind: "approve", nodeId: awaiting.nodeId };
    else if (approved) action = { kind: "promote", nodeId: approved.nodeId };
    else if (runnable) action = { kind: "run", nodeId: runnable.nodeId };
    else if (g.nodes.every((n) => terminal.has(n.state))) action = { kind: "complete" };
    else {
      // pending nodes exist but none is eligible (deps rejected/cancelled/failed)
      return stopped("wedged", g, {
        detail: "no derivable action: pending nodes have non-promoted terminal dependencies",
        nodeStates: nodeStatesOf(g),
      });
    }

    // --- execute the ONE action ---------------------------------------------
    let result: CliEnvelope;
    switch (action.kind) {
      case "run":
        result = cli(["run", "--project-id", opts.projectId, "--graph-id", opts.graphId, "--node-id", action.nodeId, "--actor-id", actorId]);
        break;
      case "approve": {
        // approve path: recover the facts from the read-only review output,
        // then ask the REVIEW POLICY. There is no auto-approve.
        const review = cli(["review", "--project-id", opts.projectId, "--graph-id", opts.graphId, "--node-id", action.nodeId]);
        const reviewData =
          review.success && review.data && typeof review.data === "object"
            ? (review.data as {
                gateRecord?: { validation?: { status?: string; artifactHash?: string } };
                sandbox?: { changedFiles?: string[] };
              })
            : null;
        const artifactHash = reviewData?.gateRecord?.validation?.artifactHash ?? null;
        if (!reviewData || !artifactHash) {
          return stopped("command-failed", g, { failedCommand: "review", nodeId: action.nodeId, error: review.error ?? null });
        }
        const decision = reviewPolicy.decide({
          graphId: opts.graphId,
          nodeId: action.nodeId,
          // run ids are attempt-scoped since the retry verdict
          runId: `run-${Math.max(byId.get(action.nodeId)?.attempt ?? 1, 1)}`,
          workerAdapter: byId.get(action.nodeId)?.workerAdapter ?? "unknown",
          gateStatus: (reviewData.gateRecord?.validation?.status as "passed" | "failed" | undefined) ?? "unknown",
          artifactHash,
          changedFiles: reviewData.sandbox?.changedFiles ?? [],
        });
        if (decision.action === "stop") {
          // hand the review to a human: machine state, no approval recorded
          return stopped("review-policy-stop", g, {
            nodeId: action.nodeId,
            policy: reviewPolicy.name,
            reason: decision.reason,
            artifactHash,
            requiredAction:
              "human review required: inspect the run, then `gorp approve --reviewed-commit <hash>` or `gorp reject`, then re-run orchestrate",
          });
        }
        result = cli([
          "approve", "--project-id", opts.projectId, "--graph-id", opts.graphId, "--node-id", action.nodeId,
          "--actor-id", actorId, "--reviewed-commit", artifactHash,
          "--reason", `review policy '${reviewPolicy.name}': ${decision.reason}`,
        ]);
        break;
      }
      case "promote":
        result = cli(["promote", "--project-id", opts.projectId, "--graph-id", opts.graphId, "--node-id", action.nodeId, "--actor-id", actorId]);
        break;
      case "complete":
        result = cli([
          "graph", "transition", "--project-id", opts.projectId, "--graph-id", opts.graphId,
          "--to", "completed", "--actor-type", "orchestrator", "--actor-id", actorId,
          "--reason-code", "ALL_NODES_TERMINAL", "--reason", "scheduler verified every node terminal",
        ]);
        break;
    }

    // record the step against RE-DISCOVERED state (never assumed)
    const after = show();
    const afterGraph = "nodes" in after ? after : null;
    steps.push({
      step,
      action,
      ok: result.success,
      ...(result.success ? {} : { error: result.error ?? { code: "UNKNOWN", message: "no error envelope", details: {} } }),
      nodeStates: afterGraph ? nodeStatesOf(afterGraph) : {},
      graphStatus: afterGraph?.status ?? "unknown",
    });

    if (!result.success) {
      return stopped("command-failed", afterGraph, {
        failedCommand: action.kind,
        ...("nodeId" in action ? { nodeId: action.nodeId } : {}),
        error: result.error ?? null,
        exitCode: result.exitCode,
      });
    }
  }

  const finalShown = show();
  const finalGraph = "nodes" in finalShown ? finalShown : null;
  if (finalGraph?.status === "completed") {
    return { outcome: "completed", reason: null, graphStatus: "completed", nodeStates: nodeStatesOf(finalGraph), steps, stopState: null };
  }
  return stopped("max-steps", finalGraph, { maxSteps });
}
