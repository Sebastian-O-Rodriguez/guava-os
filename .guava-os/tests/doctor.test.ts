import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRegistryRemotes, formatDoctor, runDoctor } from "../src/doctor.js";
import type { Config } from "../src/config.js";
import type { RegistryProject } from "../src/registry.js";

function activeProject(partial: Partial<RegistryProject> & { id: string }): RegistryProject {
  return { lifecycle: "active", ...partial };
}

describe("checkRegistryRemotes", () => {
  it("reports ok when git_remote matches the local origin", () => {
    const result = checkRegistryRemotes(
      [activeProject({ id: "guava-os", gitRemote: "https://github.com/o/guava-os.git", repoPath: "/repo/guava-os" })],
      () => "https://github.com/o/guava-os.git",
    );
    expect(result.passed).toBe(true);
    expect(result.remotes?.[0]).toMatchObject({ id: "guava-os", status: "ok" });
  });

  it("reports missing when an active project has no git_remote", () => {
    const result = checkRegistryRemotes(
      [activeProject({ id: "routineme", repoPath: "/repo" })],
      () => "https://github.com/o/routineme.git",
    );
    expect(result.remotes?.[0]).toMatchObject({ id: "routineme", status: "missing" });
    expect(result.detail).toContain("missing: routineme");
  });

  it("flags an origin mismatch as advisory, never a failure", () => {
    const result = checkRegistryRemotes(
      [activeProject({ id: "guava-site", gitRemote: "https://github.com/o/company-site.git", repoPath: "/repo" })],
      () => "https://github.com/o/different.git",
    );
    expect(result.passed).toBe(true);
    expect(result.advisory).toBe(true);
    expect(result.remotes?.[0]).toMatchObject({
      id: "guava-site",
      status: "mismatch",
      registryRemote: "https://github.com/o/company-site.git",
      localRemote: "https://github.com/o/different.git",
      note: "origin https://github.com/o/different.git",
    });
    expect(result.detail).toContain("mismatch: guava-site");
  });

  it("flags dir-name mismatch when repo dir != remote repo name (documented case)", () => {
    // guava-site: dir name "guava-site" differs from remote repo "company-site".
    const result = checkRegistryRemotes(
      [activeProject({ id: "guava-site", gitRemote: "https://github.com/o/company-site.git", repoPath: "/repo/guava-site" })],
      () => "https://github.com/o/company-site.git",
    );
    expect(result.remotes?.[0]).toMatchObject({
      id: "guava-site",
      status: "mismatch",
      registryRemote: "https://github.com/o/company-site.git",
      note: 'dir "guava-site" != remote repo "company-site"',
    });
    expect(result.detail).toContain("mismatch: guava-site");
  });

  it("ignores retired projects", () => {
    const result = checkRegistryRemotes(
      [{ id: "guava-hermes", lifecycle: "retired", repoPath: "/repo" }],
      () => "https://github.com/o/guava-hermes.git",
    );
    expect(result.remotes).toEqual([]);
    expect(result.detail).toContain("0/0 active projects");
  });

  it("reports unknown when the local origin is unreadable", () => {
    const result = checkRegistryRemotes(
      [activeProject({ id: "bell-diagnostic", gitRemote: "https://github.com/o/bell-diagnostic.git", repoPath: "/gone" })],
      () => null,
    );
    expect(result.remotes?.[0]).toMatchObject({ id: "bell-diagnostic", status: "unknown" });
    expect(result.detail).toContain("unverified origin: bell-diagnostic");
  });
});
describe("formatDoctor git_remote column", () => {
  it("renders project / status / git_remote columns with the mismatch note", () => {
    const result = checkRegistryRemotes(
      [activeProject({ id: "guava-site", gitRemote: "https://github.com/o/company-site.git", repoPath: "/repo" })],
      () => "https://github.com/o/different.git",
    );
    const output = formatDoctor([result]);
    expect(output).toContain("status     git_remote");
    expect(output).toContain("https://github.com/o/company-site.git");
    expect(output).toContain("(origin https://github.com/o/different.git)");
  });
});

// ── GUA-136: AGENTS.md is advisory, never a doctor hard-fail ────────────────

const ADVISORY_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
  personas: ["architect", "backend", "frontend", "qa"],
  statuses: {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
    in_review: "In Review", done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  labels: { persona_labels: ["architect", "backend", "frontend"], qa_label: "qa" },
  invariants: {
    max_todo_per_persona: 3, stale_hours: 48, reclaim_limit: 2,
    bulk_threshold: 5, max_subtasks_per_parent: 3,
  },
  branch_pattern: "feat/{prefix}-{id}-{slug}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

describe("GUA-136: agents-md advisory contract", () => {
  it("is advisory (passed, never a hard fail) when AGENTS.md is absent for a nonexistent root", () => {
    const results = runDoctor("/nonexistent/path", ADVISORY_CONFIG, false);
    const agents = results.find((r) => r.name === "agents-md");
    expect(agents).toBeDefined();
    expect(agents!.passed).toBe(true);
    expect(agents!.advisory).toBe(true);
  });

  it("is advisory (passed) when AGENTS.md is present with an ADR_001 authority reference", () => {
    const root = mkdtempSync(join(tmpdir(), "doctor-agents-"));
    try {
      mkdirSync(join(root, ".guava-os"), { recursive: true });
      writeFileSync(join(root, "AGENTS.md"), "## Authority\nADR_001 wins every conflict.\n", "utf8");
      const results = runDoctor(root, ADVISORY_CONFIG, false);
      const agents = results.find((r) => r.name === "agents-md");
      expect(agents!.passed).toBe(true);
      expect(agents!.advisory).toBe(true);
      expect(agents!.detail).toContain("ADR_001");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
