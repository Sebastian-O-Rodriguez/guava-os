/**
 * `guava-os work` — deterministic session gate (the "script, not AI" layer).
 *
 * Reports open work so a session bootstrap can decide whether to proceed or
 * close. It queries Linear directly (unlike the stdin classifier commands).
 *
 * Exit code is the gate: 0 = work available, 1 = nothing actionable.
 *
 *   work        → this project (repo config)
 *   work --all  → every active registry project
 *   --json      → machine-readable output
 */
import { findRepoRoot, loadConfig, type Config } from "./config.js";
import * as pm from "./linear-client.js";
import { loadRegistry } from "./registry.js";

export interface WorkView {
  project: string;
  todoByRole: Record<string, number>;
  inProgress: number;
  inReview: number;
  totalOpen: number;
}

async function workView(config: Config, linearProject: string): Promise<WorkView> {
  const { issues } = await pm.searchIssues(config, { projectId: linearProject });
  const todoByRole: Record<string, number> = {};
  let inProgress = 0;
  let inReview = 0;

  for (const issue of issues) {
    if (issue.completedAt || issue.canceledAt) continue;
    if (issue.status === config.statuses.in_progress) { inProgress++; continue; }
    if (issue.status === config.statuses.in_review) { inReview++; continue; }
    if (issue.status === config.statuses.todo) {
      const role = config.roles.find((r) => issue.labels.includes(r));
      if (role) todoByRole[role] = (todoByRole[role] ?? 0) + 1;
    }
  }

  const totalOpen = Object.values(todoByRole).reduce((a, b) => a + b, 0);
  return { project: linearProject, todoByRole, inProgress, inReview, totalOpen };
}

function formatViews(views: WorkView[]): string {
  if (views.length === 0) return "(no active projects with Linear mapping)";
  return views
    .map((v) => {
      const roles = Object.entries(v.todoByRole).map(([r, n]) => `${r}=${n}`).join(" ") || "none";
      return `${v.project}: todo[${roles}] in-progress=${v.inProgress} in-review=${v.inReview}`;
    })
    .join("\n");
}

export async function runWork(args: string[], jsonMode: boolean): Promise<number> {
  const repoRoot = findRepoRoot();
  const config = loadConfig(repoRoot);

  if (args.includes("--all")) {
    const registry = loadRegistry();
    const active = registry.filter(
      (p) => p.lifecycle !== "retired" && p.lifecycle !== "paused" && p.linearProject,
    );
    const views: WorkView[] = [];
    for (const p of active) {
      try {
        views.push(await workView(config, p.linearProject!));
      } catch {
        // unqueryable project (no Linear mapping / network) — skip, never block the gate
      }
    }
    const total = views.reduce((s, v) => s + v.totalOpen + v.inProgress + v.inReview, 0);
    if (jsonMode) console.log(JSON.stringify({ work: views, totalOpen: total }, null, 2));
    else console.log(formatViews(views));
    return total > 0 ? 0 : 1;
  }

  const view = await workView(config, config.linear.project);
  const total = view.totalOpen + view.inProgress + view.inReview;
  if (jsonMode) console.log(JSON.stringify(view, null, 2));
  else console.log(formatViews([view]));
  return total > 0 ? 0 : 1;
}