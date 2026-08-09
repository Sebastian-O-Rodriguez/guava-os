import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Sprint 2.1 — failure semantics: every orchestrate invocation persists its
// outcome (started/ended events) so a DETACHED invocation whose stdout is
// discarded is never silent. These tests drive the COMPILED CLI as a
// subprocess (the real operator path) and only use internal imports to
// construct test states and to read the folded status.
import { loadConfig, orchestratorLogPath, type RuntimeConfig } from "../src/config/index.js";
import {
  readOrchestratorStatus,
  recordOrchestrateStarted,
  pidAlive,
} from "../src/orchestrator/status.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import type { GraphNode } from "../src/contracts/types.js";
import { registerProjects } from "./helpers.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");

const clock: Clock = { now: () => "2026-07-25T12:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

beforeAll(() => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeConsumer(): string {
  const dir = mkdtempSync(join(tmpdir(), "gorp-ostatus-repo-"));
  git(["init", "-q"], dir);
  git(["config", "user.email", "t@example.com"], dir);
  git(["config", "user.name", "t"], dir);
  writeFileSync(join(dir, "README.md"), "# consumer\n");
  git(["add", "."], dir);
  git(["commit", "-q", "-m", "init"], dir);
  return dir;
}

function node(nodeId: string, artifact: string, deps: string[] = []): GraphNode {
  return {
    nodeId,
    taskType: "fixture-mutation",
    objective: `write ${artifact}`,
    acceptanceCriteria: ["artifact exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: [artifact],
    workerAdapter: "fixture",
    dependencies: deps,
    state: "pending",
    attempt: 0,
  };
}

function saveGraph(graphId: string, nodes: GraphNode[], opts: { approve?: boolean } = {}): void {
  const store = new GraphStore(cfg);
  const draft = buildDraftGraph(
    {
      graphId,
      project: { projectId: "p1" },
      baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
      nodes,
      createdBy: "op",
      createdByType: "operator",
    },
    clock,
  );
  store.save(draft);
  if (opts.approve !== false) {
    store.update(
      applyGraphTransition(
        draft,
        { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "ok" },
        clock,
      ),
    );
  }
}

interface Envelope {
  success: boolean;
  data?: any;
  error?: { code: string; message: string; details: Record<string, any> };
}

function cli(args: string[]): Envelope {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    return JSON.parse(stdout) as Envelope;
  } catch (e) {
    const err = e as { stdout?: string };
    return JSON.parse(err.stdout ?? "{}") as Envelope;
  }
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-ostatus-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = makeConsumer();
  registerProjects({ p1: repo });
});
afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("Sprint 2.1: orchestrate persists its outcome (no silent stop)", () => {
  it("completed run: started + ended events land in the per-graph log; status folds to 'completed'", () => {
    saveGraph("ok-1", [node("n1", "docs/one.md")]);
    const r = cli(["orchestrate", "--project-id", "p1", "--graph-id", "ok-1", "--actor-id", "orchestrator:test"]);
    expect(r.success).toBe(true);
    expect(r.data.invocationId).toMatch(/^inv-/);

    const logPath = orchestratorLogPath(cfg, "p1", "ok-1");
    expect(existsSync(logPath)).toBe(true);
    const lines = readFileSync(logPath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);

    const status = readOrchestratorStatus(cfg, "p1", "ok-1");
    expect(status.latest?.status).toBe("completed");
    expect(status.latest?.outcome).toBe("completed");
    expect(status.latest?.actorId).toBe("orchestrator:test");
    expect(status.latest?.graphStatus).toBe("completed");
    expect(status.latest?.nodeStates).toEqual({ n1: "promoted" });
  });

  it("stopped run (graph not runnable): stop reason + machine state persisted", () => {
    saveGraph("draft-1", [node("n1", "docs/one.md")], { approve: false });
    const r = cli(["orchestrate", "--project-id", "p1", "--graph-id", "draft-1"]);
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe("ORCHESTRATION_STOPPED");

    const status = readOrchestratorStatus(cfg, "p1", "draft-1");
    expect(status.latest?.status).toBe("stopped");
    expect(status.latest?.reason).toBe("graph-not-runnable");
    expect(status.latest?.stopState).toMatchObject({ status: "draft" });
  });

  it("stopped run (dirty target tree at promote): the failed command's error envelope is persisted", () => {
    saveGraph("dirty-1", [node("n1", "docs/one.md")]);
    // Dirty the TARGET repo: promotion requires a clean tree and must stop.
    writeFileSync(join(repo, "README.md"), "# dirtied by operator mid-sprint\n");

    const r = cli(["orchestrate", "--project-id", "p1", "--graph-id", "dirty-1"]);
    expect(r.success).toBe(false);

    const status = readOrchestratorStatus(cfg, "p1", "dirty-1");
    expect(status.latest?.status).toBe("stopped");
    expect(status.latest?.reason).toBe("command-failed");
    const stop = status.latest?.stopState as any;
    expect(stop.failedCommand).toBe("promote");
    expect(stop.error.code).toBe("PROMOTION_BLOCKED");
    // The persisted evidence must carry the WHY, not just the fact of failure.
    expect(JSON.stringify(stop.error)).toMatch(/clean|dirty/i);
  });

  it("stopped run (base drift): an approved node invalidated by target HEAD movement persists the conflict", () => {
    saveGraph("drift-1", [node("n1", "docs/one.md")]);
    // Run up to awaiting_review + approve, then move the target HEAD before promote.
    const first = cli(["orchestrate", "--project-id", "p1", "--graph-id", "drift-1", "--max-steps", "2"]);
    expect(first.success).toBe(false); // max-steps stop, node approved
    writeFileSync(join(repo, "drift.txt"), "operator commit moved HEAD\n");
    git(["add", "."], repo);
    git(["commit", "-q", "-m", "base drift"], repo);

    const r = cli(["orchestrate", "--project-id", "p1", "--graph-id", "drift-1"]);
    expect(r.success).toBe(false);

    const status = readOrchestratorStatus(cfg, "p1", "drift-1");
    expect(status.latest?.status).toBe("stopped");
    expect(status.latest?.reason).toBe("command-failed");
    const stop = status.latest?.stopState as any;
    expect(stop.failedCommand).toBe("promote");
    expect(String(stop.error.code)).toMatch(/PROMOTION/);
  });

  it("crash: a started event with a dead pid folds to 'presumed-crashed'; a live pid stays 'running'", () => {
    saveGraph("crash-1", [node("n1", "docs/one.md")]);
    recordOrchestrateStarted(cfg, "p1", "crash-1", "orchestrator:test", clock, 999999999);
    const crashed = readOrchestratorStatus(cfg, "p1", "crash-1");
    expect(crashed.latest?.status).toBe("presumed-crashed");
    expect(crashed.latest?.endedAt).toBeNull();

    recordOrchestrateStarted(cfg, "p1", "crash-1", "orchestrator:test", clock, process.pid);
    const running = readOrchestratorStatus(cfg, "p1", "crash-1");
    expect(running.latest?.status).toBe("running");
    expect(running.invocations).toHaveLength(2);
    expect(running.invocations[0]!.status).toBe("presumed-crashed");
  });

  it("real detached crash: SIGKILL mid-run leaves no ended event and is detected", async () => {
    // A 2-node chain gives the scheduler enough steps to be killable mid-run.
    saveGraph("kill-1", [node("n1", "docs/one.md"), node("n2", "docs/two.md", ["n1"])]);
    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, [CLI, "orchestrate", "--project-id", "p1", "--graph-id", "kill-1"], {
      stdio: "ignore",
      env: process.env,
    });
    // Wait for the started event to land, then kill hard.
    const logPath = orchestratorLogPath(cfg, "p1", "kill-1");
    await new Promise<void>((resolve, reject) => {
      const t0 = Date.now();
      const poll = setInterval(() => {
        if (existsSync(logPath)) { clearInterval(poll); resolve(); }
        else if (Date.now() - t0 > 15_000) { clearInterval(poll); reject(new Error("started event never appeared")); }
      }, 50);
    });
    child.kill("SIGKILL");
    await new Promise((resolve) => child.on("exit", resolve));

    const status = readOrchestratorStatus(cfg, "p1", "kill-1");
    expect(status.latest?.endedAt).toBeNull();
    expect(status.latest?.status).toBe("presumed-crashed");
  });

  it("orchestrate-status CLI: pure read returns the folded invocations; empty log is not an error", () => {
    saveGraph("cli-1", [node("n1", "docs/one.md")]);
    const empty = cli(["orchestrate-status", "--project-id", "p1", "--graph-id", "cli-1"]);
    expect(empty.success).toBe(true);
    expect(empty.data.invocations).toEqual([]);
    expect(empty.data.latest).toBeNull();

    cli(["orchestrate", "--project-id", "p1", "--graph-id", "cli-1"]);
    const after = cli(["orchestrate-status", "--project-id", "p1", "--graph-id", "cli-1"]);
    expect(after.success).toBe(true);
    expect(after.data.latest.status).toBe("completed");
    // Read-only: calling status twice must not grow the log.
    const lines = readFileSync(orchestratorLogPath(cfg, "p1", "cli-1"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("pidAlive: own pid alive, absurd pid dead", () => {
    expect(pidAlive(process.pid)).toBe(true);
    expect(pidAlive(999999999)).toBe(false);
  });
});
