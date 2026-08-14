import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ompAdapter, extractOmpSummary, extractOmpUsage } from "../src/worker/omp.js";
import { createSandbox, sandboxHead, type Sandbox } from "../src/sandbox/worktree.js";
import { GorpError } from "../src/errors/index.js";
import type { GraphNode, WorkerResult } from "../src/contracts/types.js";
import type { Clock } from "../src/graph/graph.js";

const clock: Clock = { now: () => "2026-08-11T13:00:00.000Z" };

let repo: string;
let sandboxRoot: string;
let fakeOmpDir: string;
let prevOmpCmd: string | undefined;
let prevOmpTimeout: string | undefined;
let prevOmpModel: string | undefined;
let prevOmpAppend: string | undefined;

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
    persona: "backend",
    ...partial,
  };
}

/** A node with the default fields but NO persona (the GUA-155 legacy shape). */
function makeNodeNoPersona(): GraphNode {
  const { persona: _persona, ...rest } = makeNode();
  return rest;
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
  prevOmpModel = process.env["GORP_OMP_MODEL"];
  prevOmpAppend = process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"];
  // Resolved worker profile (GOS-46): the adapter requires both to be set
  // whenever a node carries a persona.
  process.env["GORP_OMP_MODEL"] = "default";
  process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] = "You are a backend architect.";
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
  if (prevOmpModel !== undefined) process.env["GORP_OMP_MODEL"] = prevOmpModel;
  else delete process.env["GORP_OMP_MODEL"];
  if (prevOmpAppend !== undefined) process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] = prevOmpAppend;
  else delete process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"];
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

describe("OMP adapter resolved-profile passthrough", () => {
  let argTracePath: string;
  let prevAppend: string | undefined;

  function writeArgTraceFakeOmp(): string {
    const tmp = mkdtempSync(join(tmpdir(), "gorp-omp-argtrace-"));
    argTracePath = join(tmp, "args.json");
    const path = join(fakeOmpDir, "fake-omp-args.sh");
    writeFileSync(
      path,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        // Drain stdin
        "cat > /dev/null 2>&1 || true",
        // Produce an expected artifact so the adapter's changed-files check passes
        "mkdir -p docs",
        "printf 'GOS-35 probe artifact\\n' > docs/probe.md",
        // Write all args to the trace file as a JSON array
        `printf '%s\\n' "$(printf '%s\\n' "$@" | jq -R -s -c 'split("\n")[:-1]')" > "${argTracePath}"`,
        // Emit a valid agent_end so the adapter doesn't fail on missing summary
        "printf '%s\\n' '{\"type\":\"agent_end\",\"messages\":[{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Args captured.\"}]}]}'",
      ].join("\n") + "\n",
      "utf8",
    );
    chmodSync(path, 0o755);
    return path;
  }

  beforeEach(() => {
    prevAppend = process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"];
  });

  afterEach(() => {
    if (prevAppend !== undefined) process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] = prevAppend;
    else delete process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"];
    if (argTracePath && existsSync(dirname(argTracePath))) {
      rmSync(dirname(argTracePath), { recursive: true, force: true });
    }
  });

  it("forwards the resolved --model and --append-system-prompt to omp", async () => {
    process.env["GORP_OMP_CMD"] = writeArgTraceFakeOmp();
    process.env["GORP_OMP_MODEL"] = "slow";
    process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] = "You are a backend architect.";
    const sandbox: Sandbox = createSandbox(
      repo,
      git(["rev-parse", "HEAD"], repo).trim(),
      join(sandboxRoot, "sandbox-append"),
      "gorp/run/omp-adapter-append/node-1/run-1",
    );
    try {
      await ompAdapter.invoke({ sandbox, graphId: "g-omp", runId: "run-1", node: makeNode({ persona: "backend" }), clock });
      expect(existsSync(argTracePath)).toBe(true);
      const args: string[] = JSON.parse(readFileSync(argTracePath, "utf8"));
      const modelIdx = args.indexOf("--model");
      expect(modelIdx).not.toBe(-1);
      expect(args[modelIdx + 1]).toBe("slow");
      const appendIdx = args.indexOf("--append-system-prompt");
      expect(appendIdx).not.toBe(-1);
      expect(args[appendIdx + 1]).toBe("You are a backend architect.");
    } finally {
      delete process.env["GORP_OMP_CMD"];
    }
  });
});

describe("OMP adapter fails closed (GOS-46 / GUA-179)", () => {
  let spawnMarker: string;

  function writeMarkerFakeOmp(): string {
    const tmp = mkdtempSync(join(tmpdir(), "gorp-omp-marker-"));
    spawnMarker = join(tmp, "spawned");
    const path = join(fakeOmpDir, "fake-omp-marker.sh");
    writeFileSync(
      path,
      [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        "cat > /dev/null 2>&1 || true",
        "mkdir -p docs",
        "printf 'probe\\n' > docs/probe.md",
        `touch "${spawnMarker}"`,
        "printf '%s\\n' '{\"type\":\"agent_end\",\"messages\":[{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"spawned\"}]}]}'",
      ].join("\n") + "\n",
      "utf8",
    );
    chmodSync(path, 0o755);
    return path;
  }

  afterEach(() => {
    if (spawnMarker && existsSync(dirname(spawnMarker))) {
      rmSync(dirname(spawnMarker), { recursive: true, force: true });
    }
  });

  async function invokeExpectingFailure(
    node: GraphNode,
    opts: { model?: string; append?: string },
  ): Promise<GorpError> {
    const sandbox: Sandbox = createSandbox(
      repo,
      git(["rev-parse", "HEAD"], repo).trim(),
      join(sandboxRoot, "sandbox-fail"),
      "gorp/run/omp-adapter-fail/node-1/run-1",
    );
    process.env["GORP_OMP_CMD"] = writeMarkerFakeOmp();
    if (opts.model === undefined) delete process.env["GORP_OMP_MODEL"];
    else process.env["GORP_OMP_MODEL"] = opts.model;
    if (opts.append === undefined) delete process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"];
    else process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] = opts.append;
    try {
      await ompAdapter.invoke({ sandbox, graphId: "g-omp", runId: "run-1", node, clock });
      throw new Error("expected ompAdapter.invoke to throw");
    } catch (e) {
      if (!(e instanceof GorpError)) throw e;
      return e;
    } finally {
      delete process.env["GORP_OMP_CMD"];
    }
  }

  it("GUA-155 repro: persona set but no profile env → throws BEFORE spawn (no default worker)", async () => {
    const err = await invokeExpectingFailure(makeNode({ persona: "backend" }), {});
    expect(err.code).toBe("WORKER_FAILED");
    expect(err.message).toContain("GORP_OMP_MODEL");
    // The omp binary was never executed — no weak/default fallback spawned.
    expect(existsSync(spawnMarker)).toBe(false);
  });

  it("no persona → throws before spawn (a persona is required)", async () => {
    const err = await invokeExpectingFailure(makeNodeNoPersona(), {
      model: "default",
      append: "body",
    });
    expect(err.code).toBe("WORKER_FAILED");
    expect(err.message).toContain("no persona");
    expect(existsSync(spawnMarker)).toBe(false);
  });

  it("model resolved but persona body missing → throws before spawn", async () => {
    const err = await invokeExpectingFailure(makeNode({ persona: "backend" }), { model: "default" });
    expect(err.code).toBe("WORKER_FAILED");
    expect(err.message).toContain("GORP_OMP_SYSTEM_PROMPT_APPEND");
    expect(existsSync(spawnMarker)).toBe(false);
  });
});

describe("OMP adapter empty-turn retry (GOS-46 follow-on)", () => {
  // Fake OMP that emits a clean exit; whether it edits is driven by a marker
  // file in the shared sandbox cwd, so the SAME script behaves differently on
  // the first vs the (retried) second invocation:
  //   writes-first  : edit on call 1 (retry never needed)
  //   recovers      : no edits on call 1, edits on call 2 (retry recovers it)
  //   always-empty  : no edits on either call (retry still fails closed)
  function writeBehaviorFakeOmp(kind: "writes-first" | "recovers" | "always-empty"): string {
    const path = join(fakeOmpDir, `fake-tenant-${kind}.sh`);
    // Counter lives OUTSIDE the sandbox cwd so the shared marker is never
    // staged/committed as if the worker produced an artifact.
    const counter = join(fakeOmpDir, `call-${kind}.marker`);
    const edit = ["mkdir -p docs", "printf 'GOS retry probe\\n' > docs/probe.md"].join("\n");
    const first = kind === "writes-first" ? edit : ":";
    const second = kind === "always-empty" ? ":" : edit;
    const body = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cat > /dev/null 2>&1 || true   # drain the prompt the adapter pipes in",
      `if [ -f "${counter}" ]; then SECOND=1; else SECOND=0; touch "${counter}"; fi`,
      `if [ "$SECOND" = "0" ]; then`,
      first,
      "else",
      second,
      "fi",
      `printf '%s\\n' '{"type":"agent_end","messages":[{"role":"assistant","content":[{"type":"text","text":"done"}]}]}'`,
    ].join("\n");
    writeFileSync(path, body + "\n", "utf8");
    chmodSync(path, 0o755);
    return path;
  }
  async function invoke(kind: "writes-first" | "recovers" | "always-empty"): Promise<WorkerResult | Error> {
    const sandbox: Sandbox = createSandbox(
      repo,
      git(["rev-parse", "HEAD"], repo).trim(),
      join(sandboxRoot, "sandbox"),
      "gorp/run/omp-retry/node-1/run-1",
    );
    process.env["GORP_OMP_CMD"] = writeBehaviorFakeOmp(kind);
    try {
      return await ompAdapter.invoke({ sandbox, graphId: "g-retry", runId: "run-1", node: makeNode(), clock });
    } catch (e) {
      return e as Error;
    } finally {
      delete process.env["GORP_OMP_CMD"];
    }
  }

  it("recovers an empty first turn via one bounded retry that then edits", async () => {
    const result = (await invoke("recovers")) as WorkerResult;
    expect(result.outcome).toBe("succeeded");
    // the retry's edit is committed to the sandbox branch and reported
    expect(result.changedFiles).toContain("docs/probe.md");
  });

  it("does not retry when the first turn already produced edits", async () => {
    const result = (await invoke("writes-first")) as WorkerResult;
    expect(result.outcome).toBe("succeeded");
    expect(result.changedFiles).toContain("docs/probe.md");
  });

  it("fails closed even after the empty-turn retry when the worker still edits nothing", async () => {
    const err = (await invoke("always-empty")) as Error & { code?: string };
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("even after an empty-turn retry");
    expect(err.message).toContain("no files changed");
  });
});

describe("extractOmpUsage (GOS-55)", () => {
  it("reads tokens + cost from a turn_end event", () => {
    const stdout = [
      '{"type":"turn_end","message":{"role":"assistant","usage":{"input":1200,"output":300,"totalTokens":1500,"cost":{"total":0.0042}}}}',
    ].join("\n");
    const usage = extractOmpUsage(stdout);
    expect(usage).toBeDefined();
    expect(usage!.tokensIn).toBe(1200);
    expect(usage!.tokensOut).toBe(300);
    expect(usage!.tokensTotal).toBe(1500);
    expect(usage!.costUsd).toBe(0.0042);
  });

  it("reads usage from an agent_end event (assistant message)", () => {
    const stdout = [
      '{"type":"agent_end","messages":[{"role":"user","content":[]},{"role":"assistant","content":[],"usage":{"input":800,"output":200,"totalTokens":1000,"cost":{"total":0.01}}}]}',
    ].join("\n");
    const usage = extractOmpUsage(stdout);
    expect(usage).toBeDefined();
    expect(usage!.tokensIn).toBe(800);
    expect(usage!.tokensTotal).toBe(1000);
    expect(usage!.costUsd).toBe(0.01);
  });

  it("returns undefined when no usage is present", () => {
    const stdout = [
      '{"type":"session","id":"s1"}',
      '{"type":"agent_end","messages":[{"role":"assistant","content":[{"type":"text","text":"done"}]}]}',
    ].join("\n");
    expect(extractOmpUsage(stdout)).toBeUndefined();
  });

  it("reads costUsd defensively when at top level instead of cost.total", () => {
    const stdout = [
      '{"type":"turn_end","message":{"role":"assistant","usage":{"input":50,"output":10,"totalTokens":60,"costUsd":0.005}}}',
    ].join("\n");
    const usage = extractOmpUsage(stdout);
    expect(usage).toBeDefined();
    expect(usage!.costUsd).toBe(0.005);
  });

  it("ignores non-finite and non-numeric values", () => {
    const stdout = [
      '{"type":"turn_end","message":{"role":"assistant","usage":{"input":"abc","output":null,"totalTokens":Infinity,"cost":{"total":"x"}}}}',
    ].join("\n");
    const usage = extractOmpUsage(stdout);
    expect(usage).toBeUndefined();
  });

  it("returns the last usage when multiple events carry usage", () => {
    const stdout = [
      '{"type":"turn_end","message":{"role":"assistant","usage":{"input":100,"output":50,"totalTokens":150,"cost":{"total":0.001}}}}',
      '{"type":"turn_end","message":{"role":"assistant","usage":{"input":200,"output":100,"totalTokens":300,"cost":{"total":0.002}}}}',
    ].join("\n");
    const usage = extractOmpUsage(stdout);
    expect(usage).toBeDefined();
    expect(usage!.tokensIn).toBe(200);
    expect(usage!.tokensTotal).toBe(300);
  });
});

describe("OMP adapter returns usage (GOS-55)", () => {
  function writeFakeOmpWithUsage(emitsUsage: boolean): string {
    const path = join(fakeOmpDir, "fake-omp-usage.sh");
    const usageLine = emitsUsage
      ? `printf '%s\\n' '{"type":"turn_end","message":{"role":"assistant","content":[{"type":"text","text":"done"}],"usage":{"input":600,"output":150,"totalTokens":750,"cost":{"total":0.003}}}}'`
      : "";
    const body = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "mkdir -p docs",
      "printf 'GOS-55 probe\\n' > docs/probe.md",
      "cat > /dev/null 2>&1 || true",
      usageLine,
      "printf '%s\\n' '{\"type\":\"agent_end\",\"messages\":[{\"role\":\"assistant\",\"content\":[{\"type\":\"text\",\"text\":\"Wrote docs/probe.md\"}]}]}'",
    ].filter(Boolean).join("\n");
    writeFileSync(path, body + "\n", "utf8");
    chmodSync(path, 0o755);
    return path;
  }

  it("stamps tokens + cost + durationMs when OMP reports usage", async () => {
    process.env["GORP_OMP_CMD"] = writeFakeOmpWithUsage(true);
    try {
      const sandbox = createSandbox(
        repo,
        git(["rev-parse", "HEAD"], repo).trim(),
        join(sandboxRoot, "sb-usage"),
        "gorp/run/omp-usage-test/node-1/run-1",
      );
      const result = await ompAdapter.invoke({ sandbox, graphId: "g-usage", runId: "run-1", node: makeNode(), clock });
      expect(result.outcome).toBe("succeeded");
      expect(result.usage).toBeDefined();
      expect(result.usage!.tokensIn).toBe(600);
      expect(result.usage!.tokensOut).toBe(150);
      expect(result.usage!.tokensTotal).toBe(750);
      expect(result.usage!.costUsd).toBe(0.003);
      expect(result.usage!.durationMs).toBe(0); // fixed clock → 0 ms
    } finally {
      delete process.env["GORP_OMP_CMD"];
    }
  });

  it("persists durationMs only when OMP reports no usage", async () => {
    process.env["GORP_OMP_CMD"] = writeFakeOmpWithUsage(false);
    try {
      const sandbox = createSandbox(
        repo,
        git(["rev-parse", "HEAD"], repo).trim(),
        join(sandboxRoot, "sb-no-usage"),
        "gorp/run/omp-no-usage-test/node-1/run-1",
      );
      const result = await ompAdapter.invoke({ sandbox, graphId: "g-no-usage", runId: "run-1", node: makeNode(), clock });
      expect(result.outcome).toBe("succeeded");
      expect(result.usage).toBeDefined();
      expect(result.usage!.durationMs).toBe(0);
      expect(result.usage!.tokensIn).toBeUndefined();
      expect(result.usage!.tokensOut).toBeUndefined();
      expect(result.usage!.tokensTotal).toBeUndefined();
      expect(result.usage!.costUsd).toBeUndefined();
    } finally {
      delete process.env["GORP_OMP_CMD"];
    }
  });
});
