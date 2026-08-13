import { describe, it, expect } from "vitest";
import {
  evaluateWrite,
  assertWriteAllowed,
  WriteViolationError,
  isPathWithin,
  normalizePath,
  expandHome,
} from "../src/path-guard.js";

const ROOT = "/work/bell-diagnostic";
const OTHER = "/work/guava-os";

describe("expandHome / normalizePath", () => {
  it("expands a leading tilde", () => {
    const expanded = expandHome("~/dev/repos/x");
    expect(expanded.startsWith("/")).toBe(true);
    expect(expanded.endsWith("dev/repos/x")).toBe(true);
  });

  it("resolves to an absolute path", () => {
    expect(normalizePath("/a/./b/../c")).toBe("/a/c");
  });
});

describe("isPathWithin", () => {
  it("treats an exact root as within", () => {
    expect(isPathWithin("/a/b", "/a/b")).toBe(true);
  });

  it("treats a descendant as within", () => {
    expect(isPathWithin("/a/b/c.txt", "/a/b")).toBe(true);
  });

  it("rejects a sibling prefix (not a real parent)", () => {
    expect(isPathWithin("/a/bc/x", "/a/b")).toBe(false);
  });

  it("rejects a parent of the root", () => {
    expect(isPathWithin("/a", "/a/b")).toBe(false);
  });

  it("rejects an unrelated root", () => {
    expect(isPathWithin("/z/y", "/a/b")).toBe(false);
  });
});

describe("evaluateWrite", () => {
  it("allows a write inside an allowed root", () => {
    expect(evaluateWrite("/work/bell-diagnostic/src/x.ts", [ROOT])).toEqual({
      allowed: true,
    });
  });

  it("allows the root itself", () => {
    expect(evaluateWrite("/work/bell-diagnostic", [ROOT])).toEqual({
      allowed: true,
    });
  });

  it("rejects a write in a different repo", () => {
    expect(evaluateWrite("/work/guava-os/src/cli.ts", [ROOT])).toEqual({
      allowed: false,
      code: "OUT_OF_SCOPE",
    });
  });

  it("rejects a sibling prefix repo", () => {
    expect(evaluateWrite("/work/bell-diagnostic-evil", [ROOT])).toEqual({
      allowed: false,
      code: "OUT_OF_SCOPE",
    });
  });

  it("rejects every write when there are no writable roots", () => {
    expect(evaluateWrite("/anything/at/all", [])).toEqual({
      allowed: false,
      code: "NO_WRITABLE_ROOTS",
    });
  });

  it("allows writes across multiple allowed roots", () => {
    const roots = [ROOT, OTHER];
    expect(evaluateWrite("/work/guava-os/x", roots)).toEqual({ allowed: true });
    expect(evaluateWrite("/work/bell-diagnostic/x", roots)).toEqual({
      allowed: true,
    });
  });

  it("normalizes relative and dotted requests before deciding", () => {
    expect(evaluateWrite("/work/bell-diagnostic/./sub/../x", [ROOT])).toEqual({
      allowed: true,
    });
  });
});

describe("assertWriteAllowed (fail-closed, classified)", () => {
  it("does not throw for an in-scope write", () => {
    expect(() => assertWriteAllowed("/work/bell-diagnostic/x", [ROOT])).not.toThrow();
  });

  it("throws OUT_OF_SCOPE for an out-of-scope write", () => {
    try {
      assertWriteAllowed("/work/guava-os/cli.ts", [ROOT]);
      throw new Error("expected assertWriteAllowed to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(WriteViolationError);
      const err = e as WriteViolationError;
      expect(err.code).toBe("OUT_OF_SCOPE");
      expect(err.requestedPath).toBe("/work/guava-os/cli.ts");
      expect(err.message).toMatch(/outside the allowed writable roots/);
    }
  });

  it("throws NO_WRITABLE_ROOTS for a reviewer role", () => {
    try {
      assertWriteAllowed("/anywhere", []);
      throw new Error("expected assertWriteAllowed to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(WriteViolationError);
      expect((e as WriteViolationError).code).toBe("NO_WRITABLE_ROOTS");
    }
  });
});
