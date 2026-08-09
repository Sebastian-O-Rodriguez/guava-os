/**
 * Project command checks (Sprint 3C; structured + timeouts since Sprint 3D):
 * the "real" half of the gate.
 *
 * The project's required checks come from the graph itself — the node's
 * `requiredCommands`, each a STRUCTURED command `{ executable, args[],
 * timeoutMs? }` (part of the operator-approved graph document, e.g.
 * { executable: "npm", args: ["test"] }). There is NO shell, NO whitespace
 * splitting, NO interpolation: the executable and exact argv are spawned as
 * given, inside the sandbox working tree. Exit code, stdout, stderr, and
 * duration are captured into the gate record's check details (truncated; the
 * gate record is chained, so the captured evidence is tamper-evident).
 *
 * Semantics — deterministic and fail-closed:
 *  - a blank executable is bad config -> failed check (never skipped);
 *  - a command that cannot be spawned is a failed check (exit=-1 + error);
 *  - every command has a TIMEOUT (per-command `timeoutMs`, default 600000):
 *    on expiry the process is killed and the check fails closed with the
 *    timeout recorded (`exit=timeout ...`);
 *  - any non-zero exit fails the check; ANY failed check fails the gate;
 *  - commands run only if the scope checks passed (fail fast — a scope
 *    violation already fails the gate, so its command results would be
 *    meaningless);
 *  - promotion re-runs ALL of these against the reviewed commit and refuses
 *    to cherry-pick unless they pass again (no stale gate).
 */

import { execFileSync } from "node:child_process";
import type { GateCheck, GraphNode, RequiredCommand } from "../contracts/types.js";
import type { Clock } from "../graph/graph.js";

const CAPTURE_LIMIT = 2000;
export const DEFAULT_COMMAND_TIMEOUT_MS = 600_000;

function truncate(s: string): string {
  const t = s.trim();
  return t.length > CAPTURE_LIMIT ? `${t.slice(0, CAPTURE_LIMIT)}…[truncated]` : t;
}

/** Milliseconds between two ISO timestamps (0 under a fixed test clock). */
function durationMs(startedAt: string, endedAt: string): number {
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

export function commandCheckName(command: RequiredCommand): string {
  const blank = command.executable.trim().length === 0;
  return `command:${blank ? "(empty)" : [command.executable, ...command.args].join(" ")}`;
}

export function runCommandChecks(node: GraphNode, sandboxDir: string, clock: Clock): GateCheck[] {
  const checks: GateCheck[] = [];
  for (const command of node.requiredCommands) {
    const name = commandCheckName(command);
    if (command.executable.trim().length === 0) {
      checks.push({
        name,
        status: "failed",
        detail: "bad command config: blank executable",
      });
      continue;
    }
    const timeoutMs = command.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
    const startedAt = clock.now();
    let exitCode: number | "timeout";
    let stdout = "";
    let stderr = "";
    try {
      stdout = execFileSync(command.executable, [...command.args], {
        cwd: sandboxDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
        killSignal: "SIGKILL",
      });
      exitCode = 0;
    } catch (e) {
      const err = e as {
        status?: number | null;
        signal?: string | null;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      // A killed process (no exit status, a signal) under an armed timeout is
      // a timeout; anything else unspawnable is exit=-1.
      if (err.status == null && err.signal) {
        exitCode = "timeout";
      } else {
        exitCode = err.status ?? -1; // -1: could not spawn at all
      }
      stdout = err.stdout ?? "";
      stderr = err.stderr ?? (exitCode === -1 ? (err.message ?? "spawn failed") : "");
    }
    const endedAt = clock.now();
    const exitLabel = exitCode === "timeout" ? `timeout(killed after ${timeoutMs}ms)` : String(exitCode);
    const detail =
      `exit=${exitLabel} duration=${durationMs(startedAt, endedAt)}ms timeoutMs=${timeoutMs}` +
      ` stdout=${JSON.stringify(truncate(stdout))} stderr=${JSON.stringify(truncate(stderr))}`;
    checks.push({
      name,
      status: exitCode === 0 ? "passed" : "failed",
      detail,
    });
  }
  return checks;
}
