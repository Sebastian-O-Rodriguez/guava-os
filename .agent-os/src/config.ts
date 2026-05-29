import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

export interface LinearConfig {
  team: string;
  project: string;
  issue_prefix: string;
}

export interface Config {
  linear: LinearConfig;
  personas: string[];
  statuses: {
    backlog: string;
    todo: string;
    in_progress: string;
    in_review: string;
    done: string;
  };
  active_parent_statuses: string[];
  labels: {
    persona_labels: string[];
    qa_label: string;
  };
  invariants: {
    max_todo_per_persona: number;
    stale_hours: number;
    reclaim_limit: number;
    bulk_threshold: number;
    max_subtasks_per_parent: number;
  };
  branch_pattern: string;
  agent_files: Record<string, string>;
  process_files: Record<string, string>;
  manifest_path: string;
}

/** All persona labels including qa */
export function allPersonaLabels(config: Config): string[] {
  const labels = [...config.labels.persona_labels];
  if (!labels.includes(config.labels.qa_label)) {
    labels.push(config.labels.qa_label);
  }
  return labels;
}

export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  while (dir !== "/") {
    if (existsSync(resolve(dir, ".agent-os", "config.json"))) return dir;
    dir = dirname(dir);
  }
  throw new Error("Not inside an agent-os repo (no .agent-os/config.json found)");
}

export function loadConfig(repoRoot: string): Config {
  const configPath = resolve(repoRoot, ".agent-os", "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as Config;
}
