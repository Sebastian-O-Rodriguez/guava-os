/**
 * Fail-closed path allowlist guard (GOS-45 / GUA-178 v1 permission model).
 *
 * The single enforcement primitive of the v1 permission model. Given a
 * requested write path and the set of allowed writable roots (absolute paths),
 * it decides allow/reject. The decision is deterministic, lexical, and
 * independent of git or the filesystem — safe to unit-test without a repo.
 *
 * Model:
 *   - A write is allowed IFF the requested absolute path is equal to, or
 *     strictly inside, at least one allowed root.
 *   - An empty allowed-roots set rejects every write (read/test-only roles).
 *   - Rejection is classified (NO_WRITABLE_ROOTS | OUT_OF_SCOPE) and throws
 *     BEFORE anything is written — no partial write.
 *
 * v1 limitation (documented, not silent): path comparison is lexical
 * (`path.resolve` + `path.relative`); it does not chase symlinks or inspect
 * mount boundaries. Container/OS sandboxing is a deliberate non-goal
 * (consistent with gorp's "no containers" non-goal). Callers who need
 * symlink-resistance should canonicalize with `realpath` at the boundary.
 */

import { homedir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";

/** Classified rejection codes for a failed write. */
export type WriteViolationCode = "NO_WRITABLE_ROOTS" | "OUT_OF_SCOPE";

/** Result of evaluating a write against the allowlist. */
export type WriteDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly code: WriteViolationCode };

/** Classified, fail-closed error thrown before an out-of-scope write. */
export class WriteViolationError extends Error {
  readonly code: WriteViolationCode;
  readonly requestedPath: string;
  readonly allowedRoots: readonly string[];

  constructor(
    code: WriteViolationCode,
    requestedPath: string,
    allowedRoots: readonly string[],
  ) {
    const message =
      code === "NO_WRITABLE_ROOTS"
        ? `write rejected (NO_WRITABLE_ROOTS): role has no writable roots — cannot write "${requestedPath}"`
        : `write rejected (OUT_OF_SCOPE): "${requestedPath}" is outside the allowed writable roots`;
    super(message);
    this.name = "WriteViolationError";
    this.code = code;
    this.requestedPath = requestedPath;
    this.allowedRoots = allowedRoots;
  }
}

/** Expand a leading `~` to the user home directory. */
export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}

/** Normalize a path to an absolute, `~`-expanded form (no symlink chase). */
export function normalizePath(p: string): string {
  return resolve(expandHome(p));
}

/**
 * True when `requested` is equal to, or strictly inside, `root`.
 * Both must already be absolute (normalizePath).
 */
export function isPathWithin(requested: string, root: string): boolean {
  const rel = relative(root, requested);
  if (rel === "") return true; // exact match
  // ".." or "../…" escapes; an absolute rel means different root entirely.
  return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

/**
 * Pure allow/reject decision for a single requested write.
 * Deterministic; touches no filesystem, git, or process state.
 */
export function evaluateWrite(
  requestedPath: string,
  allowedRoots: readonly string[],
): WriteDecision {
  if (allowedRoots.length === 0) {
    return { allowed: false, code: "NO_WRITABLE_ROOTS" };
  }
  const target = normalizePath(requestedPath);
  for (const root of allowedRoots) {
    if (isPathWithin(target, normalizePath(root))) {
      return { allowed: true };
    }
  }
  return { allowed: false, code: "OUT_OF_SCOPE" };
}

/**
 * Fail-closed assertion: throws WriteViolationError unless the write is in
 * scope. Call this at the write boundary BEFORE mutating the filesystem.
 */
export function assertWriteAllowed(
  requestedPath: string,
  allowedRoots: readonly string[],
): void {
  const decision = evaluateWrite(requestedPath, allowedRoots);
  if (!decision.allowed) {
    throw new WriteViolationError(
      decision.code,
      normalizePath(requestedPath),
      allowedRoots,
    );
  }
}
