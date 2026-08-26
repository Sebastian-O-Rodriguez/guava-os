import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { resolve } from "path";

const CLI = resolve(__dirname, "../src/cli.ts");
const REPO_ROOT = resolve(__dirname, "../..");

function run(
  args: string,
  stdin?: string,
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${CLI} ${args}`, {
      cwd: REPO_ROOT,
      input: stdin ?? "",
      encoding: "utf-8",
      timeout: 15000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: any) {
    return { stdout: err.stdout ?? "", stderr: err.stderr ?? "", exitCode: err.status ?? 1 };
  }
}

const COMPLETE = [
  "## Why this exists",
  "Canonical issues keep the board executable.",
  "## Scope",
  "pm create --description - enforcement.",
  "## Acceptance criteria",
  "Issues carry a domain label and readiness.",
].join("\n");

describe("pm --description - (stdin body)", () => {
  it("update: '-' with empty stdin errors clearly", () => {
    const { stderr, exitCode } = run("pm update GUA-1 --description -", "");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("pm update --description - requires a body on stdin");
  });

  it("update: '-' with whitespace-only stdin errors clearly", () => {
    const { stderr, exitCode } = run("pm update GUA-1 --description -", "  \n\t  ");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("pm update --description - requires a body on stdin");
  });

  it("create: '-' with empty stdin errors clearly", () => {
    const { stderr, exitCode } = run("pm create --title T --description -", "");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("pm create --description - requires a body on stdin");
  });

  it("create: '-' reads heredoc body as the description (passes heading check, fails label gate before network)", () => {
    const { stderr, exitCode } = run("pm create --title T --description -", `${COMPLETE}\n`);
    expect(exitCode).toBe(1);
    // The heredoc body passed assertCanonicalDescription (no "Missing:"),
    // proving stdin was consumed as `description`; execution stopped at the
    // label gate, before any Linear call.
    expect(stderr).toContain("requires at least one --label matching a configured domain");
    expect(stderr).not.toContain("requires a body on stdin");
    expect(stderr).not.toContain("Missing:");
  });

  it("create: literal --description value (not '-') is left untouched", () => {
    // A literal description value is used as-is; stdin is not consulted.
    const { stderr, exitCode } = run("pm create --title T --description literal-body", "");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Missing:");
    expect(stderr).not.toContain("requires a body on stdin");
  });
});
