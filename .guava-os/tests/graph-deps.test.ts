import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { formatStatus } from "../src/status.js";
import { generateNext } from "../src/next.js";
import { loadConfig, findRepoRoot } from "../src/config.js";

const config = loadConfig(findRepoRoot());

function issue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    id: overrides.id,
    identifier: overrides.identifier ?? overrides.id,
    title: "Task",
    status: "Todo",
    statusType: "unstarted",
    priority: { value: 2, name: "High" },
    labels: [],
    project: "guava-os",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    canceledAt: null,
    ...overrides,
  };
}

const PARENT = "p-1";
const A = "t-a";
const B = "t-b";
const C = "t-c";

function graph(issues: LinearIssue[]) {
  return buildGraph(issues, config);
}

/** Parent + A(Todo, backend) blocks B(Todo, backend) ; C(Todo, backend) free. */
function board(overrides: { aBlocksB?: boolean; aDone?: boolean } = {}): LinearIssue[] {
  const aBlocksB = overrides.aBlocksB ?? true;
  const aDone = overrides.aDone ?? false;
  return [
    issue({ id: PARENT, title: "Parent", labels: [], status: "Todo", statusType: "unstarted" }),
    issue({
      id: A, title: "A", parentId: PARENT, labels: ["backend"],
      status: aDone ? "Done" : "Todo",
      statusType: aDone ? "completed" : "unstarted",
      blocks: aBlocksB ? [B] : [],
    }),
    issue({ id: B, title: "B", parentId: PARENT, labels: ["backend"] }),
    issue({ id: C, title: "C", parentId: PARENT, labels: ["backend"] }),
  ];
}

describe("GOS-28 buildGraph dependency edges", () => {
  it("marks capability loaded when blocks data present", () => {
    const g = graph(board());
    expect(g.capabilities.dependencyRelationsLoaded).toBe(true);
  });

  it("keeps capability false when no relation data", () => {
    const g = graph(board({ aBlocksB: false }));
    expect(g.capabilities.dependencyRelationsLoaded).toBe(false);
  });

  it("classifies blocked work as NOT executable", () => {
    const g = graph(board());
    const persona = g.executable.get("backend")!;
    // A (the blocker) is executable; B (blocked) is not; C is free
    expect(persona.map((s) => s.id)).toEqual(["t-a", "t-c"]);
    const blocked = g.blocked.find((b) => b.id === B)!;
    expect(blocked.persona).toBe("backend");
    expect(blocked.reason).toContain("A");
    expect(g.summary.totalBlocked).toBe(1);
  });

  it("unblocks when the blocker completes", () => {
    const g = graph(board({ aDone: true }));
    // A completed is skipped by the classifier entirely; B and C are free
    expect(g.executable.get("backend")!.map((s) => s.id).sort()).toEqual(["t-b", "t-c"]);
    expect(g.blocked).toEqual([]);
  });

it("ignores relations when no data was loaded (legacy behavior)", () => {
    const g = graph(board({ aBlocksB: false }));
    // no relation data: A, B, C all executable (blocker check unavailable)
    expect(g.executable.get("backend")!.map((s) => s.id).sort()).toEqual(["t-a", "t-b", "t-c"]);
    expect(g.blocked).toEqual([]);
  });
});

describe("GOS-28 status/next consumption", () => {
  it("status prints the blocked queue with reason when loaded", () => {
    const g = graph(board());
    const out = formatStatus(g);
    expect(out).toContain("BLOCKED");
    expect(out).toContain("blocked by: A");
    expect(out).not.toContain("dependency relations not loaded");
  });

  it("status keeps the unavailable banner when not loaded", () => {
    const g = graph(board({ aBlocksB: false }));
    expect(formatStatus(g)).toContain("dependency relations not loaded");
  });

  it("next never emits a blocked issue and reports them in context", () => {
    const g = graph(board());
    const result = generateNext(g, config);
    // one directive per persona = only the top executable (A); B (blocked) never.
    expect(result.directives.some((d) => d.issue_id === B)).toBe(false);
    expect(result.directives.some((d) => d.issue_id === A)).toBe(true);
    const ctx = JSON.stringify(result);
    expect(ctx).toContain("blocked by unresolved dependencies");
  });
});