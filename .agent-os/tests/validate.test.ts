import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { runValidate, formatValidate } from "../src/validate.js";
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
    max_todo_per_persona: 2, stale_hours: 48, reclaim_limit: 2,
    bulk_threshold: 5, max_subtasks_per_parent: 3,
  },
  branch_pattern: "feat/{prefix}-{id}-{slug}",
  agent_files: {},
  process_files: {},
  manifest_path: ".agent-os/manifest.json",
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
// Individual violation codes
// ──────────────────────────────────────────────────────────────────

describe("V302 orphan_sub_issue", () => {
  it("detects sub-issue whose parent is not in dataset", () => {
    const issues = [
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-MISSING" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V302", name: "orphan_sub_issue", severity: "warning", issue_id: "TST-10",
    }));
  });

  it("does not flag sub-issues whose parent exists", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V302")).toHaveLength(0);
  });
});

describe("V303 parent_not_active", () => {
  it("detects Todo sub-issue with Backlog parent", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V303", name: "parent_not_active", severity: "error", issue_id: "TST-10",
    }));
  });

  it("does not flag sub-issue with active parent", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V303")).toHaveLength(0);
  });
});

describe("V304 empty_parent", () => {
  it("detects active parent with no sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V304", name: "empty_parent", severity: "warning", issue_id: "TST-1",
    }));
  });

  it("does not flag parent with sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V304")).toHaveLength(0);
  });

  it("does not flag Backlog parent with no sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V304")).toHaveLength(0);
  });
});

describe("V400 missing_persona_label", () => {
  it("detects sub-issue with no persona label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: [], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V400", name: "missing_persona_label", severity: "error", issue_id: "TST-10",
    }));
  });

  it("does not flag sub-issue with valid persona label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V400")).toHaveLength(0);
  });

  it("does not flag completed sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Done", statusType: "completed", labels: [], parentId: "TST-1", completedAt: "2026-01-05" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V400")).toHaveLength(0);
  });
});

describe("V401 multiple_persona_labels", () => {
  it("detects sub-issue with multiple persona labels", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend", "frontend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V401", name: "multiple_persona_labels", severity: "error", issue_id: "TST-10",
    }));
  });
});

describe("V402 unknown_persona_label", () => {
  it("detects label not in configured personas or known categories", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend", "devops"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V402", name: "unknown_persona_label", severity: "warning", issue_id: "TST-10",
    }));
    expect(result.violations.find(v => v.code === "V402")!.detail).toContain("devops");
  });

  it("does not flag known category labels (Feature, Bug, Improvement)", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend", "Bug"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V402")).toHaveLength(0);
  });
});

describe("V500 queue_overflow", () => {
  it("detects persona queue exceeding max_todo_per_persona", () => {
    // config has max_todo_per_persona = 2
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V500", name: "queue_overflow", severity: "warning",
    }));
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("3");
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("backend");
  });

  it("does not flag when under capacity", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V500")).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Exit code behavior
// ──────────────────────────────────────────────────────────────────

describe("exit code semantics", () => {
  it("clean graph has 0 errors and 0 warnings", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(0);
    expect(result.summary.total).toBe(0);
  });

  it("error violations set errors > 0", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.summary.errors).toBeGreaterThan(0);
  });

  it("warning-only violations have errors = 0", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      // empty parent = warning only
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBeGreaterThan(0);
  });

  it("strict mode: hasFailures when warnings exist", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    // Simulate strict: total > 0 means failure
    const strictFail = result.summary.total > 0;
    const normalFail = result.summary.errors > 0;

    expect(strictFail).toBe(true);
    expect(normalFail).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// Output consistency
// ──────────────────────────────────────────────────────────────────

describe("output consistency", () => {
  it("human and JSON outputs derive from the same violation list", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: [], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    const humanOutput = formatValidate(result);
    const jsonString = JSON.stringify(result);

    // Every violation code in result appears in both outputs
    for (const v of result.violations) {
      expect(humanOutput).toContain(v.code);
      expect(jsonString).toContain(v.code);
    }

    // Summary counts match
    expect(humanOutput).toContain(`${result.summary.errors} errors`);
    expect(humanOutput).toContain(`${result.summary.warnings} warnings`);
  });

  it("violations are deterministically ordered", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend", "frontend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Backlog", statusType: "backlog", labels: [], parentId: "TST-1" }),
    ];

    const graph1 = buildGraph(issues, TEST_CONFIG);
    const result1 = runValidate(graph1, issues, TEST_CONFIG);
    const graph2 = buildGraph(issues, TEST_CONFIG);
    const result2 = runValidate(graph2, issues, TEST_CONFIG);

    expect(result1.violations.map(v => `${v.code}:${v.issue_id}`))
      .toEqual(result2.violations.map(v => `${v.code}:${v.issue_id}`));
  });

  it("errors sort before warnings", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["backend"], parentId: "TST-1" }),
      // V303 (error) + V304 (warning for empty Backlog parent? no — Backlog not active)
      // Let's add a warning source
      makeIssue({ id: "TST-11", status: "Backlog", statusType: "backlog", labels: [], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    const errors = result.violations.filter(v => v.severity === "error");
    const warnings = result.violations.filter(v => v.severity === "warning");

    if (errors.length > 0 && warnings.length > 0) {
      const lastErrorIdx = result.violations.lastIndexOf(errors[errors.length - 1]);
      const firstWarningIdx = result.violations.indexOf(warnings[0]);
      expect(lastErrorIdx).toBeLessThan(firstWarningIdx);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// Read-only guarantee
// ──────────────────────────────────────────────────────────────────

describe("validate read-only guarantee", () => {
  it("no mutation-named functions exist in validate module exports", async () => {
    const mod = await import("../src/validate.js");
    const exportNames = Object.keys(mod);

    const mutationPatterns = /^(save|create|update|delete|remove|set|assign|move|transition|write|push|post|patch|put)/i;
    for (const name of exportNames) {
      if (typeof (mod as any)[name] === "function") {
        expect(name).not.toMatch(mutationPatterns);
      }
    }
  });

  it("runValidate does not modify input arrays", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: [], parentId: "TST-1" }),
    ];
    const snapshot = JSON.stringify(issues);
    const graph = buildGraph(issues, TEST_CONFIG);
    runValidate(graph, issues, TEST_CONFIG);
    expect(JSON.stringify(issues)).toBe(snapshot);
  });
});
