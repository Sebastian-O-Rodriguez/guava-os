import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

export interface LinearConfig {
  team: string;
  project: string;
  issue_prefix: string;
}

export interface Config {
  linear: LinearConfig;
  roles: string[];
  domains?: string[];
  statuses: {
    backlog: string;
    todo: string;
    in_progress: string;
    in_review: string;
    done: string;
  };
  active_parent_statuses: string[];
  invariants: {
    max_todo_per_role: number;
    stale_hours: number;
    reclaim_limit: number;
    bulk_threshold: number;
    max_subtasks_per_parent: number;
  };
  branch_pattern: string;
  process_files: Record<string, string>;
  manifest_path: string;
}

/** All OMP roles in this project */
export function allRoles(config: Config): string[] {
  return config.roles;
}

export function allDomains(config: Config): string[] {
  return config.domains ?? [];
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
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Config;
}