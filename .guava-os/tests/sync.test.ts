import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildSyncPlan,
  formatSyncPlan,
  migrateConfig,
  reconcileLabels,
  reconcileSymlinks,
} from "../src/sync.js";

const CANONICAL_TYPES = ["Feature", "Bug", "Improvement", "Chore", "Spike"];
const CANONICAL_DOMAINS = ["pm", "qa", "security", "backend", "frontend", "devops", "ai-ml"];

/** 69a17a6-era legacy config: roles + max_todo_per_role + dev/{role} + domains, no domainAgents. */
function legacyConfig() {
  return {
    $schema: "./config.schema.json",
    linear: { team: "Guava AI", project: "guava-os", issue_prefix: "GUA" },
    roles: ["task", "reviewer", "scout", "designer", "sonic", "librarian", "security-reviewer"],
    domains: [...CANONICAL_DOMAINS],
    statuses: {
      backlog: "Backlog",
      todo: "Todo",
      in_progress: "In Progress",
      in_review: "In Review",
      done: "Done",
    },
    active_parent_statuses: ["Todo", "In Progress"],
    invariants: {
      max_todo_per_role: 3,
      stale_hours: 48,
      reclaim_limit: 2,
      bulk_threshold: 5,
      max_subtasks_per_parent: 3,
    },
    branch_pattern: "dev/{role}",
    process_files: {},
    manifest_path: ".guava-os/manifest.json",
  };
}

describe("migrateConfig", () => {
  it("maps legacy schema to canonical with no roles/max_todo_per_role/{role} remnants", () => {
    const raw = legacyConfig();
    const { config } = migrateConfig(raw);

    expect("roles" in config).toBe(false);
    expect((config.invariants as Record<string, unknown>).max_todo_per_domain).toBe(3);
    expect("max_todo_per_role" in (config.invariants as Record<string, unknown>)).toBe(false);
    expect(config.branch_pattern).toBe("dev/{domain}");
    expect(JSON.stringify(config)).not.toContain("max_todo_per_role");
    expect(JSON.stringify(config)).not.toContain("{role}");
  });

  it("yields a valid new schema (types + readiness + domainAgents injected)", () => {
    const { config } = migrateConfig(legacyConfig());

    expect(config.types).toEqual(CANONICAL_TYPES);
    expect(config.readiness).toEqual({
      untriaged: "untriaged",
      ready: "ready-for-work",
      needs_rescoping: "needs-rescoping",
    });
    expect(config.domains).toEqual(CANONICAL_DOMAINS);
    expect(config.domainAgents).toEqual({
      pm: "task",
      qa: "reviewer",
      security: "security-reviewer",
      backend: "task",
      frontend: "designer",
      devops: "task",
      "ai-ml": "task",
    });
  });

  it("does not mutate its input", () => {
    const raw = legacyConfig();
    migrateConfig(raw);
    expect("roles" in raw).toBe(true);
    expect((raw.invariants as Record<string, unknown>).max_todo_per_role).toBe(3);
    expect(raw.branch_pattern).toBe("dev/{role}");
  });

  it("is idempotent — second pass yields no changes", () => {
    const first = migrateConfig(legacyConfig());
    const second = migrateConfig(first.config);

    expect(second.changes).toEqual([]);
    expect(second.config).toEqual(first.config);
  });

  it("seeds canonical domains when the repo hint is absent (never from roles)", () => {
    const raw = legacyConfig();
    delete (raw as Record<string, unknown>).domains;
    const { config } = migrateConfig(raw);

    expect(config.domains).toEqual(CANONICAL_DOMAINS);
    expect(config.domainAgents).toEqual({
      pm: "task",
      qa: "reviewer",
      security: "security-reviewer",
      backend: "task",
      frontend: "designer",
      devops: "task",
      "ai-ml": "task",
    });
  });

  it("seeds domainAgents from a repo hint with the correct agent mapping", () => {
    const { config } = migrateConfig({
      linear: { team: "T", project: "P", issue_prefix: "X" },
      domains: ["security", "frontend", "backend", "qa"],
    });

    expect(config.domainAgents).toEqual({
      security: "security-reviewer",
      frontend: "designer",
      backend: "task",
      qa: "reviewer",
    });
    expect(config.domains).toEqual(["security", "frontend", "backend", "qa"]);
  });

  it("emits a flag change for owner confirmation when seeding domains", () => {
    const { changes } = migrateConfig(legacyConfig());
    const flag = changes.find((c) => c.kind === "flag");
    expect(flag).toBeDefined();
    expect(flag?.item).toBe("domainAgents");
  });
});

describe("reconcileLabels", () => {
  const configured = [
    ...CANONICAL_TYPES,
    "untriaged",
    "ready-for-work",
    "needs-rescoping",
  ];

  it("returns missing readiness + type labels in create", () => {
    const existing = ["architect", "Feature", "Bug"];
    const { create } = reconcileLabels(configured, existing);

    expect(create).toEqual([
      "Improvement",
      "Chore",
      "Spike",
      "untriaged",
      "ready-for-work",
      "needs-rescoping",
    ]);
  });

  it("flags architect and other legacy/role labels as stray without deletion", () => {
    const existing = ["architect", "task", "sonic", "librarian", "Feature"];
    const { stray } = reconcileLabels(configured, existing);

    expect(stray).toEqual(["architect", "task", "sonic", "librarian"]);
    expect(existing).toHaveLength(5);
  });

  it("returns empty create and stray when already converged", () => {
    const { create, stray } = reconcileLabels(["Feature", "Bug"], ["Feature", "Bug"]);
    expect(create).toEqual([]);
    expect(stray).toEqual([]);
  });
});

describe("reconcileSymlinks", () => {
  function makeSkillTree() {
    const root = mkdtempSync(join(tmpdir(), "guava-sync-"));
    const canonical = join(root, "canonical");
    const repo = join(root, "repo");
    mkdirSync(canonical, { recursive: true });
    mkdirSync(repo, { recursive: true });
    mkdirSync(join(canonical, "alpha"), { recursive: true });
    mkdirSync(join(canonical, "behavior"), { recursive: true });
    mkdirSync(join(canonical, "gamma"), { recursive: true });
    symlinkSync(join(canonical, "alpha"), join(repo, "alpha"));
    symlinkSync(join(canonical, "nope"), join(repo, "stale"));
    return { root, canonical, repo };
  }

  it("detects missing canonical skills (incl. behavior) as add and dead targets as broken", () => {
    const { canonical, repo } = makeSkillTree();
    const { add, broken } = reconcileSymlinks(repo, canonical);

    expect(add).toEqual(["behavior", "gamma"]);
    expect(add).toContain("behavior");
    expect(broken).toEqual(["stale"]);
  });

  it("returns no drift for a fully converged tree", () => {
    const root = mkdtempSync(join(tmpdir(), "guava-sync-converged-"));
    const canonical = join(root, "canonical");
    const repo = join(root, "repo");
    mkdirSync(canonical, { recursive: true });
    mkdirSync(repo, { recursive: true });
    mkdirSync(join(canonical, "alpha"), { recursive: true });
    symlinkSync(join(canonical, "alpha"), join(repo, "alpha"));
    try {
      expect(reconcileSymlinks(repo, canonical)).toEqual({ add: [], broken: [] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("buildSyncPlan", () => {
  it("composes config, label, and symlink drift into one plan", () => {
    const plan = buildSyncPlan({
      repoRoot: "/repo/guava-os",
      config: legacyConfig(),
      linearLabels: [],
      skillLinks: [
        { name: "behavior", target: "", broken: false },
        { name: "supabase", target: "/dead/path", broken: true },
        { name: "alpha", target: "/real/alpha", broken: false },
      ],
    });

    expect(plan.repo).toBe("/repo/guava-os");
    expect(plan.drift).toBe(true);

    expect(plan.changes.config.length).toBeGreaterThan(0);
    expect(plan.changes.config.some((c) => c.kind === "flag")).toBe(true);

    expect(plan.changes.labels.length).toBeGreaterThan(0);
    expect(plan.changes.labels.some((c) => c.kind === "add")).toBe(true);

    expect(plan.changes.symlinks).toEqual([
      { kind: "add", item: "behavior", detail: "missing symlink to canonical skill" },
      { kind: "flag", item: "supabase", detail: "dead symlink target → /dead/path" },
    ]);
  });

  it("reports no drift when all surfaces are converged", () => {
    const migrated = migrateConfig(legacyConfig()).config;
    const configured = [
      ...CANONICAL_TYPES,
      "untriaged",
      "ready-for-work",
      "needs-rescoping",
      ...CANONICAL_DOMAINS,
    ];

    const plan = buildSyncPlan({
      repoRoot: "/repo/guava-os",
      config: migrated,
      linearLabels: configured,
      skillLinks: [],
    });

    expect(plan.drift).toBe(false);
    expect(plan.changes.config).toEqual([]);
    expect(plan.changes.labels).toEqual([]);
    expect(plan.changes.symlinks).toEqual([]);
  });
});

describe("formatSyncPlan", () => {
  it("groups config / labels / symlinks with [kind] item - detail lines", () => {
    const plan = buildSyncPlan({
      repoRoot: "/repo/guava-os",
      config: legacyConfig(),
      linearLabels: [],
      skillLinks: [{ name: "behavior", target: "", broken: false }],
    });

    const text = formatSyncPlan(plan);

    expect(text).toContain("sync plan — repo: /repo/guava-os");
    expect(text).toContain("drift: yes");
    expect(text).toContain("config");
    expect(text).toContain("labels");
    expect(text).toContain("symlinks");
    expect(text).toMatch(/\[change\]/);
    expect(text).toMatch(/\[add\]/);
    expect(text).toMatch(/\[flag\]/);
    expect(text).toMatch(/\[add\] behavior - missing symlink to canonical skill/);
  });

  it("prints (no drift) for converged groups", () => {
    const plan = {
      repo: "/repo/guava-os",
      drift: false,
      changes: { config: [], labels: [], symlinks: [], uncommitted: [] },
    };

    const text = formatSyncPlan(plan);
    expect(text).toContain("drift: none");
    expect(text).toContain("(no drift)");
  });
});

describe("sync read-only guarantee", () => {
  it("exports no mutation-named functions", async () => {
    const mod = await import("../src/sync.js");
    const names = Object.keys(mod);
    for (const mutation of ["write", "save", "create", "update", "delete", "remove", "push", "sync"]) {
      expect(names).not.toContain(mutation);
    }
  });
});
