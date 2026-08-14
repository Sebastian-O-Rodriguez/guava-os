/**
 * Gorp control-plane CLI (Sprint 1 Waves A-D, Sprints 2A/3A).
 *
 * Implemented:   graph create | validate | show | transition   (Wave A)
 *                run | review (read-only)                      (Wave B)
 *                promote (fail-closed cherry-pick)             (Wave C)
 *                approve | reject | inspect (read-only audit)  (Wave D)
 *                orchestrate (single-graph scheduler loop)     (Sprint 3A)
 *                retry (review verdict: fresh attempt)         (Sprint 5A)
 *
 * Primary output is machine-readable JSON. Exit codes are documented in
 * src/errors/index.ts (EXIT_CODES) and tested. This CLI never invokes the
 * deprecated dispatch.sh; worker runtimes are reached only through the
 * worker adapter seam (`gorp run` on a node whose adapter is e.g. omp).
 */

import { readFileSync } from "node:fs";
import { EXIT_CODES, GorpError, exitCodeFor, isGorpError } from "../errors/index.js";
import { loadConfig } from "../config/index.js";
import { emit, type CliResult } from "./output.js";
import { GraphStore, stripLegacyRepositoryPath } from "../storage/graph-store.js";
import { resolveProjectRepoPath } from "../registry/projects.js";
import { validateAgainst } from "../contracts/validator.js";
import { applyGraphTransition, buildDraftGraph, type Clock, systemClock } from "../graph/graph.js";
import { executeRun } from "../run/run.js";
import { reviewRun } from "../run/review.js";
import { executePromote } from "../promote/promote.js";
import { executeApprove, executeReject, executeRetry } from "../review/decision.js";
import { inspectRun } from "../inspect/inspect.js";
import { runSchedulerLoop } from "../orchestrator/scheduler.js";
import { readOrchestratorStatus, recordOrchestrateEnded, recordOrchestrateStarted } from "../orchestrator/status.js";
import { compileGraph } from "../compiler/graph-compiler.js";
import { git } from "../sandbox/worktree.js";
import { implementedReviewPolicies, resolveReviewPolicy } from "../orchestrator/review-policy.js";
import { fileURLToPath } from "node:url";
import type { ActorType, ExecutionGraph, GraphNode } from "../contracts/types.js";
import { computeGraphDrift } from "../compiler/drift.js";
import { appendChainEntry, fileSha256 } from "../audit/chain.js";
import { graphAuditChainPath } from "../config/index.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface ParsedArgs {
  readonly positionals: readonly string[];
  readonly flags: Readonly<Record<string, string>>;
  readonly bools: ReadonlySet<string>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        bools.add(key);
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags, bools };
}

function requireFlag(args: ParsedArgs, name: string): string {
  const v = args.flags[name];
  if (v === undefined || v.length === 0) {
    throw new GorpError("INVALID_ARGUMENT", `missing required --${name}`, { flag: name });
  }
  return v;
}

function readJsonFile(path: string): unknown {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new GorpError("INVALID_ARGUMENT", `cannot read file: ${path}`, { path, cause: String(e) });
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (e) {
    throw new GorpError("INVALID_ARGUMENT", `file is not valid JSON: ${path}`, { path, cause: String(e) });
  }
}

// --- graph create ---------------------------------------------------------
// Two modes: --from <doc.json> (a full graph document), or explicit flags for a
// minimal single-node graph. --from is primary; flags exist for convenience.
function cmdGraphCreate(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const store = new GraphStore(cfg);
  const overwrite = args.bools.has("overwrite");

  if (args.flags["commands"] !== undefined) {
    throw new GorpError("INVALID_ARGUMENT", "--commands was removed: requiredCommands are structured {executable, args[]} objects since Sprint 3D — author them in a graph document and use --from", {
      flag: "commands",
    });
  }
  if (args.flags["repo"] !== undefined) {
    throw new GorpError("INVALID_ARGUMENT", "--repo was removed (Sprint 5A): execution state stores projectId only; the repository path is resolved from the project registry (registry/projects.yml, override GORP_PROJECT_REGISTRY)", {
      flag: "repo",
    });
  }

  let graph: ExecutionGraph;
  if (args.flags["from"]) {
    const doc = stripLegacyRepositoryPath(readJsonFile(args.flags["from"])) as Record<string, unknown>;
    // Force draft/unapproved on create regardless of the input document's claims:
    // approval only ever happens via an explicit transition.
    const forced: Record<string, unknown> = {
      ...doc,
      status: "draft",
      approvalStatus: "unapproved",
      transitions: [],
    };
    // Normalize provenance timestamp if absent.
    if (!forced["provenance"]) {
      forced["provenance"] = {
        createdBy: args.flags["actor-id"] ?? "operator",
        createdByType: "operator",
        createdAt: clock.now(),
        source: "operator cli",
      };
    }
    graph = forced as unknown as ExecutionGraph;
  } else {
    const node: GraphNode = {
      nodeId: args.flags["node-id"] ?? "node-1",
      taskType: args.flags["task-type"] ?? "fixture-mutation",
      objective: requireFlag(args, "objective"),
      acceptanceCriteria: [args.flags["acceptance"] ?? "artifact exists"],
      allowedPaths: (args.flags["allowed"] ?? ".gorp/fixtures/slice/**").split(","),
      forbiddenPaths: (args.flags["forbidden"] ?? "").split(",").filter((s) => s.length > 0),
      // Structured commands (executable/args) cannot be expressed in a CSV
      // flag without whitespace-splitting, which is forbidden; use --from.
      requiredCommands: [],
      expectedArtifacts: (args.flags["artifacts"] ?? "").split(",").filter((s) => s.length > 0),
      workerAdapter: args.flags["worker"] ?? "fixture",
      dependencies: [],
      state: "pending",
      attempt: 0,
    };
    graph = buildDraftGraph(
      {
        graphId: requireFlag(args, "graph-id"),
        project: {
          projectId: requireFlag(args, "project-id"),
        },
        baseCommit: requireFlag(args, "base-commit"),
        nodes: [node],
        createdBy: args.flags["actor-id"] ?? "operator",
        createdByType: "operator",
        source: "operator cli",
      },
      clock,
    );
  }

  const path = store.save(graph, { overwrite });
  return {
    success: true,
    command: "graph.create",
    ids: { graphId: graph.graphId, projectId: graph.project.projectId },
    data: { path, status: graph.status, approvalStatus: graph.approvalStatus },
  };
}

// --- graph validate -------------------------------------------------------
function cmdGraphValidate(args: ParsedArgs): CliResult {
  let value: unknown;
  if (args.flags["from"]) {
    value = readJsonFile(args.flags["from"]);
  } else {
    const cfg = loadConfig();
    const store = new GraphStore(cfg);
    value = store.load(requireFlag(args, "project-id"), requireFlag(args, "graph-id"));
  }
  const result = validateAgainst("execution-graph", value);
  if (!result.valid) {
    throw new GorpError("SCHEMA_VALIDATION_FAILED", "graph failed schema validation", {
      issues: result.issues,
    });
  }
  return {
    success: true,
    command: "graph.validate",
    data: { valid: true },
  };
}

// --- graph show -----------------------------------------------------------
function cmdGraphShow(args: ParsedArgs): CliResult {
  const cfg = loadConfig();
  const store = new GraphStore(cfg);
  const graph = store.load(requireFlag(args, "project-id"), requireFlag(args, "graph-id"));
  return {
    success: true,
    command: "graph.show",
    ids: { graphId: graph.graphId, projectId: graph.project.projectId },
    data: graph,
  };
}

// --- graph transition -----------------------------------------------------
function cmdGraphTransition(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const store = new GraphStore(cfg);
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const to = requireFlag(args, "to");
  const actorType = requireFlag(args, "actor-type");
  const actorId = requireFlag(args, "actor-id");
  const reasonCode = requireFlag(args, "reason-code");
  const reasonText = requireFlag(args, "reason");

  const graph = store.load(projectId, graphId);
  // applyGraphTransition throws (no side effect) on illegal transition / bad actor,
  // so nothing is persisted unless the transition is legal.
  const next = applyGraphTransition(
    graph,
    { to: to as ExecutionGraph["status"], actorType, actorId, reasonCode, reasonText },
    clock,
  );
  store.update(next);
  const last = next.transitions[next.transitions.length - 1]!;
  return {
    success: true,
    command: "graph.transition",
    ids: { graphId: next.graphId, projectId: next.project.projectId },
    data: {
      from: last.fromState,
      to: last.toState,
      status: next.status,
      approvalStatus: next.approvalStatus,
      transitionId: last.transitionId,
      actorType: last.actorType as ActorType,
    },
  };
}

// --- run (Wave B; explicit node since Sprint 2A) ------------------------------
async function cmdRun(args: ParsedArgs, clock: Clock): Promise<CliResult> {
  const cfg = loadConfig();
  const out = await executeRun(
    cfg,
    {
      projectId: requireFlag(args, "project-id"),
      graphId: requireFlag(args, "graph-id"),
      nodeId: requireFlag(args, "node-id"),
      actorId: args.flags["actor-id"] ?? "operator",
    },
    clock,
  );
  return {
    success: true,
    command: "run",
    ids: { graphId: requireFlag(args, "graph-id"), projectId: requireFlag(args, "project-id"), nodeId: out.nodeId, runId: out.runId },
    data: out,
  };
}

// --- review (Wave B, READ-ONLY; explicit node since Sprint 2A) ----------------
function cmdReview(args: ParsedArgs): CliResult {
  const cfg = loadConfig();
  const reviewInput = {
    projectId: requireFlag(args, "project-id"),
    graphId: requireFlag(args, "graph-id"),
    nodeId: requireFlag(args, "node-id"),
    ...(args.flags["run-id"] !== undefined ? { runId: args.flags["run-id"] } : {}),
  };
  const out = reviewRun(cfg, reviewInput);
  return {
    success: true,
    command: "review",
    ids: { graphId: reviewInput.graphId, projectId: reviewInput.projectId, nodeId: out.nodeId, runId: out.runId },
    data: out,
  };
}

// --- approve / reject / retry (Wave D; retry Sprint 5A) ------------------------
function cmdDecision(kind: "approve" | "reject" | "retry", args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const input = {
    projectId,
    graphId,
    nodeId: requireFlag(args, "node-id"),
    ...(args.flags["run-id"] !== undefined ? { runId: args.flags["run-id"] } : {}),
    actorId: requireFlag(args, "actor-id"),
    reason: requireFlag(args, "reason"),
    ...(args.flags["reviewed-commit"] !== undefined ? { reviewedCommit: args.flags["reviewed-commit"] } : {}),
  };
  const out =
    kind === "approve"
      ? executeApprove(cfg, input, clock)
      : kind === "reject"
        ? executeReject(cfg, input, clock)
        : executeRetry(cfg, input, clock);
  return {
    success: true,
    command: kind,
    ids: { graphId, projectId, nodeId: out.nodeId, runId: out.runId },
    data: out,
  };
}

// --- inspect (Wave D, READ-ONLY audit view) ------------------------------------
function cmdInspect(args: ParsedArgs): CliResult {
  const cfg = loadConfig();
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const out = inspectRun(cfg, {
    projectId,
    graphId,
    nodeId: requireFlag(args, "node-id"),
    ...(args.flags["run-id"] !== undefined ? { runId: args.flags["run-id"] } : {}),
    includeDiff: args.bools.has("diff"),
  });
  return {
    success: true,
    command: "inspect",
    ids: { graphId, projectId, nodeId: out.nodeId, runId: out.runId },
    data: out,
  };
}

// --- compile-graph: approved execution request -> draft graph ----------------
function cmdCompileGraph(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const sprintDoc = readJsonFile(requireFlag(args, "from"));
  // The sprint carries project IDENTITY only; the repository path (needed
  // just to read HEAD as the default base commit) comes from the registry.
  const projectId = (sprintDoc as { project?: { projectId?: string } }).project?.projectId;
  const baseCommit =
    args.flags["base-commit"] ??
    (projectId ? git(["rev-parse", "HEAD"], resolveProjectRepoPath(projectId)).stdout.trim() : undefined);
  if (!baseCommit) {
    throw new GorpError("INVALID_ARGUMENT", "cannot determine base commit: pass --base-commit or a sprint with a registered project.projectId", {});
  }
  const graph = compileGraph(sprintDoc, { baseCommit, clock });
  const store = new GraphStore(cfg);
  const path = store.save(graph, { overwrite: args.bools.has("overwrite") });
  return {
    success: true,
    command: "compile-graph",
    ids: { graphId: graph.graphId, projectId: graph.project.projectId },
    data: {
      path,
      baseCommit,
      status: graph.status,
      approvalStatus: graph.approvalStatus,
      nodes: graph.nodes.map((n) => ({ nodeId: n.nodeId, workerAdapter: n.workerAdapter, dependencies: n.dependencies })),
      note: "draft graph created by the graph compiler — it requires an explicit operator approval transition before any node can run",
    },
  };
}

// --- orchestrate (Sprint 3A): single-graph scheduler loop ----------------------
// The scheduler drives THIS CLI as subprocesses (public surface only, one
// crash boundary per action). It never imports runtime internals.
function cmdOrchestrate(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const actorId = args.flags["actor-id"] ?? "orchestrator:sched";
  const maxStepsRaw = args.flags["max-steps"];
  const policyName = args.flags["review-policy"] ?? "fixture";
  const profilesPath = args.flags["persona-profiles"];
  let reviewPolicy;
  try {
    reviewPolicy = resolveReviewPolicy(policyName);
  } catch {
    throw new GorpError("INVALID_ARGUMENT", `unknown review policy: ${policyName}`, {
      reviewPolicy: policyName,
      implemented: implementedReviewPolicies(),
    });
  }
  // Optional per-persona worker-profile bundle (guava-os resolves it; gorp
  // stays source-neutral). Keyed by persona label -> { model, systemPrompt }.
  let personaProfiles: Readonly<Record<string, { model: string; systemPrompt: string }>> | undefined;
  if (profilesPath) {
    const raw = readJsonFile(profilesPath);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new GorpError("INVALID_ARGUMENT", `--persona-profiles must be a JSON object keyed by persona label: ${profilesPath}`);
    }
    personaProfiles = raw as Record<string, { model: string; systemPrompt: string }>;
  }
  // Sprint 2.1: the outcome must survive a detached invocation whose stdout is
  // discarded — persist started/ended to the append-only per-graph status log.
  const started = recordOrchestrateStarted(cfg, projectId, graphId, actorId, clock);
  const result = runSchedulerLoop({
    cli: fileURLToPath(import.meta.url),
    projectId,
    graphId,
    reviewPolicy,
    actorId,
    ...(personaProfiles ? { personaProfiles } : {}),
    ...(maxStepsRaw !== undefined ? { maxSteps: Number.parseInt(maxStepsRaw, 10) } : {}),
  });
  recordOrchestrateEnded(cfg, projectId, graphId, started.invocationId, result, clock);
  if (result.outcome !== "completed") {
    // Stop is not silent: the machine state is the error payload.
    throw new GorpError("ORCHESTRATION_STOPPED", `scheduler stopped: ${result.reason}`, {
      reason: result.reason,
      graphStatus: result.graphStatus,
      nodeStates: result.nodeStates,
      stopState: result.stopState,
      steps: result.steps,
      invocationId: started.invocationId,
      mutation: false,
    });
  }
  return {
    success: true,
    command: "orchestrate",
    ids: { graphId, projectId },
    data: { ...result, invocationId: started.invocationId },
  };
}

// --- orchestrate-status (Sprint 2.1): pure read of the invocation log ----------
function cmdOrchestrateStatus(args: ParsedArgs): CliResult {
  const cfg = loadConfig();
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  return {
    success: true,
    command: "orchestrate-status",
    ids: { graphId, projectId },
    data: readOrchestratorStatus(cfg, projectId, graphId),
  };
}



/** Extract projectId from a sprint document with runtime narrowing. */
function sprintProjectId(doc: unknown): string | undefined {
  if (doc && typeof doc === "object" && "project" in doc) {
    const project = doc.project;
    if (project && typeof project === "object" && "projectId" in project) {
      const pid = project.projectId;
      if (typeof pid === "string") return pid;
    }
  }
  return undefined;
}


// --- reconcile (GOS-43): drift diff + explicit-operator-gated mutation ---------
function cmdReconcile(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const store = new GraphStore(cfg);
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const fromPath = requireFlag(args, "from");

  const graph = store.load(projectId, graphId);
  const sprintDoc = readJsonFile(fromPath);
  const drift = computeGraphDrift(graph, sprintDoc);

  const adopt = args.bools.has("adopt");
  const regenerate = args.bools.has("regenerate");

  if (adopt && regenerate) {
    throw new GorpError("INVALID_ARGUMENT", "--adopt and --regenerate are mutually exclusive", {});
  }


  if (adopt) {
    const spId = sprintProjectId(sprintDoc);
    if (spId !== undefined && spId !== projectId) {
      throw new GorpError("INVALID_ARGUMENT", "--adopt requires the sprint's project.projectId to match the graph's projectId", {
        sprintProjectId: spId ?? null,
        graphProjectId: projectId,
      });
    }
  }

  // ── Mutation gate: running/locked graph is read-only ──
  if (adopt || regenerate) {
    if (graph.status === "running") {
      throw new GorpError("STATE_CONFLICT", "graph is running — reconcile is read-only. Regenerate a fresh graph instead.", {
        graphId,
        projectId,
        graphStatus: graph.status,
      });
    }

    // Mutating reconcile: compile a new graph from sprint and persist with audit.
    const baseCommit = args.flags["base-commit"] ?? graph.baseCommit;
    const toGraphId = regenerate
      ? `${graphId}-regen-${clock.now().replace(/[:.]/g, "-")}`
      : graphId;

    const newGraph = compileGraph(sprintDoc, { baseCommit, clock });

    // Set the target graphId (for regenerate, override the sprint's sprintId)
    const targetGraph = regenerate
      ? { ...newGraph, graphId: toGraphId }
      : { ...newGraph, graphId };  // adopt: overwrite existing id

    if (regenerate) {
      store.save(targetGraph, { overwrite: false });
    } else {
      store.update(targetGraph);
    }

    const auditDir = join(cfg.stateHome, "projects", projectId, "graphs");
    mkdirSync(auditDir, { recursive: true });
    const auditChainPath = graphAuditChainPath(cfg, projectId, toGraphId);
    const reconcileRecordPath = join(auditDir, `${toGraphId}-reconcile.json`);
    const reconcileRecord = {
      schemaVersion: 1,
      kind: adopt ? "adopt" : "regenerate",
      projectId,
      fromGraphId: graphId,
      toGraphId,
      sprintSha256: fileSha256(fromPath),
      drift: {
        added: drift.added,
        removed: drift.removed,
        tasksChanged: drift.tasksChanged.map((c) => ({
          taskId: c.taskId,
          changes: c.changes.map((ch) => ({ field: ch.field, sprint: ch.sprint, graph: ch.graph })),
        })),
        dependenciesChanged: drift.dependenciesChanged,
        nodeStates: drift.nodeStates,
        hasDrift: drift.hasDrift,
      },
      operatedBy: args.flags["actor-id"] ?? "operator",
      operatedAt: clock.now(),
      fromSprint: fromPath,
    };
    const serialized = JSON.stringify(reconcileRecord, null, 2);
    writeFileSync(reconcileRecordPath, serialized, "utf8");
    appendChainEntry(
      auditChainPath,
      auditDir,
      "graph-reconcile",
      `${toGraphId}-reconcile.json`,
      reconcileRecordPath,
      clock,
    );

    return {
      success: true,
      command: "reconcile",
      ids: { graphId: toGraphId, projectId },
      data: {
        action: adopt ? "adopt" : "regenerate",
        fromGraphId: graphId,
        toGraphId,
        path: join(auditDir, `${toGraphId}.json`),
        drift,
        auditRecord: reconcileRecordPath,
        note:
          "reconciliation applied — the new graph is DRAFT/UNAPPROVED and requires an explicit operator approval transition before any node can run",
      },
    };
  }

  // ── Read-only: drift report ──
  return {
    success: true,
    command: "reconcile",
    ids: { graphId, projectId },
    data: {
      action: "report",
      graphStatus: graph.status,
      drift,
      note:
        graph.status === "running"
          ? "graph is RUNNING — mutation is blocked. Reconcile is read-only. To act on drift, regenerate a fresh graph."
          : "read-only drift report — pass --adopt or --regenerate to act on drift",
    },
  };
}

// --- promote (Waves C+D) -------------------------------------------------------
function cmdPromote(args: ParsedArgs, clock: Clock): CliResult {
  const cfg = loadConfig();
  const projectId = requireFlag(args, "project-id");
  const graphId = requireFlag(args, "graph-id");
  const out = executePromote(
    cfg,
    {
      projectId,
      graphId,
      nodeId: requireFlag(args, "node-id"),
      ...(args.flags["run-id"] !== undefined ? { runId: args.flags["run-id"] } : {}),
      actorId: requireFlag(args, "actor-id"),
    },
    clock,
  );
  return {
    success: true,
    command: "promote",
    ids: { graphId, projectId, nodeId: out.nodeId, runId: out.runId },
    data: out,
  };
}

function fail(command: string, err: GorpError): CliFailureExit {
  const result: CliResult = {
    success: false,
    command,
    error: { code: err.code, message: err.message, details: err.details as Record<string, unknown> },
  };
  return { result, exitCode: exitCodeFor(err.code) };
}

interface CliFailureExit {
  readonly result: CliResult;
  readonly exitCode: number;
}

export async function runCli(argvRaw: readonly string[], clock: Clock = systemClock): Promise<{ result: CliResult; exitCode: number }> {
  const argv = argvRaw.slice();
  const group = argv[0];
  const sub = argv[1];
  const rest = parseArgs(argv.slice(2));

  try {
    if (group === "graph") {
      switch (sub) {
        case "create":
          return { result: cmdGraphCreate(rest, clock), exitCode: EXIT_CODES.OK };
        case "validate":
          return { result: cmdGraphValidate(rest), exitCode: EXIT_CODES.OK };
        case "show":
          return { result: cmdGraphShow(rest), exitCode: EXIT_CODES.OK };
        case "transition":
          return { result: cmdGraphTransition(rest, clock), exitCode: EXIT_CODES.OK };
        default:
          throw new GorpError("INVALID_ARGUMENT", `unknown graph subcommand: ${sub ?? "(none)"}`, {
            subcommand: sub ?? null,
          });
      }
    }
    // run/review take no subcommand: their flags start at argv[1].
    if (group === "run") return { result: await cmdRun(parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "review") return { result: cmdReview(parseArgs(argv.slice(1))), exitCode: EXIT_CODES.OK };
    if (group === "approve") return { result: cmdDecision("approve", parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "reject") return { result: cmdDecision("reject", parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "retry") return { result: cmdDecision("retry", parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "inspect") return { result: cmdInspect(parseArgs(argv.slice(1))), exitCode: EXIT_CODES.OK };
    if (group === "promote") return { result: cmdPromote(parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "compile-graph") return { result: cmdCompileGraph(parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "reconcile") return { result: cmdReconcile(parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "orchestrate") return { result: cmdOrchestrate(parseArgs(argv.slice(1)), clock), exitCode: EXIT_CODES.OK };
    if (group === "orchestrate-status") return { result: cmdOrchestrateStatus(parseArgs(argv.slice(1))), exitCode: EXIT_CODES.OK };
 
    throw new GorpError("INVALID_ARGUMENT", `unknown command: ${group ?? "(none)"}`, {
      command: group ?? null,
      known: ["graph", "compile-graph", "run", "review", "approve", "reject", "retry", "promote", "inspect", "reconcile", "orchestrate", "orchestrate-status"],
    });
  } catch (e) {
    if (isGorpError(e)) {
      // Only `graph` has subcommands; for other groups argv[1] is a flag.
      const commandName = group ? (group === "graph" && sub ? `${group}.${sub}` : group) : "unknown";
      const f = fail(commandName, e);
      return { result: f.result, exitCode: f.exitCode };
    }
    // Unexpected error: wrap as STORAGE_FAILURE-ish generic, still structured.
    const wrapped = new GorpError("STORAGE_FAILURE", "unexpected runtime error", {
      cause: e instanceof Error ? e.message : String(e),
    });
    const f = fail("unknown", wrapped);
    return { result: f.result, exitCode: f.exitCode };
  }
}

async function main(): Promise<void> {
  const { result, exitCode } = await runCli(process.argv.slice(2));
  emit(result);
  process.exit(exitCode);
}

// Only auto-run when invoked directly (not when imported by tests).
if (process.argv[1] && (process.argv[1].endsWith("main.ts") || process.argv[1].endsWith("main.js"))) {
  main().catch((e) => {
    process.stderr.write(String(e) + "\n");
    process.exit(70);
  });
}
