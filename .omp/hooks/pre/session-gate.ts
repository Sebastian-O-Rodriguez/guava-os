/**
 * Session gate — deterministic hook run on `session_start`.
 *
 * Runs `guava-os work --all` and either surfaces the open work or signals
 * "nothing to do". This is the "script, not AI" layer: it runs before the
 * agent reasons. First cut — validates against the live OMP hook API
 * (`omp://hooks.md`).
 */
import { execFileSync } from "node:child_process";
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const GUAVA_OS = "/Users/sebroot/dev/guava-os";
const TSX = `${GUAVA_OS}/node_modules/.bin/tsx`;
const CLI = `${GUAVA_OS}/.guava-os/src/cli.ts`;

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

    if (!hasWork) {
      pi.sendMessage?.({ type: "text", content: "No open work in any project — closing session." });
      return;
    }

    pi.sendMessage?.({
      type: "text",
      content: `Open work:\n${output}\n\nFollow the manager loop in .omp/AGENTS.md (plan → write → review).`,
    });
  });
}