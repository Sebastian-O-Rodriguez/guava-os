import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  fixtureAdapter,
  implementedAdapters,
  invokeAdapter,
  resolveWorkerAdapter,
  type WorkerAdapter,
  type WorkerInvocation,
} from "../src/worker/adapter.js";
import { createSandbox, sandboxHead, type Sandbox } from "../src/sandbox/worktree.js";
import { validateAgainst } from "../src/contracts/validator.js";
import { GorpError } from "../src/errors/index.js";
import type { GraphNode, WorkerResult } from "../src/contracts/types.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-07-16T13:00:00.000Z" };

let repo: string;
let sandboxRoot: string;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeNode(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "node-1",
    taskType: "fixture-mutation",
    objective: "add a governed note",
    acceptanceCriteria: ["note exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: ["docs/note.md"],
    workerAdapter: "fixture",
    dependencies: [],
    state: "running",
    attempt: 1,
    ...partial,
  };
}

function makeInvocation(): WorkerInvocation {
  const sandbox: Sandbox = createSandbox(
    repo,
    git(["rev-parse", "HEAD"], repo).trim(),
    join(sandboxRoot, "sandbox"),
    "gorp/run/adapter-test/node-1/run-1",
  );
  return { sandbox, graphId: "g-adapter", runId: "run-1", node: makeNode(), clock };
}

async function expectWorkerContractError(fn: () => unknown, violationIncludes: string): Promise<GorpError> {
  let err: GorpError | null = null;
  try {
    await fn();
  } catch (e) {
    err = e as GorpError;
  }
  expect(err).not.toBeNull();
  expect(err!.code).toBe("WORKER_FAILED");
  expect(String(err!.details["contractViolation"])).toContain(violationIncludes);
  return err!;
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "gorp-adapter-repo-"));
  sandboxRoot = mkdtempSync(join(tmpdir(), "gorp-adapter-sb-"));
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

describe("Sprint 3B worker adapter seam", () => {
  it("registry: fixture resolves; unknown adapter fails closed with the implemented list", async () => {
    expect(resolveWorkerAdapter("fixture")).toBe(fixtureAdapter);
    expect(implementedAdapters()).toEqual(["fixture", "omp"]);

    expect(resolveWorkerAdapter("omp").name).toBe("omp");
    let err: GorpError | null = null;
    try {
      resolveWorkerAdapter("unknown-worker");
    } catch (e) {
      err = e as GorpError;
    }
    expect(err!.code).toBe("NOT_IMPLEMENTED");
    expect(err!.details["workerAdapter"]).toBe("unknown-worker");
    expect(err!.details["implemented"]).toEqual(["fixture", "omp"]);
    expect(err!.details["mutation"]).toBe(false);
  });

  it("fixture passes through the adapter boundary with identical, contract-valid behavior", async () => {
    const invocation = makeInvocation();
    const result = await invokeAdapter(fixtureAdapter, invocation);

    // same behavior as before the seam: one commit, deterministic result
    expect(result.outcome).toBe("succeeded");
    expect(result.workerAdapter).toBe("fixture");
    expect(result.graphId).toBe("g-adapter");
    expect(result.nodeId).toBe("node-1");
    expect(result.runId).toBe("run-1");
    expect(result.changedFiles).toEqual(["docs/note.md"]);
    expect(validateAgainst("worker-result", result).valid).toBe(true);
    // the worker committed exactly once in the sandbox
    expect(sandboxHead(invocation.sandbox)).toMatch(/^[0-9a-f]{40}$/);
    expect(git(["rev-list", "--count", "HEAD"], invocation.sandbox.dir).trim()).toBe("2");
    // and the consumer checkout is untouched
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
  });

  it("bad result: schema-invalid worker output is refused at the boundary", async () => {
    const bad: WorkerAdapter = {
      name: "fixture",
      invoke: () => ({ nonsense: true }) as unknown as WorkerResult,
    };
    await expectWorkerContractError(() => invokeAdapter(bad, makeInvocation()), "schema validation");
  });

  it("contract error: identity mismatch is refused (worker cannot report for another node)", async () => {
    const liar: WorkerAdapter = {
      name: "fixture",
      invoke: (input) => ({
        schemaVersion: 1,
        graphId: input.graphId,
        nodeId: "some-other-node", // lies about which node it worked on
        runId: input.runId,
        workerAdapter: "fixture",
        outcome: "succeeded",
        startedAt: input.clock.now(),
        endedAt: input.clock.now(),
      }),
    };
    const err = await expectWorkerContractError(() => invokeAdapter(liar, makeInvocation()), "identity");
    expect((err.details["got"] as { nodeId: string }).nodeId).toBe("some-other-node");
  });

  it("contract error: claiming a different adapter name is refused", async () => {
    const impostor: WorkerAdapter = {
      name: "fixture",
      invoke: (input) => ({
        schemaVersion: 1,
        graphId: input.graphId,
        nodeId: input.node.nodeId,
        runId: input.runId,
        workerAdapter: "retired-adapter", // result claims to come from a different adapter
        outcome: "succeeded",
        startedAt: input.clock.now(),
        endedAt: input.clock.now(),
      }),
    };
    await expectWorkerContractError(() => invokeAdapter(impostor, makeInvocation()), "different workerAdapter");
  });

  it("the invocation is the worker's whole world: no config, store, or state-home access", async () => {
    // Structural proof: WorkerInvocation exposes exactly these keys.
    const invocation = makeInvocation();
    expect(Object.keys(invocation).sort()).toEqual(["clock", "graphId", "node", "runId", "sandbox"]);
    // and the sandbox handle carries only git-level facts
    expect(Object.keys(invocation.sandbox).sort()).toEqual(["baseCommit", "branch", "dir", "repositoryPath"]);
  });
});
