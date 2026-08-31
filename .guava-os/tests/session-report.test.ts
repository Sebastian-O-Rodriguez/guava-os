import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));

import { execFileSync } from "node:child_process";
import report from "../../.claude/hooks/pre/session-report";

type Host = Parameters<typeof report>[0];
type Message = { type: string; content: string };
type StartHandler = (event: unknown, ctx: { cwd?: string }) => Promise<void> | void;

function capture(): { start: StartHandler; send: (m: Message) => void; registered: string[] } {
  let start: StartHandler = () => undefined;
  const send = vi.fn<(m: Message) => void>();
  const registered: string[] = [];
  const host = {
    on(event: string, handler: unknown): void {
      registered.push(event);
      if (event === "session_start") start = handler as StartHandler;
    },
    sendMessage: send,
  } as unknown as Host;
  report(host);
  return { start, send, registered };
}

beforeEach(() => {
  vi.mocked(execFileSync).mockReset();
});

describe("session report (session-report.ts)", () => {
  it("reports status and registers no tool_call blocker", async () => {
    vi.mocked(execFileSync).mockReturnValue("guava-os: ready=0");
    const { registered } = capture();
    // It must never register a tool_call handler (never blocks execution).
    expect(registered).toEqual(["session_start"]);
  });

  it("reports a message even when gos work fails", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("boom");
    });
    const { start, send } = capture();
    await start(undefined, { cwd: "/tmp/x" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
