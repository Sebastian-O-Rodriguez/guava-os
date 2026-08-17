/**
 * OMP worker adapter (GOS-11).
 *
 * Implements the WorkerAdapter interface for OMP (Oh My Pi) — the primary
 * engineering runtime per ADR_001. Invokes `omp -p --auto-approve --mode json`
 * as one external process per node attempt, spawned with cwd = the sandbox
 * worktree (provisioned with gitignored deps via symlinks — GOS-61).
 *
 * Per the GOS-8 OMP runtime boundary contract:
 *   - the adapter receives only WorkerInvocation (blind; no runtime config);
 *   - OMP runs with cwd = the sandbox worktree; it WRITES only there;
 *   - the adapter makes the single sandbox commit (OMP must not touch git);
 *   - the result must validate against worker-result.schema.json and echo
 *     the invocation identity exactly (enforced by invokeAdapter);
 *   - workers never approve or promote (operator-only, hash-bound);
 *   - workers never fetch Linear.
 *
 * Configuration:
 *   GORP_OMP_CMD             — path to the omp binary (default: "omp" from PATH)
 *   GORP_OMP_TIMEOUT         — total run timeout in ms (default: 600000)
 *   GORP_OMP_STARTUP_TIMEOUT — max ms to wait for the FIRST output byte from
 *                              stdout/stderr (default: 120000). A worker that
 *                              hangs before producing any output (e.g. MCP
 *                              servers blocking on init) is killed here and
 *                              fails fast instead of burning the whole run
 *                              window at 0% CPU.
 *   GORP_OMP_MCP_DISABLE     — set to a truthy value to ask OMP to skip MCP
 *                              servers for this worker run. NOTE (GOS-57
 *                              discovery): OMP v17.3.2 has NO native flag or
 *                              env var for this — it loads user MCP servers
 *                              from ~/.omp/agent/mcp.json and rejects
 *                              --no-mcp. The adapter forwards OMP_MCP_DISABLE=1
 *                              to the child for forward compatibility (a no-op
 *                              today); the practical workaround is to move
 *                              mcp.json aside, and GORP_OMP_STARTUP_TIMEOUT is
 *                              the real fail-fast guard for the hang.
 *   GORP_OMP_MAX_COST_USD    — cumulative cost ceiling in USD, enforced per
 *                              attempt (default: 0.30 = $0.30). A safety
 *                              ceiling, NOT a working budget: operators raise
 *                              it for real work. Set to 0 to disable the cost
 *                              check. When the OMP worker's turn_end usage
 *                              events cumulatively exceed this, the child is
 *                              SIGKILLed and the attempt records a cost-limit
 *                              outcome (never the generic 10-min timeout).
 *   GORP_OMP_MAX_TOKENS      — cumulative token ceiling, enforced per attempt
 *                              (default: 0 = disabled — cost is the binding
 *                              limit, not an arbitrary token count). Cost/tokens
 *                              are accumulated ONLY from turn_end usage events
 *                              on the NDJSON stream; whichever limit crosses
 *                              first wins.
 *
 * Worker profile (GOS-46, fail closed): a node MUST carry a persona, and the
 * guava-os wf layer MUST have resolved it into the environment before
 * dispatch. A missing persona, model, or persona body aborts the spawn with a
 * classified WORKER_FAILED error — there is no weak/default fallback.
 *   GORP_OMP_MODEL                — model tier (required when a persona is set)
 *   GORP_OMP_SYSTEM_PROMPT_APPEND — persona body (required when a persona is set)
 */

import { spawn } from "node:child_process";
import { GorpError } from "../errors/index.js";
import type { WorkerResult, WorkerUsage, WorkerUsageEvent } from "../contracts/types.js";
import { git, sandboxChangedFiles, sandboxHead } from "../sandbox/worktree.js";
import type { WorkerAdapter, WorkerInvocation } from "./adapter.js";

export const OMP_ADAPTER = "omp";
const WORKER_NAME = "gorp-omp-worker";
const WORKER_EMAIL = "omp-worker@gorp.local";
const DEFAULT_MAX_COST_USD = 0.30;
const DEFAULT_MAX_TOKENS = 0;

const DEFAULT_TIMEOUT_MS = 600_000;
const DEFAULT_STARTUP_TIMEOUT_MS = 120_000;
const CAPTURE_LIMIT = 4000;

/**
 * Extract the OMP worker's final summary from omp JSON-lines (NDJSON) output.
 * omp emits one typed event per line (session/agent_start/turn_start/…), so a
 * whole-stream `JSON.parse` cannot work. The final assistant message in the
 * trailing `agent_end` event carries the worker's own words.
 */
export function extractOmpSummary(stdout: string): string {
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const ev = JSON.parse(t) as {
        type?: string;
        messages?: Array<{ role?: string; content?: Array<{ type?: string; text?: string }> }>;
      };
      if (ev?.type !== "agent_end" || !Array.isArray(ev.messages)) continue;
      for (const m of [...ev.messages].reverse()) {
        if (m?.role !== "assistant" || !Array.isArray(m.content)) continue;
        const text = m.content
          .filter((c) => c?.type === "text")
          .map((c) => c.text ?? "")
          .join("\n")
          .trim();
        if (text) return truncate(text);
      }
    } catch {
      // line is not JSON — skip
    }
  }
  return "OMP worker completed.";
}

// --- OMP usage extraction (GOS-55) ---

function firstNumber(obj: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Read token/cost usage from a single OMP usage object. */
function readUsage(u: Record<string, unknown>): WorkerUsage | undefined {
  const tokensIn = firstNumber(u, ["input", "inputTokens", "input_tokens"]);
  const tokensOut = firstNumber(u, ["output", "outputTokens", "output_tokens"]);
  const tokensTotal = firstNumber(u, ["totalTokens", "total_tokens", "total"]);
  const cost = u["cost"];
  const costUsd = typeof cost === "object" && cost !== null && !Array.isArray(cost)
    ? firstNumber(cost as Record<string, unknown>, ["total", "totalCost"])
    : firstNumber(u, ["costUsd", "cost_usd"]);
  const report: WorkerUsage = {};
  if (tokensIn !== undefined) report.tokensIn = tokensIn;
  if (tokensOut !== undefined) report.tokensOut = tokensOut;
  if (tokensTotal !== undefined) report.tokensTotal = tokensTotal;
  if (costUsd !== undefined) report.costUsd = costUsd;
  return Object.keys(report).length > 0 ? report : undefined;
}

/** Scan event payloads for a usage object (top-level, message.usage, or messages[N].usage). */
function findUsage(ev: Record<string, unknown>): Record<string, unknown> | undefined {
  const usage = ev["usage"];
  if (typeof usage === "object" && usage !== null && !Array.isArray(usage)) return usage as Record<string, unknown>;
  const message = ev["message"];
  if (typeof message === "object" && message !== null && !Array.isArray(message)) {
    const mu = (message as Record<string, unknown>)["usage"];
    if (typeof mu === "object" && mu !== null && !Array.isArray(mu)) return mu as Record<string, unknown>;
  }
  const messages = ev["messages"];
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (typeof m === "object" && m !== null && !Array.isArray(m)) {
        const mu = (m as Record<string, unknown>)["usage"];
        if (typeof mu === "object" && mu !== null && !Array.isArray(mu)) return mu as Record<string, unknown>;
      }
    }
  }
  return undefined;
}



/**
 * Extract one usage entry per turn_end usage-bearing event, in order (GOS-65).
 * Every field is read defensively: only finite numbers are kept, and cost is
 * NEVER invented. The LAST event is the most-cumulative run-level usage.
 */
export function parseUsageEvents(stdout: string): readonly WorkerUsageEvent[] {
  const events: WorkerUsageEvent[] = [];
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let ev: unknown;
    try {
      ev = JSON.parse(t) as unknown;
    } catch {
      continue;
    }
    if (typeof ev !== "object" || ev === null || Array.isArray(ev)) continue;
    const rec = ev as Record<string, unknown>;
    if (rec["type"] !== "turn_end") continue;
    const u = findUsage(rec);
    if (!u) continue;
    const report = readUsage(u);
    if (!report) continue;
    events.push({ turn: events.length + 1, ...report });
  }
  return events;
}

/**
 * Extract the LAST turn's usage (GOS-55): the most-cumulative run-level number.
 * Backward-compatible with the single-number consumer; the full history is
 * `parseUsageEvents` (GOS-65).
 */
export function extractOmpUsage(stdout: string): WorkerUsage | undefined {
  // Legacy (GOS-55): the LAST usage-bearing event of ANY type (agent_end is
  // final/cumulative; turn_end is per-turn). Unlike parseUsageEvents, this
  // does NOT filter to turn_end — a worker may report its final usage only in
  // an agent_end event.
  let last: WorkerUsage | undefined;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let ev: unknown;
    try {
      ev = JSON.parse(t) as unknown;
    } catch {
      continue;
    }
    if (typeof ev !== "object" || ev === null || Array.isArray(ev)) continue;
    const u = findUsage(ev as Record<string, unknown>);
    if (!u) continue;
    const report = readUsage(u);
    if (report) last = report;
  }
  return last;
}
function fail(message: string, details: Record<string, unknown> = {}): never {
  throw new GorpError("WORKER_FAILED", `omp adapter: ${message}`, { workerAdapter: OMP_ADAPTER, ...details });
}

function truncate(s: string): string {
  return s.length > CAPTURE_LIMIT ? s.slice(0, CAPTURE_LIMIT) + "\n... (truncated)" : s;
}

/** Worker-spawn diagnostics go to stderr: stdout is reserved for the OMP
 *  NDJSON stream and, at the CLI, the structured result envelope. */
function logOmp(msg: string): void {
  process.stderr.write(`[omp] ${msg}\n`);
}

/**
 * Instruction appended on the empty-turn retry (GOS-46 follow-on): a worker
 * that ended a clean turn without editing anything is asked once, explicitly,
 * to actually modify the working tree.
 */
const RETRY_APPEND =
  "\n\nNOTE: Your previous attempt completed WITHOUT changing any files, so this run FAILED. " +
  "You MUST edit the working tree now — write new files or modify existing ones to satisfy the " +
  "objective and acceptance criteria — then finish. Do not merely inspect, plan, or print paths.";

/** Stage all worktree changes; return the sorted staged file list (empty = no artifacts).
 *  We detect the staged index, not `diff base..HEAD`: HEAD is pinned above and
 *  worktree edits are not in any commit until the adapter commits. */
function stageAndList(dir: string): string[] {
  git(["add", "--all"], dir);
  return git(["diff", "--cached", "--name-only"], dir)
    .stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .sort();
}

interface OmpProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  startupTimedOut: boolean;
  firstOutputMs: number | null;
  costLimited: boolean;
  costLimitedDetail?: string;
}

function runOmp(
  cmd: string,
  args: string[],
  cwd: string,
  prompt: string,
  timeoutMs: number,
  startupTimeoutMs: number,
  maxCostUsd?: number,
  maxTokens?: number,
  env?: NodeJS.ProcessEnv,
): Promise<OmpProcessResult> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: true, ...(env ? { env } : {}) });
    const spawnedAt = Date.now();
    logOmp(`spawned pid=${proc.pid ?? "?"}`);
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let startupTimedOut = false;
    let firstOutputMs: number | null = null;
    let costLimited = false;
    let costLimitedDetail: string | undefined;
    // Budget tracking (GOS-62): accumulate across turn_end usage events.
    let cumulativeTokens = 0;
    let cumulativeCostUsd = 0;
    let settled = false;

    const killGroup = (): void => {
      try { process.kill(-proc.pid!, "SIGKILL"); } catch { proc.kill("SIGKILL"); }
    };
    const finish = (result: OmpProcessResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(runTimer);
      clearTimeout(startupTimer);
      resolve(result);
    };

    // Total run window (GORP_OMP_TIMEOUT) — unchanged.
    const runTimer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, timeoutMs);
    // Startup window (GORP_OMP_STARTUP_TIMEOUT): fail fast when the worker
    // produces NO output at all — e.g. MCP servers blocking on init. Cleared
    // on the first data byte, so a silent 0%-CPU hang never burns the whole
    // run window.
    const startupTimer = setTimeout(() => {
      startupTimedOut = true;
      killGroup();
    }, startupTimeoutMs);

    const onFirstData = (stream: "stdout" | "stderr"): void => {
      if (firstOutputMs !== null) return;
      firstOutputMs = Date.now() - spawnedAt;
      clearTimeout(startupTimer);
      logOmp(`first ${stream} data after ${firstOutputMs}ms (pid=${proc.pid ?? "?"})`);
    };

    // GOS-62: per-line NDJSON budget enforcement. We buffer partial lines and
    // check cumulative usage against configured limits on every turn_end event.
    let lineBuffer = "";
    const budgetActive = maxCostUsd !== undefined && maxCostUsd > 0
      || maxTokens !== undefined && maxTokens > 0;

    proc.stdout.on("data", (d) => {
      onFirstData("stdout");
      const chunk = d.toString();
      stdout += chunk;
      if (!costLimited && budgetActive) {
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? ""; // keep incomplete last line
        for (const line of lines) {
          const t = line.trim();
          if (!t) continue;
          let ev: unknown;
          try { ev = JSON.parse(t); } catch { continue; }
          if (typeof ev !== "object" || ev === null || Array.isArray(ev)) continue;
          const rec = ev as Record<string, unknown>;
          if (rec["type"] !== "turn_end") continue;
          const u = findUsage(rec);
          if (!u) continue;
          const report = readUsage(u);
          if (!report) continue;
          if (report.tokensTotal !== undefined) cumulativeTokens += report.tokensTotal;
          if (report.costUsd !== undefined) cumulativeCostUsd += report.costUsd;
          // Check both limits; either crossing fires.
          const costHit = maxCostUsd !== undefined && maxCostUsd > 0 && cumulativeCostUsd > maxCostUsd;
          const tokenHit = maxTokens !== undefined && maxTokens > 0 && cumulativeTokens > maxTokens;
          if (costHit || tokenHit) {
            costLimited = true;
            costLimitedDetail = `Budget exceeded: ${cumulativeCostUsd.toFixed(4)} USD / ${cumulativeTokens} tokens > limit ${maxCostUsd ?? "none"} USD / ${maxTokens ?? "none"} tokens`;
            logOmp(`cost limit hit: ${costLimitedDetail}`);
            killGroup();
            // Resolve immediately: the over-budget usage is already captured and
            // we must not wait on `close`, which an orphaned grandchild (e.g. a
            // lingering sleep) could delay by holding the stdout pipe open.
            finish({ exitCode: null, signal: "SIGKILL", stdout, stderr, timedOut, startupTimedOut, firstOutputMs, costLimited, costLimitedDetail });
            return;
          }
        }
      }
    });
    proc.stderr.on("data", (d) => {
      onFirstData("stderr");
      stderr += d;
    });
    proc.on("error", (err) => {
      finish({ exitCode: null, signal: null, stdout, stderr: stderr + String(err), timedOut: false, startupTimedOut: false, firstOutputMs, costLimited, ...(costLimitedDetail ? { costLimitedDetail } : {}) });
    });
    proc.on("close", (code, signal) => {
      finish({ exitCode: code, signal, stdout, stderr, timedOut, startupTimedOut, firstOutputMs, costLimited, ...(costLimitedDetail ? { costLimitedDetail } : {}) });
    });
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

export const ompAdapter: WorkerAdapter = {
  name: OMP_ADAPTER,
  async invoke(input: WorkerInvocation): Promise<WorkerResult> {
    const { sandbox, graphId, runId, node, clock } = input;
    const startedAt = clock.now();

    // FAIL CLOSED (GOS-46 / GUA-179): a resolved worker profile is REQUIRED
    // before spawn. The guava-os wf layer resolves node.persona -> env; this
    // adapter only verifies the profile is present. No weak/default fallback,
    // no silent no-persona spawn.
    const persona = node.persona?.trim();
    if (!persona) {
      fail("refusing to spawn: node has no persona (a resolved worker profile is required)", {
        nodeId: node.nodeId,
        graphId,
        runId,
      });
    }
    const model = (process.env["GORP_OMP_MODEL"] ?? "").trim();
    if (!model) {
      fail(`refusing to spawn: GORP_OMP_MODEL is not resolved for persona '${persona}'`, {
        persona,
        nodeId: node.nodeId,
      });
    }
    const appendSystemPrompt = (process.env["GORP_OMP_SYSTEM_PROMPT_APPEND"] ?? "").trim();
    if (!appendSystemPrompt) {
      fail(`refusing to spawn: GORP_OMP_SYSTEM_PROMPT_APPEND is not resolved for persona '${persona}'`, {
        persona,
        nodeId: node.nodeId,
      });
    }
    const maxCostUsdEnv = (process.env["GORP_OMP_MAX_COST_USD"] ?? "").trim();
    const maxTokensEnv = (process.env["GORP_OMP_MAX_TOKENS"] ?? "").trim();
    // Parse defensively: empty -> default, "0" -> disable that dimension,
    // garbage/negative -> default (never silently disable the safety ceiling).
    const parseBudget = (raw: string, dflt: number): number => {
      if (raw === "") return dflt;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : dflt;
    };
    const maxCostUsd = parseBudget(maxCostUsdEnv, DEFAULT_MAX_COST_USD);
    const maxTokens = parseBudget(maxTokensEnv, DEFAULT_MAX_TOKENS);

    const cmd = (process.env["GORP_OMP_CMD"] ?? "omp").trim();
    const timeoutMs = Number.parseInt(process.env["GORP_OMP_TIMEOUT"] ?? "", 10) || DEFAULT_TIMEOUT_MS;
    const startupTimeoutMs = Number.parseInt(process.env["GORP_OMP_STARTUP_TIMEOUT"] ?? "", 10) || DEFAULT_STARTUP_TIMEOUT_MS;
    const mcpDisableRaw = (process.env["GORP_OMP_MCP_DISABLE"] ?? "").trim();
    const mcpDisable = mcpDisableRaw !== "" && mcpDisableRaw !== "0" && mcpDisableRaw.toLowerCase() !== "false";
    // Forward the MCP-bypass intent to the child. OMP v17.3.2 does not yet
    // honor OMP_MCP_DISABLE (see header note); it is passed for forward
    // compatibility and recorded in spawn diagnostics so a future OMP that
    // honors it turns the bypass on without a gorp change.
    const childEnv = mcpDisable ? { ...process.env, OMP_MCP_DISABLE: "1" } : undefined;

    const headBefore = sandboxHead(sandbox);

    // Build the prompt for OMP — everything the worker is allowed to know.
    const objective = node.objective;
    const acceptance = node.acceptanceCriteria.map((c) => `- ${c}`).join("\n");
    const scope = [
      `Allowed paths: ${node.allowedPaths.join(", ") || "(all)"}`,
      `Forbidden paths: ${node.forbiddenPaths.join(", ") || "(none)"}`,
    ].join("\n");
    const artifacts = node.expectedArtifacts.length > 0
      ? `Expected artifacts: ${node.expectedArtifacts.join(", ")}`
      : "";

    const prompt = [
      `# Task: ${node.taskType ?? "sprint-task"}`,
      ``,
      `## Objective`,
      objective,
      ``,
      `## Acceptance Criteria`,
      acceptance,
      ``,
      `## Scope`,
      scope,
      artifacts,
      ``,
      `## Rules`,
      `- Work ONLY in this directory (the sandbox). (all deps and configs are available here)`,
      `- Do NOT run git commands (the engine commits for you).`,
      `- Do NOT access Linear or any external project management system.`,
      `- Do NOT approve or promote work (operator-only).`,
      ``,
      `When done, output a JSON summary of what you did.`,
    ].filter(Boolean).join("\n");
    // Invoke OMP in print mode with auto-approve. The persona body arrives via
    // GORP_OMP_SYSTEM_PROMPT_APPEND — set by the guava-os wf layer, never
    // resolved from guava-os paths here (adapter stays source-neutral).
    const args = ["-p", "--auto-approve", "--mode", "json", "--model", model, "--append-system-prompt", appendSystemPrompt];

    // args-redacted replaces the persona body with a length-only marker.
    const argsRedacted = args.map((a) =>
      a === appendSystemPrompt ? `<system-prompt:${appendSystemPrompt.length}>` : a,
    );
    const spawnCtx = {
      cmd,
      cwd: sandbox.dir,
      model,
      persona,
      promptLen: prompt.length,
      args: argsRedacted,
      mcpDisable,
      maxCostUsd,
      maxTokens,
      timeoutMs,
    };
    logOmp(`spawning: cmd=${cmd} persona=${persona} model=${model} cwd=${sandbox.dir} promptLen=${prompt.length} args=${JSON.stringify(argsRedacted)}`);

    // One invocation; cost-limited runs return without throwing so the adapter
    // can record a cost-limit outcome. Timeout / signal / nonzero exit still
    // throw. A clean exit (code 0) is the only outcome that may be retried below.
    const invokeOmp = async (promptText: string): Promise<OmpProcessResult> => {
      const r = await runOmp(cmd, [...args, promptText], sandbox.dir, "", timeoutMs, startupTimeoutMs, maxCostUsd, maxTokens, childEnv);
      if (r.costLimited) return r;
      if (r.startupTimedOut) {
        fail(`start-up timed out after ${startupTimeoutMs}ms with no output (SIGKILL)`, {
          ...spawnCtx,
          startupTimedOut: true,
          stdout: truncate(r.stdout),
          stderr: truncate(r.stderr),
        });
      }
      if (r.timedOut) {
        fail(`timed out after ${timeoutMs}ms (SIGKILL)`, {
          ...spawnCtx,
          firstOutputMs: r.firstOutputMs,
          stdout: truncate(r.stdout),
          stderr: truncate(r.stderr),
        });
      }
      if (r.signal) {
        fail(`process was cancelled/killed (signal ${r.signal})`, {
          ...spawnCtx,
          signal: r.signal,
          firstOutputMs: r.firstOutputMs,
          stdout: truncate(r.stdout),
          stderr: truncate(r.stderr),
        });
      }
      if (r.exitCode !== 0) {
        fail(`process exited non-zero (${r.exitCode})`, {
          ...spawnCtx,
          exitCode: r.exitCode,
          firstOutputMs: r.firstOutputMs,
          stdout: truncate(r.stdout),
          stderr: truncate(r.stderr),
        });
      }
      return r;
    };
    // OMP must not touch git — HEAD stays pinned to the sandbox base.
    const assertHeadPinned = (): void => {
      const headAfter = sandboxHead(sandbox);
      if (headAfter !== headBefore) {
        fail("OMP moved HEAD — the adapter owns the sandbox commit, not the worker", {
          headBefore,
          headAfter,
        });
      }
    };

    // GOS-62: cost-limit short-circuits — no retry, no commit, no gate.
    // Return a WorkerResult with outcome cost-limit so the run layer persists
    // the evidence and fails the run with a distinct classification.
    const buildCostLimitResult = (p: OmpProcessResult): WorkerResult => {
      const endedAt = clock.now();
      const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
      const usage = { ...(extractOmpUsage(p.stdout) ?? {}), durationMs };
      const usageHistory = parseUsageEvents(p.stdout);
      return {
        schemaVersion: 1,
        graphId,
        nodeId: node.nodeId,
        runId,
        workerAdapter: OMP_ADAPTER,
        outcome: "cost-limit",
        summary: truncate(p.costLimitedDetail ?? "Budget exceeded"),
        ...(p.stderr.length > 0 ? { reviewerNotes: truncate(p.stderr) } : {}),
        artifactRefs: [],
        startedAt,
        endedAt,
        usage,
        ...(usageHistory.length > 0 ? { usageHistory } : {}),
      };
    };

    // Attempt 1.
    let proc = await invokeOmp(prompt);
    if (proc.costLimited) return buildCostLimitResult(proc);
    assertHeadPinned();

    // Bounded empty-turn retry: a clean exit that changed NOTHING (e.g. the
    // worker only ran `pwd && ls`) is re-invoked ONCE with an explicit "you
    // must edit files" instruction. Timeouts and nonzero exits never retry —
    // only a clean turn that produced zero edits, and only once. Fail-closed
    // is preserved for real failures while the lazy-turn case is recovered.
    let stagedFiles = stageAndList(sandbox.dir);
    if (stagedFiles.length === 0) {
      proc = await invokeOmp(prompt + RETRY_APPEND);
      if (proc.costLimited) return buildCostLimitResult(proc);
      assertHeadPinned();
      stagedFiles = stageAndList(sandbox.dir);
    }

    if (stagedFiles.length === 0) {
      fail("no files changed — the worker produced no artifacts even after an empty-turn retry", {
        stdout: truncate(proc.stdout),
      });
    }

    // OMP JSON mode emits structured events (NDJSON); pull the worker's own
    // summary out of the final assistant message. OMP-specific shapes stay
    // here; gorp never sees them.
    const summary = extractOmpSummary(proc.stdout);
    let reviewerNotes: string | undefined;
    if (proc.stderr.length > 0) reviewerNotes = truncate(proc.stderr);

    // Make the single sandbox commit (same pattern as the fixture adapter).
    const commitMessage = `gorp: omp worker — ${graphId}/${node.nodeId}/${runId}`;
    git(["commit", "--no-verify", "-m", commitMessage], sandbox.dir, {
      GIT_AUTHOR_NAME: WORKER_NAME,
      GIT_AUTHOR_EMAIL: WORKER_EMAIL,
      GIT_COMMITTER_NAME: WORKER_NAME,
      GIT_COMMITTER_EMAIL: WORKER_EMAIL,
    });

    const commitSha = sandboxHead(sandbox);
    // Post-commit diff base..HEAD now reflects exactly the OMP worker's changes.
    const changedFiles = sandboxChangedFiles(sandbox);

    const endedAt = clock.now();
    const durationMs = Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
    const usage = { ...(extractOmpUsage(proc.stdout) ?? {}), durationMs };
    const usageHistory = parseUsageEvents(proc.stdout);

    return {
      schemaVersion: 1,
      graphId,
      nodeId: node.nodeId,
      runId,
      workerAdapter: OMP_ADAPTER,
      outcome: "succeeded" as const,
      exitCode: 0,
      summary: truncate(summary),
      expectedFiles: [...node.expectedArtifacts],
      changedFiles,
      artifactRefs: [...node.expectedArtifacts],
      commandsExecuted: [{ command: cmd, exitCode: 0 }],
      ...(reviewerNotes ? { reviewerNotes } : {}),
      startedAt,
      endedAt,
      usage,
      ...(usageHistory.length > 0 ? { usageHistory } : {}),
    };
  },
};
