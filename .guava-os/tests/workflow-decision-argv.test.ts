import { describe, it, expect, vi, beforeEach } from "vitest";

// The wf decision wrappers must pass the exact gorp CLI flag names
// (--actor-id, --reviewed-commit). Earlier they passed --actor/--commit,
// which gorp ignores (requireFlag("actor-id") throws) — dead decision surface.
vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => JSON.stringify({ success: true })),
}));

import { execFileSync } from "node:child_process";
import { approve, reject, retry, promote } from "../src/workflow.js";

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
});