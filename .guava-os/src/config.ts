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

export function loadConfig(repoRoot: string): Config {
  const configPath = resolve(repoRoot, ".guava-os", "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, "utf8")) as Config;
}
