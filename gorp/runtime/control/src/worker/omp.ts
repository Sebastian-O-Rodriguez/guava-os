/**
 * OMP worker adapter (GOS-11).
 *
 * Implements the WorkerAdapter interface for OMP (Oh My Pi) — the primary
 * engineering runtime per ADR_001. Invokes `omp -p --auto-approve --mode json`
 * as one external process per node attempt, inside the sandbox worktree.
 *
 * Per the GOS-8 OMP runtime boundary contract:
 *   - the adapter receives only WorkerInvocation (blind; no runtime config);
 *   - OMP runs in the sandbox cwd; it writes code there;
 *   - the adapter makes the single sandbox commit (OMP must not touch git);
 *   - the result must validate against worker-result.schema.json and echo
 *     the invocation identity exactly (enforced by invokeAdapter);
 *   - workers never approve or promote (operator-only, hash-bound);
 *   - workers never fetch Linear.
 *
 * Configuration:
 *   GORP_OMP_CMD      — path to the omp binary (default: "omp" from PATH)
 *   GORP_OMP_TIMEOUT  — timeout in ms (default: 600000)
 *   GORP_OMP_MODEL    — model tier (default: persona's model or "default")
 */

import { spawn } from "node:child_process";
import { GorpError } from "../errors/index.js";
import type { WorkerResult } from "../contracts/types.js";
import { git, sandboxChangedFiles, sandboxHead } from "../sandbox/worktree.js";
import type { WorkerAdapter, WorkerInvocation } from "./adapter.js";

export const OMP_ADAPTER = "omp";
const WORKER_NAME = "gorp-omp-worker";
const WORKER_EMAIL = "omp-worker@gorp.local";
const DEFAULT_TIMEOUT_MS = 600_000;
const CAPTURE_LIMIT = 4000;

function fail(message: string, details: Record<string, unknown> = {}): never {
  throw new GorpError("WORKER_FAILED", `omp adapter: ${message}`, { workerAdapter: OMP_ADAPTER, ...details });
}

function truncate(s: string): string {
  return s.length > CAPTURE_LIMIT ? s.slice(0, CAPTURE_LIMIT) + "\n... (truncated)" : s;
}

interface OmpProcessResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runOmp(
  cmd: string,
  args: string[],
  cwd: string,
  prompt: string,
  timeoutMs: number,
): Promise<OmpProcessResult> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout.on("data", (d) => { stdout += d; });
    proc.stderr.on("data", (d) => { stderr += d; });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: null, signal: null, stdout, stderr: stderr + String(err), timedOut: false });
    });
    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: code, signal, stdout, stderr, timedOut });
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

    const cmd = (process.env["GORP_OMP_CMD"] ?? "omp").trim();
    const timeoutMs = Number.parseInt(process.env["GORP_OMP_TIMEOUT"] ?? "", 10) || DEFAULT_TIMEOUT_MS;
    const model = process.env["GORP_OMP_MODEL"] ?? "default";

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
      `- Work ONLY in this directory (the sandbox).`,
      `- Do NOT run git commands (the engine commits for you).`,
      `- Do NOT access Linear or any external project management system.`,
      `- Do NOT approve or promote work (operator-only).`,
      ``,
      `When done, output a JSON summary of what you did.`,
    ].filter(Boolean).join("\n");

    // Invoke OMP in print mode with auto-approve.
    const args = ["-p", "--auto-approve", "--mode", "json", "--model", model, prompt];
    const proc = await runOmp(cmd, args, sandbox.dir, "", timeoutMs);

    if (proc.timedOut) {
      fail(`timed out after ${timeoutMs}ms (SIGKILL)`, {
        timeoutMs,
        stdout: truncate(proc.stdout),
        stderr: truncate(proc.stderr),
      });
    }
    if (proc.signal) {
      fail(`process was cancelled/killed (signal ${proc.signal})`, {
        signal: proc.signal,
        stdout: truncate(proc.stdout),
        stderr: truncate(proc.stderr),
      });
    }
    if (proc.exitCode !== 0) {
      fail(`process exited non-zero (${proc.exitCode})`, {
        exitCode: proc.exitCode,
        stdout: truncate(proc.stdout),
        stderr: truncate(proc.stderr),
      });
    }

    // OMP's JSON mode outputs structured content; extract the summary.
    // The adapter maps OMP output to the WorkerResult schema — OMP-specific
    // shapes stay here; gorp never sees them.
    let summary = "OMP worker completed.";
    let reviewerNotes: string | undefined;
    try {
      const ompOutput = JSON.parse(proc.stdout) as {
        content?: string;
        message?: string;
        text?: string;
        response?: string;
      };
      summary = ompOutput.content ?? ompOutput.message ?? ompOutput.text ?? ompOutput.response ?? summary;
      if (proc.stderr.length > 0) reviewerNotes = truncate(proc.stderr);
    } catch {
      // If JSON parsing fails, use stdout as summary (truncated).
      if (proc.stdout.trim().length > 0) summary = truncate(proc.stdout.trim());
    }

    // Verify HEAD didn't move (OMP must not touch git).
    const headAfter = sandboxHead(sandbox);
    if (headAfter !== headBefore) {
      fail("OMP moved HEAD — the adapter owns the sandbox commit, not the worker", {
        headBefore,
        headAfter,
      });
    }

    // Collect changed files from the sandbox.
    const changedFiles = sandboxChangedFiles(sandbox);
    if (changedFiles.length === 0) {
      fail("no files changed — the worker produced no artifacts", {
        stdout: truncate(proc.stdout),
      });
    }

    // Make the single sandbox commit (same pattern as the fixture adapter).
    git(["add", "--all"], sandbox.dir);
    const commitMessage = `gorp: omp worker — ${graphId}/${node.nodeId}/${runId}`;
    git(["commit", "--no-verify", "-m", commitMessage], sandbox.dir, {
      GIT_AUTHOR_NAME: WORKER_NAME,
      GIT_AUTHOR_EMAIL: WORKER_EMAIL,
      GIT_COMMITTER_NAME: WORKER_NAME,
      GIT_COMMITTER_EMAIL: WORKER_EMAIL,
    });

    const commitSha = sandboxHead(sandbox);

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
      endedAt: clock.now(),
    };
  },
};
