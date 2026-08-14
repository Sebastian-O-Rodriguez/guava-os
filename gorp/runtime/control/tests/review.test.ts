/**
 * GOS-52: review-output overflow regression tests.
 *
 * A multi-MB worker diff (e.g. 4.9 MB lighthouse/verification JSON) used to
 * overflow the scheduler's review subprocess (Node default 1 MiB maxBuffer).
 * The fix bounds the diff embedded in ReviewOutput.sandbox and bumps the
 * scheduler's maxBuffer.
 *
 * Unit tests for `boundedDiff` cover the pure truncation contract;
 * the integration test verifies `reviewRun` actually pipes the diff through
 * boundedDiff (wiring regression guard).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { boundedDiff, MAX_DIFF_BYTES, MAX_DIFF_LINES, reviewRun } from "../src/run/review.js";
import { registerProjects } from "./helpers.js";
import { loadConfig, type RuntimeConfig } from "../src/config/index.js";
import { DEFAULT_RUN_ID, executeRun } from "../src/run/run.js";
import { GraphStore } from "../src/storage/graph-store.js";
import { applyGraphTransition, buildDraftGraph, type Clock } from "../src/graph/graph.js";
import type { GraphNode } from "../src/contracts/types.js";

const clock: Clock = { now: () => "2026-08-14T12:00:00.000Z" };

// ── Unit: boundedDiff ────────────────────────────────────────────────────────

describe("boundedDiff (pure unit)", () => {
  it("passes through a small diff untouched", () => {
    const tiny = "+add this line\n-remove that";
    expect(boundedDiff(tiny)).toBe(tiny);
  });

  it("passes through an empty diff untouched", () => {
    expect(boundedDiff("")).toBe("");
  });

  it("truncates a diff with more than MAX_DIFF_LINES lines", () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `+line ${i}`);
    const large = lines.join("\n");
    const out = boundedDiff(large);

    const outLines = out.split("\n");
    // Should keep MAX_DIFF_LINES lines + one marker line.
    expect(outLines.length).toBe(MAX_DIFF_LINES + 1);
    // The marker must report elision details.
    expect(out).toContain("… (diff truncated:");
    expect(out).toContain(`${MAX_DIFF_LINES} of 2000 lines`);
    expect(out).toContain("bytes");
  });

  it("truncates a diff exceeding MAX_DIFF_BYTES (few lines, byte cap does the work)", () => {
    // Fewer than MAX_DIFF_LINES lines, but each long enough that the BYTE cap
    // (not the line cap) is the binding constraint.
    const longLine = "y".repeat(16 * 1024); // 16 KiB per line
    const lines = Array.from({ length: 8 }, (_, i) => `+line-${i} ${longLine}`);
    const large = lines.join("\n"); // ~128 KiB across 8 lines
    expect(Buffer.byteLength(large, "utf8")).toBeGreaterThan(MAX_DIFF_BYTES);
    expect(lines.length).toBeLessThan(MAX_DIFF_LINES);

    const out = boundedDiff(large);

    const byteLen = Buffer.byteLength(out, "utf8");
    expect(byteLen).toBeGreaterThan(0);
    expect(byteLen).toBeLessThan(MAX_DIFF_BYTES + 256);
    expect(out).toContain("… (diff truncated:");
    // All 8 lines existed; fewer survived the byte cap.
    expect(out).toContain(" of 8 lines");
  });

  it("hard-truncates a single over-budget line (e.g. minified JSON)", () => {
    // One giant line of 'x's that exceeds MAX_DIFF_BYTES.
    const giant = "x".repeat(2 * 1024 * 1024); // 2 MiB of x's on one line
    const out = boundedDiff(giant);

    const byteLen = Buffer.byteLength(out, "utf8");
    // The result is a byte-truncated head + marker; always bounded.
    expect(byteLen).toBeGreaterThan(0);
    expect(byteLen).toBeLessThan(MAX_DIFF_BYTES + 256);
    expect(out).toContain("… (diff truncated:");
    expect(out).toContain("1 of 1 lines"); // single huge line
  });

  it("marker reports the correct elision counts", () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `+short line ${i}`);
    const diff = lines.join("\n");
    const totalBytes = Buffer.byteLength(diff, "utf8");
    const out = boundedDiff(diff);

    // We expect truncation (1000 > MAX_DIFF_LINES).
    expect(out).toContain(`… (diff truncated: ${MAX_DIFF_LINES} of 1000 lines`);
    // The byte counts should be present and not empty.
    expect(out).toMatch(/\d+ of \d+ bytes\)$/);
    // The "total" byte count should match the original.
    const m = out.match(/(\d+) of (\d+) bytes\)$/);
    expect(m).not.toBeNull();
    // total bytes in marker == total bytes of the original diff
    expect(Number(m![2])).toBe(totalBytes);
  });
});

// ── Integration: reviewRun bounding ──────────────────────────────────────────

let stateHome: string;
let repo: string;
let cfg: RuntimeConfig;

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function makeNode(partial: Partial<GraphNode> = {}): GraphNode {
  return {
    nodeId: "node-1",
    taskType: "fixture-mutation",
    objective: "add a governed note",
    acceptanceCriteria: ["note exists"],
    allowedPaths: ["docs/**"],
    forbiddenPaths: ["secrets/**"],
    requiredCommands: [],
    expectedArtifacts: ["docs/note.md"],
    workerAdapter: "fixture",
    dependencies: [],
    state: "pending",
    attempt: 0,
    ...partial,
  };
}

function approvedGraph(graphId: string, node: GraphNode) {
  const store = new GraphStore(cfg);
  const draft = buildDraftGraph(
    {
      graphId,
      project: { projectId: "p1" },
      baseCommit: git(["rev-parse", "HEAD"], repo).trim(),
      nodes: [node],
      createdBy: "op",
      createdByType: "operator",
    },
    clock,
  );
  store.save(draft);
  const approved = applyGraphTransition(
    draft,
    { to: "approved", actorType: "operator", actorId: "op", reasonCode: "OPERATOR_APPROVAL", reasonText: "approved" },
    clock,
  );
  store.update(approved);
  return approved;
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-review-state-"));
  process.env["GORP_STATE_HOME"] = stateHome;
  cfg = loadConfig();
  repo = mkdtempSync(join(tmpdir(), "gorp-review-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# consumer\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ p1: repo });
});

afterEach(() => {
  delete process.env["GORP_PROJECT_REGISTRY"];
  delete process.env["GORP_STATE_HOME"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("reviewRun bounded output (GOS-52)", () => {
  it("sandbox.diff is bounded even after a multi-MB sandbox commit", async () => {
    approvedGraph("g-overflow", makeNode());
    const out = await executeRun(
      cfg,
      { projectId: "p1", nodeId: "node-1", graphId: "g-overflow", actorId: "orch" },
      clock,
    );

    // Inflate: add a 3 MiB file to the sandbox so the diff from baseCommit
    // is dominated by that content. The fixture worker already committed
    // docs/note.md; this commit goes on top.
    const sbDir = out.sandbox!.dir;
    expect(existsSync(sbDir)).toBe(true);

    // Write a large file with one giant line (minified-JSON-like).
    const bigFile = join(sbDir, "big-output.json");
    writeFileSync(bigFile, Buffer.alloc(3 * 1024 * 1024, "x")); // 3 MiB of ASCII
    git(["add", "big-output.json"], sbDir);
    git(["commit", "-q", "-m", "inflate diff"], sbDir);

    const review = reviewRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-overflow" });
    expect(review.sandbox).not.toBeNull();
    const diff = review.sandbox!.diff;

    // The embedded diff must be bounded (far below 3 MiB).
    const diffBytes = Buffer.byteLength(diff, "utf8");
    expect(diffBytes).toBeGreaterThan(0);
    expect(diffBytes).toBeLessThan(150 * 1024); // well under 150 KiB (max is 64 KiB + marker)

    // Must carry the truncation marker.
    expect(diff).toContain("… (diff truncated:");

    // The review output still carries the unchanged fields the policy binds to.
    expect(review.sandbox!.changedFiles).toContain("docs/note.md");
    expect(review.sandbox!.changedFiles).toContain("big-output.json");
    expect(review.sandbox!.headCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(review.gateRecord).not.toBeNull();
    expect(review.gateRecord!.validation.artifactHash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("sandbox.diff passes through when the diff is small", async () => {
    // Normal fixture run: small diff, no truncation needed.
    approvedGraph("g-small", makeNode());
    await executeRun(
      cfg,
      { projectId: "p1", nodeId: "node-1", graphId: "g-small", actorId: "orch" },
      clock,
    );

    const review = reviewRun(cfg, { projectId: "p1", nodeId: "node-1", graphId: "g-small" });
    expect(review.sandbox).not.toBeNull();
    const diff = review.sandbox!.diff;

    // Small diff is NOT truncated.
    expect(diff).not.toContain("… (diff truncated:");
    expect(diff).toContain("docs/note.md"); // real diff content present
    expect(diff).toContain("+# add a governed note");
  });
});