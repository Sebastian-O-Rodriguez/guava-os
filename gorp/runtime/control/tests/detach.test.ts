import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Mock spawn BEFORE the module under test loads, so `cmdOrchestrate --detach`
// captures the child args without launching a real detached process.
const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(() => ({ pid: 4242, unref: () => {} })),
}));
vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));
// Under vitest there is no `--import tsx` loader in execArgv, so currentLoader
// returns undefined and schedulerSpawnArgs would throw for a `.ts` CLI. Mock
// it to a stable loader — the detach branch's arg-building is already covered
// by scheduler tests; this suite asserts the detach BRANCH behavior only.
vi.mock("../src/orchestrator/scheduler.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/orchestrator/scheduler.js")>();
  return { ...actual, currentLoader: () => "/fake/loader.mjs" };
});

import { runCli } from "../src/cli/main.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-08-16T00:00:00.000Z" };
let stateHome: string;

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-detach-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  process.env["GORP_PROJECT_REGISTRY"] = join(stateHome, "registry.yml");
  spawnMock.mockClear();
});

afterEach(() => {
  delete process.env["GORP_STATE_HOME"];
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
});

describe("orchestrate --detach", () => {
  it("returns a detached shape and spawns a child instead of running the loop in-process", async () => {
    const { result } = await runCli(
      ["orchestrate", "--project-id", "p1", "--graph-id", "g1", "--detach", "--actor-id", "operator"],
      clock,
    );
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).detached).toBe(true);
    expect((result.data as Record<string, unknown>).pid).toBe(4242);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const spawnArgs = spawnMock.mock.calls[0] as unknown as [string, string[], unknown];
    const argv = spawnArgs[1];
    expect(argv).toContain("orchestrate");
    expect(argv).toContain("--project-id");
    expect(argv).toContain("p1");
    expect(argv).toContain("--graph-id");
    expect(argv).toContain("g1");
    expect(argv).toContain("--actor-id");
    expect(argv).toContain("operator");
    expect(argv).not.toContain("--detach");
  });

  it("does not spawn when --detach is absent (runs the loop synchronously)", async () => {
    const { result } = await runCli(
      ["orchestrate", "--project-id", "p1", "--graph-id", "missing", "--actor-id", "operator"],
      clock,
    );
    expect(result.success).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
