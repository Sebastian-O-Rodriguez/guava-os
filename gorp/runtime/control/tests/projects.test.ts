import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveProjectRepoPath } from "../src/registry/projects.js";
import { GorpError } from "../src/errors/index.js";

const ORDER =
  /bootstrap order: create minimal repo → register \(with git_remote\) → execute\/scaffold/;

function makeRegistry(entries: string): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "gorp-projects-test-"));
  const path = join(dir, "projects.yml");
  writeFileSync(path, `projects:\n${entries}\n`, "utf8");
  return { dir, path };
}

describe("resolveProjectRepoPath bootstrap-order error text", () => {
  it("names the canonical order for an unregistered project", () => {
    const { dir, path } = makeRegistry("  - id: other\n    repo_path: /tmp/other\n");
    try {
      expect(() => resolveProjectRepoPath("missing", { GORP_PROJECT_REGISTRY: path })).toThrow(
        ORDER,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names the canonical order when the entry has no repo_path", () => {
    const { dir, path } = makeRegistry("  - id: p\n");
    try {
      expect(() => resolveProjectRepoPath("p", { GORP_PROJECT_REGISTRY: path })).toThrow(ORDER);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("names the canonical order when the repo directory does not exist", () => {
    const { dir, path } = makeRegistry("  - id: p\n    repo_path: /definitely/not/here\n");
    try {
      expect(() => resolveProjectRepoPath("p", { GORP_PROJECT_REGISTRY: path })).toThrow(ORDER);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("still fails closed (GorpError PROJECT_NOT_REGISTERED) for a missing repo dir", () => {
    const { dir, path } = makeRegistry("  - id: p\n    repo_path: /definitely/not/here\n");
    try {
      expect(() => resolveProjectRepoPath("p", { GORP_PROJECT_REGISTRY: path })).toThrow(GorpError);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});