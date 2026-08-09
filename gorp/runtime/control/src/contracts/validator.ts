/**
 * Schema-loading + validation boundary.
 *
 * This is the ONE tightly-contained external-parsing boundary. Untrusted input
 * arrives as `unknown`; we validate against the canonical JSON Schema and only
 * then narrow to a domain type. `any` is confined to Ajv interop and never
 * leaks a value outward unvalidated.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { GorpError } from "../errors/index.js";
import type { ExecutionGraph } from "./types.js";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Canonical schemas live in the gorp repo at specs/runtime/. From the built
 * location (dist/contracts) or source (src/contracts) the repo root is four
 * levels up: runtime/control/<dist|src>/contracts -> gorp root.
 */
export function specsRuntimeDir(): string {
  // <gorp>/runtime/control/{src|dist}/contracts/validator -> up to <gorp>
  return join(HERE, "..", "..", "..", "..", "specs", "runtime");
}

export type SchemaName =
  | "execution-graph"
  | "worker-result"
  | "gate-record"
  | "run-record"
  | "review-decision"
  | "promotion-record"
  | "sprint";

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const cache = new Map<SchemaName, ValidateFunction>();

export function loadSchema(name: SchemaName): unknown {
  const path = join(specsRuntimeDir(), `${name}.schema.json`);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    throw new GorpError("STORAGE_FAILURE", `cannot read schema ${name}`, {
      path,
      cause: String(e),
    });
  }
  // Contained parse boundary: schema JSON itself.
  return JSON.parse(raw) as unknown;
}

function compile(name: SchemaName): ValidateFunction {
  const cached = cache.get(name);
  if (cached) return cached;
  const schema = loadSchema(name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Ajv interop boundary
  const fn = ajv.compile(schema as any);
  cache.set(name, fn);
  return fn;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly keyword: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/** Validate an already-parsed value against a named schema. Pure, no throw. */
export function validateAgainst(name: SchemaName, value: unknown): ValidationResult {
  const fn = compile(name);
  const valid = fn(value);
  if (valid) return { valid: true, issues: [] };
  const issues: ValidationIssue[] = (fn.errors ?? []).map((e) => ({
    path: e.instancePath === "" ? "/" : e.instancePath,
    message: e.message ?? "invalid",
    keyword: e.keyword,
  }));
  return { valid: false, issues };
}

/**
 * Parse + validate an execution graph from an untrusted value. Throws a
 * structured SCHEMA_VALIDATION_FAILED on any violation; returns a narrowed
 * ExecutionGraph on success.
 */
export function parseExecutionGraph(value: unknown): ExecutionGraph {
  const result = validateAgainst("execution-graph", value);
  if (!result.valid) {
    throw new GorpError("SCHEMA_VALIDATION_FAILED", "execution graph failed schema validation", {
      issues: result.issues,
    });
  }
  return value as ExecutionGraph;
}
