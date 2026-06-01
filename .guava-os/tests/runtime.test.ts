import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { formatStatus, formatStatusJson } from "../src/status.js";
import { runDoctor } from "../src/doctor.js";
import type { Config } from "../src/config.js";

const TEST_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
  personas: ["architect", "backend", "frontend", "qa"],
  statuses: {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
    in_review: "In Review", done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  labels: { persona_labels: ["architect", "backend", "frontend"], qa_label: "qa" },
  invariants: {
    max_todo_per_persona: 3, stale_hours: 48, reclaim_limit: 2,
    bulk_threshold: 5, max_subtasks_per_parent: 3,
  },
  branch_pattern: "feat/{prefix}-{id}-{slug}",
  agent_files: {},
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

function makeIssue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    title: overrides.id,
    status: "Backlog",
    statusType: "backlog",
    priority: { value: 3, name: "Medium" },
    labels: [],
    project: "TestProject",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    completedAt: null,
    canceledAt: null,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────
// Runtime Consistency
// ──────────────────────────────────────────────────────────────────

describe("runtime consistency", () => {
  it("human and JSON output derive from the same graph.summary", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Backlog", statusType: "backlog", labels: ["frontend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    const humanOutput = formatStatus(graph);
    const jsonOutput = formatStatusJson(graph) as any;

    const summaryLine = humanOutput.split("\n").find(l => l.startsWith("SUMMARY:"))!;
    expect(summaryLine).toContain(`${graph.summary.totalExecutable} executable`);
    expect(summaryLine).toContain(`${graph.summary.totalNotPromoted} not promoted`);
    expect(summaryLine).toContain(`${graph.summary.totalBlocked} blocked`);
    expect(summaryLine).toContain(`${graph.summary.totalInvalid} invalid`);

    expect(jsonOutput.summary.totalExecutable).toBe(graph.summary.totalExecutable);
    expect(jsonOutput.summary.totalNotPromoted).toBe(graph.summary.totalNotPromoted);
    expect(jsonOutput.summary.totalBlocked).toBe(graph.summary.totalBlocked);
    expect(jsonOutput.summary.totalInvalid).toBe(graph.summary.totalInvalid);
    expect(jsonOutput.summary.activeParentCount).toBe(graph.summary.activeParentCount);
  });

  it("executable counts match executable arrays", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["architect"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["frontend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);

    let arrayTotal = 0;
    for (const [, queue] of graph.executable) {
      arrayTotal += queue.length;
    }

    expect(graph.summary.totalExecutable).toBe(arrayTotal);
    expect(graph.summary.totalExecutable).toBe(3);
  });

  it("persona queues are deterministic for identical input", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1", priority: { value: 2, name: "High" }, updatedAt: "2026-01-02" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1", priority: { value: 1, name: "Urgent" }, updatedAt: "2026-01-01" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1", priority: { value: 2, name: "High" }, updatedAt: "2026-01-01" }),
    ];

    const graph1 = buildGraph(issues, TEST_CONFIG);
    const graph2 = buildGraph(issues, TEST_CONFIG);

    const q1 = graph1.executable.get("backend")!;
    const q2 = graph2.executable.get("backend")!;

    expect(q1.map(s => s.id)).toEqual(q2.map(s => s.id));
    expect(q1[0].id).toBe("TST-11"); // P0/Urgent
    expect(q1[1].id).toBe("TST-12"); // P1/High, older
    expect(q1[2].id).toBe("TST-10"); // P1/High, newer
  });

  it("classification is deterministic for identical input", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Backlog", statusType: "backlog", labels: ["frontend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: [], parentId: "TST-1" }),
    ];

    const g1 = buildGraph(issues, TEST_CONFIG);
    const g2 = buildGraph(issues, TEST_CONFIG);

    expect(g1.summary).toEqual(g2.summary);
    expect(g1.notPromoted.map(s => s.id)).toEqual(g2.notPromoted.map(s => s.id));
    expect(g1.invalid.map(s => s.id)).toEqual(g2.invalid.map(s => s.id));
    expect(g1.blocked.map(s => s.id)).toEqual(g2.blocked.map(s => s.id));
  });
});

// ──────────────────────────────────────────────────────────────────
// Classification Correctness
// ──────────────────────────────────────────────────────────────────

describe("classification correctness", () => {
  it("sub-issues in Backlog are NOT_PROMOTED, not BLOCKED", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: ["backend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.notPromoted.length).toBe(1);
    expect(graph.notPromoted[0].id).toBe("TST-10");
    expect(graph.blocked.length).toBe(0);
  });

  it("sub-issues with missing persona label are INVALID", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: [], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.invalid.length).toBe(1);
    expect(graph.invalid[0].violation).toBe("missing persona label");
    expect(graph.summary.totalExecutable).toBe(0);
  });

  it("sub-issues with inactive parent are INVALID", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.invalid.length).toBe(1);
    expect(graph.invalid[0].violation).toContain("not active");
  });

  it("sub-issues with multiple persona labels are INVALID", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend", "frontend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.invalid.length).toBe(1);
    expect(graph.invalid[0].violation).toContain("multiple persona labels");
  });

  it("eligible Todo sub-issues with active parent are EXECUTABLE", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.summary.totalExecutable).toBe(1);
    expect(graph.executable.get("backend")![0].id).toBe("TST-10");
  });

  it("canceled issues are excluded entirely", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1", canceledAt: "2026-01-05" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.summary.totalExecutable).toBe(0);
    expect(graph.notPromoted.length).toBe(0);
    expect(graph.invalid.length).toBe(0);
  });

  it("completed sub-issues are excluded from all categories", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Done", statusType: "completed", labels: ["backend"], parentId: "TST-1", completedAt: "2026-01-05" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.summary.totalExecutable).toBe(0);
    expect(graph.notPromoted.length).toBe(0);
    expect(graph.blocked.length).toBe(0);
    expect(graph.invalid.length).toBe(0);
  });

  it("In Progress sub-issues are not in any category", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "In Progress", statusType: "started", labels: ["backend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.summary.totalExecutable).toBe(0);
    expect(graph.notPromoted.length).toBe(0);
    expect(graph.blocked.length).toBe(0);
    expect(graph.invalid.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Read-Only Guarantee
// ──────────────────────────────────────────────────────────────────

describe("read-only guarantee", () => {
  it("no mutation-named functions exist in linear module exports", async () => {
    const linearModule = await import("../src/linear.js");
    const exportNames = Object.keys(linearModule);

    const mutationPatterns = /^(save|create|update|delete|remove|set|assign|move|transition|write|push|post|patch|put)/i;
    for (const name of exportNames) {
      if (typeof (linearModule as any)[name] === "function") {
        expect(name).not.toMatch(mutationPatterns);
      }
    }
  });

  it("no mutation-named functions exist in status module exports", async () => {
    const statusModule = await import("../src/status.js");
    const exportNames = Object.keys(statusModule);

    const mutationPatterns = /^(save|create|update|delete|remove|set|assign|move|transition|write|push|post|patch|put)/i;
    for (const name of exportNames) {
      if (typeof (statusModule as any)[name] === "function") {
        expect(name).not.toMatch(mutationPatterns);
      }
    }
  });

  it("no mutation-named functions exist in doctor module exports", async () => {
    const doctorModule = await import("../src/doctor.js");
    const exportNames = Object.keys(doctorModule);

    const mutationPatterns = /^(save|create|update|delete|remove|set|assign|move|transition|write|push|post|patch|put)/i;
    for (const name of exportNames) {
      if (typeof (doctorModule as any)[name] === "function") {
        expect(name).not.toMatch(mutationPatterns);
      }
    }
  });

  it("no mutation-named functions exist in config module exports", async () => {
    const configModule = await import("../src/config.js");
    const exportNames = Object.keys(configModule);

    const mutationPatterns = /^(save|create|update|delete|remove|set|assign|move|transition|write|push|post|patch|put)/i;
    for (const name of exportNames) {
      if (typeof (configModule as any)[name] === "function") {
        expect(name).not.toMatch(mutationPatterns);
      }
    }
  });

  it("buildGraph is a pure function — does not modify input array", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];

    const snapshot = JSON.stringify(issues);
    buildGraph(issues, TEST_CONFIG);
    expect(JSON.stringify(issues)).toBe(snapshot);
  });

  it("buildGraph is a pure function — does not modify config", () => {
    const configSnapshot = JSON.stringify(TEST_CONFIG);
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];

    buildGraph(issues, TEST_CONFIG);
    expect(JSON.stringify(TEST_CONFIG)).toBe(configSnapshot);
  });

  it("doctor is read-only — only reads filesystem, never writes", () => {
    // runDoctor uses existsSync and readFileSync — read-only fs operations.
    // It completes without error on a non-existent path (no writes attempted).
    const results = runDoctor("/nonexistent/path", TEST_CONFIG, false);
    expect(results.length).toBeGreaterThan(0);
    // Filesystem checks (config, claude-md, agents, gitignore) must fail for nonexistent root
    const fsChecks = results.filter(r => ["config", "claude-md", "agents", "gitignore"].includes(r.name));
    expect(fsChecks.every(r => !r.passed)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────
// Capabilities
// ──────────────────────────────────────────────────────────────────

describe("capabilities", () => {
  it("graph always reports dependencyRelationsLoaded as false", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.capabilities.dependencyRelationsLoaded).toBe(false);
  });

  it("JSON output includes capabilities object", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    const json = formatStatusJson(graph) as any;
    expect(json.capabilities).toBeDefined();
    expect(json.capabilities.dependencyRelationsLoaded).toBe(false);
  });

  it("human output includes dependency limitation notice", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    const human = formatStatus(graph);
    expect(human).toContain("dependency relations not loaded");
  });

  it("blocked category is always empty when dependencies not loaded", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Backlog", statusType: "backlog", labels: ["frontend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    // Without dependency data, nothing can be classified as BLOCKED
    expect(graph.blocked.length).toBe(0);
    expect(graph.summary.totalBlocked).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Parent Health
// ──────────────────────────────────────────────────────────────────

describe("parent health", () => {
  it("parent with no sub-issues has hasSubtasks=false", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    expect(graph.parents[0].hasSubtasks).toBe(false);
    expect(graph.parents[0].total).toBe(0);
  });

  it("parent health counts match actual sub-issue statuses", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Done", statusType: "completed", labels: ["backend"], parentId: "TST-1", completedAt: "2026-01-05" }),
      makeIssue({ id: "TST-11", status: "In Progress", statusType: "started", labels: ["frontend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["architect"], parentId: "TST-1" }),
      makeIssue({ id: "TST-13", status: "Backlog", statusType: "backlog", labels: ["backend"], parentId: "TST-1" }),
    ];

    const graph = buildGraph(issues, TEST_CONFIG);
    const parent = graph.parents[0];
    expect(parent.done).toBe(1);
    expect(parent.inProgress).toBe(1);
    expect(parent.todo).toBe(1);
    expect(parent.backlog).toBe(1);
    expect(parent.total).toBe(4);
  });
});
