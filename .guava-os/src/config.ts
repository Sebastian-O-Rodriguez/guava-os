import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

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

/** Full set of required new-schema fields, in canonical reporting order. */
const REQUIRED_FIELD_PATHS: string[] = [
  "linear",
  "domains",
  "domainAgents",
  "types",
  "readiness.untriaged",
  "readiness.ready",
  "readiness.needs_rescoping",
  "statuses",
  "active_parent_statuses",
  "invariants.max_todo_per_domain",
  "branch_pattern",
  "process_files",
  "manifest_path",
];

const REQUIRED_READINESS_FIELDS: string[] = ["untriaged", "ready", "needs_rescoping"];

/** Thrown when a repo config predates the domain model and must be migrated. */
export class ConfigStaleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigStaleError";
  }
}

/** Reports required-field paths missing from `config`, in canonical order. */
function missingFields(config: Record<string, unknown>): string[] {
  const missing: string[] = [];

  for (const key of ["linear", "domains", "domainAgents", "types"]) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) missing.push(key);
  }

  const readiness = config.readiness;
  const readinessMissing =
    readiness === null || typeof readiness !== "object" || Array.isArray(readiness)
      ? REQUIRED_READINESS_FIELDS
      : REQUIRED_READINESS_FIELDS.filter(
          (key) => !Object.prototype.hasOwnProperty.call(readiness, key),
        );
  for (const key of readinessMissing) missing.push(`readiness.${key}`);

  for (const key of ["statuses", "active_parent_statuses"]) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) missing.push(key);
  }

  const invariants = config.invariants;
  if (
    invariants === null ||
    typeof invariants !== "object" ||
    Array.isArray(invariants) ||
    !Object.prototype.hasOwnProperty.call(invariants, "max_todo_per_domain")
  ) {
    missing.push("invariants.max_todo_per_domain");
  }

  for (const key of ["branch_pattern", "process_files", "manifest_path"]) {
    if (!Object.prototype.hasOwnProperty.call(config, key)) missing.push(key);
  }

  return missing;
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
  parts.push("Run 'guava-os sync <repo>' to migrate this config.");
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
  const missing = missingFields(config);
  const legacy = legacyFields(config);
  if (missing.length > 0 || legacy.length > 0) {
    throw new ConfigStaleError(staleConfigMessage(missing, legacy));
  }
  // Required fields and legacy markers verified above.
  return config as unknown as Config;
}
