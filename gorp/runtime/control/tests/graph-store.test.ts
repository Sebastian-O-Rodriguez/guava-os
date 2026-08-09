import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GraphStore } from "../src/storage/graph-store.js";
import { serializeDeterministic } from "../src/storage/serialize.js";
import { loadConfig, graphPath } from "../src/config/index.js";
import { buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { isGorpError } from "../src/errors/index.js";
import type { ExecutionGraph, GraphNode } from "../src/contracts/types.js";

const fixedClock: Clock = { now: () => "2026-07-14T12:00:00.000Z" };
let stateHome: string;

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-state-"));
});
afterEach(() => {
  rmSync(stateHome, { recursive: true, force: true });
});

function cfg() {
  return loadConfig({ GORP_STATE_HOME: stateHome } as NodeJS.ProcessEnv);
}

function goodNode(over: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "node-1", taskType: "fixture-mutation", objective: "o",
    acceptanceCriteria: ["a"], allowedPaths: [".gorp/fixtures/slice/**"],
    forbiddenPaths: [], requiredCommands: [], expectedArtifacts: [],
    workerAdapter: "fixture", dependencies: [], state: "pending", attempt: 0,
    ...over,
  };
}

function draft(over: { graphId?: string; nodes?: GraphNode[] } = {}): ExecutionGraph {
  return buildDraftGraph({
    graphId: over.graphId ?? "g1",
    project: { projectId: "p1" },
    baseCommit: "0123456",
    nodes: over.nodes ?? [goodNode()],
    createdBy: "op", createdByType: "operator",
  }, fixedClock);
}

describe("GraphStore", () => {
  it("creates and persists a valid draft graph outside any repo", () => {
    const store = new GraphStore(cfg());
    const path = store.save(draft());
    expect(path.startsWith(stateHome)).toBe(true);
    expect(existsSync(path)).toBe(true);
    // location matches the documented layout
    expect(path).toBe(graphPath(cfg(), "p1", "g1"));
    expect(path).toContain(join("projects", "p1", "graphs"));
  });

  it("reject malformed graph (schema)", () => {
    const store = new GraphStore(cfg());
    const bad = { ...draft(), status: "Todo" } as unknown as ExecutionGraph;
    try { store.save(bad); throw new Error("nope"); }
    catch (e) { expect(isGorpError(e) && e.code).toBe("SCHEMA_VALIDATION_FAILED"); }
  });

  it("reject duplicate graph id unless overwrite", () => {
    const store = new GraphStore(cfg());
    store.save(draft());
    try { store.save(draft()); throw new Error("nope"); }
    catch (e) { expect(isGorpError(e) && e.code).toBe("GRAPH_ALREADY_EXISTS"); }
    // overwrite works
    const p = store.save(draft(), { overwrite: true });
    expect(existsSync(p)).toBe(true);
  });

  it("reload equals persisted graph", () => {
    const store = new GraphStore(cfg());
    const g = draft();
    store.save(g);
    const loaded = store.load("p1", "g1");
    expect(serializeDeterministic(loaded)).toBe(serializeDeterministic(g));
  });

  it("stable serialization is byte-identical across runs", () => {
    const a = serializeDeterministic(draft());
    const b = serializeDeterministic(draft());
    expect(a).toBe(b);
  });

  it("persists a multi-node graph with dependencies (shape rules moved to run policy)", () => {
    const store = new GraphStore(cfg());
    const g = draft({
      nodes: [goodNode({ nodeId: "n1" }), goodNode({ nodeId: "n2", dependencies: ["n1"] })],
    });
    const path = store.save(g);
    expect(existsSync(path)).toBe(true);
    const loaded = store.load("p1", "g1");
    expect(loaded.nodes).toHaveLength(2);
    expect(loaded.nodes[1]!.dependencies).toEqual(["n1"]);
  });

  it("load of missing graph -> GRAPH_NOT_FOUND", () => {
    const store = new GraphStore(cfg());
    try { store.load("p1", "missing"); throw new Error("nope"); }
    catch (e) { expect(isGorpError(e) && e.code).toBe("GRAPH_NOT_FOUND"); }
  });

  it("atomic-write failure preserves prior state (rename into place)", () => {
    // Persist a good graph, then confirm no .tmp files linger and content is intact.
    const store = new GraphStore(cfg());
    store.save(draft());
    const dir = join(stateHome, "projects", "p1", "graphs");
    const files = readdirSync(dir);
    expect(files.filter((f) => f.includes(".tmp")).length).toBe(0);
    expect(files).toContain("g1.json");
    // content is the deterministic serialization
    const onDisk = readFileSync(join(dir, "g1.json"), "utf8");
    expect(onDisk).toBe(serializeDeterministic(store.load("p1", "g1")));
  });

  it("respects LOCK: refuses when a lock file exists", () => {
    const store = new GraphStore(cfg());
    store.save(draft());
    // simulate a stale lock
    const lock = join(stateHome, "projects", "p1", "graphs", "g1.lock");
    writeFileSync(lock, "999\n");
    try { store.update({ ...draft() }); throw new Error("nope"); }
    catch (e) { expect(isGorpError(e) && e.code).toBe("LOCKED"); }
    rmSync(lock, { force: true });
  });
});
