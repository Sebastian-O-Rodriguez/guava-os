import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import gate from "../hooks/dispatch-gate";

type Host = Parameters<typeof gate>[0];
type Message = { type: string; content: string };
type StartEvent = { cwd?: string };
type StartHandler = (event: unknown, ctx: StartEvent) => Promise<void> | void;
type ToolHandler = (
  event: { toolName?: string },
) => Promise<{ block: boolean; reason: string } | void> | void;

function capture(): { start: StartHandler; tool: ToolHandler; send: (m: Message) => void } {
  let start: StartHandler = () => undefined;
  let tool: ToolHandler = () => undefined;
  const send = vi.fn<(m: Message) => void>();
  const host = {
    on(event: string, handler: unknown): void {
      if (event === "session_start") start = handler as StartHandler;
      if (event === "tool_call") tool = handler as ToolHandler;
    },
    sendMessage: send,
  } as unknown as Host;
  gate(host);
  return { start, tool, send };
}

function noWorkError(): Error & { status?: number; stdout?: Buffer; stderr?: Buffer } {
  const e = new Error("no work") as Error & { status?: number; stdout?: Buffer; stderr?: Buffer };
  e.status = 1;
  e.stdout = Buffer.from("ready=0");
  e.stderr = Buffer.from("");
  return e;
}

beforeEach(() => {
  vi.mocked(execFileSync).mockReset();
  delete process.env.GUAVA_OS_ALLOW_NO_WORK;
});

describe("dispatch gate (dispatch-gate.ts)", () => {
  it("does not block execution when ready work exists", async () => {
    vi.mocked(execFileSync).mockReturnValue("project: x — ready=2");
    const { start, tool } = capture();
    await start(undefined, { cwd: "/tmp/x" });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });

  it("blocks exec tools when no ready work", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool } = capture();
    await start(undefined, { cwd: "/tmp/x" });
    const result = await tool({ toolName: "bash" });
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("GUAVA_OS_ALLOW_NO_WORK");
  });

  it("never blocks a non-exec tool", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool } = capture();
    await start(undefined, { cwd: "/tmp/x" });
    const result = await tool({ toolName: "read" });
    expect(result).toBeUndefined();
  });

  it("leaves the gate inactive for an unregistered cwd", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const e = noWorkError();
      e.stderr = Buffer.from("Not inside an guava-os repo (no .guava-os/config.json found)");
      throw e;
    });
    const { start, tool } = capture();
    await start(undefined, { cwd: "/tmp/not-governed" });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });

  it("bypasses when GUAVA_OS_ALLOW_NO_WORK is set", async () => {
    process.env.GUAVA_OS_ALLOW_NO_WORK = "1";
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool } = capture();
    await start(undefined, { cwd: "/tmp/x" });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });
});
