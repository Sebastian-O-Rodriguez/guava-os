/**
 * Deterministic fixture worker (Wave B).
 *
 * The deterministic fixture worker adapter. It performs one simple,
 * useful, fully deterministic task: materialize the node's expected artifacts
 * inside the sandbox (create or overwrite files with content derived solely
 * from the graph/node identity and objective), then record exactly one
 * sandbox commit.
 *
 * Boundaries (enforced here, re-verified by the gate):
 *  - writes ONLY inside the sandbox directory (path-traversal guard);
 *  - never touches the graph store — a worker has no way to transition graph
 *    state or modify topology (it is not even an authorized actor type);
 *  - no network, no AI, no background processes, no retries.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { GorpError } from "../errors/index.js";
import type { GraphNode, WorkerResult } from "../contracts/types.js";
import type { Clock } from "../graph/graph.js";
import { git, type Sandbox } from "../sandbox/worktree.js";

export const FIXTURE_ADAPTER = "fixture";

const WORKER_NAME = "gorp-fixture-worker";
const WORKER_EMAIL = "fixture-worker@gorp.local";

export interface FixtureWorkerInput {
  readonly sandbox: Sandbox;
  readonly graphId: string;
  readonly runId: string;
  readonly node: GraphNode;
  readonly clock: Clock;
}

/** Deterministic file content: derived only from stable identifiers. */
export function fixtureContent(graphId: string, nodeId: string, runId: string, node: GraphNode, artifact: string): string {
  const lines = [
    `# ${node.objective}`,
    ``,
    `artifact: ${artifact}`,
    `graph: ${graphId}`,
    `node: ${nodeId}`,
    `run: ${runId}`,
    `task-type: ${node.taskType}`,
    ``,
    `acceptance criteria:`,
    ...node.acceptanceCriteria.map((c) => `- ${c}`),
    ``,
  ];
  return lines.join("\n");
}

function assertInsideSandbox(sandboxDir: string, artifact: string): string {
  if (isAbsolute(artifact) || artifact.split(/[\\/]/).includes("..")) {
    throw new GorpError("WORKER_FAILED", "artifact path must be relative and traversal-free", { artifact });
  }
  const target = resolve(join(sandboxDir, artifact));
  const rel = relative(resolve(sandboxDir), target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new GorpError("WORKER_FAILED", "artifact path escapes the sandbox", { artifact });
  }
  if (rel === ".git" || rel.startsWith(`.git${sep}`)) {
    throw new GorpError("WORKER_FAILED", "artifact path may not target .git", { artifact });
  }
  return target;
}

/**
 * Run the fixture worker inside the sandbox. Returns a schema-shaped
 * WorkerResult; throws WORKER_FAILED (fail closed) on any violation.
 */
export function runFixtureWorker(input: FixtureWorkerInput): WorkerResult {
  const { sandbox, graphId, runId, node, clock } = input;
  const startedAt = clock.now();

  // Adapter-name resolution is the registry's job (worker/adapter.ts); this
  // worker only ever sees invocations already routed to it.
  if (node.expectedArtifacts.length === 0) {
    throw new GorpError("WORKER_FAILED", "fixture worker requires at least one expectedArtifact", {
      nodeId: node.nodeId,
    });
  }

  // 1. Materialize the expected artifacts (deterministic content).
  for (const artifact of node.expectedArtifacts) {
    const target = assertInsideSandbox(sandbox.dir, artifact);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, fixtureContent(graphId, node.nodeId, runId, node, artifact), "utf8");
  }

  // 2. Record exactly ONE sandbox commit (the artifact review/promotion binds to).
  const when = clock.now();
  git(["add", "--all"], sandbox.dir);
  git(
    [
      "-c", `user.name=${WORKER_NAME}`,
      "-c", `user.email=${WORKER_EMAIL}`,
      "commit", "-q",
      "-m", `gorp(${graphId}/${node.nodeId}): ${node.objective}`,
    ],
    sandbox.dir,
    { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
  );

  const artifacts = [...node.expectedArtifacts].sort();
  return {
    schemaVersion: 1,
    graphId,
    nodeId: node.nodeId,
    runId,
    workerAdapter: FIXTURE_ADAPTER,
    outcome: "succeeded",
    exitCode: 0,
    summary: `deterministic fixture worker materialized ${artifacts.length} expected artifact(s) for: ${node.objective}`,
    expectedFiles: artifacts,
    reviewerNotes: "fixture worker: file content is derived solely from graph/node identity; no external input was consulted",
    changedFiles: artifacts,
    artifactRefs: artifacts,
    commandsExecuted: [],
    startedAt,
    endedAt: clock.now(),
  };
}
