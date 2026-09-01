import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import gate from "../hooks/dispatch-gate";

type Message = { type: string; content: string };
type DispatchMessage = {
  customType: string;
  content: string;
  display: boolean;
  details: Record<string, string>;
  attribution: string;
};
type StartEvent = { cwd?: string; ui?: { setStatus?: (key: string, text: string) => void } };
type StartHandler = (event: unknown, ctx: StartEvent) => Promise<void> | void;
type ToolHandler = (
  event: { toolName?: string },
) => Promise<{ block: boolean; reason: string } | void> | void;
type BeforeStartHandler = () => Promise<{ message?: DispatchMessage } | void> | void;

function capture() {
  const handlers: Record<string, unknown> = {};
  const send = vi.fn<(m: Message) => void>();
  const setStatus = vi.fn<(key: string, text: string) => void>();
  const host = {
    on(event: string, handler: unknown): void {
      handlers[event] = handler;
    },
    sendMessage: send,
  } as unknown as Parameters<typeof gate>[0];
  gate(host);
  return {
    start: handlers.session_start as StartHandler,
    beforeStart: handlers.before_agent_start as BeforeStartHandler,
    tool: handlers.tool_call as ToolHandler,
    send,
    setStatus,
  };
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
    const { start, tool, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });

  it("blocks exec tools when no ready work", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    const result = await tool({ toolName: "bash" });
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("GUAVA_OS_ALLOW_NO_WORK");
  });

  it("never blocks a non-exec tool", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    const result = await tool({ toolName: "read" });
    expect(result).toBeUndefined();
  });

  it("leaves the gate inactive for an unregistered cwd", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      const e = noWorkError();
      e.stderr = Buffer.from("Not inside an guava-os repo (no .guava-os/config.json found)");
      throw e;
    });
    const { start, tool, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/not-governed", ui: { setStatus } });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });

  it("bypasses when GUAVA_OS_ALLOW_NO_WORK is set", async () => {
    process.env.GUAVA_OS_ALLOW_NO_WORK = "1";
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, tool, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    const result = await tool({ toolName: "bash" });
    expect(result).toBeUndefined();
  });

  it("surfaces ready-work footer status when ready work exists", async () => {
    vi.mocked(execFileSync).mockReturnValue("project: x — ready=2");
    const { start, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(setStatus).toHaveBeenCalledWith("dispatch-gate", "ready work available");
  });

  it("surfaces a closing footer status when no ready work exists", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(setStatus).toHaveBeenCalledWith("dispatch-gate", "no ready work — closing");
  });

  it("emits a synthetic first-turn dispatch instruction when ready work exists", async () => {
    vi.mocked(execFileSync).mockReturnValue("project: x — ready=2");
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    const result = await beforeStart();
    expect(result?.message).toMatchObject({
      customType: "guava-os:dispatch",
      display: true,
      attribution: "user",
    });
    expect(result?.message.content).toContain("dispatch");
  });

  it("emits no dispatch instruction when no ready work exists", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw noWorkError();
    });
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(await beforeStart()).toBeUndefined();
  });

  it("emits the dispatch instruction only once", async () => {
    vi.mocked(execFileSync).mockReturnValue("project: x — ready=2");
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(await beforeStart()).toBeDefined();
    expect(await beforeStart()).toBeUndefined();
  });
});