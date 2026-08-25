import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Done-commit gate tests (GUA-113 move gate).
 * `moveStatus` must refuse a transition to the configured done status unless a
 * commit in the project's registered repo references the canonical id.
 * No network or real git is touched: fetch and child_process are mocked.
 */

// Hoisted mutable state so the child_process mock can be driven per-test.
const git = vi.hoisted(() => ({
  subjects: "",
  bodies: "",
  calls: 0,
}));

vi.mock("node:child_process", () => ({
  execFileSync: (_cmd: string, args: string[]) => {
    git.calls += 1;
    if (args.includes("--oneline")) return git.subjects;
    if (args.includes("--format=%B")) return git.bodies;
    throw new Error(`unexpected git args: ${args.join(" ")}`);
  },
}));

import {
  moveStatus,
  DoneCommitGateError,
  type MoveStatusOptions,
} from "../src/linear-client.js";
import type { Config } from "../src/config.js";

// Mirrors .guava-os/config.json — only the fields moveStatus reads matter.
const CONFIG: Config = {
  linear: { team: "Guava AI", project: "guava-os", issue_prefix: "GUA" },
  domains: ["task"],
  domainAgents: { task: "task" },
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: { untriaged: "untriaged", ready: "ready-for-work", needs_rescoping: "needs-rescoping" },
  statuses: {
    backlog: "Backlog",
    todo: "Todo",
    in_progress: "In Progress",
    in_review: "In Review",
    done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  invariants: {
    max_todo_per_domain: 3,
    stale_hours: 48,
    reclaim_limit: 2,
    bulk_threshold: 5,
    max_subtasks_per_parent: 3,
  },
  branch_pattern: "dev/{domain}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

// ── Registry fixture ────────────────────────────────────────────────────────
let registryDir: string;

function writeRegistry(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "guava-move-gate-"));
  writeFileSync(join(dir, "projects.yml"), body, "utf8");
  return dir;
}

// ── Fetch mock (Linear GraphQL) ─────────────────────────────────────────────
type FetchCall = { query: string; variables: Record<string, unknown> };
const fetchCalls: FetchCall[] = [];

function jsonResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { data };
    },
    async text() {
      return "";
    },
  };
}

function makeFetchRouter(projectName: string) {
  return vi.fn(async (_url: string, init: { body?: string }) => {
    const { query, variables } = JSON.parse(init.body ?? "{}") as FetchCall;
    fetchCalls.push({ query, variables });

    // resolveStateId: issue team states
    if (query.includes("team { states")) {
      return jsonResponse({
        issue: {
          team: {
            states: {
              nodes: [
                { id: "00000000-0000-0000-0000-000000000001", name: "Todo" },
                { id: "00000000-0000-0000-0000-000000000002", name: "In Progress" },
                { id: "00000000-0000-0000-0000-000000000003", name: "Done" },
              ],
            },
          },
        },
      });
    }

    // getIssue: full issue normalization
    if (query.includes("identifier")) {
      return jsonResponse({
        issue: {
          id: "uuid-1",
          identifier: "GUA-123",
          title: "Test issue",
          state: { name: "Todo", type: "unstarted" },
          priority: 2,
          labels: { nodes: [] },
          parent: null,
          project: { name: projectName },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          completedAt: null,
          canceledAt: null,
          assignee: null,
          description: "",
          relations: { nodes: [] },
        },
      });
    }

    // updateIssue mutation
    if (query.includes("issueUpdate")) {
      return jsonResponse({ issueUpdate: { success: true } });
    }

    return jsonResponse({});
  });
}

beforeEach(() => {
  git.subjects = "";
  git.bodies = "";
  git.calls = 0;
  fetchCalls.length = 0;
  vi.stubEnv("LINEAR_API_KEY", "test-key");
  // Default registry: only guava-os is registered.
  registryDir = writeRegistry(
    [
      "projects:",
      "  - id: guava-os",
      "    repo_path: /tmp/guava-move-gate-repo",
      "    linear_project: guava-os",
      "    lifecycle: active",
    ].join("\n"),
  );
  vi.stubEnv("GUAVA_OS_PROJECT_REGISTRY", join(registryDir, "projects.yml"));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  try {
    rmSync(registryDir, { recursive: true, force: true });
  } catch {
    /* already removed */
  }
});

describe("done-commit gate", () => {
  it("refuses when no commit references the canonical id", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 Some unrelated commit";
    git.bodies = "Some unrelated body";

    await expect(moveStatus("GUA-123", "Done", CONFIG))
      .rejects.toBeInstanceOf(DoneCommitGateError);
    await expect(moveStatus("GUA-123", "Done", CONFIG))
      .rejects.toThrow(/GUA-123/);
    await expect(moveStatus("GUA-123", "Done", CONFIG))
      .rejects.toThrow(/GUA-123 <outcome>/);
    // git log was consulted (subjects + bodies), so a check ran.
    expect(git.calls).toBeGreaterThan(0);
    // No status mutation was issued.
    expect(fetchCalls.some((c) => c.query.includes("issueUpdate"))).toBe(false);
  });

  it("succeeds when a commit subject references the id", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 GUA-123 Add the done-commit gate";

    const issue = await moveStatus("GUA-123", "Done", CONFIG);
    expect(issue.id).toBe("uuid-1");
    expect(git.calls).toBeGreaterThanOrEqual(1);
    expect(fetchCalls.some((c) => c.query.includes("issueUpdate"))).toBe(true);
  });

  it("succeeds when a commit body references the id", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 Subject without the id";
    git.bodies = "Fixes GUA-123 by enforcing the gate";

    const issue = await moveStatus("GUA-123", "Done", CONFIG);
    expect(issue.id).toBe("uuid-1");
    // subjects then bodies both consulted
    expect(git.calls).toBeGreaterThanOrEqual(2);
  });

  it("skips the gate for non-done statuses", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 No GUA-123 here";

    const issue = await moveStatus("GUA-123", "In Progress", CONFIG);
    expect(issue.id).toBe("uuid-1");
    expect(git.calls).toBe(0);
  });

  it("bypasses the gate with allowNoCommit", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 No GUA-123 here";

    const issue = await moveStatus("GUA-123", "Done", CONFIG, {
      allowNoCommit: true,
    } satisfies MoveStatusOptions);
    expect(issue.id).toBe("uuid-1");
    expect(git.calls).toBe(0);
    expect(fetchCalls.some((c) => c.query.includes("issueUpdate"))).toBe(true);
  });

  it("refuses when the project is not in the registry", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("unknown-proj"));

    await expect(moveStatus("GUA-123", "Done", CONFIG))
      .rejects.toThrow(/Unregistered Linear project "unknown-proj"/);
    expect(git.calls).toBe(0);
    expect(fetchCalls.some((c) => c.query.includes("issueUpdate"))).toBe(false);
  });

  it("distinguishes GUA-123 from GUA-1234 (no false positive)", async () => {
    vi.stubGlobal("fetch", makeFetchRouter("guava-os"));
    git.subjects = "abc1234 GUA-1234 Fix a different issue";
    git.bodies = "GUA-1234 body";

    await expect(moveStatus("GUA-123", "Done", CONFIG))
      .rejects.toBeInstanceOf(DoneCommitGateError);
    expect(git.calls).toBeGreaterThanOrEqual(2);
  });
});
