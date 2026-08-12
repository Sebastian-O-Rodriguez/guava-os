import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateAgainst, loadSchema, type SchemaName } from "../src/contracts/validator.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "..", "fixtures");
const SCHEMAS: SchemaName[] = [
  "execution-graph",
  "worker-result",
  "gate-record",
  "run-record",
  "review-decision",
  "promotion-record",
  "sprint",
];
const FORBIDDEN_TERMS = ["linear", "hermes", "claude code", "claude-code", "openrouter", "tmux"];

function readFixture(rel: string): unknown {
  return JSON.parse(readFileSync(join(FIX, rel), "utf8")) as unknown;
}

describe("contracts: schema self-load", () => {
  for (const name of SCHEMAS) {
    it(`${name} loads and compiles`, () => {
      const schema = loadSchema(name) as Record<string, unknown>;
      expect(schema["$schema"]).toContain("json-schema.org");
      // compiling by validating an empty object exercises ajv.compile
      const r = validateAgainst(name, {});
      expect(typeof r.valid).toBe("boolean");
    });
  }
});

describe("contracts: source-neutral terminology audit", () => {
  for (const name of SCHEMAS) {
    it(`${name} contains no provider/legacy terms`, () => {
      const raw = readFileSync(
        join(HERE, "..", "..", "..", "specs", "runtime", `${name}.schema.json`),
        "utf8",
      ).toLowerCase();
      for (const term of FORBIDDEN_TERMS) {
        expect(raw.includes(term), `${name} must not contain "${term}"`).toBe(false);
      }
    });
  }
});

describe("contracts: positive fixtures validate", () => {
  const positives: Array<[SchemaName, string]> = [
    ["execution-graph", "execution-graph/positive.single-node.json"],
    ["execution-graph", "execution-graph/positive.multi-node-schema-valid.json"],
    ["worker-result", "worker-result/positive.succeeded.json"],
    ["gate-record", "gate-record/positive.pending.json"],
    ["run-record", "run-record/positive.minimal.json"],
    ["review-decision", "review-decision/positive.approved.json"],
    ["promotion-record", "promotion-record/positive.promoted.json"],
    ["sprint", "sprint/positive.two-task.json"],
  ];
  for (const [schema, rel] of positives) {
    it(`${rel} is schema-valid`, () => {
      const r = validateAgainst(schema, readFixture(rel));
      expect(r.issues).toEqual([]);
      expect(r.valid).toBe(true);
    });
  }
});

describe("contracts: negative fixtures fail for the intended reason", () => {
  it("missing required field (project) fails on 'required'", () => {
    const r = validateAgainst("execution-graph", readFixture("execution-graph/negative.missing-project.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "required")).toBe(true);
  });

  it("unknown critical field is rejected (additionalProperties)", () => {
    const r = validateAgainst("execution-graph", readFixture("execution-graph/negative.unknown-field.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "additionalProperties")).toBe(true);
  });

  it("bad status enum fails on 'enum'", () => {
    const r = validateAgainst("execution-graph", readFixture("execution-graph/negative.bad-status-enum.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "enum")).toBe(true);
  });

  it("bad graphId pattern fails on 'pattern'", () => {
    const r = validateAgainst("execution-graph", readFixture("execution-graph/negative.bad-graphid.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "pattern")).toBe(true);
  });

  it("worker-result bad outcome fails on 'enum'", () => {
    const r = validateAgainst("worker-result", readFixture("worker-result/negative.bad-outcome.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "enum")).toBe(true);
  });

  it("gate-record bad review status fails on 'enum'", () => {
    const r = validateAgainst("gate-record", readFixture("gate-record/negative.bad-review-status.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "enum")).toBe(true);
  });

  it("run-record missing governanceVersion fails on 'required'", () => {
    const r = validateAgainst("run-record", readFixture("run-record/negative.missing-governance.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "required")).toBe(true);
  });

  it("review-decision bad decision fails on 'enum'", () => {
    const r = validateAgainst("review-decision", readFixture("review-decision/negative.bad-decision.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "enum")).toBe(true);
  });

  it("sprint with retries fails on 'const' (no retries exist)", () => {
    const r = validateAgainst("sprint", readFixture("sprint/negative.retries.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "const")).toBe(true);
  });

  it("promotion-record missing decision link fails on 'required'", () => {
    const r = validateAgainst("promotion-record", readFixture("promotion-record/negative.missing-decision-link.json"));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "required")).toBe(true);
  });
});

describe("contracts: every fixture directory has positive and negative coverage", () => {
  it("all seven schemas have fixtures", () => {
    for (const name of SCHEMAS) {
      const files = readdirSync(join(FIX, name));
      expect(files.some((f) => f.startsWith("positive")), `${name} needs a positive fixture`).toBe(true);
      expect(files.some((f) => f.startsWith("negative")), `${name} needs a negative fixture`).toBe(true);
    }
  });
});

describe("contracts: optional persona/profile fields validate (GUA-123)", () => {
  it("sprint: task with persona validates", () => {
    const sprint = readFixture("sprint/positive.two-task.json") as Record<string, unknown>;
    const tasks = sprint["tasks"] as Array<Record<string, unknown>>;
    tasks[0]["persona"] = "architect";
    const r = validateAgainst("sprint", sprint);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("execution-graph: node with persona validates", () => {
    const graph = readFixture("execution-graph/positive.single-node.json") as Record<string, unknown>;
    const nodes = graph["nodes"] as Array<Record<string, unknown>>;
    nodes[0]["persona"] = "architect";
    const r = validateAgainst("execution-graph", graph);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("run-record: record with profile validates", () => {
    const record = readFixture("run-record/positive.minimal.json") as Record<string, unknown>;
    record["profile"] = { persona: "architect", model: "claude-sonnet-4-20250514" };
    const r = validateAgainst("run-record", record);
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("run-record: profile with extra fields is rejected (additionalProperties)", () => {
    const record = readFixture("run-record/positive.minimal.json") as Record<string, unknown>;
    record["profile"] = { persona: "architect", model: "default", extra: "nope" };
    const r = validateAgainst("run-record", record);
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => i.keyword === "additionalProperties")).toBe(true);
  });
});
