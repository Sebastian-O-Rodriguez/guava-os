import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

vi.mock("../src/linear-client.js", () => ({
  listIssueLabels: vi.fn(),
  createIssueLabel: vi.fn(),
}));

import { runSync } from "../src/cli.js";
import { listIssueLabels, createIssueLabel } from "../src/linear-client.js";

const CANONICAL_CONFIG = {
  linear: { team: "Guava AI", project: "guava-bi", issue_prefix: "BIA" },
  domains: ["pm", "qa", "security", "backend", "frontend", "devops", "ai-ml"],
  domainAgents: {
    pm: "task",
    qa: "reviewer",
    security: "security-reviewer",
    backend: "task",
    frontend: "designer",
    devops: "task",
    "ai-ml": "task",
  },
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
  statuses: { backlog: "Backlog", todo: "Todo", in_progress: "In Progress", in_review: "In Review", done: "Done" },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: { max_todo_per_domain: 3, stale_hours: 48, reclaim_limit: 2, bulk_threshold: 5, max_subtasks_per_parent: 3 },
  branch_pattern: "dev/{domain}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

function legacyConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = JSON.parse(JSON.stringify(CANONICAL_CONFIG));
  delete config.domains;
  delete config.domainAgents;
  config.roles = ["task"];
  (config.invariants as Record<string, unknown>).max_todo_per_role = 3;
  delete (config.invariants as Record<string, unknown>).max_todo_per_domain;
  config.branch_pattern = "dev/{role}";
  return config;
}

function makeRepo(base: string, name: string, config: unknown): string {
  const root = join(base, name);
  mkdirSync(join(root, ".guava-os"), { recursive: true });
  mkdirSync(join(root, ".omp", "skills"), { recursive: true });
  writeFileSync(join(root, ".guava-os", "config.json"), JSON.stringify(config, null, 2), "utf8");
  return root;
}

function makeRegistry(
  base: string,
  entries: { id: string; repoPath?: string; lifecycle: string }[],
): string {
  const path = join(base, "projects.yml");
  const lines = ["projects:"];
  for (const e of entries) {
    lines.push(`  - id: ${e.id}`);
    if (e.repoPath !== undefined) lines.push(`    repo_path: ${e.repoPath}`);
    lines.push(`    lifecycle: ${e.lifecycle}`);
  }
  writeFileSync(path, lines.join("\n") + "\n", "utf8");
  return path;
}

const ORIGINAL_ENV = process.env.GUAVA_OS_PROJECT_REGISTRY;

beforeEach(() => {
  vi.mocked(listIssueLabels).mockReset().mockResolvedValue([]);
  vi.mocked(createIssueLabel).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.GUAVA_OS_PROJECT_REGISTRY;
  else process.env.GUAVA_OS_PROJECT_REGISTRY = ORIGINAL_ENV;
});

describe("runSync --all", () => {
  it("reports every active repo and returns 1 when any drifts", async () => {
    const base = mkdtempSync(join(tmpdir(), "guava-sync-all-"));
    const a = makeRepo(base, "repo-a", legacyConfig());
    const b = makeRepo(base, "repo-b", legacyConfig());
    process.env.GUAVA_OS_PROJECT_REGISTRY = makeRegistry(base, [
      { id: "repo-a", repoPath: a, lifecycle: "active" },
      { id: "repo-b", repoPath: b, lifecycle: "active" },
    ]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = await runSync(["--all"]);
    const out = log.mock.calls.flat().join("\n");
    log.mockRestore();

    expect(exit).toBe(1);
    expect(out).toContain(`sync plan — repo: ${a}`);
    expect(out).toContain(`sync plan — repo: ${b}`);
    expect(out).toContain("aggregate: 0 clean, 2 drifted, 0 errored (2 active repos)");

    rmSync(base, { recursive: true, force: true });
  });

  it("applies to every active repo under --all --fix --force", async () => {
    const base = mkdtempSync(join(tmpdir(), "guava-sync-all-"));
    const a = makeRepo(base, "repo-a", legacyConfig());
    const b = makeRepo(base, "repo-b", legacyConfig());
    process.env.GUAVA_OS_PROJECT_REGISTRY = makeRegistry(base, [
      { id: "repo-a", repoPath: a, lifecycle: "active" },
      { id: "repo-b", repoPath: b, lifecycle: "active" },
    ]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = await runSync(["--all", "--fix", "--force"]);
    const out = log.mock.calls.flat().join("\n");
    log.mockRestore();

    expect(exit).toBe(0);
    expect(out).toContain("aggregate: 2 clean, 0 drifted, 0 errored (2 active repos)");

    const aConfig = JSON.parse(readFileSync(join(a, ".guava-os", "config.json"), "utf8"));
    const bConfig = JSON.parse(readFileSync(join(b, ".guava-os", "config.json"), "utf8"));
    expect(aConfig.roles).toBeUndefined();
    expect(bConfig.roles).toBeUndefined();

    rmSync(base, { recursive: true, force: true });
  });

  it("excludes retired projects from the batch", async () => {
    const base = mkdtempSync(join(tmpdir(), "guava-sync-all-"));
    const a = makeRepo(base, "repo-a", legacyConfig());
    process.env.GUAVA_OS_PROJECT_REGISTRY = makeRegistry(base, [
      { id: "repo-a", repoPath: a, lifecycle: "active" },
      { id: "retired", repoPath: join(base, "does-not-exist"), lifecycle: "retired" },
    ]);

    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = await runSync(["--all"]);
    const out = log.mock.calls.flat().join("\n");
    log.mockRestore();

    expect(exit).toBe(1);
    expect(out).toContain("(1 active repos)");
    expect(out).not.toContain("retired");

    rmSync(base, { recursive: true, force: true });
  });
});