/**
 * Dispatch gate — project-session ready-work gate (any governed repo).
 *
 * On `session_start`, run `gos work` from the project cwd. If the project has
 * no ready-for-work issues, block execution tools and close the session. If
 * there is ready work, report the todo list so the agent can dispatch by
 * domain. An unregistered cwd leaves the gate inactive. Pure code, zero AI.
 *
 * Override: GUAVA_OS_ALLOW_NO_WORK.
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

export default function (pi: HookAPI): void {
  // Per-invocation state — never shared across sessions.
  let noReadyWork = false;

  pi.on("session_start", async (_event, ctx) => {
    let output = "";
    let hasWork = false;
    let unregistered = false;
    try {
      output = execFileSync(TSX, [CLI, "work"], {
        cwd: ctx.cwd ?? process.cwd(),
        encoding: "utf8",
      }).trim();
      hasWork = true;
    } catch (err) {
      const e = err as { status?: number; stdout?: string | Buffer; stderr?: string | Buffer };
      output = (e.stdout?.toString() ?? "").trim();
      unregistered = /not inside an? guava-os repo/i.test((e.stderr ?? "").toString());
      hasWork = false;
    }

    noReadyWork = !hasWork && !unregistered;

    if (unregistered) {
      pi.sendMessage?.({ type: "text", content: "Not a governed repo — dispatch gate inactive." });
      return;
    }
    if (!hasWork) {
      pi.sendMessage?.({ type: "text", content: "No ready-for-work issues for this project — closing session." });
      return;
    }
    pi.sendMessage?.({
      type: "text",
      content:
        `Ready work:\n${output}\n\n` +
        "Dispatch by domain — see .omp/AGENTS.md and docs/architecture/linear-conventions.md.",
    });
  });

  pi.on("tool_call", async (event) => {
    if (!noReadyWork) return;
    if (!EXECUTION_TOOLS[event.toolName]) return;
    if (process.env.GUAVA_OS_ALLOW_NO_WORK) return;
    return {
      block: true,
      reason:
        "No ready-for-work issues for this project — dispatch gate blocks execution. " +
        "Set GUAVA_OS_ALLOW_NO_WORK=1 to override.",
    };
  });
}
