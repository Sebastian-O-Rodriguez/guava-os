/**
 * Persisted graph store beneath the configured Gorp state root (outside any
 * consumer repository).
 *
 *   <stateHome>/projects/<project-id>/graphs/<graph-id>.json
 *
 * Guarantees:
 *  - validate-before-persist (schema)
 *  - reject duplicate graph IDs unless explicit overwrite
 *  - atomic writes (temp file + fsync + rename; prior state survives failure)
 *  - deterministic serialization
 *  - minimal single-host lock: refuse when a lock file exists
 *
 * Wave A is single-process/single-operator; no distributed locking.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeSync,
} from "node:fs";
import { atomicWrite } from "./atomic.js";
import { GorpError } from "../errors/index.js";
import {
  graphPath,
  graphsDir,
  lockPath,
  type RuntimeConfig,
} from "../config/index.js";
import type { ExecutionGraph } from "../contracts/types.js";
import { parseExecutionGraph } from "../contracts/validator.js";
import { serializeDeterministic } from "./serialize.js";

export interface StoreOptions {
  /** Allow overwriting an existing graph id (default false -> GRAPH_ALREADY_EXISTS). */
  readonly overwrite?: boolean;
}

/**
 * Lazy migration (Sprint 5A): graphs persisted before the projectId-only
 * identity carried absolute repository paths (top-level `repositoryPath` and
 * `project.repositoryPath`). Those fields are no longer part of the contract
 * (paths are resolved from the project registry at command time) and would
 * fail schema validation. Strip them from an untrusted parsed document; the
 * next save persists the migrated shape. Exported so document-loading CLI
 * paths (graph create --from) migrate identically.
 */
export function stripLegacyRepositoryPath(parsed: unknown): unknown {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const doc = parsed as Record<string, unknown>;
    delete doc["repositoryPath"];
    const project = doc["project"];
    if (project && typeof project === "object" && !Array.isArray(project)) {
      delete (project as Record<string, unknown>)["repositoryPath"];
    }
  }
  return parsed;
}

function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", "cannot create state directory", { dir, cause: String(e) });
  }
}

function acquireLock(path: string): void {
  if (existsSync(path)) {
    throw new GorpError("LOCKED", "graph lock present (another writer?)", { lock: path });
  }
  try {
    // 'wx' fails if the file already exists -> race-safe on a single host.
    const fd = openSync(path, "wx");
    writeSync(fd, `${process.pid}\n`);
    fsyncSync(fd);
    closeSync(fd);
  } catch (e) {
    throw new GorpError("LOCKED", "cannot acquire graph lock", { lock: path, cause: String(e) });
  }
}

function releaseLock(path: string): void {
  try {
    rmSync(path, { force: true });
  } catch {
    /* best-effort */
  }
}

export class GraphStore {
  constructor(private readonly cfg: RuntimeConfig) {}

  exists(projectId: string, graphId: string): boolean {
    return existsSync(graphPath(this.cfg, projectId, graphId));
  }

  /** Validate + persist a graph. Enforces duplicate protection and locking.
   *  Sprint 2A: the store no longer enforces any node-count/dependency shape —
   *  multi-node graphs persist; shape rules live in run policy (run/policy.ts). */
  save(graph: ExecutionGraph, opts: StoreOptions = {}): string {
    // Validate against canonical schema (throws SCHEMA_VALIDATION_FAILED).
    parseExecutionGraph(graph);

    const dir = graphsDir(this.cfg, graph.project.projectId);
    ensureDir(dir);
    const target = graphPath(this.cfg, graph.project.projectId, graph.graphId);

    if (existsSync(target) && !opts.overwrite) {
      throw new GorpError("GRAPH_ALREADY_EXISTS", "graph id already exists", {
        projectId: graph.project.projectId,
        graphId: graph.graphId,
      });
    }

    const lock = lockPath(this.cfg, graph.project.projectId, graph.graphId);
    acquireLock(lock);
    try {
      atomicWrite(target, serializeDeterministic(graph));
    } finally {
      releaseLock(lock);
    }
    return target;
  }

  /** Load + validate a persisted graph. */
  load(projectId: string, graphId: string): ExecutionGraph {
    const target = graphPath(this.cfg, projectId, graphId);
    if (!existsSync(target)) {
      throw new GorpError("GRAPH_NOT_FOUND", "graph not found", { projectId, graphId });
    }
    let raw: string;
    try {
      raw = readFileSync(target, "utf8");
    } catch (e) {
      throw new GorpError("STORAGE_FAILURE", "cannot read graph", { target, cause: String(e) });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown; // contained parse boundary
    } catch (e) {
      throw new GorpError("STORAGE_FAILURE", "graph file is not valid JSON", { target, cause: String(e) });
    }
    return parseExecutionGraph(stripLegacyRepositoryPath(parsed));
  }

  /**
   * Persist an updated graph that already exists (transition path). Requires
   * the graph file to exist; performs atomic overwrite under lock.
   */
  update(graph: ExecutionGraph): string {
    const target = graphPath(this.cfg, graph.project.projectId, graph.graphId);
    if (!existsSync(target)) {
      throw new GorpError("GRAPH_NOT_FOUND", "graph not found for update", {
        projectId: graph.project.projectId,
        graphId: graph.graphId,
      });
    }
    parseExecutionGraph(graph);
    const lock = lockPath(this.cfg, graph.project.projectId, graph.graphId);
    acquireLock(lock);
    try {
      atomicWrite(target, serializeDeterministic(graph));
    } finally {
      releaseLock(lock);
    }
    return target;
  }
}

export { serializeDeterministic } from "./serialize.js";
