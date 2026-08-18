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

  it("treats an absent tools field as the full/default tool set (no GORP_OMP_TOOLS)", () => {
    writePersona("notools", "---\nname: notools\nmodel: default\n---\n\nBody.\n");
    const env = personaEnv(resolvePersona("notools", root));
    expect(env.GORP_OMP_TOOLS).toBeUndefined();
    expect(env).toEqual({ GORP_OMP_MODEL: "default", GORP_OMP_SYSTEM_PROMPT_APPEND: "Body." });
  });

  it("fails closed on an empty tools list (no accidental full-catalog fallback)", () => {
    writePersona("empty", "---\nname: empty\nmodel: default\ntools: []\n---\n\nBody.\n");
    expect(() => resolvePersona("empty", root)).toThrow(/empty tools/);
  });

  it("fails closed on an unknown tool name", () => {
    writePersona("bad", "---\nname: bad\nmodel: default\ntools: [read, notatool]\n---\n\nBody.\n");
    expect(() => resolvePersona("bad", root)).toThrow(/unknown tool.*notatool/);
  });

  it("parses the block-list tools form (canonical)", () => {
    writePersona(
      "block",
      ["---", "name: block", "model: default", "tools:", "  - read", "  - grep", "---", "", "Body."].join("\n"),
    );
    expect(resolvePersona("block", root).tools).toEqual(["read", "grep"]);
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