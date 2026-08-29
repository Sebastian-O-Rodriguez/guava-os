import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { runValidate, formatValidate } from "../src/validate.js";
import type { Config } from "../src/config.js";

const READY = "ready-for-work";
const DESC = "## Why this exists\nreason\n\n## Scope\nscope\n\n## Acceptance criteria\ncriteria\n";

const TEST_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
  domains: ["task", "reviewer", "scout", "designer", "sonic", "librarian"],
  domainAgents: {
    task: "task",
    reviewer: "reviewer",
    scout: "scout",
    designer: "designer",
    sonic: "sonic",
    librarian: "librarian",
  },
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
  statuses: {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
    in_review: "In Review", done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: {
    max_todo_per_domain: 2, stale_hours: 48, reclaim_limit: 2,
    bulk_threshold: 5, max_subtasks_per_parent: 3,
  },
  branch_pattern: "feat/{prefix}-{id}-{slug}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

function makeIssue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    id: overrides.id,
    identifier: overrides.identifier ?? overrides.id,
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
    description: DESC,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────
// Individual violation codes
// ──────────────────────────────────────────────────────────────────

describe("V302 orphan_sub_issue", () => {
  it("detects sub-issue whose parent is not in dataset", () => {
    const issues = [
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-MISSING" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V303")).toHaveLength(0);
  });
});

describe("V304 empty_parent", () => {
  it("detects active issue with no children and no domain", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V304", name: "empty_parent", severity: "warning", issue_id: "TST-1",
    }));
  });

  it("does not flag issue with children (real container)", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V304")).toHaveLength(0);
  });

  it("does not flag Backlog issue with no sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Backlog", statusType: "backlog" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V304")).toHaveLength(0);
  });

  it("does not flag standalone deliverable with domain label (GUA-111)", () => {
    // A top-level issue with no children but with a domain label
    // is a standalone deliverable, not an empty parent.
    const issues = [
      makeIssue({ id: "GUA-104", status: "Todo", statusType: "unstarted", labels: ["scout"] }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V304")).toHaveLength(0);
  });
});

describe("V305 subtask_overflow", () => {
  it("flags active parent exceeding max_subtasks_per_parent", () => {
    // config has max_subtasks_per_parent = 3
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-13", status: "Todo", statusType: "unstarted", labels: ["designer"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V305", name: "subtask_overflow", severity: "error", issue_id: "TST-1",
    }));
    expect(result.violations.find(v => v.code === "V305")!.detail).toContain("4");
    expect(result.violations.find(v => v.code === "V305")!.detail).toContain("max_subtasks_per_parent 3");
  });

  it("does not flag parent at the cap boundary", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V305")).toHaveLength(0);
  });

  it("does not flag completed parent with many sub-issues", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Done", statusType: "completed", completedAt: "2026-01-02" }),
      makeIssue({ id: "TST-10", status: "Done", statusType: "completed", parentId: "TST-1", completedAt: "2026-01-02" }),
      makeIssue({ id: "TST-11", status: "Done", statusType: "completed", parentId: "TST-1", completedAt: "2026-01-02" }),
      makeIssue({ id: "TST-12", status: "Done", statusType: "completed", parentId: "TST-1", completedAt: "2026-01-02" }),
      makeIssue({ id: "TST-13", status: "Done", statusType: "completed", parentId: "TST-1", completedAt: "2026-01-02" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V305")).toHaveLength(0);
  });
});

describe("V400 missing_domain_label", () => {
  it("detects sub-issue with no domain label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: [], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V400", name: "missing_domain_label", severity: "error", issue_id: "TST-10",
    }));
  });

  it("does not flag sub-issue with valid domain label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Backlog", statusType: "backlog", labels: ["task"], parentId: "TST-1" }),
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

  it("flags standalone deliverable with no domain label (GUA-111)", () => {
    const issues = [
      makeIssue({ id: "GUA-104", status: "Todo", statusType: "unstarted", labels: [] }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V400", name: "missing_domain_label", severity: "error", issue_id: "GUA-104",
    }));
  });
});

describe("V402 unknown_label", () => {
  it("detects label not in configured domains, types, or readiness", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "devops"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V402", name: "unknown_label", severity: "warning", issue_id: "TST-10",
    }));
    expect(result.violations.find(v => v.code === "V402")!.detail).toContain("devops");
  });

  it("does not flag known category labels (Feature, Bug, Improvement)", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "Bug"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V402")).toHaveLength(0);
  });
});

describe("V500 queue_overflow", () => {
  it("detects domain queue exceeding max_todo_per_domain", () => {
    // config has max_todo_per_domain = 2
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V500", name: "queue_overflow", severity: "warning",
    }));
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("3");
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("task");
  });

  it("does not flag when under capacity", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations.filter(v => v.code === "V500")).toHaveLength(0);
  });

  it("counts standalone Todo deliverables in queue overflow (GUA-111)", () => {
    // max_todo_per_domain = 2. Three standalone task deliverables -> V500.
    const issues = [
      makeIssue({ id: "GUA-104", status: "Todo", statusType: "unstarted", labels: ["task"] }),
      makeIssue({ id: "GUA-105", status: "Todo", statusType: "unstarted", labels: ["task"] }),
      makeIssue({ id: "GUA-106", status: "Todo", statusType: "unstarted", labels: ["task"] }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V500", name: "queue_overflow", severity: "warning",
    }));
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("3");
    expect(result.violations.find(v => v.code === "V500")!.detail).toContain("task");
  });
});

// ──────────────────────────────────────────────────────────────────
// Exit code behavior
// ──────────────────────────────────────────────────────────────────

describe("exit code semantics", () => {
  it("clean graph has 0 errors and 0 warnings", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", READY], parentId: "TST-1" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.summary.errors).toBeGreaterThan(0);
  });

  it("warning-only violations have errors = 0", () => {
    // V402 unknown_label is warning-only.
    // Child under active parent — avoids V304/V400.
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "devops", READY], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);

    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBeGreaterThan(0);
  });

  it("strict mode: hasFailures when warnings exist", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "devops", READY], parentId: "TST-1" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "designer"], parentId: "TST-1" }),
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
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
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

describe("nested decomposition — wave → container → leaves", () => {
  // wave (top-level) → container (a parent of leaves, itself a child) → leaves
  function nestedFixture(): LinearIssue[] {
    return [
      makeIssue({ id: "WAVE", title: "Wave", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "CONT", title: "Container", status: "Todo", statusType: "unstarted", parentId: "WAVE" }),
      makeIssue({ id: "L1", title: "Leaf One", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "CONT" }),
      makeIssue({ id: "L2", title: "Leaf Two", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "CONT" }),
    ];
  }
  function codes(issues: LinearIssue[]): string[] {
    const graph = buildGraph(issues, TEST_CONFIG);
    return runValidate(graph, issues, TEST_CONFIG).violations.map((v) => v.code);
  }

  it("does NOT flag leaves as orphans when their parent is a nested container", () => {
    const v = codes(nestedFixture());
    expect(v).not.toContain("V302");
  });

  it("applies V303 parent-active to a nested container (leaf under a non-active container)", () => {
    const issues = nestedFixture();
    const cont = issues.find((i) => i.id === "CONT")!;
    cont.status = "Done";
    cont.statusType = "completed";
    const v = codes(issues);
    expect(v).toContain("V303");
    const detail = runValidate(buildGraph(issues, TEST_CONFIG), issues, TEST_CONFIG)
      .violations.find((x) => x.code === "V303");
    expect(detail?.issue_id).toBe("L1");
  });

  it("applies V305 overflow to a NESTED container (not just top-level parents)", () => {
    const issues = nestedFixture();
    // give CONT 4 children (cap is 3) — CONT is itself a child of WAVE
    for (let i = 0; i < 2; i++) {
      issues.push(makeIssue({ id: `LX${i}`, status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "CONT" }));
    }
    const v = codes(issues);
    expect(v).toContain("V305");
    const detail = runValidate(buildGraph(issues, TEST_CONFIG), issues, TEST_CONFIG)
      .violations.find((x) => x.code === "V305");
    expect(detail?.issue_id).toBe("CONT");
  });

  it("does NOT flag a domain label on a container (containers exempt — GUA-523)", () => {
    const issues = nestedFixture();
    issues.find((i) => i.id === "CONT")!.labels = ["task"];
    const v = codes(issues);
    expect(v).not.toContain("V306");
    expect(v).not.toContain("V400");
    expect(v).not.toContain("V403");
  });

  it("does NOT flag V305 on a BACKLOG container (cap applies to ACTIVE containers)", () => {
    const issues = nestedFixture();
    // give CONT 4 children (over cap 3) but make it Backlog (unscheduled grouping)
    for (let i = 0; i < 2; i++) {
      issues.push(makeIssue({ id: `LB${i}`, status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "CONT" }));
    }
    const cont = issues.find((i) => i.id === "CONT")!;
    cont.status = "Backlog";
    cont.statusType = "backlog";
    expect(codes(issues)).not.toContain("V305");
  });
});

// ──────────────────────────────────────────────────────────────────
// Domain labels — single domain per deliverable
// ──────────────────────────────────────────────────────────────────

describe("domain labels (single domain per deliverable)", () => {
  it("accepts a single domain label (no V400/V402/V403)", () => {
    const issues = [
      makeIssue({ id: "TST-60", status: "Todo", statusType: "unstarted", labels: ["task", READY] }),
    ];
    const result = runValidate(buildGraph(issues, TEST_CONFIG), issues, TEST_CONFIG);
    expect(result.violations.some((v) => v.code === "V400")).toBe(false);
    expect(result.violations.some((v) => v.code === "V402")).toBe(false);
    expect(result.violations.some((v) => v.code === "V403")).toBe(false);
  });

  it("flags multiple domain labels (V403)", () => {
    const issues = [
      makeIssue({ id: "TST-61", status: "Todo", statusType: "unstarted", labels: ["task", "designer"] }),
    ];
    const result = runValidate(buildGraph(issues, TEST_CONFIG), issues, TEST_CONFIG);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ code: "V403", name: "multiple_domain_labels", issue_id: "TST-61" }),
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// Readiness + description (new protocol invariants)
// ──────────────────────────────────────────────────────────────────

describe("V404 readiness_label_count", () => {
  it("errors when an open deliverable has no readiness label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V404", name: "readiness_label_count", severity: "error", issue_id: "TST-10",
    }));
  });

  it("errors when an open deliverable has multiple readiness labels", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", "ready-for-work", "untriaged"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V404", name: "readiness_label_count", severity: "error", issue_id: "TST-10",
    }));
  });

  it("does not flag a deliverable with exactly one readiness label", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", READY], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);
    expect(result.violations.filter(v => v.code === "V404")).toHaveLength(0);
  });
});

describe("V405 missing_description_sections", () => {
  it("errors when an open deliverable lacks required description sections", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", READY], parentId: "TST-1", description: "just a body" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);
    expect(result.violations).toContainEqual(expect.objectContaining({
      code: "V405", name: "missing_description_sections", severity: "error", issue_id: "TST-10",
    }));
  });

  it("does not flag when all three sections are present", () => {
    const issues = [
      makeIssue({ id: "TST-1", status: "Todo", statusType: "unstarted" }),
      makeIssue({ id: "TST-10", status: "Todo", statusType: "unstarted", labels: ["task", READY], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, TEST_CONFIG);
    const result = runValidate(graph, issues, TEST_CONFIG);
    expect(result.violations.filter(v => v.code === "V405")).toHaveLength(0);
  });
});
