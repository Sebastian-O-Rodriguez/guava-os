/**
 * `gorp run` (Wave B, reworked in Sprint 2A for multi-node): execute ONE
 * explicitly chosen node of an approved graph, once.
 *
 *   approved graph -> (per-node) worktree sandbox -> fixture worker ->
 *   persist worker result -> scope gate -> persist gate record -> stop
 *   (review/decision/promotion are separate commands). NO scheduler: the
 *   caller names the node; policy (run/policy.ts) checks eligibility
 *   (pending, dependencies promoted). NO concurrency, NO automatic retries
 *   (a fresh attempt exists only via the operator's review retry verdict,
 *   which returns the node to pending), NO background jobs.
 *
 * Base commit is recorded PER NODE RUN: the target repository's HEAD at run
 * start (so a later node can base on the HEAD produced by promoting an
 * earlier node). It is persisted in the run record and used by review,
 * promotion, and inspect — graph.baseCommit remains creation-time provenance.
 *
 * State ownership: only this control flow (actor type `orchestrator`)
 * transitions graph/node state. The worker cannot — it never sees the store,
 * and `worker` is not an authorized actor type.
 *
 * Fail closed: any worker or gate failure marks node+graph failed, destroys
 * the sandbox, persists the records that explain the failure, and exits with
 * a distinct code. On success the sandbox is kept for review.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { GorpError } from "../errors/index.js";
import {
  auditChainPath,
  gateRecordPath,
  runDir,
  runRecordPath,
  sandboxDir,
  workerResultPath,
  type RunRef,
  type RuntimeConfig,
} from "../config/index.js";
import { appendChainEntry, type ChainEvent } from "../audit/chain.js";
import { GraphStore } from "../storage/graph-store.js";
import { atomicWriteJson } from "../storage/atomic.js";
import { validateAgainst, specsRuntimeDir } from "../contracts/validator.js";
import type {
  ExecutionGraph,
  GateRecord,
  RunRecord,
  WorkerResult,
  WorkerUsage,
} from "../contracts/types.js";
import { applyGraphTransition, applyNodeTransition, systemClock, type Clock } from "../graph/graph.js";
import {
  createSandbox,
  destroySandbox,
  git,
  provisionSandbox,
  sandboxAllChangedFiles,
  sandboxChangedFiles,
  sandboxHead,
  sandboxIsClean,
  type Sandbox,
} from "../sandbox/worktree.js";
import { invokeAdapter, resolveWorkerAdapter } from "../worker/adapter.js";
import { buildGateRecord, matchesAny, scopeChecks } from "../gate/scope.js";
import { runCommandChecks } from "../gate/commands.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { assertNodeRunnable, selectNode } from "./policy.js";
import { captureGitBaseline } from "./baseline.js";
import { reportFailClosed } from "../telemetry/index.js";

const ORCHESTRATOR = "orchestrator" as const;

/** First attempt's run id (kept for callers that predate retry). */
export const DEFAULT_RUN_ID = "run-1";

/**
 * Run ids are attempt-scoped since the retry verdict (Sprint 5A):
 * node.attempt counts completed `running` entries, so the NEXT run is
 * attempt+1 and the MOST RECENT run is attempt (min 1 for pre-run defaults).
 */
export function nextRunId(node: { readonly attempt: number }): string {
  return `run-${node.attempt + 1}`;
}

export function currentRunId(node: { readonly attempt: number }): string {
  return `run-${Math.max(node.attempt, 1)}`;
}

/** Sandbox branch in the consumer repo; unique per graph+node+run. */
export function sandboxBranchFor(ref: RunRef): string {
  return `gorp/run/${ref.graphId}/${ref.nodeId}/${ref.runId}`;
}

/** Resolved Gorp governance version, read from gorp.manifest.yml. Fail closed. */
export function governanceVersion(): string {
  const manifest = join(specsRuntimeDir(), "..", "..", "gorp.manifest.yml");
  let raw: string;
  try {
    raw = readFileSync(manifest, "utf8");
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", "cannot read gorp.manifest.yml for governance version", {
      manifest,
      cause: String(e),
    });
  }
  const m = raw.match(/^version:\s*(\S+)\s*$/m);
  if (!m || !m[1]) {
    throw new GorpError("STORAGE_FAILURE", "gorp.manifest.yml has no version field", { manifest });
  }
  return m[1];
}

export interface RunInput {
  readonly projectId: string;
  readonly graphId: string;
  /** Explicit node to run. Required — there is no fallback to the first node. */
  readonly nodeId: string;
  readonly actorId: string;
}

export interface RunOutput {
  readonly runId: string;
  readonly nodeId: string;
  readonly baseCommit: string; // per-node-run base (target HEAD at run start)
  readonly finalStatus: RunRecord["finalStatus"];
  readonly nodeState: string;
  readonly graphStatus: string;
  readonly sandbox: { readonly dir: string; readonly branch: string; readonly headCommit: string } | null;
  readonly validation: GateRecord["validation"];
  readonly review: GateRecord["review"];
  readonly records: {
    readonly runRecord: string;
    readonly workerResult: string;
    readonly gateRecord: string;
  };
}

interface ControlDecision {
  decision: string;
  reasonCode: string;
  reasonText?: string;
  at?: string;
}

function persistValidated(name: "worker-result" | "gate-record" | "run-record", path: string, value: unknown): void {
  const check = validateAgainst(name, value);
  if (!check.valid) {
    // Internal invariant: we refuse to persist a record that violates its own contract.
    throw new GorpError("SCHEMA_VALIDATION_FAILED", `${name} failed schema validation before persist`, {
      issues: check.issues,
    });
  }
  atomicWriteJson(path, value);
}

/**
 * sha256 of the resolved worker profile — deterministic lifecycle evidence
 * (GOS-46). The same persona + model + persona body always hash to the same
 * value, so a review decision can bind to the exact profile that ran.
 */
function computePromptHash(persona: string, model: string, systemPrompt: string): string {
  return createHash("sha256").update(JSON.stringify({ persona, model, systemPrompt })).digest("hex");
}

/**
 * Resolve the worker profile to stamp into the run record (GOS-46).
 *
 * Present only when the node carries a persona. The model comes from the
 * environment (set by the guava-os wf layer before dispatch); when it is not
 * resolvable it is omitted (the omp adapter has already failed closed before
 * a spawn could happen in that case).
 */
function resolveWorkerProfile(persona: string | undefined): RunRecord["profile"] {
  if (!persona) return undefined;
  const model = process.env["GORP_OMP_MODEL"] ?? "";
  const systemPrompt = process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] ?? "";
  return {
    persona,
    ...(model ? { model } : {}),
    promptHash: computePromptHash(persona, model, systemPrompt),
  };
}

/**
 * Stamp per-run usage into the run record (GOS-55). The worker adapter reports
 * tokens + cost when the runtime provides them; the control plane adds the
 * wall-clock duration it can always measure (endedAt - startedAt) only when
 * the worker reports nothing, so `durationMs` is always present.
 */
function resolveRunUsage(workerUsage: WorkerUsage | undefined, startedAt: string, endedAt: string): WorkerUsage {
  if (workerUsage) return workerUsage;
  const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
  return { durationMs };
}

/**
 * Extract worker-spawn diagnostics from a failed invocation's error details
 * (GOS-57). The omp adapter stamps cmd/cwd/model/persona/promptLen/args (plus
 * the startup/run timeout windows) into the WORKER_FAILED GorpError when a
 * spawn stalls or dies before producing a result. Persist those keys onto the
 * run record so a start-up hang is debuggable from the record alone. The full
 * prompt is never included (only its length); the persona body is redacted to
 * a length marker in `args`.
 */
function resolveSpawnDiagnostics(details: Readonly<Record<string, unknown>>): Record<string, unknown> | undefined {
  const keys = ["cmd", "cwd", "model", "persona", "promptLen", "args", "mcpDisable", "startupTimeoutMs", "timeoutMs", "startupTimedOut", "firstOutputMs"] as const;
  const out: Record<string, unknown> = {};
  let found = false;
  for (const k of keys) {
    if (k in details) {
      out[k] = details[k];
      found = true;
    }
  }
  return found ? out : undefined;
}

export async function executeRun(cfg: RuntimeConfig, input: RunInput, clock: Clock = systemClock): Promise<RunOutput> {
  const store = new GraphStore(cfg);
  let graph: ExecutionGraph = store.load(input.projectId, input.graphId);

  // Explicit node selection + eligibility policy (fail closed; no fallback).
  const node = selectNode(graph, input.nodeId);
  assertNodeRunnable(graph, node);
  // Resolve the worker profile ONCE (GOS-46): persona -> { persona, model,
  // promptHash }. The omp adapter enforces that a persona + resolved env exist
  // before spawning; this stamps the same resolved profile into the run record.
  const profile = resolveWorkerProfile(node.persona);

  // Resolve the worker adapter FIRST: an unknown adapter fails closed before
  // any state transition, sandbox, or run directory exists.
  const workerAdapter = resolveWorkerAdapter(node.workerAdapter);

  // First node run moves the graph approved -> running; later node runs join
  // the already-running graph. Anything else cannot run.
  if (graph.status !== "approved" && graph.status !== "running") {
    throw new GorpError("STATE_CONFLICT", "graph must be approved (or already running) to run a node", {
      graphId: graph.graphId,
      status: graph.status,
      approvalStatus: graph.approvalStatus,
    });
  }

  const ref: RunRef = { graphId: graph.graphId, nodeId: node.nodeId, runId: nextRunId(node) };
  const rDir = runDir(cfg, input.projectId, ref);
  if (existsSync(rDir)) {
    throw new GorpError("STATE_CONFLICT", "run directory already exists for this attempt", {
      ...ref,
      runDir: rDir,
    });
  }
  mkdirSync(rDir, { recursive: true });

  const repositoryPath = resolveProjectRepoPath(graph.project.projectId);
  // Immutable baseline (GOS-33): capture branch/tag refs + HEAD + tree hash at
  // run start. The HEAD becomes the per-node-run base commit. Fail closed on
  // any git error (SANDBOX_FAILURE).
  const baseline = captureGitBaseline(repositoryPath, clock);
  const baseCommit = baseline.head;

  const startedAt = clock.now();
  const decisions: ControlDecision[] = [];
  const decide = (decision: string, reasonCode: string, reasonText?: string): void => {
    decisions.push({
      decision,
      reasonCode,
      ...(reasonText !== undefined ? { reasonText } : {}),
      at: clock.now(),
    });
  };

  // Control (orchestrator actor) owns every state change. Never the worker.
  if (graph.status === "approved") {
    graph = applyGraphTransition(
      graph,
      { to: "running", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode: "RUN_START", reasonText: `first node run (${node.nodeId}) started` },
      clock,
    );
  }
  graph = applyNodeTransition(
    graph,
    { nodeId: node.nodeId, to: "ready", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode: "NODE_ELIGIBLE", reasonText: "explicitly selected node is pending with all dependencies promoted" },
    clock,
  );
  graph = applyNodeTransition(
    graph,
    { nodeId: node.nodeId, to: "running", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode: "WORKER_START", reasonText: `dispatching ${node.workerAdapter} worker` },
    clock,
  );
  store.update(graph);
  decide("start-run", "NODE_ELIGIBLE", `node ${node.nodeId} selected explicitly; base ${baseCommit}`);

  const branch = sandboxBranchFor(ref);
  const sbDir = sandboxDir(cfg, input.projectId, ref);
  const sandbox: Sandbox = createSandbox(repositoryPath, baseCommit, sbDir, branch);
  decide("create-sandbox", "SANDBOX_ISOLATION", `worktree ${branch} at base ${baseCommit}`);

  const provisioned = provisionSandbox(sandbox);
  if (provisioned.length > 0) {
    decide("provision-sandbox", "DEPS_PROVISIONED", `symlinked ${provisioned.length} dep dir(s) from repo root`);
  }

  const paths = {
    runRecord: runRecordPath(cfg, input.projectId, ref),
    workerResult: workerResultPath(cfg, input.projectId, ref),
    gateRecord: gateRecordPath(cfg, input.projectId, ref),
  };
  const chainPath = auditChainPath(cfg, input.projectId, ref);
  // Persist + chain: each record is hashed into the append-only audit chain
  // the moment it is written, so later unaccompanied edits are detectable
  // (integrity evidence only — no external anchor; see audit/chain.ts).
  const persistChained = (event: ChainEvent & ("worker-result" | "gate-record" | "run-record"), path: string, value: unknown): void => {
    persistValidated(event, path, value);
    appendChainEntry(chainPath, rDir, event, `${event}.json`, path, clock);
  };

  const failRun = (
    reasonCode: string,
    reasonText: string,
    workerResult: WorkerResult | null,
    gateRecord: GateRecord | null,
    cause: GorpError,
  ): never => {
    decide("fail-run", reasonCode, reasonText);
    // Evidence records (worker result / gate record) were already persisted and
    // chained by the main flow before this failure was raised — never rewrite
    // them (append-only audit). Mark node+graph failed, destroy sandbox.
    let failed = applyNodeTransition(
      graph,
      { nodeId: node.nodeId, to: "failed", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode, reasonText },
      clock,
    );
    failed = applyGraphTransition(
      failed,
      { to: "failed", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode, reasonText },
      clock,
    );
    store.update(failed);
    // GOS-51: snapshot partial in-scope artifacts BEFORE destroying the sandbox
    // so the operator can inspect what the worker changed before it failed.
    // This is best-effort evidence — never blocks the fail-closed path.
    let partialPreserved: string[] | undefined;
    try {
      const allChanged = sandboxAllChangedFiles(sandbox);
      const inScope = allChanged.filter((f) => matchesAny(f, node.allowedPaths));
      if (inScope.length > 0) {
        const partialDir = join(rDir, "partial");
        mkdirSync(partialDir, { recursive: true });
        const preserved: string[] = [];
        for (const file of inScope) {
          const src = join(sandbox.dir, file);
          if (existsSync(src) && !statSync(src).isDirectory()) {
            const dest = join(partialDir, file);
            mkdirSync(dirname(dest), { recursive: true });
            copyFileSync(src, dest);
            preserved.push(file);
          }
        }
        if (preserved.length > 0) {
          atomicWriteJson(join(partialDir, "partial.json"), {
            preservedFiles: preserved.sort(),
            baseCommit,
            graphId: graph.graphId,
            nodeId: node.nodeId,
            runId: ref.runId,
            preservedAt: clock.now(),
            promotable: false,
          });
          partialPreserved = preserved;
          decide("preserve-partial", "PARTIAL_PRESERVED", `preserved ${preserved.length} in-scope file(s) to partial/`);
        }
      }
    } catch {
      // Best-effort: partial preservation MUST NOT block failRun.
    }
    destroySandbox(sandbox);
    decide("destroy-sandbox", "FAIL_CLOSED", "sandbox destroyed on failure");
    const endedAt = clock.now();
    const usage = resolveRunUsage(workerResult?.usage, startedAt, endedAt);
    const diagnostics = resolveSpawnDiagnostics(cause.details);
    const record: RunRecord = {
      schemaVersion: 1,
      runId: ref.runId,
      graphId: graph.graphId,
      nodeId: node.nodeId,
      projectId: input.projectId,
      governanceVersion: governanceVersion(),
      baseCommit,
      baseline,
      workerAdapter: node.workerAdapter,
      sandboxIdentity: branch,
      ...(workerResult ? { workerResultRef: "worker-result.json" } : {}),
      ...(gateRecord ? { gateRecordRef: "gate-record.json" } : {}),
      ...(profile ? { profile } : {}),
      ...(diagnostics ? { diagnostics } : {}),
      controlDecisions: decisions,
      finalStatus: "failed",
      startedAt,
      endedAt,
      usage,
    };
    persistChained("run-record", paths.runRecord, record);
    // GOS-59: report the fail-closed outcome to Sentry AFTER the run record is
    // durably persisted, BEFORE throwing. Best-effort — never blocks the throw.
    try {
      reportFailClosed(cfg, input.projectId, ref);
    } catch { /* fail-open: telemetry never affects execution */ }
    throw new GorpError(cause.code, cause.message, {
      ...cause.details,
      ...ref,
      records: paths,
    });
  };

  // --- worker (adapter boundary; result contract-checked, never trusted raw)
  let workerResult: WorkerResult;
  try {
    workerResult = await invokeAdapter(workerAdapter, { sandbox, graphId: graph.graphId, runId: ref.runId, node, clock });
  } catch (e) {
    const err = e instanceof GorpError ? e : new GorpError("WORKER_FAILED", "worker threw unexpectedly", { cause: String(e) });
    return failRun("WORKER_FAILED", err.message, null, null, err);
  }
  persistChained("worker-result", paths.workerResult, workerResult);
  decide("persist-worker-result", "WORKER_SUCCEEDED", `outcome ${workerResult.outcome}`);

  if (workerResult.outcome !== "succeeded") {
    return failRun(
      "WORKER_FAILED",
      `worker outcome ${workerResult.outcome}`,
      workerResult,
      null,
      new GorpError("WORKER_FAILED", `worker outcome ${workerResult.outcome}`, {}),
    );
  }

  // --- gate (independent of the worker's claims) ----------------------------
  // Scope checks first; the project's required commands (node.requiredCommands,
  // from the operator-approved graph) run in the sandbox ONLY when scope
  // passed — a scope violation already fails the gate.
  const gateInput = {
    graphId: graph.graphId,
    node,
    runId: ref.runId,
    changedFiles: sandboxChangedFiles(sandbox),
    sandboxClean: sandboxIsClean(sandbox),
    artifactHash: sandboxHead(sandbox),
  };
  const sChecks = scopeChecks(gateInput);
  const allChecks = sChecks.every((c) => c.status === "passed")
    ? [...sChecks, ...runCommandChecks(node, sandbox.dir, clock)]
    : sChecks;
  const gateRecord = buildGateRecord(gateInput, allChecks);
  persistChained("gate-record", paths.gateRecord, gateRecord);
  decide("persist-gate-record", "SCOPE_GATE", `validation ${gateRecord.validation.status}`);

  if (gateRecord.validation.status !== "passed") {
    const failedChecks = gateRecord.validation.checks.filter((c) => c.status === "failed");
    return failRun(
      "GATE_FAILED",
      failedChecks.map((c) => `${c.name}: ${c.detail ?? "failed"}`).join("; "),
      workerResult,
      gateRecord,
      new GorpError(
        "GATE_FAILED",
        `gate failed: ${failedChecks.map((c) => c.name).join(", ")}`,
        { checks: failedChecks },
      ),
    );
  }

  // --- success: stop at the review boundary ---------------------------------
  graph = applyNodeTransition(
    graph,
    { nodeId: node.nodeId, to: "awaiting_review", actorType: ORCHESTRATOR, actorId: input.actorId, reasonCode: "GATE_PASSED", reasonText: "scope gate passed; awaiting operator review" },
    clock,
  );
  store.update(graph);
  decide("await-review", "GATE_PASSED", "sandbox kept for review; decision and promotion are separate commands");
  const endedAt = clock.now();
  const usage = resolveRunUsage(workerResult.usage, startedAt, endedAt);

  const record: RunRecord = {
    schemaVersion: 1,
    runId: ref.runId,
    graphId: graph.graphId,
    nodeId: node.nodeId,
    projectId: input.projectId,
    governanceVersion: governanceVersion(),
    baseCommit,
    baseline,
    workerAdapter: node.workerAdapter,
    sandboxIdentity: branch,
    workerResultRef: "worker-result.json",
    gateRecordRef: "gate-record.json",
    ...(profile ? { profile } : {}),
    controlDecisions: decisions,
    finalStatus: "succeeded",
    startedAt,
    endedAt,
    usage,
  };
  persistChained("run-record", paths.runRecord, record);

  const updatedNode = graph.nodes.find((n) => n.nodeId === node.nodeId)!;
  return {
    runId: ref.runId,
    nodeId: node.nodeId,
    baseCommit,
    finalStatus: "succeeded",
    nodeState: updatedNode.state,
    graphStatus: graph.status,
    sandbox: { dir: sandbox.dir, branch, headCommit: sandboxHead(sandbox) },
    validation: gateRecord.validation,
    review: gateRecord.review,
    records: paths,
  };
}
