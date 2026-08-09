/**
 * Structured CLI output envelope. Every command emits machine-readable JSON as
 * primary output. Never free-form-only.
 */

import type { GorpErrorCode } from "../errors/index.js";

export interface CliSuccess {
  readonly success: true;
  readonly command: string;
  readonly ids?: Record<string, string>;
  readonly data?: unknown;
}

export interface CliFailure {
  readonly success: false;
  readonly command: string;
  readonly error: {
    readonly code: GorpErrorCode;
    readonly message: string;
    readonly details: Record<string, unknown>;
  };
}

export type CliResult = CliSuccess | CliFailure;

export function emit(result: CliResult): void {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
