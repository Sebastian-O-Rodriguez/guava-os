import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, ConfigStaleError, type Config } from "../src/config.js";

const VALID_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
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
  statuses: {
    backlog: "Backlog",
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: {
    max_todo_per_domain: 3,
    stale_hours: 48,
    reclaim_limit: 2,
    bulk_threshold: 5,
    max_subtasks_per_parent: 3,
  },
  branch_pattern: "dev/{domain}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

// Role-based config predating the domain model (guavabi-shaped).
const LEGACY_CONFIG = {
  linear: { team: "Guava AI", project: "guava-bi", issue_prefix: "BIA" },
  roles: ["task", "reviewer", "scout", "designer", "sonic", "librarian"],
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
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

function writeConfig(config: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "guava-config-"));
  const configDir = join(dir, ".guava-os");
  mkdirSync(configDir);
  writeFileSync(join(configDir, "config.json"), JSON.stringify(config, null, 2), "utf8");
  return dir;
}

function caughtMessage(run: () => unknown): string {
  try {
    run();
  } catch (err) {
    return (err as Error).message;
  }
  return "";
}

describe("loadConfig schema validation", () => {
  it("loads a valid new-schema config unchanged", () => {
    const dir = writeConfig(VALID_CONFIG);
    try {
      expect(loadConfig(dir)).toEqual(VALID_CONFIG);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws ConfigStaleError (not a TypeError) for a legacy config", () => {
    const dir = writeConfig(LEGACY_CONFIG);
    try {
      let thrown: unknown;
      try {
        loadConfig(dir);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ConfigStaleError);
      expect(thrown).not.toBeInstanceOf(TypeError);

      const message = (thrown as Error).message;
      expect(message).toContain("Missing fields: domains, domainAgents, invariants.max_todo_per_domain");
      expect(message).toContain("Legacy fields: roles, invariants.max_todo_per_role, branch_pattern (contains \"{role}\")");
      expect(message).toContain("guava-os sync <repo>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names only the missing fields for a partial config", () => {
    const partial = { ...VALID_CONFIG };
    delete (partial as { domainAgents?: unknown }).domainAgents;
    delete (partial as { types?: unknown }).types;
    const dir = writeConfig(partial);
    try {
      const message = caughtMessage(() => loadConfig(dir));
      expect(message).toContain("Missing fields: domainAgents, types");
      expect(message).toContain("guava-os sync <repo>");
      expect(message).not.toContain("linear");
      expect(message).not.toContain("domains");
      expect(message).not.toContain("Legacy fields");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("flags a config carrying a legacy marker even when new fields are present", () => {
    const mixed = { ...VALID_CONFIG, roles: ["task", "reviewer"] };
    const dir = writeConfig(mixed);
    try {
      const message = caughtMessage(() => loadConfig(dir));
      expect(message).toContain("Legacy fields: roles");
      expect(message).not.toContain("Missing fields");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
