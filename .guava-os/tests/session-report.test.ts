import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import report from "../../.claude/hooks/pre/session-report";

type Message = { type: string; content: string };
type DispatchMessage = {
  customType: string;
  content: string;
  display: boolean;
  details: Record<string, string>;
  attribution: string;
};
type Ctx = { cwd?: string; ui?: { setStatus?: (key: string, text: string) => void } };
type StartHandler = (event: unknown, ctx: Ctx) => Promise<void> | void;
type BeforeStartHandler = (event: unknown, ctx: Ctx) => Promise<{ message?: DispatchMessage } | void> | void;

function capture() {
  const registered: string[] = [];
  const handlers: Record<string, unknown> = {};
  const send = vi.fn<(m: Message) => void>();
  const setStatus = vi.fn<(key: string, text: string) => void>();
  const host = {
    on(event: string, handler: unknown): void {
      registered.push(event);
      handlers[event] = handler;
    },
    sendMessage: send,
  } as unknown as Parameters<typeof report>[0];
  report(host);
  return {
    registered,
    start: handlers.session_start as StartHandler,
    beforeStart: handlers.before_agent_start as BeforeStartHandler,
    send,
    setStatus,
  };
}

beforeEach(() => {
  vi.mocked(execFileSync).mockReset();
});

describe("session report (session-report.ts)", () => {
  it("reports status and registers no tool_call blocker", async () => {
    vi.mocked(execFileSync).mockReturnValue("guava-os: ready=2");
    const { registered } = capture();
    // It must never register a tool_call handler (never blocks execution).
    expect(registered).toEqual(["session_start", "before_agent_start"]);
  });

  it("reports a message even when gos work fails", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("boom");
    });
    const { start, send, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("surfaces a no-work footer status when gos work fails", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("boom");
    });
    const { start, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(setStatus).toHaveBeenCalledWith("session-report", expect.stringContaining("no ready work"));
  });

  it("emits no dispatch instruction when no ready work exists", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("boom");
    });
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(await beforeStart(undefined, {})).toBeUndefined();
  });

  it("emits a synthetic first-turn dispatch instruction when ready work exists", async () => {
    vi.mocked(execFileSync).mockReturnValue("guava-os: ready=2 [id1 id2]");
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });

    expect(setStatus).toHaveBeenCalledWith("session-report", expect.stringContaining("ready work"));

    const result = await beforeStart(undefined, {});
    expect(result?.message).toMatchObject({
      customType: "guava-os:dispatch",
      display: true,
      attribution: "user",
    });
    expect(result?.message.content).toContain("dispatch");
    expect(result?.message.details).toEqual({ kind: "auto-dispatch", hook: "session-report" });
  });

  it("emits the dispatch instruction only once", async () => {
    vi.mocked(execFileSync).mockReturnValue("guava-os: ready=2");
    const { start, beforeStart, setStatus } = capture();
    await start(undefined, { cwd: "/tmp/x", ui: { setStatus } });
    expect(await beforeStart(undefined, {})).toBeDefined();
    expect(await beforeStart(undefined, {})).toBeUndefined();
  });
});