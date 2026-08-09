/**
 * Stable, structured error model for the Gorp control runtime.
 *
 * Error meaning is carried by `code` (never parsed from human strings).
 * Each code maps to a documented CLI exit code (see EXIT_CODES).
 */

export type GorpErrorCode =
  | "INVALID_ARGUMENT"
  | "SCHEMA_VALIDATION_FAILED"
  | "GRAPH_NOT_FOUND"
  | "GRAPH_ALREADY_EXISTS"
  | "UNSUPPORTED_GRAPH_SHAPE"
  | "ILLEGAL_STATE_TRANSITION"
  | "STATE_CONFLICT"
  | "STORAGE_FAILURE"
  | "LOCKED"
  | "SANDBOX_FAILURE"
  | "WORKER_FAILED"
  | "GATE_FAILED"
  | "RUN_NOT_FOUND"
  | "PROMOTION_BLOCKED"
  | "PROMOTION_CONFLICT"
  | "REVIEW_BLOCKED"
  | "AUDIT_TAMPERED"
  | "ORCHESTRATION_STOPPED"
  | "PROJECT_NOT_REGISTERED"
  | "NOT_IMPLEMENTED";

export interface GorpErrorDetails {
  readonly [key: string]: unknown;
}

/** A structured runtime error. `details` is machine-readable, never free-form-only. */
export class GorpError extends Error {
  readonly code: GorpErrorCode;
  readonly details: GorpErrorDetails;

  constructor(code: GorpErrorCode, message: string, details: GorpErrorDetails = {}) {
    super(message);
    this.name = "GorpError";
    this.code = code;
    this.details = details;
  }

  toJSON(): { code: GorpErrorCode; message: string; details: GorpErrorDetails } {
    return { code: this.code, message: this.message, details: this.details };
  }
}

/**
 * Documented, tested CLI exit codes. 0 is success. Every error code has a
 * distinct exit code so callers can branch reliably without string parsing.
 */
export const EXIT_CODES: Readonly<Record<GorpErrorCode | "OK", number>> = Object.freeze({
  OK: 0,
  INVALID_ARGUMENT: 2,
  SCHEMA_VALIDATION_FAILED: 3,
  GRAPH_NOT_FOUND: 4,
  GRAPH_ALREADY_EXISTS: 5,
  UNSUPPORTED_GRAPH_SHAPE: 6,
  ILLEGAL_STATE_TRANSITION: 7,
  STATE_CONFLICT: 8,
  STORAGE_FAILURE: 9,
  LOCKED: 10,
  SANDBOX_FAILURE: 11,
  WORKER_FAILED: 12,
  GATE_FAILED: 13,
  RUN_NOT_FOUND: 14,
  PROMOTION_BLOCKED: 15,
  PROMOTION_CONFLICT: 16,
  REVIEW_BLOCKED: 17,
  AUDIT_TAMPERED: 18,
  ORCHESTRATION_STOPPED: 19,
  PROJECT_NOT_REGISTERED: 20,
  NOT_IMPLEMENTED: 69,
});

export function exitCodeFor(code: GorpErrorCode): number {
  return EXIT_CODES[code];
}

export function isGorpError(e: unknown): e is GorpError {
  return e instanceof GorpError;
}
