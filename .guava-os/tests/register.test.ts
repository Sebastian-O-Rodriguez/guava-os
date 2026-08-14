import { describe, it, expect } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerProject, runRegister } from "../src/register.js";
import { loadRegistry } from "../src/registry.js";
import { checkRegistryRemotes } from "../src/doctor.js";


function tmpDir() {
  return mkdtempSync(join(tmpdir(), "guava-register-test-"));
}

/** Write a minimal projects.yml with one existing entry. */
function writeRegistry(dir: string, ...blocks: string[]): string {
  const path = join(dir, "projects.yml");
  writeFileSync(path, `projects:\n${blocks.join("\n")}\n`, "utf8");
  return path;
}

describe("registerProject", () => {
  it("creates a repo dir (git init) and records repo + remote + lifecycle in the registry", () => {
    const dir = tmpDir();
    try {
      const repo = join(dir, "new-proj");
      const reg = writeRegistry(
        dir,
        "  - id: existing",
        "    repo_path: /tmp/existing",
      );
      const r = registerProject("new-proj", repo, "https://github.com/o/new-proj.git", reg);

      expect(r.createdRepo).toBe(true);
      expect(r.entryCreated).toBe(true);
      expect(r.repoPathAbs).toBe(repo);
      expect(r.gitRemote).toBe("https://github.com/o/new-proj.git");

      // Repo exists and is a git repo.
      expect(existsSync(repo)).toBe(true);
      expect(readFileSync(join(repo, ".git", "HEAD"), "utf8").trim()).toBeTruthy();

      // Origin remote set.
      const gitConfig = readFileSync(join(repo, ".git", "config"), "utf8");
      expect(gitConfig).toContain("https://github.com/o/new-proj.git");

      // Registry parses back.
      const projects = loadRegistry(reg);
      const entry = projects.find((p) => p.id === "new-proj")!;
      expect(entry.repoPath).toBe(repo);
      expect(entry.gitRemote).toBe("https://github.com/o/new-proj.git");
      expect(entry.lifecycle).toBe("active");

      // Existing entry preserved.
      expect(projects.find((p) => p.id === "existing")).toBeDefined();

      // Only one new-proj entry.
      expect(projects.filter((p) => p.id === "new-proj")).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("updates an existing entry instead of duplicating (idempotent re-register)", () => {
    const dir = tmpDir();
    try {
      const repo = join(dir, "repo");
      mkdirSync(repo, { recursive: true });
      // git init the existing dir so ensureRepoDir doesn't surprise us
      execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });

      const reg = writeRegistry(
        dir,
        "  - id: proj",
        "    repo_path: /old/path",
        "    git_remote: https://github.com/o/old.git",
        "    lifecycle: active",
      );
      registerProject("proj", repo, "https://github.com/o/new.git", reg);

      const projects = loadRegistry(reg);
      expect(projects.filter((p) => p.id === "proj")).toHaveLength(1);
      expect(projects.find((p) => p.id === "proj")!.repoPath).toBe(repo);
      expect(projects.find((p) => p.id === "proj")!.gitRemote).toBe("https://github.com/o/new.git");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("doctor git-remote check reports ok after a matching register", () => {
    const dir = tmpDir();
    try {
      const repo = join(dir, "new-proj");
      const reg = writeRegistry(dir);
      registerProject("new-proj", repo, "https://github.com/o/new-proj.git", reg);

      // Load the registry for a complete entry (carries gitRemote too).
      const loaded = loadRegistry(reg);
      const check = checkRegistryRemotes(loaded);

      const remote = check.remotes?.find((r) => r.id === "new-proj");
      expect(remote).toBeDefined();
      expect(remote!.status).toBe("ok");
      expect(remote!.registryRemote).toBe("https://github.com/o/new-proj.git");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("handles repo dirs that exist without .git (git init inside)", () => {
    const dir = tmpDir();
    try {
      const repo = join(dir, "existing-dir");
      mkdirSync(repo, { recursive: true });
      writeFileSync(join(repo, "README.md"), "# hello\n");
      const reg = writeRegistry(dir);

      const r = registerProject("p", repo, undefined, reg);
      // createdRepo = false because dir already existed
      expect(r.createdRepo).toBe(false);
      // But .git was created
      expect(existsSync(join(repo, ".git"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runRegister requires --repo", () => {
    expect(() => runRegister(["proj"], false)).toThrow(/--repo <path> is required/);
  });

  it("runRegister requires <id>", () => {
    expect(() => runRegister([], false)).toThrow(/<id> is required/);
  });
});