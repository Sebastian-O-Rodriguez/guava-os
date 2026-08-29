import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createIssue,
  updateIssue,
  linkDependencies,
  unlinkDependencies,
  loadToken,
} from "../src/linear-client.js";
import { findRepoRoot } from "../src/config.js";
import { tmpdir } from "node:os";

// loadToken's .env fallback resolves via findRepoRoot; point it at a
// nonexistent root so the missing-key path is exercised without the real .env.
vi.mock("../src/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config.js")>();
  return { ...actual, findRepoRoot: vi.fn(() => "/nonexistent-root") };
});

/**
 * Fetch-mocked tests for the Linear write path (GUA-96).
 * Every test routes fake GraphQL responses; no network is touched.
 */

type FetchCall = {
  query: string;
  variables: Record<string, unknown>;
};

const calls: FetchCall[] = [];
let respond: (query: string, variables: Record<string, unknown>) => unknown;
/** Relations returned by the relation-probe query (GOS-41 unlink tests). */
let stubRelations: unknown[] = [];

function mockFetch() {
  return vi.fn(async (_url: string, init: { body?: string }) => {
    const { query, variables } = JSON.parse(init.body ?? "{}") as {
      query: string;
      variables: Record<string, unknown>;
    };
    calls.push({ query, variables });
    const body = respond(query, variables);
    return {
      ok: true,
      status: 200,
      async text() {
        return "";
      },
      async json() {
        return body;
      },
    };
  }) as unknown as typeof fetch;
}

/** Route by query shape to canned responses for name resolution. */
function router(query: string, variables: Record<string, unknown>): unknown {
  if (query.includes("query { teams")) {
    return { data: { teams: { nodes: [{ id: "team-uuid", name: "Guava AI" }] } } };
  }
  if (query.includes("issueLabels")) {
    return {
      data: {
        issueLabels: {
          nodes: [
            { id: "label-backend", name: "backend" },
            { id: "label-architect", name: "architect" },
          ],
        },
      },
    };
  }
  if (query.includes("projects(filter")) {
    return { data: { projects: { nodes: [{ id: "project-uuid", name: "guava-os", url: "" }] } } };
  }
  if (query.includes("team(id")) {
    return {
      data: {
        team: {
          states: {
            nodes: [
              { id: "state-todo", name: "Todo" },
              { id: "state-done", name: "Done" },
            ],
          },
        },
      },
    };
  }
  if (query.includes("viewer")) {
    return { data: { viewer: { id: "viewer-uuid" } } };
  }
  if (
    query.includes("relations { nodes { id type issue { id }") &&
    !query.includes("description")
  )
    return { data: { issue: { relations: { nodes: stubRelations } } } };
  if (query.includes("issues(filter")) {
    // identifier -> uuid (fresh issues filter; distinct per input)
    return { data: { issues: { nodes: [{ id: `uuid-${String(variables.v)}` }] } } };
  }
  if (query.includes("issue(id: $id)")) {
    // getIssue after create/update
    return {
      data: {
        issue: {
          id: "issue-uuid",
          identifier: "GUA-1",
          title: "Created",
          state: { name: "Todo", type: "unstarted" },
          priority: 2,
          labels: { nodes: [{ name: "backend" }] },
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
  }
  if (query.includes("issueCreate")) {
    return { data: { issueCreate: { issue: { id: "issue-uuid", title: "Created" } } } };
  }
  if (query.includes("issueRelationCreate")) {
    return { data: { issueRelationCreate: { success: true } } };
  }
  if (query.includes("issueRelationDelete")) {
    return { data: { issueRelationDelete: { success: true } } };
  }
  if (query.includes("issueUpdate")) {
    return { data: { issueUpdate: { success: true } } };
  }
  return { data: {} };
}

beforeEach(() => {
  calls.length = 0;
  stubRelations = [];
  vi.stubGlobal("fetch", mockFetch());
  vi.stubEnv("LINEAR_API_KEY", "test-key");
  respond = router;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GUA-96 name/identifier resolution", () => {
  it("createIssue resolves team/project/label/status names before issueCreate", async () => {
    await createIssue({
      title: "T",
      teamId: "Guava AI",
      projectId: "guava-os",
      parentId: "GUA-1",
      labels: ["backend"],
      status: "Todo",
    });
    const create = calls.find((c) => c.query.includes("issueCreate("))!;
    const input = create.variables.input as Record<string, unknown>;
    expect(input.teamId).toBe("team-uuid");
    expect(input.projectId).toBe("project-uuid");
    expect(input.parentId).toBe("uuid-GUA-1");
    expect(input.labelIds).toEqual(["label-backend"]);
    expect(input.stateId).toBe("state-todo");
  });

  it("updateIssue omits labelIds when labels not provided (no wipe)", async () => {
    await updateIssue("issue-uuid", { description: "new body" });
    const update = calls.find((c) => c.query.includes("issueUpdate("))!;
    const input = update.variables.input as Record<string, unknown>;
    expect("labelIds" in input).toBe(false);
  });

  it("updateIssue resolves label names when provided", async () => {
    await updateIssue("issue-uuid", { labels: ["architect"] });
    const update = calls.find((c) => c.query.includes("issueUpdate("))!;
    expect((update.variables.input as Record<string, unknown>).labelIds).toEqual(["label-architect"]);
  });

  it("updateIssue sets parentId (resolved) when --parent provided", async () => {
    await updateIssue("GUA-7", { parentId: "GUA-9" });
    const update = calls.find((c) => c.query.includes("issueUpdate("))!;
    expect((update.variables.input as Record<string, unknown>).parentId).toBe("uuid-GUA-9");
  });

  it("updateIssue omits parentId when not provided (no unintended reparent)", async () => {
    await updateIssue("GUA-7", { description: "body" });
    const update = calls.find((c) => c.query.includes("issueUpdate("))!;
    expect("parentId" in (update.variables.input as Record<string, unknown>)).toBe(false);
  });

  it("updateIssue passes null parentId to detach (--parent none)", async () => {
    await updateIssue("GUA-7", { parentId: null });
    const update = calls.find((c) => c.query.includes("issueUpdate("))!;
    expect((update.variables.input as Record<string, unknown>).parentId).toBeNull();
  });

  it("updateIssue rejects self-parent before any mutation", async () => {
    await expect(updateIssue("GUA-7", { parentId: "GUA-7" })).rejects.toThrow(/itself/);
    expect(calls.filter((c) => c.query.includes("issueUpdate("))).toHaveLength(0);
  });

  it("updateIssue rejects non-canonical parent alias before any mutation", async () => {
    await expect(updateIssue("GUA-7", { parentId: "S0" })).rejects.toThrow(/Non-canonical/);
    expect(calls.filter((c) => c.query.includes("issueUpdate("))).toHaveLength(0);
  });
});

describe("GUA-96 native relation creation", () => {
  it("--blocks creates issueRelationCreate type=blocks with correct direction", async () => {
    await linkDependencies("GUA-5", { blocks: ["GUA-6"] });
    const rel = calls.find((c) => c.query.includes("issueRelationCreate("))!;
    const input = rel.variables.input as Record<string, unknown>;
    expect(input.type).toBe("blocks");
    expect(input.issueId).toBe("uuid-GUA-5");
    expect(input.relatedIssueId).toBe("uuid-GUA-6");
  });

  it("resolves identifiers via fresh issues filter, not the stale issue(id:) shortcut", async () => {
    await linkDependencies("GUA-5", { blocks: ["GUA-6"] });
    expect(calls.some((c) => c.query.includes("issues(filter"))).toBe(true);
    expect(calls.some((c) => c.query.includes("issue(id: $v)"))).toBe(false);
  });

  it("--blocked-by inverts direction (B blocks A)", async () => {
    await linkDependencies("GUA-5", { blockedBy: ["GUA-6"] });
    const rel = calls.find((c) => c.query.includes("issueRelationCreate("))!;
    const input = rel.variables.input as Record<string, unknown>;
    expect(input.type).toBe("blocks");
    expect(input.issueId).toBe("uuid-GUA-6");
    expect(input.relatedIssueId).toBe("uuid-GUA-5");
  });

  it("rejects self-links before any call", async () => {
    await expect(linkDependencies("GUA-5", { blocks: ["GUA-5"] })).rejects.toThrow(/itself/);
    expect(calls.filter((c) => c.query.includes("issueRelationCreate("))).toHaveLength(0);
  });

  it("rejects non-canonical alias references before any network call", async () => {
    await expect(linkDependencies("S0", { blocks: ["GUA-6"] })).rejects.toThrow(/Non-canonical/);
    await expect(linkDependencies("GUA-5", { blocks: ["R1"] })).rejects.toThrow(/Non-canonical/);
    expect(calls.filter((c) => c.query.includes("issueRelationCreate("))).toHaveLength(0);
  });
});

describe("GOS-41 native relation removal (unlink)", () => {
  it("--blocked-by deletes the B blocks A relation (inverse of link)", async () => {
    // source GUA-5 is blocked by GUA-6  <=>  relation issue=uuid-GUA-6 related=uuid-GUA-5
    stubRelations = [
      { id: "rel-1", type: "blocks", issue: { id: "uuid-GUA-6" }, relatedIssue: { id: "uuid-GUA-5" } },
    ];
    await unlinkDependencies("GUA-5", { blockedBy: ["GUA-6"] });
    const relProbe = calls.filter((c) => c.query.includes("relations { nodes"));
    expect(relProbe).toHaveLength(1);
    expect(relProbe[0].variables.id).toBe("uuid-GUA-5");
    const del = calls.find((c) => c.query.includes("issueRelationDelete("))!;
    expect(del.variables.id).toBe("rel-1");
  });

  it("--blocks deletes the A blocks B relation", async () => {
    stubRelations = [
      { id: "rel-2", type: "blocks", issue: { id: "uuid-GUA-5" }, relatedIssue: { id: "uuid-GUA-6" } },
    ];
    await unlinkDependencies("GUA-5", { blocks: ["GUA-6"] });
    const del = calls.find((c) => c.query.includes("issueRelationDelete("))!;
    expect(del.variables.id).toBe("rel-2");
  });

  it("deletes nothing when the requested edge is absent (classified error, no mutation)", async () => {
    stubRelations = [];
    await expect(unlinkDependencies("GUA-5", { blockedBy: ["GUA-6"] }))
      .rejects.toThrow(/No "blocks" relation to remove/);
    expect(calls.some((c) => c.query.includes("issueRelationDelete("))).toBe(false);
  });

  it("rejects self-unlink before any probe", async () => {
    await expect(unlinkDependencies("GUA-5", { blockedBy: ["GUA-5"] }))
      .rejects.toThrow(/itself/);
    expect(calls.some((c) => c.query.includes("relations { nodes"))).toBe(false);
  });

  it("rejects non-canonical refs before any probe", async () => {
    await expect(unlinkDependencies("S0", { blockedBy: ["GUA-6"] }))
      .rejects.toThrow(/Non-canonical/);
    await expect(unlinkDependencies("GUA-5", { blockedBy: ["R1"] }))
      .rejects.toThrow(/Non-canonical/);
    expect(calls.some((c) => c.query.includes("relations { nodes"))).toBe(false);
  });
});

describe("GOS-25 auth loading", () => {
  it("loadToken prefers the environment variable", () => {
    expect(loadToken()).toBe("test-key");
  });

  it("loadToken fails with a canonical message (no secret) when unset", () => {
    vi.stubEnv("LINEAR_API_KEY", "");
    vi.stubEnv("LINEAR_TOKEN", "");
    expect(findRepoRoot("/any")).toBe("/nonexistent-root"); // mock active
    expect(() => loadToken()).toThrow(/LINEAR_API_KEY/);
    expect(() => loadToken()).not.toThrow(/test-key|lin_api/);
  });

  it("anchors the .env lookup to the checkout, not process.cwd()", () => {
    vi.stubEnv("LINEAR_API_KEY", "");
    vi.stubEnv("LINEAR_TOKEN", "");
    const probes: (string | undefined)[] = [];
    vi.mocked(findRepoRoot).mockImplementationOnce((startDir?: string) => {
      probes.push(startDir);
      return "/nonexistent-root";
    });
    const cwdBefore = process.cwd();
    try {
      process.chdir(tmpdir());
      expect(() => loadToken()).toThrow(/LINEAR_API_KEY/);
    } finally {
      process.chdir(cwdBefore);
    }
    expect(probes).toHaveLength(1);
    expect(probes[0]).toBeTypeOf("string");
    expect(probes[0] as string).toContain(".guava-os");
  });
});