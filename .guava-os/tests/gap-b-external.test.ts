import { describe, it, expect } from "vitest";
import { buildGraph, type LinearIssue } from "../src/linear.js";
import { formatStatus, formatStatusJson } from "../src/status.js";
import { generateNext, formatNext } from "../src/next.js";
import { runValidate } from "../src/validate.js";
import type { Config } from "../src/config.js";

const TEST_CONFIG: Config = {
  linear: { team: "Test", project: "TestProject", issue_prefix: "TST" },
  personas: ["architect", "backend", "frontend", "qa"],
  statuses: {
    backlog: "Backlog", todo: "Todo", in_progress: "In Progress",
    in_review: "In Review", done: "Done",
  },
  active_parent_statuses: ["Todo", "In Progress"],
  labels: { persona_labels: ["architect", "backend", "frontend"], qa_label: "qa" },
  invariants: {
    max_todo_per_persona: 3, stale_hours: 48, reclaim_limit: 2,
    bulk_threshold: 5, max_subtasks_per_parent: 3,
  },
  branch_pattern: "feat/{prefix}-{id}-{slug}",
  process_files: {},
  manifest_path: ".guava-os/manifest.json",
};

function makeIssue(overrides: Partial<LinearIssue> & { id: string }): LinearIssue {
  return {
    id: overrides.id,
    identifier: overrides.identifier ?? overrides.id,
    title: overrides.id,
    status: "Todo",
    statusType: "unstarted",
    priority: { value: 2, name: "High" },
    labels: [],
    project: "TestProject",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    completedAt: null,
    canceledAt: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// GOS-36 (Gap B): External blocker visibility
// ═══════════════════════════════════════════════════════════════════

describe("GOS-36: reproduction — out-of-snapshot blocker → false-ready", () => {
  it("classifies an in-snapshot issue as executable when blocked by an out-of-snapshot issue (false-ready)", () => {
    // Issue B is in the snapshot. External issue E (not in snapshot) blocks B.
    // B has blocks = [] (no outgoing edges). No one in the snapshot blocks B.
    // B has Todo status with persona label — looks fully eligible.
    // Today: B → executable (false-ready). The graph CANNOT see the
    // external blocker because the edge goes E.blocks = [B.id] and E
    // isn't in the dataset.
    const parent = makeIssue({
      id: "TST-PARENT", title: "Parent", labels: [],
      status: "Todo", statusType: "unstarted",
    });
    const b = makeIssue({
      id: "TST-B", title: "B (blocked externally)",
      labels: ["backend"], parentId: "TST-PARENT",
      blocks: [], // B blocks nothing in snapshot
    });
    // A blocks B (in-snapshot relation — proves relations ARE loaded)
    const a = makeIssue({
      id: "TST-A", title: "A blocks B",
      labels: ["backend"], parentId: "TST-PARENT",
      blocks: ["TST-B"],
    });

    const graph = buildGraph([parent, a, b], TEST_CONFIG);

    // A blocks B, so B is correctly blocked by A (in-snapshot detection works).
    // But B is ALSO blocked by external E — which is INVISIBLE.
    // After A resolves, B becomes executable despite external E blocking it.
    // This test verifies the graph's limitation: once the in-snapshot
    // blocker clears, the external gap remains.

    // With both A and B present, A blocks B → B is blocked (dataset-internal).
    const aQueue = graph.executable.get("backend")!;
    expect(aQueue.map((s) => s.id)).toEqual(["TST-A"]); // only A executable
    expect(graph.blocked.some((b) => b.id === "TST-B")).toBe(true);
    expect(graph.blocked.find((b) => b.id === "TST-B")!.reason).toContain("A blocks B");
    // capability flag: relations loaded, gap exists
    expect(graph.capabilities.dependencyRelationsLoaded).toBe(true);
    expect(graph.capabilities.hasExternalBlockerGap).toBe(true);

    // Now: mark A as completed. B should become executable (internal blocker
    // resolved), BUT external E might still block B — we can't see it.
    // This IS the false-ready scenario: B → executable despite possible
    // external blocker.
    const aDone = makeIssue({
      id: "TST-A", title: "A blocks B (done)",
      labels: ["backend"], parentId: "TST-PARENT",
      status: "Done", statusType: "completed",
      blocks: ["TST-B"], // blocks edge still present but A is completed
    });
    const graph2 = buildGraph([parent, aDone, b], TEST_CONFIG);

    // B is now executable (internal blocker resolved)
    const bQueue = graph2.executable.get("backend")!;
    expect(bQueue.map((s) => s.id)).toEqual(["TST-B"]);
    expect(graph2.blocked).toEqual([]);

    // The gap flag is STILL true — we cannot prove B isn't externally blocked
    expect(graph2.capabilities.hasExternalBlockerGap).toBe(true);
    // This IS the false-ready: B is executable despite unknown external blockers
    expect(graph2.summary.totalExecutable).toBe(1);
  });
});

describe("GOS-36: capability flag — hasExternalBlockerGap", () => {
  it("is true when dependency relations are loaded (snapshot is partial)", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"], // has blocks edges → relations loaded
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    expect(g.capabilities.dependencyRelationsLoaded).toBe(true);
    expect(g.capabilities.hasExternalBlockerGap).toBe(true);
  });

  it("is false when no relation data was loaded", () => {
    const a = makeIssue({ id: "TST-1", labels: ["backend"] });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    expect(g.capabilities.dependencyRelationsLoaded).toBe(false);
    expect(g.capabilities.hasExternalBlockerGap).toBe(false);
  });
});

describe("GOS-36: status banner", () => {
  it("formatStatus prints external blocker gap note when executables + gap exist", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"], // triggers relations loaded
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    // a is executable (blocks b → b is blocked, a is free)
    expect(g.summary.totalExecutable).toBeGreaterThan(0);

    const out = formatStatus(g);
    expect(out).toContain("EXECUTABLE");
    expect(out).toContain("NOTE: External blockers may exist outside the snapshot");
  });

  it("formatStatus omits gap note when no executables exist", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    // Remove b from executable (it's blocked) — but a IS executable.
    // To have zero executables, use a scenario where all are blocked.
    // Actually: a blocks b, a is executable → totalExecutable > 0.
    // Let's test: a blocks b, a is completed → b is executable.
    // We want no executable → make a and b both completed.

    const aDone = makeIssue({
      id: "TST-1", labels: ["backend"],
      status: "Done", statusType: "completed",
      blocks: ["TST-2"],
    });
    const bDone = makeIssue({
      id: "TST-2", labels: ["backend"],
      status: "Done", statusType: "completed",
    });

    const g2 = buildGraph([aDone, bDone], TEST_CONFIG);
    // Both completed, but aDone has blocks → dependencyRelationsLoaded=true,
    // hasExternalBlockerGap=true, but totalExecutable=0.
    expect(g2.summary.totalExecutable).toBe(0);
    expect(g2.capabilities.hasExternalBlockerGap).toBe(true);

    const out = formatStatus(g2);
    expect(out).not.toContain("NOTE: External blockers may exist");
  });

  it("formatStatus includes hasExternalBlockerGap in JSON output", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    const json = formatStatusJson(g) as Record<string, unknown>;
    const caps = json.capabilities as Record<string, unknown>;
    expect(caps.hasExternalBlockerGap).toBe(true);
    expect(caps.dependencyRelationsLoaded).toBe(true);
  });
});

describe("GOS-36: next context and format", () => {
  it("buildContext includes external blocker warning when gap exists", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    const result = generateNext(g, TEST_CONFIG);

    // Context should include the external blocker note
    const allContexts = result.directives.flatMap((d) => d.context);
    expect(allContexts.some((c) => c.includes("external blockers may exist"))).toBe(true);
  });

  it("formatNext prints external blocker gap banner when directives exist", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    const result = generateNext(g, TEST_CONFIG);
    const out = formatNext(result);

    expect(out).toContain("NOTE: External blockers may exist outside the snapshot");
  });

  it("formatNext omits banner when no directives (no executable work)", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      status: "Done", statusType: "completed",
      blocks: ["TST-2"],
    });
    const b = makeIssue({
      id: "TST-2", labels: ["backend"],
      status: "Done", statusType: "completed",
    });

    const g = buildGraph([a, b], TEST_CONFIG);
    const result = generateNext(g, TEST_CONFIG);
    const out = formatNext(result);

    expect(result.directives.length).toBe(0);
    expect(out).not.toContain("NOTE: External blockers may exist");
  });
});

describe("GOS-36: validate violation V307", () => {
  it("emits V307 when external blocker gap exists and executables present", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    const result = runValidate(g, [a, b], TEST_CONFIG);

    const v = result.violations.find((v) => v.code === "V307");
    expect(v).toBeDefined();
    expect(v!.severity).toBe("warning");
    expect(v!.name).toBe("external_blocker_gap");
    expect(v!.detail).toContain("may be blocked by issues outside this dataset");
  });

  it("does not emit V307 when no executables (even if gap flag is true)", () => {
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      status: "Done", statusType: "completed",
      blocks: ["TST-2"],
    });
    const b = makeIssue({
      id: "TST-2", labels: ["backend"],
      status: "Done", statusType: "completed",
    });

    const g = buildGraph([a, b], TEST_CONFIG);
    expect(g.capabilities.hasExternalBlockerGap).toBe(true);
    expect(g.summary.totalExecutable).toBe(0);

    const result = runValidate(g, [a, b], TEST_CONFIG);
    const v307 = result.violations.filter((v) => v.code === "V307");
    expect(v307).toHaveLength(0);
  });

  it("does not emit V307 when no relations loaded (no gap to warn about)", () => {
    const a = makeIssue({ id: "TST-1", labels: ["backend"] });
    const g = buildGraph([a], TEST_CONFIG);

    expect(g.capabilities.hasExternalBlockerGap).toBe(false);
    expect(g.summary.totalExecutable).toBe(1);

    const result = runValidate(g, [a], TEST_CONFIG);
    const v307 = result.violations.filter((v) => v.code === "V307");
    expect(v307).toHaveLength(0);
  });
});

describe("GOS-36: executable never silently proceeds with unknown external blocker", () => {
  it("when external blocker gap exists, either hasExternalBlockerGap is true or executable is empty", () => {
    // For every buildGraph output either:
    // (a) hasExternalBlockerGap = true (gap acknowledged) AND executables present → consumer MUST warn
    // (b) totalExecutable = 0 → nothing to warn about
    // (c) hasExternalBlockerGap = false → no gap
    // Never: hasExternalBlockerGap=false AND totalExecutable>0 AND relations loaded.
    // (relations-loaded + executables → gap=true)
    const a = makeIssue({
      id: "TST-1", labels: ["backend"],
      blocks: ["TST-2"],
    });
    const b = makeIssue({ id: "TST-2", labels: ["backend"] });

    const g = buildGraph([a, b], TEST_CONFIG);
    expect(g.capabilities.dependencyRelationsLoaded).toBe(true);
    expect(g.summary.totalExecutable).toBeGreaterThan(0);

    // Invariant: if relations loaded and executables exist, hasExternalBlockerGap MUST be true
    expect(g.capabilities.hasExternalBlockerGap).toBe(true);

    // Consumer-level invariant: when hasExternalBlockerGap=true and executables>0,
    // the status output MUST include the warning banner
    const out = formatStatus(g);
    expect(out).toContain("NOTE: External blockers may exist outside the snapshot");
  });
});