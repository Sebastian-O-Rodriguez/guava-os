import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { generateNext, formatNext } from "../src/next.js";
import { loadConfig, findRepoRoot } from "../src/config.js";
import { execSync } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

const config = loadConfig(findRepoRoot());

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
  it("produces one directive per persona with executable work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["architect"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Backend task", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.directives).toHaveLength(2);
    const personas = result.directives.map(d => d.persona);
    expect(personas).toContain("architect");
    expect(personas).toContain("backend");
  });

  it("selects highest priority item per persona", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({
        id: "TST-10", title: "Low pri", labels: ["backend"], parentId: "TST-1",
        priority: { value: 4, name: "Low" },
      }),
      makeIssue({
        id: "TST-11", title: "Urgent", labels: ["backend"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const backendDirective = result.directives.find(d => d.persona === "backend");
    expect(backendDirective).toBeDefined();
    expect(backendDirective!.issue_id).toBe("TST-11");
    expect(backendDirective!.priority.value).toBe(1);
  });

  it("returns empty directives when no executable work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "Backlog", statusType: "backlog" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.directives).toHaveLength(0);
    expect(result.summary.personas_with_work).toBe(0);
  });

  it("filters by persona when --persona provided", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["architect"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Backend task", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config, "backend");

    expect(result.directives).toHaveLength(1);
    expect(result.directives[0].persona).toBe("backend");
  });

  it("returns empty when filtered persona has no work", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Arch task", labels: ["architect"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config, "frontend");

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
      makeIssue({ id: "GUA-17", title: "Build action executor", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "backend");
    expect(d).toBeDefined();
    expect(d!.branch).toBe("backend/gua-17-build-action-executor");
  });

  it("slugifies titles with special characters", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-42", title: "Define Action type + Zod schemas in lib/actions/types.ts", labels: ["architect"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "architect");
    expect(d!.branch).toMatch(/^architect\/gua-42-define-action-type-zod-schemas/);
    expect(d!.branch).not.toMatch(/[^a-z0-9/-]/);
  });

  it("truncates long title at word boundary", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-16", title: "Define Action type + Zod schemas in lib/actions/types.ts", labels: ["architect"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "architect")!;
    // Must not cut mid-word — should end at a complete word
    expect(d.branch).toBe("architect/gua-16-define-action-type-zod-schemas-in-lib");
    expect(d.branch).not.toContain("-lib-ac");
  });

  it("file-path-heavy title produces valid slug", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-17", title: "Build action executor in lib/actions/executor.ts", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "backend")!;
    // Must not produce "-exe" or "-actions-exe" truncation
    expect(d.branch).toBe("backend/gua-17-build-action-executor-in-lib-actions");
    expect(d.branch).not.toContain("-executor-ts");
  });

  it("single long token hard truncates", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-99", title: "aaaaabbbbbaaaaabbbbbaaaaabbbbbaaaaabbbbbccccc", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "backend")!;
    // Single token exceeds limit — hard truncate at 40
    const slug = d.branch.split("/")[1].replace(/^gua-99-/, "");
    expect(slug.length).toBeLessThanOrEqual(40);
  });

  it("short titles are unchanged", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "GUA-10", title: "Design auth schema", labels: ["architect"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    const d = result.directives.find(d => d.persona === "architect")!;
    expect(d.branch).toBe("architect/gua-10-design-auth-schema");
  });
});

// ──────────────────────────────────────────────────────────────────
// Determinism
// ──────────────────────────────────────────────────────────────────

describe("next — determinism", () => {
  it("produces identical output on repeated calls", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task A", labels: ["architect"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Task B", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-12", title: "Task C", labels: ["frontend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);

    const r1 = generateNext(graph, config);
    const r2 = generateNext(graph, config);

    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("directives sorted by priority then persona", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({
        id: "TST-10", title: "Frontend low", labels: ["frontend"], parentId: "TST-1",
        priority: { value: 4, name: "Low" },
      }),
      makeIssue({
        id: "TST-11", title: "Backend urgent", labels: ["backend"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
      makeIssue({
        id: "TST-12", title: "Architect urgent", labels: ["architect"], parentId: "TST-1",
        priority: { value: 1, name: "Urgent" },
      }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    // Urgent items first (architect before backend alphabetically), then low
    expect(result.directives[0].persona).toBe("architect");
    expect(result.directives[1].persona).toBe("backend");
    expect(result.directives[2].persona).toBe("frontend");
  });
});

// ──────────────────────────────────────────────────────────────────
// Output format parity
// ──────────────────────────────────────────────────────────────────

describe("next — output formats", () => {
  it("human and JSON derive from same result", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);
    const human = formatNext(result);

    expect(human).toContain("TST-10");
    expect(human).toContain("NEXT");
    expect(human).toContain("backend");
    expect(result.directives[0].issue_id).toBe("TST-10");
  });

  it("JSON includes capabilities", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);

    expect(result.capabilities).toEqual({ dependencyRelationsLoaded: false });
  });

  it("human output shows context lines", () => {
    const issues: LinearIssue[] = [
      makeIssue({ id: "TST-1", title: "Parent", status: "In Progress", statusType: "started" }),
      makeIssue({ id: "TST-10", title: "Task A", labels: ["backend"], parentId: "TST-1" }),
      makeIssue({ id: "TST-11", title: "Task B", labels: ["backend"], parentId: "TST-1" }),
    ];
    const graph = buildGraph(issues, config);
    const result = generateNext(graph, config);
    const human = formatNext(result);

    expect(human).toContain("dependency detection unavailable");
    expect(human).toContain("2 executable backend items total");
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
      makeIssue({ id: "TST-10", title: "Task", labels: ["backend"], parentId: "TST-1" }),
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
      expect(parsed.directives[0]).toHaveProperty("persona");
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

  it("--persona filters output", () => {
    const { stdout } = run("next --json --persona architect", fixture("clean.json"));
    const parsed = JSON.parse(stdout);
    for (const d of parsed.directives) {
      expect(d.persona).toBe("architect");
    }
  });
});
