import { describe, it, expect, vi, beforeEach } from "vitest";

// The wf decision wrappers must pass the exact gorp CLI flag names
// (--actor-id, --reviewed-commit). Earlier they passed --actor/--commit,
// which gorp ignores (requireFlag("actor-id") throws) — dead decision surface.
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => JSON.stringify({ success: true })),
}));

import { execFileSync } from "node:child_process";
import { approve, reject, retry, promote, inspect } from "../src/workflow.js";

const MOCK = vi.mocked(execFileSync);

beforeEach(() => {
  process.env.GORP_PROJECT_REGISTRY = "/tmp/registry.yml";
  MOCK.mockClear();
});

describe("wf decision surface argv (GUA-146)", () => {
  it("approve passes --actor-id and --reviewed-commit (never --actor/--commit)", () => {
    approve("p1", "g1", "n1", "op:1", "abc123", "looks good");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--actor-id");
    expect(args).toContain("op:1");
    expect(args).toContain("--reviewed-commit");
    expect(args).toContain("abc123");
    expect(args).not.toContain("--actor");
    expect(args).not.toContain("--commit");
  });

  it("reject passes --actor-id", () => {
    reject("p1", "g1", "n1", "op:1", "nope");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--actor-id");
    expect(args).toContain("op:1");
    expect(args).not.toContain("--actor");
  });

  it("retry passes --actor-id", () => {
    retry("p1", "g1", "n1", "op:1", "try again");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--actor-id");
    expect(args).toContain("op:1");
    expect(args).not.toContain("--actor");
  });

  it("promote passes --actor-id", () => {
    promote("p1", "g1", "n1", "op:1");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--actor-id");
    expect(args).toContain("op:1");
    expect(args).not.toContain("--actor");
  });

  it("promote passes --override-baseline when requested (GUA-242)", () => {
    promote("p1", "g1", "n1", "op:1", { overrideBaseline: true });
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--override-baseline");
  });

  it("promote omits --override-baseline by default", () => {
    promote("p1", "g1", "n1", "op:1");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).not.toContain("--override-baseline");
  });
});

describe("wf inspect surface (GOS-54)", () => {
  it("inspect passes --project-id/--graph-id/--node-id (no --run-id by default)", () => {
    MOCK.mockReturnValue(JSON.stringify({ success: true, data: { trace: [] } }));
    inspect("p1", "g1", "n1");
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("inspect");
    expect(args).toContain("--project-id");
    expect(args).toContain("p1");
    expect(args).toContain("--graph-id");
    expect(args).toContain("g1");
    expect(args).toContain("--node-id");
    expect(args).toContain("n1");
    expect(args).not.toContain("--run-id");
  });

  it("inspect passes --run-id when provided", () => {
    MOCK.mockReturnValue(JSON.stringify({ success: true }));
    inspect("p1", "g1", "n1", { runId: "run-2" });
    const args = MOCK.mock.calls[0]![1] as string[];
    expect(args).toContain("--run-id");
    expect(args).toContain("run-2");
  });

  it("inspect returns the gorp envelope (success + data)", () => {
    MOCK.mockReturnValue(
      JSON.stringify({ success: true, command: "inspect", data: { readOnly: true, trace: [] } }),
    );
    const result = inspect("p1", "g1", "n1") as { success: boolean; data?: { readOnly: boolean; trace: unknown[] } };
    expect(result.success).toBe(true);
    expect(result.data?.readOnly).toBe(true);
    expect(result.data?.trace).toEqual([]);
  });

  it("inspect propagates gorp failure (structured, not silently swallowed)", () => {
    const structured = { success: false, command: "inspect", error: { code: "RUN_NOT_FOUND", message: "no run exists", details: {} } };
    const err = new Error("Command failed") as Error & { stdout?: string; status?: number };
    err.stdout = JSON.stringify(structured);
    err.status = 14;
    MOCK.mockImplementation(() => { throw err; });
    expect(() => inspect("p1", "g1", "n1")).toThrow();
  });
});