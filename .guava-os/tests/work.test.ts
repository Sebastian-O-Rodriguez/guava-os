import { describe, it, expect } from "vitest";
import type { LinearIssue } from "../src/linear.js";
import { classifyIssues } from "../src/work.js";
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

describe("classifyIssues blocked-by gate (GUA-581)", () => {
  it("marks an issue with an open blocked-by edge as not-ready, naming the blocker", () => {
    const blocker = makeIssue({
      id: "TST-BLK", identifier: "TST-10",
      labels: ["pm", "Feature", "ready-for-work"],
    });
    const blocked = {
      ...makeIssue({
        id: "TST-2", identifier: "TST-2",
        labels: ["pm", "Feature", "ready-for-work"],
      }),
      blockedBy: ["TST-BLK"],
    } as LinearIssue & { blockedBy?: string[] };

    const view = classifyIssues(TEST_CONFIG, [blocker, blocked]);

    expect(view.ready.some((r) => r.issue_id === "TST-2")).toBe(false);
    const notReady = view.notReady.find((n) => n.issue_id === "TST-2");
    expect(notReady).toBeDefined();
    expect(notReady!.reasons.some((r) => r.includes("TST-10"))).toBe(true);
  });

  it("treats the issue as ready once the blocker is completed", () => {
    const blocker = makeIssue({
      id: "TST-BLK", identifier: "TST-10",
      labels: ["pm", "Feature", "ready-for-work"],
      completedAt: "2026-08-01", statusType: "completed",
    });
    const blocked = {
      ...makeIssue({
        id: "TST-2", identifier: "TST-2",
        labels: ["pm", "Feature", "ready-for-work"],
      }),
      blockedBy: ["TST-BLK"],
    } as LinearIssue & { blockedBy?: string[] };

    const view = classifyIssues(TEST_CONFIG, [blocker, blocked]);

    expect(view.ready.some((r) => r.issue_id === "TST-2")).toBe(true);
    expect(view.notReady.some((n) => n.issue_id === "TST-2")).toBe(false);
  });
});
