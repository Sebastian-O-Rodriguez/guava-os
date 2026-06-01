import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";
import { readFileSync } from "fs";

const CLI = resolve(__dirname, "../src/cli.ts");
const FIXTURES = resolve(__dirname, "../fixtures");
const REPO_ROOT = resolve(__dirname, "../..");

function run(args: string, stdin?: string): { stdout: string; exitCode: number } {
  try {
    const result = execSync(`npx tsx ${CLI} ${args}`, {
      cwd: REPO_ROOT,
      input: stdin,
      encoding: "utf-8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result, exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout || "", exitCode: err.status ?? 1 };
  }
}

function fixture(name: string): string {
  return readFileSync(resolve(FIXTURES, name), "utf-8");
}

// ──────────────────────────────────────────────────────────────────
// doctor
// ──────────────────────────────────────────────────────────────────

describe("doctor smoke", () => {
  it("runs without stdin and reports checks", () => {
    const { stdout } = run("doctor");
    expect(stdout).toContain("DOCTOR");
    expect(stdout).toContain("config");
    expect(stdout).toContain("RESULT:");
  });

  it("returns JSON with --json", () => {
    const { stdout } = run("doctor --json");
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]).toHaveProperty("name");
    expect(parsed[0]).toHaveProperty("passed");
    expect(parsed[0]).toHaveProperty("detail");
  });
});

// ──────────────────────────────────────────────────────────────────
// status
// ──────────────────────────────────────────────────────────────────

describe("status smoke", () => {
  it("shows executable queue from clean fixture", () => {
    const { stdout, exitCode } = run("status", fixture("clean.json"));
    expect(stdout).toContain("EXECUTABLE");
    expect(stdout).toContain("PARENTS");
    expect(stdout).toContain("SUMMARY:");
    expect(exitCode).toBe(0);
  });

  it("returns JSON with --json", () => {
    const { stdout, exitCode } = run("status --json", fixture("clean.json"));
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("executable");
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("capabilities");
    expect(exitCode).toBe(0);
  });

  it("exits 1 when no executable work", () => {
    // warnings fixture has no Todo sub-issues under active parents
    const { exitCode } = run("status", fixture("warnings.json"));
    // TST-20 is Todo under In Progress parent with backend label — this IS executable
    // So we use errors fixture where parent is Backlog
    const { exitCode: errExit } = run("status", fixture("errors.json"));
    expect(errExit).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// validate
// ──────────────────────────────────────────────────────────────────

describe("validate smoke", () => {
  it("exits 0 on clean fixture", () => {
    const { stdout, exitCode } = run("validate", fixture("clean.json"));
    expect(stdout).toContain("no violations found");
    expect(exitCode).toBe(0);
  });

  it("exits 0 on warning-only fixture (default mode)", () => {
    const { stdout, exitCode } = run("validate", fixture("warnings.json"));
    expect(stdout).toContain("WARNINGS");
    expect(stdout).toContain("0 errors");
    expect(exitCode).toBe(0);
  });

  it("exits 1 on error fixture", () => {
    const { stdout, exitCode } = run("validate", fixture("errors.json"));
    expect(stdout).toContain("ERRORS");
    expect(exitCode).toBe(1);
  });

  it("returns valid JSON with --json", () => {
    const { stdout } = run("validate --json", fixture("errors.json"));
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("summary");
    expect(parsed).toHaveProperty("violations");
    expect(parsed.summary).toHaveProperty("errors");
    expect(parsed.summary).toHaveProperty("warnings");
    expect(parsed.summary).toHaveProperty("total");
    expect(Array.isArray(parsed.violations)).toBe(true);
    if (parsed.violations.length > 0) {
      expect(parsed.violations[0]).toHaveProperty("code");
      expect(parsed.violations[0]).toHaveProperty("name");
      expect(parsed.violations[0]).toHaveProperty("severity");
      expect(parsed.violations[0]).toHaveProperty("issue_id");
      expect(parsed.violations[0]).toHaveProperty("detail");
    }
  });

  it("--strict exits 1 on warning-only fixture", () => {
    const { exitCode } = run("validate --strict", fixture("warnings.json"));
    expect(exitCode).toBe(1);
  });

  it("--strict exits 0 on clean fixture", () => {
    const { exitCode } = run("validate --strict", fixture("clean.json"));
    expect(exitCode).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// CLI boundary
// ──────────────────────────────────────────────────────────────────

describe("CLI boundary", () => {
  it("unknown command exits 1", () => {
    const { exitCode } = run("bogus");
    expect(exitCode).toBe(1);
  });

  it("--help exits 0", () => {
    const { stdout, exitCode } = run("--help");
    expect(stdout).toContain("Commands:");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("status");
    expect(stdout).toContain("validate");
    expect(exitCode).toBe(0);
  });

  it("status --help exits 0", () => {
    const { stdout, exitCode } = run("status --help");
    expect(stdout).toContain("Commands:");
    expect(exitCode).toBe(0);
  });

  it("validate --help exits 0", () => {
    const { stdout, exitCode } = run("validate --help");
    expect(stdout).toContain("Commands:");
    expect(exitCode).toBe(0);
  });

  it("doctor --help exits 0", () => {
    const { stdout, exitCode } = run("doctor --help");
    expect(stdout).toContain("Commands:");
    expect(exitCode).toBe(0);
  });

  it("status without stdin exits 1", () => {
    const { exitCode } = run("status");
    expect(exitCode).toBe(1);
  });

  it("validate without stdin exits 1", () => {
    const { exitCode } = run("validate");
    expect(exitCode).toBe(1);
  });
});
