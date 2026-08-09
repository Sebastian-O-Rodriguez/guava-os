/**
 * Shared read-and-validate for persisted run records: parse the file, validate
 * against its canonical schema, fail closed on anything unreadable or invalid.
 */

import { readFileSync } from "node:fs";
import { GorpError } from "../errors/index.js";
import { validateAgainst, type SchemaName } from "../contracts/validator.js";

export function readValidatedRecord<T>(name: SchemaName, path: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", `cannot read ${name}`, { path, cause: String(e) });
  }
  const check = validateAgainst(name, parsed);
  if (!check.valid) {
    throw new GorpError("SCHEMA_VALIDATION_FAILED", `${name} on disk failed schema validation`, {
      path,
      issues: check.issues,
    });
  }
  return parsed as T;
}
