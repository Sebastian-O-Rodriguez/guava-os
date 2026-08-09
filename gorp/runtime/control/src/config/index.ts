/**
 * Runtime-state boundary and configuration.
 *
 * Authoritative runtime state lives OUTSIDE consumer repositories, under a
 * configurable state root:
 *   default: ~/.local/state/gorp
 *   override: GORP_STATE_HOME
 *
 * Layout (Sprint 2A: run paths are per graph+node+run):
 *   <stateHome>/projects/<project-id>/graphs/<graph-id>.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/run-record.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/worker-result.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/gate-record.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/review-decision.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/promotion-record.json
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/audit-chain.jsonl
 *   <stateHome>/projects/<project-id>/runs/<graph-id>/<node-id>/<run-id>/sandbox/   (git worktree)
 */

import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface RuntimeConfig {
  /** Absolute path to the authoritative state root. */
  readonly stateHome: string;
}

/** Resolve the state root from the environment, defaulting under the home dir. */
export function resolveStateHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env["GORP_STATE_HOME"];
  if (override && override.trim().length > 0) {
    return resolve(override.trim());
  }
  return join(homedir(), ".local", "state", "gorp");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return { stateHome: resolveStateHome(env) };
}

export function projectsDir(cfg: RuntimeConfig): string {
  return join(cfg.stateHome, "projects");
}

export function projectDir(cfg: RuntimeConfig, projectId: string): string {
  return join(projectsDir(cfg), projectId);
}

export function graphsDir(cfg: RuntimeConfig, projectId: string): string {
  return join(projectDir(cfg, projectId), "graphs");
}

export function graphPath(cfg: RuntimeConfig, projectId: string, graphId: string): string {
  return join(graphsDir(cfg, projectId), `${graphId}.json`);
}

export function lockPath(cfg: RuntimeConfig, projectId: string, graphId: string): string {
  return join(graphsDir(cfg, projectId), `${graphId}.lock`);
}

export function runsDir(cfg: RuntimeConfig, projectId: string): string {
  return join(projectDir(cfg, projectId), "runs");
}

export function orchestratorDir(cfg: RuntimeConfig, projectId: string): string {
  return join(projectDir(cfg, projectId), "orchestrator");
}

/** Append-only invocation log of every `gorp orchestrate` over one graph. */
export function orchestratorLogPath(cfg: RuntimeConfig, projectId: string, graphId: string): string {
  return join(orchestratorDir(cfg, projectId), `${graphId}.jsonl`);
}

/** Identity of one node run: every run path is keyed by graph + node + run. */
export interface RunRef {
  readonly graphId: string;
  readonly nodeId: string;
  readonly runId: string;
}

export function runDir(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runsDir(cfg, projectId), ref.graphId, ref.nodeId, ref.runId);
}

export function sandboxDir(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "sandbox");
}

export function workerResultPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "worker-result.json");
}

export function gateRecordPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "gate-record.json");
}

export function runRecordPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "run-record.json");
}

export function reviewDecisionPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "review-decision.json");
}

export function promotionRecordPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "promotion-record.json");
}

export function auditChainPath(cfg: RuntimeConfig, projectId: string, ref: RunRef): string {
  return join(runDir(cfg, projectId, ref), "audit-chain.jsonl");
}
