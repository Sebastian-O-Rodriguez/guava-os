import { describe, it, expect } from "vitest";
import { resolveLaunchTarget, gosCliPath, computeWorktreeDir } from "../src/launch.js";
import type { RoleDef } from "../src/roles.js";
import type { RegistryProject } from "../src/registry.js";

const ROLES: RoleDef[] = [
  { id: "project-agent", writableRoots: ["self"] },
  { id: "gos-agent", writableRoots: ["guava-os"] },
  { id: "reviewer", writableRoots: [] },
  { id: "operator", writableRoots: ["*"] },
];

const REGISTRY: RegistryProject[] = [
  { id: "guava-os", repoPath: "/work/guava-os", linearProject: "guava-os" },
  { id: "bell-diagnostic", repoPath: "/work/bell-diagnostic", linearProject: "bell-diagnostic" },
  { id: "guavabi", repoPath: "/work/guavabi", linearProject: "guava-bi" },
  { id: "guava-site", repoPath: "/work/guava-site" },
];

describe("resolveLaunchTarget", () => {
  it("project-agent resolves --project to its repo and binds the owned-repo allowlist", () => {
    const t = resolveLaunchTarget("project-agent", "bell-diagnostic", ROLES, REGISTRY);
    expect(t.projectId).toBe("bell-diagnostic");
    expect(t.projectRepoPath).toBe("/work/bell-diagnostic");
    expect(t.writableRoots).toEqual(["/work/bell-diagnostic"]);
    expect(t.createWorktree).toBe(true);
  });

  it("project-agent resolves a Linear project name via the registry", () => {
    const t = resolveLaunchTarget("project-agent", "guava-bi", ROLES, REGISTRY);
    expect(t.projectId).toBe("guavabi");
    expect(t.writableRoots).toEqual(["/work/guavabi"]);
  });

  it("gos-agent pins guava-os without needing --project", () => {
    const t = resolveLaunchTarget("gos-agent", undefined, ROLES, REGISTRY);
    expect(t.projectId).toBe("guava-os");
    expect(t.projectRepoPath).toBe("/work/guava-os");
    expect(t.writableRoots).toEqual(["/work/guava-os"]);
    expect(t.createWorktree).toBe(true);
  });

  it("reviewer binds NO writable roots (read/test only)", () => {
    const t = resolveLaunchTarget("reviewer", "bell-diagnostic", ROLES, REGISTRY);
    expect(t.projectId).toBe("bell-diagnostic");
    expect(t.projectRepoPath).toBe("/work/bell-diagnostic");
    expect(t.writableRoots).toEqual([]);
    expect(t.createWorktree).toBe(false);
  });

  it("reviewer requires --project to select its read target", () => {
    expect(() => resolveLaunchTarget("reviewer", undefined, ROLES, REGISTRY)).toThrow(
      /requires --project/,
    );
  });

  it("operator is the only cross-repo writer (all registry repos)", () => {
    const t = resolveLaunchTarget("operator", undefined, ROLES, REGISTRY);
    expect(t.writableRoots).toEqual([
      "/work/guava-os",
      "/work/bell-diagnostic",
      "/work/guavabi",
      "/work/guava-site",
    ]);
    expect(t.createWorktree).toBe(false);
  });

  it("throws for an unknown role", () => {
    expect(() => resolveLaunchTarget("superuser", undefined, ROLES, REGISTRY)).toThrow(
      /Unknown role "superuser"/,
    );
  });

  it("throws for an unregistered project", () => {
    expect(() => resolveLaunchTarget("project-agent", "nope", ROLES, REGISTRY)).toThrow(
      /Unregistered Linear project/,
    );
  });
});

describe("launch helpers", () => {
  it("computeWorktreeDir is deterministic under the state root", () => {
    expect(computeWorktreeDir("/state", "bell-diagnostic", "project-agent", "123")).toBe(
      "/state/worktrees/bell-diagnostic/project-agent-123",
    );
  });

  it("gosCliPath points at the stable GOS CLI", () => {
    expect(gosCliPath().endsWith(".guava-os/bin/guava-os")).toBe(true);
  });
});
