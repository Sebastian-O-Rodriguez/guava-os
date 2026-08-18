import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePersona, personaEnv } from "../src/persona.js";

let root: string;

function writePersona(name: string, content: string): void {
  const dir = join(root, ".guava-os", "personas", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "persona.md"), content, "utf8");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "guava-os-persona-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("resolvePersona", () => {
  it("parses persona.md: model from frontmatter, body as the system prompt", () => {
    writePersona(
      "backend",
      [
        "---",
        "name: backend",
        "description: Implements API routes",
        "maps_to: task",
        "model: default",
        "tools: [read, edit]",
        "---",
        "",
        "# Backend",
        "",
        "## Scope",
        "",
        "Implement backend logic.",
        "",
      ].join("\n"),
    );

    const resolved = resolvePersona("backend", root);
    expect(resolved.name).toBe("backend");
    expect(resolved.model).toBe("default");
    expect(resolved.systemPrompt).toContain("# Backend");
    expect(resolved.systemPrompt).toContain("Implement backend logic.");
    expect(resolved.tools).toEqual(["read", "edit"]);
  });

  it("emits GORP_OMP_TOOLS when the persona declares a tool allowlist", () => {
    writePersona("backend", "---\nname: backend\nmodel: default\ntools: [read, grep, glob, bash, edit, write]\n---\n\nBackend body.\n");
    expect(personaEnv(resolvePersona("backend", root))).toEqual({
      GORP_OMP_MODEL: "default",
      GORP_OMP_SYSTEM_PROMPT_APPEND: "Backend body.",
      GORP_OMP_TOOLS: "read,grep,glob,bash,edit,write",
    });
  });

  it("maps a resolved persona to the GORP_OMP_* env the omp adapter reads", () => {
    writePersona("architect", "---\nname: architect\nmodel: slow\n---\n\nArchitect body.\n");
    expect(personaEnv(resolvePersona("architect", root))).toEqual({
      GORP_OMP_MODEL: "slow",
      GORP_OMP_SYSTEM_PROMPT_APPEND: "Architect body.",
    });
  });

  it("errors when the persona file is missing", () => {
    expect(() => resolvePersona("missing", root)).toThrow(/persona 'missing' not found/);
  });

  it("errors when the persona has no model tier", () => {
    writePersona("nomodel", "---\nname: nomodel\n---\n\nBody.\n");
    expect(() => resolvePersona("nomodel", root)).toThrow(/no model tier/);
  });

  it("errors when the persona body is empty", () => {
    writePersona("emptybody", "---\nname: emptybody\nmodel: default\n---\n");
    expect(() => resolvePersona("emptybody", root)).toThrow(/empty body/);
  });
});
