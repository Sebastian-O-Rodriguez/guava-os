/**
 * Session report — control-plane planning surface (guava-os only).
 *
 * On `session_start`, run `gos work --all` and report per-project status.
 * This thread is for planning other projects and updating guava-os itself; it
 * NEVER blocks execution tools — planning must run even when no board is
 * ready-for-work (that is how work becomes ready). Pure code, zero AI.
 *
 * Visibility: the status is shown in the TUI footer via `ctx.ui.setStatus`
 * (and the injected `sendMessage` text is kept for the model).
 *
 * Auto-execution: when ready work exists at `session_start`, a
 * `before_agent_start` handler emits a one-shot synthetic first-turn
 * instruction directing the agent to begin the manager loop / dispatch.
 */
import { execFileSync } from "node:child_process";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const GUAVA_OS = "/Users/sebroot/dev/guava-os";
const TSX = `${GUAVA_OS}/node_modules/.bin/tsx`;
const CLI = `${GUAVA_OS}/.guava-os/src/cli.ts`;

const DISPATCH_CUSTOM_TYPE = "guava-os:dispatch";

console.error("[session-report] loaded");

export default function (pi: HookAPI): void {
  // Per-invocation state — never shared across sessions.
  let hasReadyWork = false;
  let dispatchInstructionSent = false;

  pi.on("session_start", async (_event, ctx) => {
    console.error("[session-report] session_start fired");
    let output = "";
    try {
      output = execFileSync(TSX, [CLI, "work", "--all"], {
        cwd: ctx.cwd ?? process.cwd(),
        encoding: "utf8",
      }).trim();
      hasReadyWork = true; // `work --all` exits 0 iff some project is ready.
    } catch (err) {
      const e = err as { stdout?: string | Buffer };
      output = (e.stdout?.toString() ?? "").trim();
      hasReadyWork = false;
    }

    ctx.ui?.setStatus(
      "session-report",
      hasReadyWork ? "ready work available — dispatching" : "no ready work — planning surface",
    );

    pi.sendMessage?.({
      type: "text",
      content:
        `Project status:\n${output || "(no output)"}\n\n` +
        "Planning surface — follow the manager loop (plan → write → review).",
    });
  });

  pi.on("before_agent_start", async () => {
    if (!hasReadyWork || dispatchInstructionSent) return;
    dispatchInstructionSent = true;
    return {
      message: {
        customType: DISPATCH_CUSTOM_TYPE,
        content:
          "Ready-for-work issues exist. Begin the manager loop now: dispatch each " +
          "ready issue to its domain agent, then move to review. Do not wait for a " +
          "user prompt.",
        display: true,
        details: { kind: "auto-dispatch", hook: "session-report" },
        attribution: "user",
      },
    };
  });
}