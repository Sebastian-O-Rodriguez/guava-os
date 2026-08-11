import { describe, it, expect } from "vitest";
import { resolveRegistryProjectId, type RegistryProject } from "../src/registry.js";

const FIXTURE: RegistryProject[] = [
  { id: "guava-os", linearProject: "guava-os" },
  { id: "guavabi", linearProject: "guava-bi" },
  { id: "reusable-diagnostic-engine", linearProject: "Reusable Diagnostic Engine v1" },
  { id: "bell-diagnostic", linearProject: "bell-diagnostic" },
  // Entry with no linear_project — resolved only by id fallback
  { id: "standalone", name: "Standalone Project" },
];

describe("resolveRegistryProjectId", () => {
  it("resolves guava-bi to guavabi via linear_project", () => {
    expect(resolveRegistryProjectId("guava-bi", FIXTURE)).toBe("guavabi");
  });

  it("falls back to id match when no linear_project matches", () => {
    // "guava-os" is both an id and a linear_project — but linear match takes precedence.
    // Use "standalone" which has no linear_project, so the id fallback path is exercised.
    expect(resolveRegistryProjectId("standalone", FIXTURE)).toBe("standalone");
  });

  it("throws a clear error for an unregistered project", () => {
    expect(() => resolveRegistryProjectId("nonexistent", FIXTURE)).toThrow(
      /Unregistered Linear project "nonexistent"/,
    );
  });
});
