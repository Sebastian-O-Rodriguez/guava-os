/**
 * `guava-os work` — deterministic session gate (the "script, not AI" layer).
 *
 * Reports open work so a session bootstrap can decide whether to proceed or
 * close. It queries Linear directly (unlike the stdin classifier commands),
 * builds the execution graph, runs the validator, and classifies each open
 * issue as READY (dispatchable) or NOT-READY (with the reasons it fails).
 *
 * READ-ONLY: no Linear writes of any kind.
 *
 * Exit code is the gate: 0 = ready work available, 1 = nothing dispatchable.
 *
 *   work        → this project (repo config)
 *   work --all  → every active registry project
 *   --json      → machine-readable output
 */
import { findRepoRoot, loadConfig, type Config } from "./config.js";
import { readinessLabels } from "./config.js";
import { buildGraph, type LinearIssue } from "./linear.js";
import { runValidate } from "./validate.js";
import * as pm from "./linear-client.js";
import { loadRegistry } from "./registry.js";

export interface WorkIssue {
  issue_id: string;
  title: string;
  domain: string | null;
  ready: boolean;
  reasons: string[];
}

export interface WorkView {
  project: string;
  ready: WorkIssue[];
  notReady: WorkIssue[];
  inProgress: number;
  inReview: number;
}

/** Classify open issues into READY / NOT-READY, keeping in-progress/in-review counts. */
function classifyIssues(config: Config, issues: LinearIssue[]): Omit<WorkView, "project"> {
  const graph = buildGraph(issues, config);
  const violations = runValidate(graph, issues, config).violations;

  // Group error violations by the deliverable they name. Aggregate codes
  // (V500 `(domain)`, V307 `(executable)`) have no single issue_id.
  const errorsByIssue = new Map<string, string[]>();
  for (const v of violations) {
    if (v.severity !== "error") continue;
    if (v.issue_id.startsWith("(")) continue;
    const list = errorsByIssue.get(v.issue_id) ?? [];
    list.push(`${v.code} ${v.name}: ${v.detail}`);
    errorsByIssue.set(v.issue_id, list);
  }

  const readinessAll = readinessLabels(config);
  const ready: WorkIssue[] = [];
  const notReady: WorkIssue[] = [];
  let inProgress = 0;
  let inReview = 0;

  for (const issue of issues) {
    if (issue.completedAt || issue.canceledAt) continue;
    if (issue.status === config.statuses.in_progress) { inProgress++; continue; }
    if (issue.status === config.statuses.in_review) { inReview++; continue; }

    const domain = config.domains.find((d) => issue.labels.includes(d)) ?? null;
    const readiness = issue.labels.find((l) => readinessAll.includes(l)) ?? null;

    const reasons: string[] = [];
    if (issue.status !== config.statuses.todo) {
      reasons.push(`status is "${issue.status}" (not Todo)`);
    }
    if (!domain) reasons.push("missing domain label");
    if (readiness !== config.readiness.ready) {
      reasons.push(
        readiness
          ? `readiness "${readiness}" (needs "${config.readiness.ready}")`
          : `missing readiness label (needs "${config.readiness.ready}")`,
      );
    }
    for (const r of errorsByIssue.get(issue.id) ?? []) reasons.push(r);

    const entry: WorkIssue = {
      issue_id: issue.id,
      title: issue.title,
      domain,
      ready: reasons.length === 0,
      reasons,
    };
    (entry.ready ? ready : notReady).push(entry);
  }

  return { ready, notReady, inProgress, inReview };
}

async function workView(config: Config, linearProject: string): Promise<WorkView> {
  const { issues } = await pm.searchIssues(config, { projectId: linearProject });
  return { project: linearProject, ...classifyIssues(config, issues) };
}

function formatViews(views: WorkView[]): string {
  if (views.length === 0) return "(no active projects with Linear mapping)";
  const lines: string[] = [];
  for (const v of views) {
    const readyIds = v.ready.map((r) => r.issue_id);
    lines.push(
      `${v.project}: ready=${v.ready.length}` +
        (readyIds.length ? ` [${readyIds.join(" ")}]` : "") +
        ` not-ready=${v.notReady.length} in-progress=${v.inProgress} in-review=${v.inReview}`,
    );
    for (const n of v.notReady) {
      lines.push(`  ! ${n.issue_id} (${n.domain ?? "no-domain"}) ${n.reasons.join("; ")}`);
    }
  }
  return lines.join("\n");
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
    const totalReady = views.reduce((s, v) => s + v.ready.length, 0);
    if (jsonMode) console.log(JSON.stringify({ work: views, ready: totalReady }, null, 2));
    else console.log(formatViews(views));
    return totalReady > 0 ? 0 : 1;
  }

  const view = await workView(config, config.linear.project);
  if (jsonMode) console.log(JSON.stringify(view, null, 2));
  else console.log(formatViews([view]));
  return view.ready.length > 0 ? 0 : 1;
}