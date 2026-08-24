import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const INJECT_SCRIPT = resolve(import.meta.dirname, "../../manual/scripts/inject.mjs");
const SAMPLE_TASK = resolve(import.meta.dirname, "../../manual/tasks/GUA-101.json");

describe("Context Injector (inject.mjs)", () => {
  it("compiles a complete task context from task payload JSON file", () => {
    const output = execFileSync("node", [INJECT_SCRIPT, SAMPLE_TASK], {
      encoding: "utf-8",
    });

    // 1. Task contract
    expect(output).toContain("# TASK CONTRACT");
    expect(output).toContain("role: task");
    expect(output).toContain("domain: backend");
    expect(output).toContain("issue: GUA-101");
    expect(output).toContain("Analytics dashboard requires DAU.");

    // 2. Routing decision tree
    expect(output).toContain("# ROUTING");
    expect(output).toContain("backend: What kind of backend work?");
    expect(output).toContain("new / changed API → api-design → python-backend");

    // 3. Small stable core (pulled from engineering-principles)
    expect(output).toContain("# ENGINEERING INVARIANTS");
    expect(output).toContain("- Stay inside contracted scope.");
    expect(output).toContain("- Follow existing repository patterns.");
    expect(output).toContain("- Never fabricate test or command results.");

    // 4. Execution protocol
    expect(output).toContain("# EXECUTION PROTOCOL");
    expect(output).toContain("1. Inspect relevant implementation and tests.");
    expect(output).toContain("6. Commit only task-related changes.");

    // 5. Activated guidance (short bullets, not full markdown manual)
    expect(output).toContain("# ACTIVATED GUIDANCE");
    expect(output).toContain("api-design:");
    expect(output).toContain("- preserve existing API conventions");
    expect(output).toContain("sql-postgres:");
    expect(output).toContain("- follow the existing DB abstraction");

    // 6. Progressive retrieval skills (skill:// pointers + load_when)
    expect(output).toContain("# AVAILABLE SKILLS");
    expect(output).toContain("path: skill://api-design");
    expect(output).toContain("load_when: deeper API semantics are required");
    expect(output).toContain("path: skill://sql-postgres");

    // 7. Completion contract
    expect(output).toContain("# COMPLETION CONTRACT");
    expect(output).toContain("- acceptance criterion → evidence");
    expect(output).toContain("- verification commands + results");
    expect(output).toContain("- commit SHA");
  });

  it("compiles task context via stdin stream", () => {
    const taskPayload = readFileSync(SAMPLE_TASK, "utf-8");
    const output = execFileSync("node", [INJECT_SCRIPT], {
      input: taskPayload,
      encoding: "utf-8",
    });

    expect(output).toContain("# TASK CONTRACT");
    expect(output).toContain("# ENGINEERING INVARIANTS");
    expect(output).toContain("# AVAILABLE SKILLS");
  });

  it("dynamically adapts routing and guidance for other domains", () => {
    const devopsTask = JSON.stringify({
      role: "task",
      domain: "devops",
      issue: "GUA-202",
      why: "Deploy staging pipeline",
      scope: ["Add GitHub Actions workflow"],
      out_of_scope: ["Production deployment"],
      acceptance: ["CI passes on pull request"],
    });

    const output = execFileSync("node", [INJECT_SCRIPT], {
      input: devopsTask,
      encoding: "utf-8",
    });

    expect(output).toContain("domain: devops");
    expect(output).toContain("devops: What kind of DevOps work?");
    expect(output).toContain("ci-cd:");
    expect(output).toContain("path: skill://ci-cd");
    expect(output).toContain("path: skill://terraform");
    expect(output).not.toContain("sql-postgres:");
  });
});
