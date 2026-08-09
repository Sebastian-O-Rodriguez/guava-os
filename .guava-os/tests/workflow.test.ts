import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { loadConfig, findRepoRoot } from "../src/config.js";
import { generateSprint, approveSprint } from "../src/sprint.js";
import type { LinearIssue } from "../src/linear.js";
import { plan } from "../src/workflow.js";

const config = loadConfig(findRepoRoot());
const repoRoot = findRepoRoot();

function issue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    title: "Task",
    status: "Todo",
    statusType: "unstarted",
    priority: { value: 2, name: "High" },
    labels: [],
    project: "guava-os",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    canceledAt: null,
    description: "",
    ...overrides,
  };
}

// Real registered project in the dev registry: guava-os -> dev repo.
const REGISTRY = resolve(repoRoot, ".guava-os", "registry", "projects.yml");

describe("GOS-27 workflow plan integration", () => {
  const stateHome = mkdtempSync(join(tmpdir(), "gos-state-"));
  const dir = mkdtempSync(join(tmpdir(), "gos-wf-"));
  const docFile = join(dir, "sprint.json");
  let prevState: string | undefined;
  let prevRegistry: string | undefined;

  beforeAll(() => {
    prevState = process.env.GORP_STATE_HOME;
    prevRegistry = process.env.GORP_PROJECT_REGISTRY;
    process.env.GORP_STATE_HOME = stateHome;
    process.env.GORP_PROJECT_REGISTRY = REGISTRY;

    const parent = "parent-wf";
    const issues: LinearIssue[] = [
      issue({ id: parent, title: "Sprint", labels: [] }),
      issue({
        id: "wf-a",
        title: "Write docs",
        parentId: parent,
        labels: ["backend"],
        description:
          "## Acceptance criteria\n- docs/one.md exists\n\n## Scope\nallowedPaths: [\"docs/**\"]\nforbiddenPaths: []",
      }),
      issue({
        id: "wf-b",
        title: "Pipeline",
        parentId: parent,
        labels: ["architect"],
        description: "## Acceptance criteria\n- pipeline runs\n",
      }),
    ];
    // wf-a blocks wf-b — native dependency survives into the graph
    issues.find((i) => i.id === "wf-a")!.blocks = ["wf-b"];
    const res = generateSprint(issues, parent, "guava-os", config);
    expect(res.excludedBlocked.map((i) => i.id)).toEqual(["wf-b"]);
    writeFileSync(docFile, JSON.stringify(res.doc, null, 2));
    approveSprint(docFile, "operator:test");
  });

  afterAll(() => {
    if (prevState !== undefined) process.env.GORP_STATE_HOME = prevState;
    else delete process.env.GORP_STATE_HOME;
    if (prevRegistry !== undefined) process.env.GORP_PROJECT_REGISTRY = prevRegistry;
    else delete process.env.GORP_PROJECT_REGISTRY;
    rmSync(stateHome, { recursive: true, force: true });
    rmSync(dir, { recursive: true, force: true });
  });

  it("wf plan compiles the approved SprintDocument through the tsx path", () => {
    expect(existsSync(REGISTRY)).toBe(true);
    const result = plan(docFile) as {
      success: boolean;
      ids?: { graphId: string; projectId: string };
      data?: { status: string; approvalStatus: string; nodes: unknown[] };
      error?: unknown;
    };
    expect(result.success).toBe(true);
    expect(result.ids?.projectId).toBe("guava-os");
    expect(result.ids?.graphId).toBeTruthy();
    expect(result.data?.status).toBe("draft");

    // Graph persisted under the ISOLATED dev state home — production state untouched
    const graphPath = join(stateHome, "projects", "guava-os", "graphs", `${result.ids!.graphId}.json`);
    expect(existsSync(graphPath)).toBe(true);
    const graph = JSON.parse(readFileSync(graphPath, "utf-8"));
    // The blocked issue never entered the graph; the free task did with its AC.
    const nodeIds = graph.nodes.map((n: { nodeId: string }) => n.nodeId);
    expect(nodeIds).toContain("wf-a");
    expect(nodeIds).not.toContain("wf-b");
  });

  it("draft graph refuses to run without operator approval (explicit human gate)", () => {
    const result = plan(docFile, { overwrite: true }) as { data?: { approvalStatus: string } };
    expect(result.data?.approvalStatus).toBe("unapproved");
  });
});