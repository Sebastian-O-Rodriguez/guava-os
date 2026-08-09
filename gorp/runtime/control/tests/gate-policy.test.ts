import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig, type RuntimeConfig } from "../src/config/index.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import { executeRun } from "../src/run/run.js";
import { runSchedulerLoop } from "../src/orchestrator/scheduler.js";
import {
  fixtureReviewPolicy,
  implementedReviewPolicies,
  resolveReviewPolicy,
  type ReviewPolicy,
} from "../src/orchestrator/review-policy.js";
import { GorpError } from "../src/errors/index.js";
import type { GateRecord, GraphNode } from "../src/contracts/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");

const clock: Clock = { now: () => "2026-07-17T09:00:00.000Z" };

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

beforeAll(() => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
}, 120_000);

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function node(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "n1",
    taskType: "fixture-mutation",
    objective: "write docs/note.md",
    acceptanceCriteria: ["artifact exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: ["docs/note.md"],
    workerAdapter: "fixture",
    dependencies: [],
    state: "pending",
    attempt: 0,
    ...partial,
  };
}

function approvedGraph(graphId: string, nodes: GraphNode[]): void {
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
  store.update(
    applyGraphTransition(
      draft,
      { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "approved" },
      clock,
    ),
  );
}

function gateOf(runRecords: { gateRecord: string }): GateRecord {
  return JSON.parse(readFileSync(runRecords.gateRecord, "utf8")) as GateRecord;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-gate-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-gate-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ p1: repo });
});
afterEach(() => {
  delete process.env["GORP_PROJECT_REGISTRY"];
  delete process.env["GORP_STATE_HOME"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("Sprint 3C gate: project commands run in the sandbox", () => {
  it("pass path: commands run, evidence captured, gate passes, node reaches review", async () => {
    approvedGraph("gate-pass", [
      node({
        requiredCommands: [
          { executable: "node", args: ["-e", "process.exit(0)"] },
          { executable: "git", args: ["--version"] },
        ],
      }),
    ]);
    const out = await executeRun(cfg, { projectId: "p1", graphId: "gate-pass", nodeId: "n1", actorId: "orch" }, clock);
    expect(out.finalStatus).toBe("succeeded");
    expect(out.nodeState).toBe("awaiting_review");

    const gate = gateOf(out.records);
    expect(gate.validation.status).toBe("passed");
    const names = gate.validation.checks.map((c) => c.name);
    expect(names).toEqual([
      "sandbox-clean",
      "changed-files-in-allowed-scope",
      "no-forbidden-paths",
      "command:node -e process.exit(0)",
      "command:git --version",
    ]);
    const gitCheck = gate.validation.checks.find((c) => c.name === "command:git --version")!;
    expect(gitCheck.status).toBe("passed");
    expect(gitCheck.detail).toContain("exit=0");
    expect(gitCheck.detail).toMatch(/duration=\d+ms/);
    expect(gitCheck.detail).toContain("git version"); // stdout captured
  });

  it("fail path: non-zero exit fails the gate; stdout/stderr captured; node+graph failed; no promote possible", async () => {
    approvedGraph("gate-fail", [
      node({
        requiredCommands: [
          // args may contain whitespace freely now: exact argv, no splitting
          { executable: "node", args: ["-e", 'console.log("gate-out"); console.error("gate-err"); process.exit(3)'] },
        ],
      }),
    ]);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", graphId: "gate-fail", nodeId: "n1", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("GATE_FAILED");

    const g = new GraphStore(cfg).load("p1", "gate-fail");
    expect(g.status).toBe("failed");
    expect(g.nodes[0]!.state).toBe("failed");

    // the persisted (chained) gate record carries the full evidence
    const records = (err!.details["records"] as { gateRecord: string });
    const gate = gateOf(records);
    expect(gate.validation.status).toBe("failed");
    const cmd = gate.validation.checks.find((c) => c.name.startsWith("command:"))!;
    expect(cmd.status).toBe("failed");
    expect(cmd.detail).toContain("exit=3");
    expect(cmd.detail).toContain("gate-out"); // stdout captured
    expect(cmd.detail).toContain("gate-err"); // stderr captured
    // scope checks passed; only the command failed
    expect(gate.validation.checks.filter((c) => !c.name.startsWith("command:")).every((c) => c.status === "passed")).toBe(true);
  });

  it("bad config fails closed at every layer: schema rejects empty, gate rejects blank and unspawnable", async () => {
    // Layer 1: an empty executable cannot even enter a graph (schema minLength 1)
    expect(() =>
      approvedGraph("gate-badcfg-schema", [node({ requiredCommands: [{ executable: "", args: [] }] })]),
    ).toThrowError(/schema validation/);

    // Layer 2: a blank executable passes the schema but is bad config at the gate
    approvedGraph("gate-badcfg", [
      node({
        requiredCommands: [
          { executable: " ", args: [] },
          { executable: "definitely-not-a-binary-xyz", args: ["--flag"] },
        ],
      }),
    ]);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", graphId: "gate-badcfg", nodeId: "n1", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err!.code).toBe("GATE_FAILED");
    const gate = gateOf(err!.details["records"] as { gateRecord: string });
    const empty = gate.validation.checks.find((c) => c.name === "command:(empty)")!;
    expect(empty.status).toBe("failed");
    expect(empty.detail).toContain("blank executable");
    const missing = gate.validation.checks.find((c) => c.name.startsWith("command:definitely-not"))!;
    expect(missing.status).toBe("failed");
    expect(missing.detail).toContain("exit=-1"); // could not spawn at all
  });

  it("commands are skipped when scope already failed (fail fast, no misleading results)", async () => {
    approvedGraph("gate-scopefirst", [
      node({ expectedArtifacts: ["outside/evil.md"], requiredCommands: [{ executable: "git", args: ["--version"] }] }),
    ]);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", graphId: "gate-scopefirst", nodeId: "n1", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err!.code).toBe("GATE_FAILED");
    const gate = gateOf(err!.details["records"] as { gateRecord: string });
    // no command checks at all: scope violation fails the gate first
    expect(gate.validation.checks.some((c) => c.name.startsWith("command:"))).toBe(false);
    expect(gate.validation.checks.find((c) => c.name === "changed-files-in-allowed-scope")!.status).toBe("failed");
  });
});

describe("Sprint 3C review policy: no auto-approve", () => {
  it("fixture policy approves only gate-passed fixture output; everything else stops", async () => {
    const base = { graphId: "g", nodeId: "n", runId: "run-1", artifactHash: "a".repeat(40), changedFiles: [] };
    expect(fixtureReviewPolicy.decide({ ...base, workerAdapter: "fixture", gateStatus: "passed" }).action).toBe("approve");
    expect(fixtureReviewPolicy.decide({ ...base, workerAdapter: "omp", gateStatus: "passed" }).action).toBe("stop");
    expect(fixtureReviewPolicy.decide({ ...base, workerAdapter: "fixture", gateStatus: "failed" }).action).toBe("stop");
    expect(fixtureReviewPolicy.decide({ ...base, workerAdapter: "fixture", gateStatus: "passed", artifactHash: null }).action).toBe("stop");
    expect(implementedReviewPolicies()).toEqual(["fixture"]);
    expect(resolveReviewPolicy("fixture")).toBe(fixtureReviewPolicy);
    expect(() => resolveReviewPolicy("rubber-stamp")).toThrowError(/unknown review policy/);
  });

  it("policy stop: the scheduler halts at the review boundary with machine state and records NO approval", async () => {
    approvedGraph("policy-stop", [node()]);
    const stopAll: ReviewPolicy = {
      name: "human-only",
      decide: () => ({ action: "stop", reason: "all output requires human review" }),
    };
    const result = runSchedulerLoop({
      cli: CLI,
      projectId: "p1",
      graphId: "policy-stop",
      env: { GORP_STATE_HOME: stateHome },
      reviewPolicy: stopAll,
    });
    expect(result.outcome).toBe("stopped");
    expect(result.reason).toBe("review-policy-stop");
    const stop = result.stopState as { nodeId: string; policy: string; reason: string; requiredAction: string };
    expect(stop.nodeId).toBe("n1");
    expect(stop.policy).toBe("human-only");
    expect(stop.reason).toContain("human review");
    expect(stop.requiredAction).toContain("gorp approve");
    // the run happened, but NO decision was recorded: node parked at review
    expect(result.nodeStates).toEqual({ n1: "awaiting_review" });
    expect(result.steps.map((s) => s.action.kind)).toEqual(["run"]);
    const runsDir = join(stateHome, "projects", "p1", "runs", "policy-stop", "n1", "run-1");
    expect(existsSync(join(runsDir, "gate-record.json"))).toBe(true);
    expect(existsSync(join(runsDir, "review-decision.json"))).toBe(false);
  }, 60_000);

  it("default policy still completes fixture graphs (behavior preserved through the policy seam)", async () => {
    approvedGraph("policy-default", [node({ requiredCommands: [{ executable: "git", args: ["--version"] }] })]);
    const result = runSchedulerLoop({
      cli: CLI,
      projectId: "p1",
      graphId: "policy-default",
      env: { GORP_STATE_HOME: stateHome },
    });
    expect(result.outcome).toBe("completed");
    expect(result.nodeStates).toEqual({ n1: "promoted" });
    expect(existsSync(join(repo, "docs", "note.md"))).toBe(true);
  }, 120_000);

  it("unknown --review-policy fails closed at the CLI", async () => {
    approvedGraph("policy-unknown", [node()]);
    let code = 0;
    let stdout = "";
    try {
      stdout = execFileSync(
        process.execPath,
        [CLI, "orchestrate", "--project-id", "p1", "--graph-id", "policy-unknown", "--review-policy", "rubber-stamp"],
        { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
      );
    } catch (e) {
      const err = e as { status?: number; stdout?: string };
      code = err.status ?? -1;
      stdout = err.stdout ?? "";
    }
    expect(code).toBe(2); // INVALID_ARGUMENT
    const j = JSON.parse(stdout) as { error: { code: string; details: { implemented: string[] } } };
    expect(j.error.code).toBe("INVALID_ARGUMENT");
    expect(j.error.details.implemented).toEqual(["fixture"]);
    // fail closed: nothing ran
    const g = new GraphStore(cfg).load("p1", "policy-unknown");
    expect(g.status).toBe("approved");
    expect(g.nodes[0]!.state).toBe("pending");
  });
});

describe("Sprint 3D: timeouts and promotion truth", () => {
  it("timeout: a hanging command is killed, recorded, and fails the gate closed", async () => {
    approvedGraph("gate-timeout", [
      node({
        requiredCommands: [
          { executable: "node", args: ["-e", "setTimeout(() => {}, 60000)"], timeoutMs: 500 },
        ],
      }),
    ]);
    let err: GorpError | null = null;
    try {
      await executeRun(cfg, { projectId: "p1", graphId: "gate-timeout", nodeId: "n1", actorId: "orch" }, clock);
    } catch (e) {
      err = e as GorpError;
    }
    expect(err).not.toBeNull();
    expect(err!.code).toBe("GATE_FAILED");
    const gate = gateOf(err!.details["records"] as { gateRecord: string });
    const cmd = gate.validation.checks.find((c) => c.name.startsWith("command:node"))!;
    expect(cmd.status).toBe("failed");
    expect(cmd.detail).toContain("exit=timeout(killed after 500ms)");
    expect(cmd.detail).toContain("timeoutMs=500");
    const g = new GraphStore(cfg).load("p1", "gate-timeout");
    expect(g.status).toBe("failed");
  }, 60_000);

  it("promotion truth: promote re-runs ALL project commands against the reviewed commit and stops on failure — no cherry-pick, evidence kept", async () => {
    // A command whose verdict depends on external state: passes at run time
    // (marker absent), fails at promote time (marker present). This simulates
    // any environment drift between review and promotion.
    const marker = join(stateHome, "world-changed.marker");
    const probe = `process.exit(require("fs").existsSync(${JSON.stringify(marker)}) ? 1 : 0)`;
    approvedGraph("promote-recheck", [
      node({ requiredCommands: [{ executable: "node", args: ["-e", probe] }] }),
    ]);

    // run + approve while the world is clean
    const out = await executeRun(cfg, { projectId: "p1", graphId: "promote-recheck", nodeId: "n1", actorId: "orch" }, clock);
    expect(out.finalStatus).toBe("succeeded");
    execFileSync(
      process.execPath,
      [CLI, "approve", "--project-id", "p1", "--graph-id", "promote-recheck", "--node-id", "n1",
        "--actor-id", "op", "--reviewed-commit", out.sandbox!.headCommit, "--reason", "ok"],
      { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
    );

    // the world changes between approval and promotion
    writeFileSync(marker, "drift\n");
    const targetHeadBefore = git(["rev-parse", "HEAD"], repo).trim();

    let code = 0;
    let stdout = "";
    try {
      stdout = execFileSync(
        process.execPath,
        [CLI, "promote", "--project-id", "p1", "--graph-id", "promote-recheck", "--node-id", "n1", "--actor-id", "op"],
        { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
      );
    } catch (e) {
      const errE = e as { status?: number; stdout?: string };
      code = errE.status ?? -1;
      stdout = errE.stdout ?? "";
    }
    expect(code).toBe(15); // PROMOTION_BLOCKED
    const j = JSON.parse(stdout) as {
      error: { code: string; details: { check: string; checks: Array<{ name: string; detail?: string }> } };
    };
    expect(j.error.code).toBe("PROMOTION_BLOCKED");
    expect(j.error.details.check).toBe("gate-rerun");
    expect(j.error.details.checks[0]!.name).toContain("command:node");
    expect(j.error.details.checks[0]!.detail).toContain("exit=1");

    // no cherry-pick: target untouched; evidence kept: sandbox + records intact
    expect(git(["rev-parse", "HEAD"], repo).trim()).toBe(targetHeadBefore);
    expect(git(["status", "--porcelain"], repo).trim()).toBe("");
    expect(existsSync(out.sandbox!.dir)).toBe(true);
    expect(existsSync(out.records.gateRecord)).toBe(true);
    const g = new GraphStore(cfg).load("p1", "promote-recheck");
    expect(g.nodes[0]!.state).toBe("approved"); // decision stands; promotion blocked
    expect(g.status).toBe("running");

    // and once the world is clean again, the same promote succeeds
    rmSync(marker);
    const retry = execFileSync(
      process.execPath,
      [CLI, "promote", "--project-id", "p1", "--graph-id", "promote-recheck", "--node-id", "n1", "--actor-id", "op"],
      { env: { ...process.env, GORP_STATE_HOME: stateHome }, encoding: "utf8" },
    );
    const rj = JSON.parse(retry) as { success: boolean; data: { nodeState: string } };
    expect(rj.success).toBe(true);
    expect(rj.data.nodeState).toBe("promoted");
  }, 120_000);
});
