import { describe, it, expect, vi } from "vitest";
import gate from "../../.claude/hooks/pre/context-gate";

type ToolCallHandler = (event: {
  toolName: string;
  input?: unknown;
}) => Promise<{ block?: boolean; reason?: string } | void> | void;
type StartHandler = (
  event: unknown,
  ctx: { ui?: { setStatus?: (key: string, text: string) => void } },
) => Promise<void> | void;

function capture() {
  const handlers: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pi: any = {
    on: (event: string, handler: unknown) => {
      handlers[event] = handler;
    },
  };
  gate(pi);
  return {
    start: handlers.session_start as StartHandler,
    tool: handlers.tool_call as ToolCallHandler,
  };
}

const MARKER = `# CONTEXT-MARKER ${"a".repeat(64)}`;

describe("context gate (context-gate.ts)", () => {
  it("blocks a task fan-out payload lacking the marker", async () => {
    const { tool } = capture();
    const result = await tool({
      toolName: "task",
      input: { i: "spawn", context: "raw context", tasks: [{ task: "do a thing" }] },
    });
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("dispatch skill / inject.mjs");
    expect(result?.reason).toContain("CONTEXT-MARKER");
  });

  it("lets a payload carrying the marker proceed", async () => {
    const { tool } = capture();
    const result = await tool({
      toolName: "task",
      input: { context: "compiled", tasks: [{ task: `...\n${MARKER}\nmore` }] },
    });
    expect(result).toBeUndefined();
  });

  it("never blocks a non-task tool", async () => {
    const { tool } = capture();
    const result = await tool({ toolName: "bash", input: { command: "rm -rf /tmp/x" } });
    expect(result).toBeUndefined();
  });

  it("bypasses when GUAVA_OS_ALLOW_RAW_DISPATCH is set", async () => {
    process.env.GUAVA_OS_ALLOW_RAW_DISPATCH = "1";
    try {
      const { tool } = capture();
      const result = await tool({
        toolName: "task",
        input: { tasks: [{ task: "no marker here" }] },
      });
      expect(result).toBeUndefined();
    } finally {
      delete process.env.GUAVA_OS_ALLOW_RAW_DISPATCH;
    }
  });

  it("surfaces gate state in the TUI footer on session_start", async () => {
    const setStatus = vi.fn<(key: string, text: string) => void>();
    const { start } = capture();
    await start(undefined, { ui: { setStatus } });
    expect(setStatus).toHaveBeenCalledWith("context-gate", "context gate active");
  });
});