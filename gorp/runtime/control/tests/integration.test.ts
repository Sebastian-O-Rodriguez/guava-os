import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { registerProjects } from "./helpers.js";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * End-to-end Wave A integration test.
 *
 * Uses a temporary state root and a temporary disposable Git repository. The
 * repository is reference metadata only (no worktree, no worker). Proves:
 * create -> persist -> show -> approve -> reload -> transition history, and that
 * NO runtime state is written into the fixture repository.
 *
 * Runs the COMPILED CLI (dist/cli/main.js) as a subprocess. Node's raw .ts
 * strip-types loader does not rewrite .js import specifiers, so we build first.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, "..");
const CLI = join(PKG, "dist", "cli", "main.js");

let stateHome: string;
let repo: string;

beforeAll(() => {
  // Ensure the compiled CLI exists for subprocess invocation.
  execFileSync("npx", ["tsc", "-p", "tsconfig.json"], { cwd: PKG, stdio: "pipe" });
});

function git(args: string[], cwd: string): void {
  execFileSync("git", args, { cwd, stdio: "pipe" });
}

function runCli(argv: string[]): { stdout: string; code: number } {
  try {
    const stdout = execFileSync("node", [CLI, ...argv], {
      env: { ...process.env, GORP_STATE_HOME: stateHome },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, code: 0 };
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    return { stdout: err.stdout ?? "", code: err.status ?? -1 };
  }
}

beforeEach(() => {
  stateHome = mkdtempSync(join(tmpdir(), "gorp-int-state-"));
  repo = mkdtempSync(join(tmpdir(), "gorp-int-repo-"));
  git(["init", "-q"], repo);
  git(["config", "user.email", "t@example.com"], repo);
  git(["config", "user.name", "t"], repo);
  writeFileSync(join(repo, "README.md"), "# fixture repo\n");
  git(["add", "."], repo);
  git(["commit", "-q", "-m", "init"], repo);
  registerProjects({ "fixture-project": repo });
});
afterEach(() => {
  delete process.env["GORP_PROJECT_REGISTRY"];
  rmSync(stateHome, { recursive: true, force: true });
  rmSync(repo, { recursive: true, force: true });
});

describe("Wave A integration: create -> persist -> show -> approve -> reload", () => {
  it("runs the full non-execution lifecycle with state outside the repo", () => {
    const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    // create
    const created = runCli([
      "graph", "create",
      "--graph-id", "slice-0001",
      "--project-id", "fixture-project",
      "--base-commit", baseCommit,
      "--objective", "create a fixture file inside allowed scope",
      "--actor-id", "operator:integration",
    ]);
    expect(created.code).toBe(0);
    const createdJson = JSON.parse(created.stdout) as { success: boolean; data: { path: string } };
    expect(createdJson.success).toBe(true);
    // persisted under the state root, NOT the repo
    expect(createdJson.data.path.startsWith(stateHome)).toBe(true);
    expect(existsSync(createdJson.data.path)).toBe(true);

    // show (draft/unapproved)
    const shown = runCli(["graph", "show", "--project-id", "fixture-project", "--graph-id", "slice-0001"]);
    expect(shown.code).toBe(0);
    const g1 = JSON.parse(shown.stdout) as { data: { status: string; approvalStatus: string } };
    expect(g1.data.status).toBe("draft");
    expect(g1.data.approvalStatus).toBe("unapproved");

    // approve (operator transition — file existence was NOT approval)
    const approved = runCli([
      "graph", "transition", "--project-id", "fixture-project", "--graph-id", "slice-0001",
      "--to", "approved", "--actor-type", "operator", "--actor-id", "operator:integration",
      "--reason-code", "OPERATOR_APPROVAL", "--reason", "sprint approved by operator",
    ]);
    expect(approved.code).toBe(0);

    // reload -> confirm transition history + approval
    const reloaded = runCli(["graph", "show", "--project-id", "fixture-project", "--graph-id", "slice-0001"]);
    const g2 = JSON.parse(reloaded.stdout) as {
      data: { status: string; approvalStatus: string; transitions: Array<{ fromState: string; toState: string; actorType: string; reasonCode: string }> };
    };
    expect(g2.data.status).toBe("approved");
    expect(g2.data.approvalStatus).toBe("approved");
    expect(g2.data.transitions).toHaveLength(1);
    expect(g2.data.transitions[0]!.fromState).toBe("draft");
    expect(g2.data.transitions[0]!.toState).toBe("approved");
    expect(g2.data.transitions[0]!.actorType).toBe("operator");
    expect(g2.data.transitions[0]!.reasonCode).toBe("OPERATOR_APPROVAL");
  });

  it("writes NO runtime state into the fixture repository", () => {
    const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    runCli([
      "graph", "create", "--graph-id", "slice-0002", "--project-id", "fixture-project", "--base-commit", baseCommit, "--objective", "x", "--actor-id", "op",
    ]);
    runCli([
      "graph", "transition", "--project-id", "fixture-project", "--graph-id", "slice-0002",
      "--to", "approved", "--actor-type", "operator", "--actor-id", "op",
      "--reason-code", "OK", "--reason", "ok",
    ]);
    // git status of the fixture repo must be clean (no .gorp, no graphs, nothing)
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
    expect(status.trim()).toBe("");
    // and the repo contains only the initial files
    const entries = readdirSync(repo).filter((e) => e !== ".git");
    expect(entries).toEqual(["README.md"]);
  });

  it("inspect fails closed on a missing graph and mutates nothing", () => {
    const { stdout, code } = runCli(["inspect", "--project-id", "nope", "--graph-id", "missing", "--node-id", "node-1"]);
    expect(code).toBe(4); // GRAPH_NOT_FOUND
    const j = JSON.parse(stdout) as { success: boolean; error: { code: string } };
    expect(j.success).toBe(false);
    expect(j.error.code).toBe("GRAPH_NOT_FOUND");
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
    expect(status.trim()).toBe("");
  });
});

describe("Wave B+C integration: approved graph -> sandbox -> worker -> result -> gate -> review -> promote", () => {
  it("drives the full loop through the compiled CLI, stops at review, then promotes", () => {
    const baseCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();

    // approved single-node graph scoped to docs/**
    const created = runCli([
      "graph", "create",
      "--graph-id", "wave-b-slice",
      "--project-id", "fixture-project",
      "--base-commit", baseCommit,
      "--objective", "add a governed note",
      "--acceptance", "note exists",
      "--allowed", "docs/**",
      "--artifacts", "docs/note.md",
      "--worker", "fixture",
      "--actor-id", "operator:integration",
    ]);
    expect(created.code).toBe(0);
    const approved = runCli([
      "graph", "transition", "--project-id", "fixture-project", "--graph-id", "wave-b-slice",
      "--to", "approved", "--actor-type", "operator", "--actor-id", "operator:integration",
      "--reason-code", "OPERATOR_APPROVAL", "--reason", "approved for wave b slice",
    ]);
    expect(approved.code).toBe(0);

    // run
    const run = runCli(["run", "--project-id", "fixture-project", "--graph-id", "wave-b-slice", "--node-id", "node-1", "--actor-id", "orch"]);
    expect(run.code).toBe(0);
    const runJson = JSON.parse(run.stdout) as {
      success: boolean;
      data: {
        finalStatus: string; nodeState: string; graphStatus: string;
        sandbox: { dir: string; headCommit: string };
        validation: { status: string };
        records: Record<string, string>;
      };
    };
    expect(runJson.success).toBe(true);
    expect(runJson.data.finalStatus).toBe("succeeded");
    expect(runJson.data.nodeState).toBe("awaiting_review");
    expect(runJson.data.validation.status).toBe("passed");
    expect(runJson.data.sandbox.dir.startsWith(stateHome)).toBe(true);
    for (const p of Object.values(runJson.data.records)) {
      expect(p.startsWith(stateHome)).toBe(true);
      expect(existsSync(p)).toBe(true);
    }

    // review (read-only)
    const review = runCli(["review", "--project-id", "fixture-project", "--graph-id", "wave-b-slice", "--node-id", "node-1"]);
    expect(review.code).toBe(0);
    const reviewJson = JSON.parse(review.stdout) as {
      success: boolean;
      data: {
        readOnly: boolean; nodeState: string;
        gateRecord: { validation: { status: string }; review: { status: string } };
        sandbox: { changedFiles: string[]; diff: string };
      };
    };
    expect(reviewJson.success).toBe(true);
    expect(reviewJson.data.readOnly).toBe(true);
    expect(reviewJson.data.nodeState).toBe("awaiting_review");
    expect(reviewJson.data.gateRecord.validation.status).toBe("passed");
    expect(reviewJson.data.gateRecord.review.status).toBe("pending");
    expect(reviewJson.data.sandbox.changedFiles).toEqual(["docs/note.md"]);
    expect(reviewJson.data.sandbox.diff).toContain("docs/note.md");

    // consumer working tree stays untouched (worktree metadata lives in .git only)
    const status = execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
    expect(status.trim()).toBe("");
    const entries = readdirSync(repo).filter((e) => e !== ".git");
    expect(entries).toEqual(["README.md"]);

    // --- Wave D: record the review decision, then promote -------------------
    const reviewedCommit = runJson.data.sandbox.headCommit;
    const approve = runCli([
      "approve", "--project-id", "fixture-project", "--graph-id", "wave-b-slice", "--node-id", "node-1",
      "--actor-id", "reviewer:integration", "--reviewed-commit", reviewedCommit,
      "--reason", "integration review approved",
    ]);
    expect(approve.code).toBe(0);
    const approveJson = JSON.parse(approve.stdout) as {
      success: boolean;
      data: { decision: { decision: string; reviewedArtifactHash: string }; nodeState: string };
    };
    expect(approveJson.success).toBe(true);
    expect(approveJson.data.decision.decision).toBe("approved");
    expect(approveJson.data.decision.reviewedArtifactHash).toBe(reviewedCommit);
    expect(approveJson.data.nodeState).toBe("approved");

    const promote = runCli([
      "promote", "--project-id", "fixture-project", "--graph-id", "wave-b-slice", "--node-id", "node-1",
      "--actor-id", "reviewer:integration",
    ]);
    expect(promote.code).toBe(0);
    const promoteJson = JSON.parse(promote.stdout) as {
      success: boolean;
      data: { promotedCommit: string; resultCommit: string; graphStatus: string; nodeState: string; sandboxCleaned: boolean };
    };
    expect(promoteJson.success).toBe(true);
    expect(promoteJson.data.promotedCommit).toBe(reviewedCommit);
    expect(promoteJson.data.graphStatus).toBe("running"); // promote does not complete the graph
    expect(promoteJson.data.nodeState).toBe("promoted");
    expect(promoteJson.data.sandboxCleaned).toBe(true);

    // the reviewed change is now on the target branch, exactly one commit on base
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    expect(head).toBe(promoteJson.data.resultCommit);
    expect(execFileSync("git", ["rev-parse", "HEAD^"], { cwd: repo, encoding: "utf8" }).trim()).toBe(baseCommit);
    expect(existsSync(join(repo, "docs", "note.md"))).toBe(true);
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" }).trim()).toBe("");
    // sandbox worktree and branch fully cleaned up
    expect(existsSync(runJson.data.sandbox.dir)).toBe(false);
    const branches = execFileSync("git", ["branch", "--list", "gorp/run/*"], { cwd: repo, encoding: "utf8" }).trim();
    expect(branches).toBe("");

    // --- Wave D: one read-only inspect shows the complete verified audit ----
    const inspect = runCli(["inspect", "--project-id", "fixture-project", "--graph-id", "wave-b-slice", "--node-id", "node-1"]);
    expect(inspect.code).toBe(0);
    const inspectJson = JSON.parse(inspect.stdout) as {
      success: boolean;
      data: {
        readOnly: boolean;
        graph: { status: string; node: { state: string } };
        reviewDecision: { record: { decision: string } };
        promotionRecord: { record: { resultCommit: string } };
        integrity: { chainValid: boolean; chain: Array<{ event: string }> };
        errors: string[];
      };
    };
    expect(inspectJson.success).toBe(true);
    expect(inspectJson.data.readOnly).toBe(true);
    expect(inspectJson.data.graph.status).toBe("running");
    expect(inspectJson.data.graph.node.state).toBe("promoted");
    expect(inspectJson.data.reviewDecision.record.decision).toBe("approved");
    expect(inspectJson.data.promotionRecord.record.resultCommit).toBe(promoteJson.data.resultCommit);
    expect(inspectJson.data.errors).toEqual([]);
    expect(inspectJson.data.integrity.chainValid).toBe(true);
    expect(inspectJson.data.integrity.chain.map((e) => e.event)).toEqual([
      "worker-result", "gate-record", "run-record", "review-decision", "promotion-record",
    ]);
  });
});
