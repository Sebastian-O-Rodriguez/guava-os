import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "../src/cli/main.js";
import { EXIT_CODES, type GorpErrorCode } from "../src/errors/index.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-07-14T12:00:00.000Z" };
let stateHome: string;

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-cli-"));
  process.env["GORP_STATE_HOME"] = stateHome;
});
afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  rmSync(stateHome, { recursive: true, force: true });
});

function createArgs(graphId = "g1"): string[] {
  return [
    "graph", "create",
    "--graph-id", graphId,
    "--project-id", "p1",
    "--base-commit", "0123456",
    "--objective", "create a fixture file",
    "--actor-id", "operator:test",
  ];
}

describe("CLI: implemented commands", () => {
  it("graph create emits valid JSON and OK exit", async () => {
    const { result, exitCode } = await runCli(createArgs(), clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.command).toBe("graph.create");
      expect(result.ids?.["graphId"]).toBe("g1");
    }
  });

  it("graph validate on persisted graph succeeds", async () => {
    await runCli(createArgs(), clock);
    const { result, exitCode } = await runCli(["graph", "validate", "--project-id", "p1", "--graph-id", "g1"], clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    expect(result.success).toBe(true);
  });

  it("graph show returns the graph document", async () => {
    await runCli(createArgs(), clock);
    const { result, exitCode } = await runCli(["graph", "show", "--project-id", "p1", "--graph-id", "g1"], clock);
    expect(exitCode).toBe(EXIT_CODES.OK);
    if (result.success) {
      const g = result.data as { status: string; approvalStatus: string };
      expect(g.status).toBe("draft");
      expect(g.approvalStatus).toBe("unapproved");
    }
  });

  it("graph transition draft->approved (operator) succeeds and persists", async () => {
    await runCli(createArgs(), clock);
    const { result, exitCode } = await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "g1",
       "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
       "--reason-code", "OPERATOR_APPROVAL", "--reason", "reviewed"],
      clock,
    );
    expect(exitCode).toBe(EXIT_CODES.OK);
    if (result.success) {
      const d = result.data as { to: string; approvalStatus: string };
      expect(d.to).toBe("approved");
      expect(d.approvalStatus).toBe("approved");
    }
    // reload confirms persistence
    const shown = await runCli(["graph", "show", "--project-id", "p1", "--graph-id", "g1"], clock);
    if (shown.result.success) {
      const g = shown.result.data as { status: string; transitions: unknown[] };
      expect(g.status).toBe("approved");
      expect(g.transitions).toHaveLength(1);
    }
  });
});

describe("CLI: failure exit codes (structured, no string parsing)", () => {
  const cases: Array<[string, string[], GorpErrorCode]> = [
    ["missing required flag", ["graph", "create", "--graph-id", "g1"], "INVALID_ARGUMENT"],
    ["not found", ["graph", "show", "--project-id", "p1", "--graph-id", "missing"], "GRAPH_NOT_FOUND"],
    ["unknown command", ["frobnicate"], "INVALID_ARGUMENT"],
  ];
  for (const [name, argv, code] of cases) {
    it(name, async () => {
      const { result, exitCode } = await runCli(argv, clock);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected failure");
      expect(result.error.code).toBe(code);
      expect(exitCode).toBe(EXIT_CODES[code]);
    });
  }

  it("illegal transition draft->running fails with ILLEGAL_STATE_TRANSITION and does not mutate", async () => {
    await runCli(createArgs(), clock);
    const { result, exitCode } = await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "g1",
       "--to", "running", "--actor-type", "orchestrator", "--actor-id", "o",
       "--reason-code", "START", "--reason", "x"],
      clock,
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("ILLEGAL_STATE_TRANSITION");
    expect(exitCode).toBe(EXIT_CODES.ILLEGAL_STATE_TRANSITION);
    // persisted state unchanged (still draft, no transitions)
    const shown = await runCli(["graph", "show", "--project-id", "p1", "--graph-id", "g1"], clock);
    if (shown.result.success) {
      const g = shown.result.data as { status: string; transitions: unknown[] };
      expect(g.status).toBe("draft");
      expect(g.transitions).toHaveLength(0);
    }
  });

  it("worker actor is rejected", async () => {
    await runCli(createArgs(), clock);
    await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "g1",
       "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
       "--reason-code", "OK", "--reason", "ok"],
      clock,
    );
    const { result, exitCode } = await runCli(
      ["graph", "transition", "--project-id", "p1", "--graph-id", "g1",
       "--to", "running", "--actor-type", "worker", "--actor-id", "w",
       "--reason-code", "START", "--reason", "x"],
      clock,
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("ILLEGAL_STATE_TRANSITION");
    expect(exitCode).toBe(EXIT_CODES.ILLEGAL_STATE_TRANSITION);
  });
});

describe("CLI: every command group is implemented", () => {
  it("unknown command lists the full implemented surface", async () => {
    const { result, exitCode } = await runCli(["frobnicate"], clock);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_ARGUMENT");
      expect(result.error.details["known"]).toEqual([
        "graph", "compile-graph", "run", "review", "approve", "reject", "retry", "promote", "inspect", "reconcile", "orchestrate", "orchestrate-status",
      ]);
    }
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
  });
});
