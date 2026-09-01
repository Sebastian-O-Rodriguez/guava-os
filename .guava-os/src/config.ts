import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "node:url";

export interface LinearConfig {
  team: string;
  project: string;
  issue_prefix: string;
  aliases?: Record<string, string>;
}

export interface Config {
  linear: LinearConfig;
  domains: string[];
  /** Domain → OMP agent type (model + disposition + tools). */
  domainAgents: Record<string, string>;
  /** Work classification labels (Feature, Bug, Improvement, Chore, Spike). */
  types: string[];
  readiness: {
    untriaged: string;
    ready: string;
    needs_rescoping: string;
  };
  statuses: {
    backlog: string;
    todo: string;
    in_progress: string;
    in_review: string;
    done: string;
  };
  active_parent_statuses: string[];
  invariants: {
    max_todo_per_domain: number;
    stale_hours: number;
    reclaim_limit: number;
    bulk_threshold: number;
    max_subtasks_per_parent: number;
  };
  branch_pattern: string;
  process_files: Record<string, string>;
  manifest_path: string;
}

/** All skill domains in this project. */
export function allDomains(config: Config): string[] {
  return config.domains;
}

/** OMP agent type for a domain (defaults to `task`). */
export function agentForDomain(config: Config, domain: string): string {
  return config.domainAgents[domain] ?? "task";
}

/** All readiness label names, in canonical order. */
export function readinessLabels(config: Config): string[] {
  return [config.readiness.untriaged, config.readiness.ready, config.readiness.needs_rescoping];
}

export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".guava-os", "config.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Not inside an guava-os repo (no .guava-os/config.json found)");
}

/** Structural view of config.schema.json — only the constraint keywords we read. */
interface SchemaNode {
  required?: string[];
  properties?: Record<string, SchemaNode>;
}

/**
 * Canonical required-field paths, read once from config.schema.json in source
 * order (top-level `required`, descending into any nested `required` object).
 * The schema file — not a hand-maintained list — is the contract for what a
 * config must carry.
 */
function loadRequiredPaths(): string[] {
  const schemaPath = fileURLToPath(new URL("../config.schema.json", import.meta.url));
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as SchemaNode;
  const paths: string[] = [];
  const walk = (node: SchemaNode, prefix: string): void => {
    for (const key of node.required ?? []) {
      const path = prefix ? `${prefix}.${key}` : key;
      const child = node.properties?.[key];
      if (child?.required && child.required.length > 0) {
        walk(child, path);
      } else {
        paths.push(path);
      }
    }
  };
  walk(schema, "");
  return paths;
}

/** Full set of required new-schema fields, in canonical reporting order. */
const REQUIRED_FIELD_PATHS: string[] = loadRequiredPaths();

/** Thrown when a repo config predates the domain model and must be migrated. */
export class ConfigStaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigStaleError";
  }
}

/** True when the dot-separated `path` resolves to an own property of `config`. */
function hasPath(config: Record<string, unknown>, path: string): boolean {
  let node: unknown = config;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object" || Array.isArray(node)) return false;
    if (!Object.prototype.hasOwnProperty.call(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

/** Legacy-schema markers: role-based fields that predate the domain model. */
function legacyFields(config: Record<string, unknown>): string[] {
  const legacy: string[] = [];
  if (Array.isArray(config.roles)) legacy.push("roles");
  const invariants = config.invariants;
  if (
    invariants !== null &&
    typeof invariants === "object" &&
    Object.prototype.hasOwnProperty.call(invariants, "max_todo_per_role")
  ) {
    legacy.push("invariants.max_todo_per_role");
  }
  if (typeof config.branch_pattern === "string" && config.branch_pattern.includes("{role}")) {
    legacy.push('branch_pattern (contains "{role}")');
  }
  return legacy;
}

function staleConfigMessage(missing: string[], legacy: string[]): string {
  const parts: string[] = ["Config is stale and must be migrated."];
  if (missing.length > 0) parts.push(`Missing fields: ${missing.join(", ")}.`);
  if (legacy.length > 0) parts.push(`Legacy fields: ${legacy.join(", ")}.`);
  parts.push("Run 'gos sync <repo>' to migrate this config.");
  return parts.join(" ");
}

export function loadConfig(repoRoot: string): Config {
  const configPath = resolve(repoRoot, ".guava-os", "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConfigStaleError(staleConfigMessage(REQUIRED_FIELD_PATHS, []));
  }
  // Plain object confirmed; the record view lets field checks read by name.
  const config = parsed as Record<string, unknown>;
  const missing = REQUIRED_FIELD_PATHS.filter((path) => !hasPath(config, path));
  const legacy = legacyFields(config);
  if (missing.length > 0 || legacy.length > 0) {
    throw new ConfigStaleError(staleConfigMessage(missing, legacy));
  }
  // Required fields and legacy markers verified above.
  return config as unknown as Config;
}