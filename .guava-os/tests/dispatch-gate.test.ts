import { describe, it, expect } from "vitest";
import gate from "../../.omp/hooks/pre/dispatch-gate";

type ToolCallHandler = (event: {
  toolName: string;
  input?: unknown;
}) => Promise<{ block?: boolean; reason?: string } | void> | void;

function captureHandler(): ToolCallHandler {
  let captured: ToolCallHandler = () => undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pi: any = {
    on: (_event: string, handler: ToolCallHandler) => {
      captured = handler;
    },
  };
  gate(pi);
  return captured;
}

const MARKER = `# CONTEXT-MARKER ${"a".repeat(64)}`;

describe("dispatch gate (dispatch-gate.ts)", () => {
  it("blocks a task fan-out payload lacking the marker", async () => {
    const handler = captureHandler();
    const result = await handler({
      toolName: "task",
      input: { i: "spawn", context: "raw context", tasks: [{ task: "do a thing" }] },
    });
    expect(result?.block).toBe(true);
    expect(result?.reason).toContain("dispatch skill / inject.mjs");
    expect(result?.reason).toContain("CONTEXT-MARKER");
  });

  it("lets a payload carrying the marker proceed", async () => {
    const handler = captureHandler();
    const result = await handler({
      toolName: "task",
      input: { context: "compiled", tasks: [{ task: `...\n${MARKER}\nmore` }] },
    });
    expect(result).toBeUndefined();
  });

  it("never blocks a non-task tool", async () => {
    const handler = captureHandler();
    const result = await handler({ toolName: "bash", input: { command: "rm -rf /tmp/x" } });
    expect(result).toBeUndefined();
  });

  it("bypasses when GUAVA_OS_ALLOW_RAW_DISPATCH is set", async () => {
    process.env.GUAVA_OS_ALLOW_RAW_DISPATCH = "1";
    try {
      const handler = captureHandler();
      const result = await handler({
        toolName: "task",
        input: { tasks: [{ task: "no marker here" }] },
      });
      expect(result).toBeUndefined();
    } finally {
      delete process.env.GUAVA_OS_ALLOW_RAW_DISPATCH;
    }
  });
});
