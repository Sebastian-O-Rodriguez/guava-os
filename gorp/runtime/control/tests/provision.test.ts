import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSandbox, provisionSandbox, type Sandbox } from "../src/sandbox/worktree.js";

let repo: string;
let sandboxRoot: string;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeSandbox(branch: string): Sandbox {
  return createSandbox(
    repo,
    git(["rev-parse", "HEAD"], repo).trim(),
    join(sandboxRoot, branch),
    `gorp/run/${branch}/node-1/run-1`,
  );
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gorp-provision-repo-"));
  sandboxRoot = mkdtempSync(join(tmpdir(), "gorp-provision-sb-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
});

afterEach(() => {
  rmSync(sandboxRoot, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("provisionSandbox (GOS-61)", () => {
  it("symlinks gitignored dep dirs from the repo root into the sandbox", () => {
    writeFileSync(join(repo, ".gitignore"), "node_modules/\n");
    mkdirSync(join(repo, "node_modules", "pkg"), { recursive: true });
    writeFileSync(join(repo, "node_modules", "pkg", "index.js"), "module.exports = 1;\n");
    git(["add", ".gitignore"], repo);
    git(["commit", "-q", "-m", "ignore deps"], repo);

    const sandbox = makeSandbox("provision-deps");
    const provisioned = provisionSandbox(sandbox);
    expect(provisioned).toEqual(["node_modules"]);

    const link = join(sandbox.dir, "node_modules");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(join(repo, "node_modules"));

    // The sandbox reaches the dep through the symlink.
    expect(readFileSync(join(sandbox.dir, "node_modules", "pkg", "index.js"), "utf8")).toBe("module.exports = 1;\n");
  });

  it("never overwrites a directory git already checked out into the sandbox", () => {
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "main.ts"), "export {};\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "track src"], repo);

    const sandbox = makeSandbox("provision-tracked");
    expect(provisionSandbox(sandbox)).toEqual([]);

    // src/ is a real directory in the sandbox, not a symlink.
    const src = lstatSync(join(sandbox.dir, "src"));
    expect(src.isSymbolicLink()).toBe(false);
    expect(src.isDirectory()).toBe(true);
  });

  it("skips gitignored dirs that do not exist on disk in the repo root", () => {
    writeFileSync(join(repo, ".gitignore"), "dist/\n");
    git(["add", ".gitignore"], repo);
    git(["commit", "-q", "-m", "ignore dist"], repo);

    const sandbox = makeSandbox("provision-missing");
    expect(provisionSandbox(sandbox)).toEqual([]);
  });
});
