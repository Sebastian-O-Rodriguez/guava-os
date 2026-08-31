/**
 * Context gate — deterministic pre-tool hook on `task` (any repo that fans out).
 *
 * Every worker fan-out must be assembled by the dispatch skill via
 * `manual/scripts/inject.mjs`, which stamps the assembled context with a
 * `# CONTEXT-MARKER <sha256-of-task-contract>` sentinel line, so this gate can
 * distinguish an assembled context from a raw `task` call. A `task` payload
 * lacking the marker is blocked. Pure regex check, zero AI.
 *
 * Override: GUAVA_OS_ALLOW_RAW_DISPATCH.
 */
import type { HookAPI } from "@oh-my-pi/pi-coding-agent/extensibility/hooks";

const CONTEXT_MARKER = /# CONTEXT-MARKER [0-9a-f]{64}/;

console.error("[context-gate] loaded");

export default function (pi: HookAPI): void {
  pi.on("session_start", async () => {
    console.error("[context-gate] session_start fired");
    pi.sendMessage?.({
      type: "text",
      content: "context-gate active — every `task` fan-out requires # CONTEXT-MARKER.",
    });
  });

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "task") return;
    if (process.env.GUAVA_OS_ALLOW_RAW_DISPATCH) return;

    const payload = JSON.stringify(event.input ?? {});
    if (CONTEXT_MARKER.test(payload)) return;

    console.error("[context-gate] blocked a raw task call (no marker)");
    return {
      block: true,
      reason:
        "task fan-out must go through the dispatch skill / inject.mjs flow: " +
        "payload is missing the '# CONTEXT-MARKER <sha256-of-task-contract>' " +
        "sentinel line (set GUAVA_OS_ALLOW_RAW_DISPATCH to bypass)",
    };
  });
}