import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProject } from "../src/register.js";
import {
  buildSyncPlan,
  migrateConfig,
  reconcileSymlinks,
} from "../src/sync.js";

const CANONICAL_TYPES = ["Feature", "Bug", "Improvement", "Chore", "Spike"];
const CANONICAL_DOMAINS = ["pm", "qa", "security", "backend", "frontend", "devops", "ai-ml"];

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "guava-register-converge-"));
}

/** A tiny canonical skill store with three skills. */
function makeCanonical(dir: string): string {
  const canonical = join(dir, "canonical");
  for (const name of ["alpha", "behavior", "gamma"]) {
    mkdirSync(join(canonical, name), { recursive: true });
  }
  return canonical;
}

function configuredLabels(config: Record<string, unknown>): string[] {
  return [
    ...(config.types as string[]),
    (config.readiness as Record<string, string>).untriaged,
    (config.readiness as Record<string, string>).ready,
    (config.readiness as Record<string, string>).needs_rescoping,
    ...(config.domains as string[]),
  ];
}

describe("register convergence at birth (GUA-490)", () => {
  it("writes a new-schema config and links canonical skills so sync is clean", () => {
    const dir = tmpDir();
    try {
      const canonical = makeCanonical(dir);
      const repo = join(dir, "new-proj");
      const reg = join(dir, "projects.yml");
      writeFileSync(reg, "projects:\n", "utf8");

      registerProject("new-proj", repo, undefined, reg, canonical);

      // Config exists and is new-schema (domains/domainAgents/types/readiness).
      const configPath = join(repo, ".guava-os", "config.json");
      expect(existsSync(configPath)).toBe(true);
      const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
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

      // Already-new-schema: migrateConfig is a no-op (no config drift).
      expect(migrateConfig(config).changes).toEqual([]);

      // Canonical skills are linked into `.omp/skills`.
      const skillsDir = join(repo, ".omp", "skills");
      for (const name of ["alpha", "behavior", "gamma"]) {
        expect(readlinkSync(join(skillsDir, name))).toBe(join(canonical, name));
      }
      expect(reconcileSymlinks(skillsDir, canonical)).toEqual({ add: [], broken: [] });

      // Full plan: no drift across config, labels, symlinks.
      const plan = buildSyncPlan({
        repoRoot: repo,
        config,
        linearLabels: configuredLabels(config),
        skillLinks: [],
      });
      expect(plan.drift).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("migrates a legacy config on re-register (roles dropped, new schema seeded)", () => {
    const dir = tmpDir();
    try {
      const canonical = makeCanonical(dir);
      const repo = join(dir, "legacy-repo");
      mkdirSync(join(repo, ".guava-os"), { recursive: true });
      writeFileSync(
        join(repo, ".guava-os", "config.json"),
        JSON.stringify({
          linear: { team: "T", project: "P", issue_prefix: "X" },
          roles: ["task", "reviewer"],
          domains: ["backend", "qa"],
          types: ["Feature", "Bug"],
          readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
          invariants: { max_todo_per_role: 3 },
          branch_pattern: "dev/{role}",
        }),
        "utf8",
      );
      const reg = join(dir, "projects.yml");
      writeFileSync(reg, "projects:\n", "utf8");

      registerProject("legacy-repo", repo, undefined, reg, canonical);

      const config = JSON.parse(
        readFileSync(join(repo, ".guava-os", "config.json"), "utf8"),
      ) as Record<string, unknown>;
      expect("roles" in config).toBe(false);
      expect(config.branch_pattern).toBe("dev/{domain}");
      // Existing non-empty types are preserved (injection only fills a gap).
      expect(config.types).toEqual(["Feature", "Bug"]);
      expect(config.readiness).toEqual({
        untriaged: "untriaged",
        ready: "ready-for-work",
        needs_rescoping: "needs-rescoping",
      });
      // Domain hint (backend, qa) kept; domainAgents seeded for them.
      expect(config.domains).toEqual(["backend", "qa"]);
      expect(config.domainAgents).toEqual({ backend: "task", qa: "reviewer" });
      // Preserved non-migration fields.
      expect(config.linear).toEqual({ team: "T", project: "P", issue_prefix: "X" });
      expect((config.invariants as Record<string, unknown>).max_todo_per_domain).toBe(3);
      expect("max_todo_per_role" in (config.invariants as Record<string, unknown>)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tolerates a missing canonical skill store (config still converges, no crash)", () => {
    const dir = tmpDir();
    try {
      const repo = join(dir, "no-skills");
      const reg = join(dir, "projects.yml");
      writeFileSync(reg, "projects:\n", "utf8");

      registerProject("no-skills", repo, undefined, reg, join(dir, "does-not-exist"));

      const configPath = join(repo, ".guava-os", "config.json");
      expect(existsSync(configPath)).toBe(true);
      // No canonical skills → no symlinks; reconcile is empty.
      expect(reconcileSymlinks(join(repo, ".omp", "skills"), join(dir, "does-not-exist"))).toEqual({
        add: [],
        broken: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});