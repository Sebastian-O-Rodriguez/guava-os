import { describe, it, expect } from "vitest";
import { parseRoles, loadRoles, resolveWritableRoots, type RoleDef } from "../src/roles.js";
import type { RegistryProject } from "../src/registry.js";

const FIXTURE_YAML = `
# header comment
roles:
  - id: project-agent
    description: Writes only its own project repo.
    writable_roots:
      - self
  - id: gos-agent
    description: Writes guava-os only.
    writable_roots:
      - guava-os
  - id: reviewer
    description: Read and test only.
    writable_roots: []
  - id: operator
    description: The only cross-repo writer.
    writable_roots:
      - "*"
`;

const REGISTRY: RegistryProject[] = [
  { id: "guava-os", repoPath: "/work/guava-os" },
  { id: "bell-diagnostic", repoPath: "/work/bell-diagnostic" },
  { id: "guavabi", repoPath: "/work/guavabi" },
  { id: "guava-hermes", repoPath: "/work/guava-hermes" },
];

describe("parseRoles", () => {
  const roles = parseRoles(FIXTURE_YAML);

  it("parses four roles with their writable-root specifiers", () => {
    expect(roles.map((r) => r.id)).toEqual([
      "project-agent",
      "gos-agent",
      "reviewer",
      "operator",
    ]);
  });

  it("project-agent writes only self", () => {
    expect(roles[0].writableRoots).toEqual(["self"]);
  });

  it("gos-agent writes guava-os only", () => {
    expect(roles[1].writableRoots).toEqual(["guava-os"]);
  });

  it("reviewer has no writable roots", () => {
    expect(roles[2].writableRoots).toEqual([]);
  });

  it("operator writes across all repos (*)", () => {
    expect(roles[3].writableRoots).toEqual(["*"]);
  });

  it("captures descriptions", () => {
    expect(roles[2].description).toMatch(/Read and test only/);
  });

  it("throws when the manifest has zero roles", () => {
    expect(() => parseRoles("roles:\n  # nothing\n")).toThrow(/zero roles/);
  });
});

describe("loadRoles (shipped manifest)", () => {
  it("loads the real roles.yml and maps every role correctly", () => {
    const roles = loadRoles();
    const byId = new Map(roles.map((r) => [r.id, r]));

    expect(byId.get("project-agent")?.writableRoots).toEqual(["self"]);
    expect(byId.get("gos-agent")?.writableRoots).toEqual(["guava-os"]);
    expect(byId.get("reviewer")?.writableRoots).toEqual([]);
    expect(byId.get("operator")?.writableRoots).toEqual(["*"]);
  });
});

describe("resolveWritableRoots", () => {
  const role = (writableRoots: string[]): RoleDef => ({ id: "r", writableRoots });

  it("resolves self to the launched project repo", () => {
    const roots = resolveWritableRoots(role(["self"]), {
      projectRepoPath: "/work/bell-diagnostic",
      registry: REGISTRY,
    });
    expect(roots).toEqual(["/work/bell-diagnostic"]);
  });

  it("resolves a registry id to that project's repo_path", () => {
    const roots = resolveWritableRoots(role(["guava-os"]), { registry: REGISTRY });
    expect(roots).toEqual(["/work/guava-os"]);
  });

  it("resolves * to every registry repo path", () => {
    const roots = resolveWritableRoots(role(["*"]), { registry: REGISTRY });
    expect(roots).toEqual([
      "/work/guava-os",
      "/work/bell-diagnostic",
      "/work/guavabi",
      "/work/guava-hermes",
    ]);
  });

  it("returns [] for a read-only role", () => {
    expect(resolveWritableRoots(role([]), { registry: REGISTRY })).toEqual([]);
  });

  it("throws when self has no resolved project repo", () => {
    expect(() => resolveWritableRoots(role(["self"]), { registry: REGISTRY })).toThrow(
      /no --project repo_path/,
    );
  });

  it("throws when a registry-id root is not registered", () => {
    expect(() => resolveWritableRoots(role(["nope"]), { registry: REGISTRY })).toThrow(
      /not a registered project/,
    );
  });
});
