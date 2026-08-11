import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ompAdapter, extractOmpSummary } from "../src/worker/omp.js";
import { createSandbox, sandboxHead, type Sandbox } from "../src/sandbox/worktree.js";
import type { GraphNode, WorkerResult } from "../src/contracts/types.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-08-11T13:00:00.000Z" };

let repo: string;
let sandboxRoot: string;
let fakeOmpDir: string;
let prevOmpCmd: string | undefined;
let prevOmpTimeout: string | undefined;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeNode(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "node-1",
    taskType: "sprint-task",
    objective: "write a probe artifact",
    acceptanceCriteria: ["docs/probe.md exists with the exact text"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: [],
    requiredCommands: [],
    expectedArtifacts: ["docs/probe.md"],
    workerAdapter: "omp",
    dependencies: [],
    state: "running",
    attempt: 1,
    ...partial,
  };
}

/** Fake OMP binary: writes an artifact in cwd, then emits an NDJSON agent_end event. */
function writeFakeOmp(writes: boolean): string {
  const path = join(fakeOmpDir, "fake-omp.sh");
  const body = writes
    ? [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "mkdir -p docs",
        "printf 'GOS-35 probe artifact\\n' > docs/probe.md",
        "cat > /dev/null 2>&1 || true   # drain stdin (the adapter pipes the prompt)",
        "printf '%s\\n' '{\"type\":\"agent_end\",\"messages\":[{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Done: wrote docs/probe.md\"}]}]}'",
      ].join("\n")
    : [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "cat > /dev/null 2>&1 || true",
        "printf '%s\\n' '{\"type\":\"agent_end\",\"messages\":[{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Task complete, no changes needed\"}]}]}'",
      ].join("\n");
  writeFileSync(path, body + "\n", "utf8");
  chmodSync(path, 0o755);
  return path;
}

async function invokeOmp(writes: boolean): Promise<WorkerResult | Error> {
  const sandbox: Sandbox = createSandbox(
    repo,
    git(["rev-parse", "HEAD"], repo).trim(),
    join(sandboxRoot, "sandbox"),
    "gorp/run/omp-adapter-test/node-1/run-1",
  );
  process.env["GORP_OMP_CMD"] = writeFakeOmp(writes);
  try {
    return await ompAdapter.invoke({ sandbox, graphId: "g-omp", runId: "run-1", node: makeNode(), clock });
  } catch (e) {
    return e as Error;
  } finally {
    delete process.env["GORP_OMP_CMD"];
  }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gorp-omp-repo-"));
  sandboxRoot = mkdtempSync(join(tmpdir(), "gorp-omp-sb-"));
  fakeOmpDir = mkdtempSync(join(tmpdir(), "gorp-omp-fake-"));
  prevOmpCmd = process.env["GORP_OMP_CMD"];
  prevOmpTimeout = process.env["GORP_OMP_TIMEOUT"];
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
});
afterEach(() => {
  if (prevOmpCmd !== undefined) process.env["GORP_OMP_CMD"] = prevOmpCmd;
  else delete process.env["GORP_OMP_CMD"];
  if (prevOmpTimeout !== undefined) process.env["GORP_OMP_TIMEOUT"] = prevOmpTimeout;
  else delete process.env["GORP_OMP_TIMEOUT"];
  rmSync(sandboxRoot, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
  rmSync(fakeOmpDir, { recursive: true, force: true });
});

describe("OMP adapter changed-files detection (GOS-35 regression)", () => {
  it("detects the worker's UNCOMMITTED worktree artifact and commits it", async () => {
    const base = git(["rev-parse", "HEAD"], repo).trim();
    const result = (await invokeOmp(true)) as WorkerResult;

    expect(result.outcome).toBe("succeeded");
    // The agent's worktree change becomes the adapter's single commit.
    expect(result.changedFiles).toEqual(["docs/probe.md"]);
    expect(result.expectedFiles).toEqual(["docs/probe.md"]);
    expect(result.artifactRefs).toEqual(["docs/probe.md"]);
    // Summary comes from the NDJSON final assistant message, not raw output.
    expect(result.summary).toBe("Done: wrote docs/probe.md");
    // The adapter committed exactly one commit on top of the pinned base.
    const head = sandboxHead({ dir: join(sandboxRoot, "sandbox"), branch: "x", repositoryPath: repo, baseCommit: base });
    expect(head).not.toBe(base);
    const log = git(["log", "--oneline", `${base}..HEAD`], join(sandboxRoot, "sandbox"));
    expect(log.trim().split("\n").length).toBe(1);
  });

  it("fails closed with 'no files changed' when the worker creates nothing", async () => {
    const err = (await invokeOmp(false)) as Error & { code?: string; details?: Record<string, unknown> };
    expect(err).toBeInstanceOf(Error);
    expect((err as { message: string }).message).toContain("no files changed");
  });
});

describe("extractOmpSummary (NDJSON)", () => {
  it("returns the final assistant text from the agent_end event", () => {
    const ndjson = [
      '{"type":"session","id":"s1"}',
      '{"type":"message_start","message":{"role":"user"}}',
      '{"type":"agent_end","messages":[{"role":"user","content":[]},{"role":"assistant","content":[{"type":"thinking","thinking":"..."},{"type":"text","text":"Wrote docs/probe.md with exact text."}]}]}',
    ].join("\n");
    expect(extractOmpSummary(ndjson)).toBe("Wrote docs/probe.md with exact text.");
  });

  it("falls back to a default when no agent_end/assistant text exists", () => {
    expect(extractOmpSummary("not json at all\n")).toBe("OMP worker completed.");
    expect(extractOmpSummary('{"type":"session"}')).toBe("OMP worker completed.");
  });
});