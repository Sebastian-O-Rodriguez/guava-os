import { describe, it, expect } from "vitest";
import type { LinearIssue } from "../src/linear.js";
import { classifyTriage } from "../src/triage.js";
import type { Config } from "../src/config.js";

const DESC =
  "## Why this exists\nreason\n\n## Scope\nscope\n\n## Acceptance criteria\ncriteria\n";

const TEST_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
  domains: ["pm", "backend"],
  domainAgents: { pm: "task", backend: "task" },
  types: ["Feature", "Bug"],
  readiness: {
    untriaged: "untriaged",
    ready: "ready-for-work",
    needs_rescoping: "needs-rescoping",
  },
  statuses: {
    backlog: "Backlog",
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: {
    max_todo_per_domain: 2,
    stale_hours: 48,
    reclaim_limit: 2,
    bulk_threshold: 5,
    max_subtasks_per_parent: 3,
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
    status: "Todo",
    statusType: "unstarted",
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

describe("classifyTriage", () => {
  it("classifies a clean open Todo deliverable as ready", () => {
    const issues = [makeIssue({ id: "TST-1", labels: ["pm", "Feature", "untriaged"] })];
    const decisions = classifyTriage(TEST_CONFIG, issues);

    expect(decisions).toHaveLength(1);
    expect(decisions[0].issue_id).toBe("TST-1");
    expect(decisions[0].old_readiness).toBe("untriaged");
    expect(decisions[0].new_readiness).toBe("ready-for-work");
    expect(decisions[0].reasons).toEqual([]);
  });

  it("classifies a deliverable with an error violation as needs-rescoping", () => {
    const issues = [
      makeIssue({ id: "TST-2", labels: ["pm", "Bug", "untriaged"], description: "" }),
    ];
    const decisions = classifyTriage(TEST_CONFIG, issues);

    expect(decisions).toHaveLength(1);
    expect(decisions[0].new_readiness).toBe("needs-rescoping");
    expect(decisions[0].reasons.length).toBeGreaterThan(0);
    expect(decisions[0].reasons[0]).toContain("V405");
  });

  it("preserves domain + type labels and replaces exactly one readiness label", () => {
    const issues = [
      makeIssue({ id: "TST-3", labels: ["pm", "Feature", "untriaged"] }),
    ];
    const decisions = classifyTriage(TEST_CONFIG, issues);

    expect(decisions[0].labels).toEqual(["pm", "Feature", "ready-for-work"]);

    // Readiness labels are replaced, never duplicated: a stale ready label on a
    // failing issue converges to a single needs-rescoping label.
    const failing = classifyTriage(TEST_CONFIG, [
      makeIssue({ id: "TST-4", labels: ["pm", "Bug", "ready-for-work"], description: "" }),
    ]);
    expect(failing[0].labels).toEqual(["pm", "Bug", "needs-rescoping"]);
    expect(
      failing[0].labels.filter((l) => l === "ready-for-work" || l === "needs-rescoping" || l === "untriaged"),
    ).toHaveLength(1);
  });

  it("is idempotent: applying labels then re-classifying converges", () => {
    const issues = [
      makeIssue({ id: "TST-5", labels: ["pm", "Feature", "untriaged"] }),
      makeIssue({ id: "TST-6", labels: ["pm", "Bug", "untriaged"], description: "" }),
      makeIssue({ id: "TST-7", labels: ["pm", "Feature", "needs-rescoping"], description: "" }),
    ];
    const first = classifyTriage(TEST_CONFIG, issues);

    // Reproduce the write: replace each issue's labels with the computed array.
    for (const d of first) {
      issues.find((i) => i.id === d.issue_id)!.labels = d.labels;
    }

    const second = classifyTriage(TEST_CONFIG, issues);
    expect(second.map((d) => d.new_readiness)).toEqual(
      first.map((d) => d.new_readiness),
    );
    for (const d of second) {
      expect(d.old_readiness).toBe(d.new_readiness);
    }
  });

  it("leaves issues with no domain label untouched", () => {
    const issues = [makeIssue({ id: "TST-8", labels: ["Feature", "untriaged"] })];
    expect(classifyTriage(TEST_CONFIG, issues)).toHaveLength(0);
  });

  it("skips containers, completed, canceled, and non-Todo issues", () => {
    const issues = [
      makeIssue({ id: "TST-P", labels: ["pm", "untriaged"] }), // container (has child below)
      makeIssue({ id: "TST-C", status: "In Progress", statusType: "started", labels: ["pm"], parentId: "TST-P" }),
      makeIssue({ id: "TST-D", labels: ["pm", "Feature", "untriaged"], completedAt: "2026-08-01", statusType: "completed" }),
      makeIssue({ id: "TST-X", labels: ["pm", "Feature", "untriaged"], canceledAt: "2026-08-01" }),
      makeIssue({ id: "TST-I", labels: ["pm", "Feature", "untriaged"], status: "In Progress", statusType: "started" }),
    ];
    expect(classifyTriage(TEST_CONFIG, issues)).toHaveLength(0);
  });
});