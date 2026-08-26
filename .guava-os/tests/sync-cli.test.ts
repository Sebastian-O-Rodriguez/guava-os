import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
  readlinkSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

vi.mock("../src/linear-client.js", () => ({
  listIssueLabels: vi.fn(),
  createIssueLabel: vi.fn(),
}));

import { runSync, collectSkillLinks, applySyncPlan } from "../src/cli.js";
import { buildSyncPlan } from "../src/sync.js";
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

function writeRepo(config: unknown): string {
  const root = mkdtempSync(join(tmpdir(), "guava-sync-cli-"));
  mkdirSync(join(root, ".guava-os"), { recursive: true });
  mkdirSync(join(root, ".omp", "skills"), { recursive: true });
  writeFileSync(join(root, ".guava-os", "config.json"), JSON.stringify(config, null, 2), "utf8");
  return root;
}

beforeEach(() => {
  vi.mocked(listIssueLabels).mockReset();
  vi.mocked(createIssueLabel).mockReset();
});

describe("collectSkillLinks", () => {
  it("maps canonical adds to empty-target links and dead repo links to broken", () => {
    const root = mkdtempSync(join(tmpdir(), "guava-sync-links-"));
    const canonical = join(root, "canonical");
    const repo = join(root, "repo");
    mkdirSync(join(canonical, "alpha"), { recursive: true });
    mkdirSync(join(canonical, "behavior"), { recursive: true });
    mkdirSync(join(canonical, "gamma"), { recursive: true });
    mkdirSync(join(repo, ".omp", "skills"), { recursive: true });
    symlinkSync(join(canonical, "alpha"), join(repo, ".omp", "skills", "alpha"));
    symlinkSync(join(canonical, "nope"), join(repo, ".omp", "skills", "stale"));

    const links = collectSkillLinks(repo, canonical);

    expect(links).toContainEqual({ name: "behavior", target: "", broken: false });
    expect(links).toContainEqual({ name: "gamma", target: "", broken: false });
    expect(links).toContainEqual({ name: "stale", target: join(canonical, "nope"), broken: true });

    // A converged link (alpha) is neither an add nor broken — not emitted.
    expect(links.some((l) => l.name === "alpha")).toBe(false);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("applySyncPlan", () => {
  it("migrates config, creates missing labels, and adds missing symlinks", async () => {
    vi.mocked(listIssueLabels).mockResolvedValue([]);
    vi.mocked(createIssueLabel).mockResolvedValue(undefined);

    const root = mkdtempSync(join(tmpdir(), "guava-sync-apply-"));
    const canonical = join(root, "canonical");
    mkdirSync(join(canonical, "alpha"), { recursive: true });
    const repo = writeRepo(legacyConfig());

    const raw = JSON.parse(readFileSync(join(repo, ".guava-os", "config.json"), "utf8"));
    const plan = buildSyncPlan({
      repoRoot: repo,
      config: raw,
      linearLabels: [],
      skillLinks: [{ name: "alpha", target: "", broken: false }],
    });

    await applySyncPlan(repo, raw, plan, canonical);

    const rewritten = JSON.parse(readFileSync(join(repo, ".guava-os", "config.json"), "utf8"));
    expect(rewritten.roles).toBeUndefined();
    expect(rewritten.domainAgents).toBeTruthy();
    expect(readlinkSync(join(repo, ".omp", "skills", "alpha"))).toBe(resolve(join(canonical, "alpha")));

    // Every `add` label change maps to one createIssueLabel call, never a delete.
    expect(createIssueLabel).toHaveBeenCalledWith("Feature", "Guava AI");
    expect(vi.mocked(createIssueLabel).mock.calls.length).toBe(plan.changes.labels.filter((c) => c.kind === "add").length);

    rmSync(root, { recursive: true, force: true });
  });
});

describe("runSync", () => {
  it("prints drift and returns 1 for a stale repo (read-only)", async () => {
    vi.mocked(listIssueLabels).mockResolvedValue([]);
    const repo = writeRepo(legacyConfig());
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const exit = await runSync([repo]);

    expect(exit).toBe(1);
    expect(log.mock.calls.flat().join("\n")).toContain("[change] roles");
    log.mockRestore();
    rmSync(repo, { recursive: true, force: true });
  });

  it("applies without prompting under --fix --force", async () => {
    vi.mocked(listIssueLabels).mockResolvedValue([]);
    vi.mocked(createIssueLabel).mockResolvedValue(undefined);
    const repo = writeRepo(legacyConfig());
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const exit = await runSync(["--fix", "--force", repo]);

    expect(exit).toBe(0);
    expect(log.mock.calls.flat().join("\n")).toContain("sync applied.");
    const rewritten = JSON.parse(readFileSync(join(repo, ".guava-os", "config.json"), "utf8"));
    expect(rewritten.roles).toBeUndefined();
    log.mockRestore();
    rmSync(repo, { recursive: true, force: true });
  });
});
