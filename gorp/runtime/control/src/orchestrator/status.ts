/**
 * Orchestrator invocation status (Sprint 2.1: failure semantics).
 *
 * Problem this solves: `gorp orchestrate` prints its stop envelope
 * (ORCHESTRATION_STOPPED + machine state) to stdout — but the primary
 * operator surface launches it DETACHED, so the envelope was discarded and
 * every stop looked silent. Proven three times in real operation
 * (operator sprints skill-note-2/3: promote failed on base drift / dirty tree
 * and the operator saw only a retry button with no cause).
 *
 * Fix: every orchestrate invocation appends two events to an APPEND-ONLY
 * per-graph JSONL log under the state root:
 *
 *   <stateHome>/projects/<project-id>/orchestrator/<graph-id>.jsonl
 *     { event: "started", invocationId, actorId, pid, at }
 *     { event: "ended",   invocationId, outcome, reason, stopState,
 *       graphStatus, nodeStates, steps, at }
 *
 * A `started` with no matching `ended` means the invocation is either still
 * running or crashed; `readOrchestratorStatus` disambiguates by checking pid
 * liveness (same host — the runtime is single-host by design, like its lock
 * files). This log is operational status, not part of the per-run audit
 * chain: it records what the SCHEDULER observed, while the authoritative
 * facts stay in the graph + run records. Nothing here mutates graph state.
 */

import { appendFileSync, closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { GorpError } from "../errors/index.js";
import { orchestratorLogPath, type RuntimeConfig } from "../config/index.js";
import type { Clock } from "../graph/graph.js";
import type { SchedulerResult } from "./scheduler.js";

export interface OrchestratorStartedEvent {
  readonly event: "started";
  readonly invocationId: string;
  readonly actorId: string;
  readonly pid: number;
  readonly at: string;
}

export interface OrchestratorEndedEvent {
  readonly event: "ended";
  readonly invocationId: string;
  readonly outcome: "completed" | "stopped";
  readonly reason: string | null;
  readonly graphStatus: string;
  readonly nodeStates: Readonly<Record<string, string>>;
  readonly stopState: Record<string, unknown> | null;
  /** Step log of the invocation (action, ok, error envelope, states after). */
  readonly steps: SchedulerResult["steps"];
  readonly at: string;
}

export type OrchestratorEvent = OrchestratorStartedEvent | OrchestratorEndedEvent;

/** One invocation as folded from its started(+ended) events. */
export interface OrchestratorInvocation {
  readonly invocationId: string;
  readonly actorId: string;
  readonly pid: number;
  readonly startedAt: string;
  /**
   * running          — no ended event, pid alive on this host
   * completed        — ended, graph completed
   * stopped          — ended with a machine stop reason
   * presumed-crashed — no ended event and the pid is gone: the orchestrator
   *                    died without recording a stop (crash / kill / reboot)
   */
  readonly status: "running" | "completed" | "stopped" | "presumed-crashed";
  readonly endedAt: string | null;
  readonly outcome: "completed" | "stopped" | null;
  readonly reason: string | null;
  readonly graphStatus: string | null;
  readonly nodeStates: Readonly<Record<string, string>> | null;
  readonly stopState: Record<string, unknown> | null;
  readonly steps: SchedulerResult["steps"] | null;
}

export interface OrchestratorStatus {
  readonly graphId: string;
  readonly projectId: string;
  readonly invocations: readonly OrchestratorInvocation[];
  /** Newest invocation (by log order), or null if orchestrate never ran. */
  readonly latest: OrchestratorInvocation | null;
}

function appendEvent(path: string, entry: OrchestratorEvent): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const fd = openSync(path, "a");
    try {
      appendFileSync(fd, JSON.stringify(entry) + "\n");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", "cannot append orchestrator status event", {
      path,
      cause: String(e),
    });
  }
}

export function recordOrchestrateStarted(
  cfg: RuntimeConfig,
  projectId: string,
  graphId: string,
  actorId: string,
  clock: Clock,
  pid: number = process.pid,
): OrchestratorStartedEvent {
  const at = clock.now();
  const entry: OrchestratorStartedEvent = {
    event: "started",
    invocationId: `inv-${pid}-${at.replace(/[:.]/g, "")}`,
    actorId,
    pid,
    at,
  };
  appendEvent(orchestratorLogPath(cfg, projectId, graphId), entry);
  return entry;
}

export function recordOrchestrateEnded(
  cfg: RuntimeConfig,
  projectId: string,
  graphId: string,
  invocationId: string,
  result: SchedulerResult,
  clock: Clock,
): OrchestratorEndedEvent {
  const entry: OrchestratorEndedEvent = {
    event: "ended",
    invocationId,
    outcome: result.outcome,
    reason: result.reason,
    graphStatus: result.graphStatus,
    nodeStates: result.nodeStates,
    stopState: result.stopState,
    steps: result.steps,
    at: clock.now(),
  };
  appendEvent(orchestratorLogPath(cfg, projectId, graphId), entry);
  return entry;
}

/** Is a pid alive on this host? (signal 0 probe; EPERM still means alive) */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function loadEvents(path: string): OrchestratorEvent[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l, i) => {
      try {
        return JSON.parse(l) as OrchestratorEvent;
      } catch (e) {
        throw new GorpError("STORAGE_FAILURE", "orchestrator status log contains an unparseable line", {
          path,
          line: i,
          cause: String(e),
        });
      }
    });
}

/** Pure read: fold the event log into per-invocation status. */
export function readOrchestratorStatus(
  cfg: RuntimeConfig,
  projectId: string,
  graphId: string,
  isAlive: (pid: number) => boolean = pidAlive,
): OrchestratorStatus {
  const events = loadEvents(orchestratorLogPath(cfg, projectId, graphId));
  const invocations: OrchestratorInvocation[] = [];
  const byId = new Map<string, number>();

  for (const e of events) {
    if (e.event === "started") {
      byId.set(e.invocationId, invocations.length);
      invocations.push({
        invocationId: e.invocationId,
        actorId: e.actorId,
        pid: e.pid,
        startedAt: e.at,
        status: "running", // provisional; resolved below
        endedAt: null,
        outcome: null,
        reason: null,
        graphStatus: null,
        nodeStates: null,
        stopState: null,
        steps: null,
      });
    } else {
      const idx = byId.get(e.invocationId);
      if (idx === undefined) continue; // ended without started: ignore, log is append-only
      const started = invocations[idx]!;
      invocations[idx] = {
        ...started,
        status: e.outcome,
        endedAt: e.at,
        outcome: e.outcome,
        reason: e.reason,
        graphStatus: e.graphStatus,
        nodeStates: e.nodeStates,
        stopState: e.stopState,
        steps: e.steps,
      };
    }
  }

  const resolved = invocations.map((inv) =>
    inv.endedAt === null && !isAlive(inv.pid) ? { ...inv, status: "presumed-crashed" as const } : inv,
  );

  return {
    graphId,
    projectId,
    invocations: resolved,
    latest: resolved.length > 0 ? resolved[resolved.length - 1]! : null,
  };
}
