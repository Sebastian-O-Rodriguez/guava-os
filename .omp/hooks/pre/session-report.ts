/**
 * Session report — control-plane planning surface (guava-os only).
 *
 * On `session_start`, run `gos work --all` and report per-project status.
 * This thread is for planning other projects and updating guava-os itself; it
 * NEVER blocks execution tools — planning must run even when no board is
 * ready-for-work (that is how work becomes ready). Pure code, zero AI.
 */
import { execFileSync } from "node:child_process";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const GUAVA_OS = "/Users/sebroot/dev/guava-os";
const TSX = `${GUAVA_OS}/node_modules/.bin/tsx`;
const CLI = `${GUAVA_OS}/.guava-os/src/cli.ts`;

export default function (pi: HookAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    let output = "";
    try {
      output = execFileSync(TSX, [CLI, "work", "--all"], {
        cwd: ctx.cwd ?? process.cwd(),
        encoding: "utf8",
      }).trim();
    } catch (err) {
      const e = err as { stdout?: string | Buffer };
      output = (e.stdout?.toString() ?? "").trim();
    }
    pi.sendMessage?.({
      type: "text",
      content:
        `Project status:\n${output || "(no output)"}\n\n` +
        "Planning surface — follow the manager loop (plan → write → review).",
    });
  });
}
