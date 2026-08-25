import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { generateNext, formatNext } from "../src/next.js";
import type { Config } from "../src/config.js";
import { execSync } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

const config: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "GUA" },
  domains: ["task", "scout", "designer", "reviewer", "sonic", "librarian"],
  domainAgents: {
    task: "task",
    scout: "security-reviewer",
    designer: "designer",
    reviewer: "reviewer",
    sonic: "sonic",
    librarian: "librarian",
  },
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
  statuses: { backlog: "Backlog", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done" },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: { max_todo_per_domain: 3, stale_hours: 48, reclaim_limit: 2, bulk_threshold: 5, max_subtasks_per_parent: 3 },
  branch_pattern: "{domain}/{prefix}-{id}-{slug}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

function makeIssue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    id: overrides.id,
    identifier: overrides.identifier ?? overrides.id,
    title: "Test issue",
    status: "Todo",
    statusType: "unstarted",
    priority: { value: 2, name: "High" },
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
// Directive generation
// ──────────────────────────────────────────────────────────────────

describe("next — directive generation", () => {
  it("produces one directive per domain with executable work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["scout"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Backend task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.directives).toHaveLength(2);
    const domains = result.directives.map(d => d.domain);
    expect(domains).toContain("scout");
    expect(domains).toContain("task");
    expect(result.directives.find(d => d.domain === "scout")!.agent).toBe("security-reviewer");
  });

  it("selects highest priority item per domain", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({
        id: "TST-10", title: "Low pri", labels: ["task"], parentId: "TST-1",
        priority: { value: 4, name: "Low" },
      }),
      makeIssue({
        id: "TST-11", title: "Urgent", labels: ["task"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const taskDirective = result.directives.find(d => d.domain === "task");
    expect(taskDirective).toBeDefined();
    expect(taskDirective!.issue_id).toBe("TST-11");
    expect(taskDirective!.priority.value).toBe(1);
  });

  it("returns empty directives when no executable work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.directives).toHaveLength(0);
    expect(result.summary.domains_with_work).toBe(0);
  });

  it("filters by domain", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["scout"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Backend task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config, "task");

    expect(result.directives).toHaveLength(1);
    expect(result.directives[0].domain).toBe("task");
  });

  it("returns empty when filtered domain has no work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["scout"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config, "designer");

    expect(result.directives).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Branch generation
// ──────────────────────────────────────────────────────────────────

describe("next — branch generation", () => {
  it("generates correct branch format", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-17", title: "Build action executor", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "task");
    expect(d).toBeDefined();
    expect(d!.branch).toBe("task/gua-17-build-action-executor");
  });

  it("slugifies titles with special characters", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-42", title: "Define Action type + Zod schemas in lib/actions/types.ts", labels: ["scout"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "scout");
    expect(d!.branch).toMatch(/^scout\/gua-42-define-action-type-zod-schemas/);
    expect(d!.branch).not.toMatch(/[^a-z0-9/-]/);
  });

  it("truncates long title at word boundary", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-16", title: "Define Action type + Zod schemas in lib/actions/types.ts", labels: ["scout"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "scout")!;
    // Must not cut mid-word — should end at a complete word
    expect(d.branch).toBe("scout/gua-16-define-action-type-zod-schemas-in-lib");
    expect(d.branch).not.toContain("-lib-ac");
  });

  it("file-path-heavy title produces valid slug", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-17", title: "Build action executor in lib/actions/executor.ts", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "task")!;
    // Must not produce "-exe" or "-actions-exe" truncation
    expect(d.branch).toBe("task/gua-17-build-action-executor-in-lib-actions");
    expect(d.branch).not.toContain("-executor-ts");
  });

  it("single long token hard truncates", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-99", title: "aaaaabbbbbaaaaabbbbbaaaaabbbbbaaaaabbbbbccccc", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "task")!;
    // Single token exceeds limit — hard truncate at 40
    const slug = d.branch.split("/")[1].replace(/^gua-99-/, "");
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("short titles are unchanged", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-10", title: "Design auth schema", labels: ["scout"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.domain === "scout")!;
    expect(d.branch).toBe("scout/gua-10-design-auth-schema");
  });
});

// ──────────────────────────────────────────────────────────────────
// Determinism
// ──────────────────────────────────────────────────────────────────

describe("next — determinism", () => {
  it("produces identical output on repeated calls", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task A", labels: ["scout"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Task B", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", title: "Task C", labels: ["designer"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);

    const r1 = generateNext(graph, config);
    const r2 = generateNext(graph, config);

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("directives sorted by priority then domain", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({
        id: "TST-10", title: "Frontend low", labels: ["designer"], parentId: "TST-1",
        priority: { value: 4, name: "Low" },
      }),
      makeIssue({
        id: "TST-11", title: "Backend urgent", labels: ["task"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
      makeIssue({
        id: "TST-12", title: "Architect urgent", labels: ["scout"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    // Urgent items first (scout before task alphabetically), then low
    expect(result.directives[0].domain).toBe("scout");
    expect(result.directives[1].domain).toBe("task");
    expect(result.directives[2].domain).toBe("designer");
  });
});

// ──────────────────────────────────────────────────────────────────
// Output format parity
// ──────────────────────────────────────────────────────────────────

describe("next — output formats", () => {
  it("human and JSON derive from same result", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);
    const human = formatNext(result);

    expect(human).toContain("TST-10");
    expect(human).toContain("NEXT");
    expect(human).toContain("task");
    expect(result.directives[0].issue_id).toBe("TST-10");
  });

  it("JSON includes capabilities", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.capabilities).toEqual({ dependencyRelationsLoaded: false, hasExternalBlockerGap: false });
  });

  it("human output shows context lines", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task A", labels: ["task"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Task B", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);
    const human = formatNext(result);

    expect(human).toContain("dependency detection unavailable");
    expect(human).toContain("2 executable task items total");
  });
});

// ──────────────────────────────────────────────────────────────────
// Read-only guarantee
// ──────────────────────────────────────────────────────────────────

describe("next — read-only guarantee", () => {
  it("does not export mutation-named functions", async () => {
    const mod = await import("../src/next.js");
    const names = Object.keys(mod);
    const mutationNames = ["save", "create", "update", "delete", "claim", "assign", "mutate", "write", "push"];
    for (const name of names) {
      for (const bad of mutationNames) {
        expect(name.toLowerCase()).not.toContain(bad);
      }
    }
  });

  it("does not modify input graph", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["task"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const before = JSON.stringify(graph);
    generateNext(graph, config);
    expect(JSON.stringify(graph)).toBe(before);
  });
});

// ──────────────────────────────────────────────────────────────────
// Smoke (CLI)
// ──────────────────────────────────────────────────────────────────

const CLI = resolve(__dirname, "../src/cli.ts");
const FIXTURES = resolve(__dirname, "../fixtures");
const REPO_ROOT = resolve(__dirname, "../..");

function run(args: string, stdin?: string): { stdout: string; exitCode: number } {
  try {
    const result = execSync(`npx tsx ${CLI} ${args}`, {
      cwd: REPO_ROOT,
      input: stdin,
      encoding: "utf-8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout || "", exitCode: err.status ?? 1 };
  }
}

function fixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

describe("next — CLI smoke", () => {
  it("generates directives from clean fixture", () => {
    const { stdout, exitCode } = run("next", fixture("clean.json"));
    expect(stdout).toContain("NEXT");
    expect(stdout).toContain("ISSUE:");
    expect(stdout).toContain("BRANCH:");
    expect(exitCode).toBe(0);
  });

  it("returns valid JSON with --json", () => {
    const { stdout, exitCode } = run("next --json", fixture("clean.json"));
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("directives");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("capabilities");
    expect(Array.isArray(parsed.directives)).toBe(true);
    if (parsed.directives.length > 0) {
      expect(parsed.directives[0]).toHaveProperty("domain");
      expect(parsed.directives[0]).toHaveProperty("agent");
      expect(parsed.directives[0]).toHaveProperty("issue_id");
      expect(parsed.directives[0]).toHaveProperty("branch");
      expect(parsed.directives[0]).toHaveProperty("priority");
      expect(parsed.directives[0]).toHaveProperty("parent_id");
      expect(parsed.directives[0]).toHaveProperty("context");
    }
    expect(exitCode).toBe(0);
  });

  it("exits 1 when no executable work", () => {
    const { exitCode } = run("next", fixture("errors.json"));
    expect(exitCode).toBe(1);
  });

  it("next --help exits 0", () => {
    const { stdout, exitCode } = run("next --help");
    expect(stdout).toContain("Commands:");
    expect(exitCode).toBe(0);
  });

  it("next without stdin exits 1", () => {
    const { exitCode } = run("next");
    expect(exitCode).toBe(1);
  });

  it("--domain filters output", () => {
    const { stdout } = run("next --json --domain backend", fixture("clean.json"));
    const parsed = JSON.parse(stdout);
    for (const d of parsed.directives) {
      expect(d.domain).toBe("backend");
    }
  });
});
