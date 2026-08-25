/**
 * Session gate — deterministic hook run on `session_start`.
 *
 * Runs `guava-os work --all` and either surfaces ready work or blocks execution
 * when there is nothing dispatchable. `work` gates on `ready-for-work`:
 * exit 0 = ready work exists; non-zero = nothing ready. The `tool_call` handler
 * blocks execution tools when the gate found no ready work.
 */
import { execFileSync } from "node:child_process";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const GUAVA_OS = "/Users/sebroot/dev/guava-os";
const TSX = `${GUAVA_OS}/node_modules/.bin/tsx`;
const CLI = `${GUAVA_OS}/.guava-os/src/cli.ts`;

const EXECUTION_TOOLS: Record<string, true> = {
  bash: true,
  edit: true,
  write: true,
  task: true,
  eval: true,
};

// Cached gate result from `session_start`.
let noReadyWork = false;

export default function (pi: HookAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    let hasWork = false;
    let output = "";
    try {
      output = execFileSync(TSX, [CLI, "work", "--all"], {
        cwd: ctx.cwd ?? process.cwd(),
        encoding: "utf8",
      }).trim();
      hasWork = true;
    } catch (err) {
      const e = err as { status?: number; stdout?: string | Buffer };
      output = (e.stdout?.toString() ?? "").trim();
      hasWork = false;
    }

    noReadyWork = !hasWork;

    if (!hasWork) {
      pi.sendMessage?.({ type: "text", content: "No ready work in any project — closing session." });
      return;
    }

    pi.sendMessage?.({
      type: "text",
      content: `Ready work:\n${output}\n\nFollow the manager loop in .omp/AGENTS.md (plan → write → review).`,
    });
  });

  pi.on("tool_call", async (event) => {
    if (!noReadyWork) return;
    if (!EXECUTION_TOOLS[event.toolName]) return;
    if (process.env.GUAVA_OS_ALLOW_NO_WORK) return;
    return {
      block: true,
      reason:
        "No ready-for-work issues in any project — session gate blocks execution. Set GUAVA_OS_ALLOW_NO_WORK=1 to override.",
    };
  });
}