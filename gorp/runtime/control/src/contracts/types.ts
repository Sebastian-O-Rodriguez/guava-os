/**
 * Domain types mirroring specs/runtime/execution-graph.schema.json.
 *
 * These are the explicit domain types used throughout the runtime. Untrusted
 * external input is parsed as `unknown` and narrowed to these types ONLY after
 * JSON Schema validation (see validator.ts).
 */

export type ActorType = "operator" | "orchestrator" | "system";

export type GraphState =
  | "draft"
  | "approved"
  | "running"
  | "blocked"
  | "failed"
  | "completed"
  | "cancelled";

export type NodeState =
  | "pending"
  | "ready"
  | "running"
  | "blocked"
  | "failed"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "promoted"
  | "cancelled";

export type ApprovalStatus = "unapproved" | "approved";
export type EntityType = "graph" | "node";

export interface TransitionRecord {
  readonly transitionId: string;
  readonly entityType: EntityType;
  readonly entityId: string;
  readonly fromState: string;
  readonly toState: string;
  readonly actorType: ActorType;
  readonly actorId: string;
  readonly reasonCode: string;
  readonly reasonText: string;
  readonly timestamp: string;
}

export interface Provenance {
  readonly createdBy: string;
  readonly createdByType: ActorType;
  readonly createdAt: string;
  readonly source?: string;
}

/**
 * Project identity only. The repository path is NEVER part of execution
 * state: it is resolved from the Gorp project registry at command time
 * (registry/projects.ts), so persisted graphs survive workspace moves.
 */
export interface ProjectIdentity {
  readonly projectId: string;
}

/** A project check command: exact executable + argv, no shell, no splitting. */
export interface RequiredCommand {
  readonly executable: string;
  readonly args: readonly string[];
  readonly timeoutMs?: number;
}

export interface GraphNode {
  readonly nodeId: string;
  readonly taskType: string;
  readonly objective: string;
  readonly acceptanceCriteria: readonly string[];
  readonly allowedPaths: readonly string[];
  readonly forbiddenPaths: readonly string[];
  readonly requiredCommands: readonly RequiredCommand[];
  readonly expectedArtifacts: readonly string[];
  readonly workerAdapter: string;
  readonly dependencies: readonly string[];
  readonly state: NodeState;
  readonly attempt: number;
  readonly persona?: string;
}

export interface ExecutionGraph {
  readonly schemaVersion: 1;
  readonly graphId: string;
  readonly project: ProjectIdentity;
  readonly baseCommit: string;
  readonly approvalStatus: ApprovalStatus;
  readonly provenance: Provenance;
  readonly status: GraphState;
  readonly nodes: readonly GraphNode[];
  readonly transitions: readonly TransitionRecord[];
}

// --- Wave B result/record contracts (mirror specs/runtime/*.schema.json) ----

export type WorkerOutcome = "succeeded" | "failed" | "blocked";

export interface WorkerUsage {
  /** Input/prompt tokens consumed. */
  tokensIn?: number;
  /** Output/completion tokens produced. */
  tokensOut?: number;
  /** Total tokens, provider-reported. */
  tokensTotal?: number;
  /** Cost in USD, provider-reported (never estimated/invented). */
  costUsd?: number;
  /** Wall-clock duration of the worker invocation, in milliseconds. */
  durationMs?: number;
}

export interface WorkerResult {
  readonly schemaVersion: 1;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId: string;
  readonly workerAdapter: string;
  readonly outcome: WorkerOutcome;
  readonly exitCode?: number;
  /** The worker's own account of the attempt. Required at the adapter boundary for new results. */
  readonly summary?: string;
  /** Files the worker intended/expected to change — its claim, checked against git. */
  readonly expectedFiles?: readonly string[];
  /** Free-text notes addressed to the human reviewer. */
  readonly reviewerNotes?: string;
  /** Computed from git by the adapter, never the worker process's claim. */
  readonly changedFiles?: readonly string[];
  readonly commandsExecuted?: ReadonlyArray<{ readonly command: string; readonly exitCode: number }>;
  readonly artifactRefs?: readonly string[];
  readonly blocker?: { readonly code: string; readonly detail: string; readonly irreducible?: boolean };
  readonly startedAt: string;
  readonly endedAt: string;
  readonly usage?: WorkerUsage;
}

export type CheckStatus = "passed" | "failed";
export type ReviewStatus = "pending" | "approved" | "rejected" | "retry_requested" | "escalated";

export interface GateCheck {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail?: string;
}

export interface GateRecord {
  readonly schemaVersion: 1;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId?: string;
  readonly validation: {
    readonly status: CheckStatus;
    readonly checks: readonly GateCheck[];
    readonly artifactHash?: string;
  };
  readonly review: {
    readonly status: ReviewStatus;
    readonly reviewer?: string;
    readonly reason?: string;
    readonly reviewedArtifactHash?: string;
    readonly decidedAt?: string;
  };
}

export interface ReviewDecision {
  readonly schemaVersion: 1;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId: string;
  readonly decision: "approved" | "rejected" | "retry";
  readonly reviewer: string;
  readonly reason: string;
  readonly reviewedArtifactHash: string;
  readonly gateRecordSha256: string;
  readonly decidedAt: string;
}

export interface PromotionRecord {
  readonly schemaVersion: 1;
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId: string;
  readonly baseCommit: string;
  readonly promotedCommit: string;
  readonly resultCommit: string;
  readonly reviewDecisionSha256: string;
  readonly promotedBy: string;
  readonly promotedAt: string;
}

export type RunFinalStatus = "succeeded" | "failed" | "blocked" | "rejected" | "cancelled";

export interface RunRecord {
  readonly schemaVersion: 1;
  readonly runId: string;
  readonly graphId: string;
  readonly nodeId: string;
  readonly projectId: string;
  readonly governanceVersion: string;
  readonly baseCommit: string;
  readonly workerAdapter: string;
  readonly sandboxIdentity?: string;
  readonly workerResultRef?: string;
  readonly gateRecordRef?: string;
  readonly promotionResult?: {
    readonly status: "promoted" | "not_promoted" | "conflict";
    readonly resultCommit?: string;
    readonly detail?: string;
  };
  readonly controlDecisions?: ReadonlyArray<{
    readonly decision: string;
    readonly reasonCode: string;
    readonly reasonText?: string;
    readonly at?: string;
  }>;
  readonly finalStatus: RunFinalStatus;
  readonly startedAt: string;
  readonly profile?: {
    readonly persona?: string;
    readonly model?: string;
    readonly role?: string;
    /** sha256 of the resolved worker profile (persona body + model), GOS-46. */
    readonly promptHash?: string;
  };
  readonly endedAt?: string;
  readonly usage?: WorkerUsage;
}
