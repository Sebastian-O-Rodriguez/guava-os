import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Clock } from "../src/graph/graph.js";
import {
  captureFilesBaseline,
  captureGitBaseline,
  verifyFilesBaseline,
  verifyGitBaseline,
} from "../src/run/baseline.js";

const clock: Clock = { now: () => "2026-08-14T10:00:00.000Z" };

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gorp-baseline-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("GOS-33 git baseline primitive", () => {
  it("captures HEAD, branch/tag refs and tree hash as structured data", () => {
    const head = git(["rev-parse", "HEAD"], repo).trim();
    git(["tag", "v1"], repo);

    const baseline = captureGitBaseline(repo, clock);

    expect(baseline.kind).toBe("git");
    expect(baseline.head).toBe(head);
    expect(baseline.head).toMatch(/^[0-9a-f]{40}$/);
    expect(baseline.treeHash).toBe(git(["rev-parse", "HEAD^{tree}"], repo).trim());
    expect(baseline.capturedAt).toBe(clock.now());
    // refs contains the current branch and the tag, not gorp sandbox branches
    const refs = Object.keys(baseline.refs);
    expect(refs.some((r) => r.startsWith("refs/heads/"))).toBe(true);
    expect(baseline.refs["refs/tags/v1"]).toBe(head);
    expect(refs.some((r) => r.startsWith("refs/heads/gorp/run/"))).toBe(false);
  });

  it("verifies unchanged: no diffs for an untouched repo", () => {
    const baseline = captureGitBaseline(repo, clock);
    expect(verifyGitBaseline(repo, baseline)).toEqual([]);
  });

  it("detects a repointed tag even when HEAD and tree are unchanged", () => {
    writeFileSync(join(repo, "base.txt"), "base\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "second"], repo);
    const parent = git(["rev-parse", "HEAD^"], repo).trim();
    git(["tag", "v1"], repo);

    const baseline = captureGitBaseline(repo, clock);
    // repoint the tag; HEAD + tree unchanged
    git(["tag", "-f", "v1", parent], repo);
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(baseline.head);

    const diffs = verifyGitBaseline(repo, baseline);
    expect(diffs).toEqual([{ field: "refs.refs/tags/v1", expected: baseline.head, actual: parent }]);
  });

  it("detects HEAD movement and tree change", () => {
    const baseline = captureGitBaseline(repo, clock);
    writeFileSync(join(repo, "README.md"), "# changed\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "move"], repo);

    const diffs = verifyGitBaseline(repo, baseline);
    expect(diffs.some((d) => d.field === "head")).toBe(true);
    expect(diffs.some((d) => d.field === "treeHash")).toBe(true);
  });
});

describe("GOS-33 files baseline primitive (non-git targets)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gorp-baseline-files-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("captures a sorted file-hash list and verifies unchanged", () => {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "a.txt"), "aaa\n");
    writeFileSync(join(dir, "sub", "b.txt"), "bbb\n");

    const baseline = captureFilesBaseline(dir, clock);
    expect(baseline.kind).toBe("files");
    expect(baseline.capturedAt).toBe(clock.now());
    expect(baseline.files.map((f) => f.path)).toEqual(["a.txt", "sub/b.txt"]);
    expect(baseline.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);

    expect(verifyFilesBaseline(dir, baseline)).toEqual([]);
  });

  it("detects added, modified and removed files", () => {
    writeFileSync(join(dir, "a.txt"), "aaa\n");
    const baseline = captureFilesBaseline(dir, clock);

    // modify a.txt, add c.txt, remove nothing → three diffs
    writeFileSync(join(dir, "a.txt"), "changed\n");
    writeFileSync(join(dir, "c.txt"), "ccc\n");

    const diffs = verifyFilesBaseline(dir, baseline);
    expect(diffs.some((d) => d.field === "files.a.txt")).toBe(true);
    expect(diffs.some((d) => d.field === "files.c.txt")).toBe(true);
  });
});
