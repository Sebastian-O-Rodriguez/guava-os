import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertCanonicalDescription,
  resolveCreateLabels,
  createIssue,
  CreateIssueValidationError,
} from "../src/linear-client.js";
import type { Config } from "../src/config.js";

/**
 * `pm create` canonical-structure + auto-label enforcement.
 * Mirrors .guava-os/config.json — only the fields the enforcement reads matter.
 */
const CONFIG: Config = {
  linear: { team: "Guava AI", project: "guava-os", issue_prefix: "GUA" },
  domains: ["pm", "qa", "backend", "frontend"],
  domainAgents: { pm: "task", qa: "reviewer", backend: "task", frontend: "designer" },
  types: ["Feature", "Bug", "Improvement", "Chore", "Spike"],
  readiness: {
    untriaged: "untriaged",
    ready: "ready-for-work",
    needs_rescoping: "needs-rescoping",
  },
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

const COMPLETE = [
  "## Why this exists",
  "Canonical issues keep the board executable.",
  "## Scope",
  "pm create enforcement.",
  "## Acceptance criteria",
  "Issues carry a domain label and readiness.",
].join("\n");

describe("pm create — canonical description", () => {
  it("accepts a description with all three headings", () => {
    expect(() => assertCanonicalDescription(COMPLETE)).not.toThrow();
  });

  it("rejects a partial description naming each missing heading", () => {
    const partial = "## Why this exists\nreason\n";
    expect(() => assertCanonicalDescription(partial)).toThrow(CreateIssueValidationError);
    expect(() => assertCanonicalDescription(partial)).toThrow(/## Scope/);
    expect(() => assertCanonicalDescription(partial)).toThrow(/## Acceptance criteria/);
  });

  it("rejects an undefined description before any Linear call", () => {
    expect(() => assertCanonicalDescription(undefined)).toThrow(CreateIssueValidationError);
    expect(() => assertCanonicalDescription("")).toThrow(/## Why this exists/);
  });
});

describe("pm create — domain + readiness labels", () => {
  it("auto-applies untriaged when only a domain label is passed", () => {
    expect(resolveCreateLabels(CONFIG, ["backend"])).toEqual(["backend", "untriaged"]);
  });

  it("keeps an explicit readiness label untouched", () => {
    expect(resolveCreateLabels(CONFIG, ["backend", "ready-for-work"])).toEqual([
      "backend",
      "ready-for-work",
    ]);
  });

  it("rejects when no --label is supplied", () => {
    expect(() => resolveCreateLabels(CONFIG, [])).toThrow(/--label.*domain/);
  });

  it("rejects when labels exist but none is a configured domain", () => {
    expect(() => resolveCreateLabels(CONFIG, ["untriaged", "Feature"])).toThrow(
      /--label.*domain/,
    );
  });
});

describe("pm create — end-to-end label resolution (fetched, no network)", () => {
  type FetchCall = { query: string; variables: Record<string, unknown> };
  const calls: FetchCall[] = [];

  function mockFetch() {
    return vi.fn(async (_url: string, init: { body?: string }) => {
      const { query, variables } = JSON.parse(init.body ?? "{}") as {
        query: string;
        variables: Record<string, unknown>;
      };
      calls.push({ query, variables });
      if (query.includes("query { teams")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return { data: { teams: { nodes: [{ id: "team-uuid", name: "Guava AI" }] } } };
          },
        };
      }
      if (query.includes("issueLabels")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return {
              data: {
                issueLabels: {
                  nodes: [
                    { id: "label-backend", name: "backend" },
                    { id: "label-untriaged", name: "untriaged" },
                  ],
                },
              },
            };
          },
        };
      }
      if (query.includes("issueCreate")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return { data: { issueCreate: { issue: { id: "issue-uuid", title: "Created" } } } };
          },
        };
      }
      if (query.includes("issue(id: $id)")) {
        return {
          ok: true,
          status: 200,
          async text() {
            return "";
          },
          async json() {
            return {
              data: {
                issue: {
                  id: "issue-uuid",
                  identifier: "GUA-1",
                  title: "Created",
                  state: { name: "Todo", type: "unstarted" },
                  priority: 2,
                  labels: { nodes: [{ name: "backend" }, { name: "untriaged" }] },
                  parent: null,
                  project: { name: "guava-os" },
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                  completedAt: null,
                  canceledAt: null,
                  assignee: null,
                  description: "",
                  relations: { nodes: [] },
                },
              },
            };
          },
        };
      }
      return { ok: true, status: 200, async text() { return ""; }, async json() { return { data: {} }; } };
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal("fetch", mockFetch());
    vi.stubEnv("LINEAR_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("succeeds and carries domain + auto-applied untriaged", async () => {
    const labels = resolveCreateLabels(CONFIG, ["backend"]);
    assertCanonicalDescription(COMPLETE);
    const issue = await createIssue({
      title: "T",
      description: COMPLETE,
      teamId: "Guava AI",
      labels,
    });

    const create = calls.find((c) => c.query.includes("issueCreate("))!;
    expect((create.variables.input as Record<string, unknown>).labelIds).toEqual([
      "label-backend",
      "label-untriaged",
    ]);
    expect(issue.labels).toEqual(["backend", "untriaged"]);
  });
});