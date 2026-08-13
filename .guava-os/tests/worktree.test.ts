import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorktree, destroyWorktree } from "../src/worktree.js";

const tmpDirs: string[] = [];
function tmpRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "gos45-wt-"));
  tmpDirs.push(dir);
  return dir;
}

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "ignore" });
}

afterEach(() => {
  for (const d of tmpDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe("createWorktree / destroyWorktree (git-backed isolation)", () => {
  it("creates an isolated worktree off HEAD, then destroys it cleanly", () => {
    const repo = tmpRepo();
    git(["init", "-q"], repo);
    git(["config", "user.email", "t@example.com"], repo);
    git(["config", "user.name", "t"], repo);
    writeFileSync(join(repo, "owned.txt"), "owned content\n");
    git(["add", "owned.txt"], repo);
    git(["commit", "-qm", "base"], repo);

    const wtDir = join(tmpdir(), `gos45-wt-checkout-${Date.now()}`);
    const wt = createWorktree(repo, wtDir, "guava-os/launch/test/branch");

    expect(wt.repositoryPath).toBe(repo);
    expect(wt.branch).toBe("guava-os/launch/test/branch");
    expect(wt.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(existsSync(wtDir)).toBe(true);
    // The worktree is a checkout of the owned repo at the recorded base.
    expect(readFileSync(join(wtDir, "owned.txt"), "utf-8")).toBe("owned content\n");

    // The consumer working tree must stay untouched/clean.
    expect(gitStatusPorcelain(repo)).toBe("");

    destroyWorktree(wt);
    expect(existsSync(wtDir)).toBe(false);
  });

  it("fails closed when the repository does not exist", () => {
    expect(() => createWorktree("/no/such/repo", "/tmp/x", "b")).toThrow(
      /repository does not exist/,
    );
  });
});

function gitStatusPorcelain(repo: string): string {
  return execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).trim();
}
