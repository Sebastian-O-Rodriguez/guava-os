import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { loadRegistry, resolveRegistryProjectId, type RegistryProject } from "../src/registry.js";

const FIXTURE: RegistryProject[] = [
  { id: "guava-os", linearProject: "guava-os" },
  { id: "guavabi", linearProject: "guava-bi" },
  { id: "reusable-diagnostic-engine", linearProject: "Reusable Diagnostic Engine v1" },
  { id: "bell-diagnostic", linearProject: "bell-diagnostic" },
  // Entry with no linear_project — resolved only by id fallback
  { id: "standalone", name: "Standalone Project" },
];

describe("resolveRegistryProjectId", () => {
  it("resolves guava-bi to guavabi via linear_project", () => {
    expect(resolveRegistryProjectId("guava-bi", FIXTURE)).toBe("guavabi");
  });

  it("falls back to id match when no linear_project matches", () => {
    // "guava-os" is both an id and a linear_project — but linear match takes precedence.
    // Use "standalone" which has no linear_project, so the id fallback path is exercised.
    expect(resolveRegistryProjectId("standalone", FIXTURE)).toBe("standalone");
  });

  it("throws a clear error for an unregistered project", () => {
    expect(() => resolveRegistryProjectId("nonexistent", FIXTURE)).toThrow(
      /Unregistered Linear project "nonexistent"/,
    );
  });
});

describe("loadRegistry git_remote parsing", () => {
  function writeRegistry(body: string): string {
    const dir = mkdtempSync(join(tmpdir(), "guava-registry-"));
    const path = join(dir, "projects.yml");
    writeFileSync(path, body, "utf8");
    return dir;
  }

  it("parses git_remote and lifecycle keys", () => {
    const dir = writeRegistry([
      "projects:",
      "  - id: guava-site",
      "    name: Guava Site",
      "    repo_path: ~/dev/repos/guava-site",
      "    git_remote: https://github.com/Sebastian-O-Rodriguez/company-site.git",
      "    lifecycle: active",
    ].join("\n"));
    try {
      const projects = loadRegistry(join(dir, "projects.yml"));
      expect(projects).toHaveLength(1);
      expect(projects[0].gitRemote).toBe("https://github.com/Sebastian-O-Rodriguez/company-site.git");
      expect(projects[0].repoPath).toBe("~/dev/repos/guava-site");
      expect(projects[0].lifecycle).toBe("active");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("leaves gitRemote undefined when the key is absent", () => {
    const dir = writeRegistry([
      "projects:",
      "  - id: routineme",
      "    repo_path: ~/dev/repos/routineme",
      "    lifecycle: active",
    ].join("\n"));
    try {
      const projects = loadRegistry(join(dir, "projects.yml"));
      expect(projects[0].gitRemote).toBeUndefined();
      expect(projects[0].repoPath).toBe("~/dev/repos/routineme");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
