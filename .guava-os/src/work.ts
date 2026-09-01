/**
 * `gos work` — deterministic session gate (the "script, not AI" layer).
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
 *   work                    → this project (repo config)
 *   work --project <name>   → that project, resolved from registry (CWD-independent)
 *   work --all              → every active registry project
 *   --json                  → machine-readable output
 */
import { findRepoRoot, loadConfig, type Config } from "./config.js";
import { readinessLabels } from "./config.js";
import { buildGraph, type LinearIssue } from "./linear.js";
import { runValidate } from "./validate.js";
import * as pm from "./linear-client.js";
import { loadRegistry, type RegistryProject } from "./registry.js";
import { homedir } from "os";
import { resolve } from "path";

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

/**
 * Incoming blocked-by edges surfaced by linear-client (GUA-549) at runtime.
 * An edge is open while its blocker is neither completed nor canceled. A
 * blocker id not present in this dataset is external (another project) — its
 * status is unverifiable, so it is conservatively treated as open and named
 * by its raw id.
 */
type IssueWithBlockedBy = LinearIssue & { blockedBy?: string[] };

function openBlockers(issue: LinearIssue, byId: Map<string, LinearIssue>): string[] {
  const blockedBy = (issue as IssueWithBlockedBy).blockedBy;
  if (!blockedBy || blockedBy.length === 0) return [];
  const open: string[] = [];
  for (const blockerId of blockedBy) {
    const blocker = byId.get(blockerId);
    if (blocker && (blocker.completedAt || blocker.canceledAt)) continue;
    open.push(blocker ? blocker.identifier : blockerId);
  }
  return open;
}

/** Classify open issues into READY / NOT-READY, keeping in-progress/in-review counts. */
export function classifyIssues(config: Config, issues: LinearIssue[]): Omit<WorkView, "project"> {
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


  const byId = new Map(issues.map((i) => [i.id, i]));
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
    for (const blocker of openBlockers(issue, byId)) {
      reasons.push(`blocked by ${blocker}`);
    }

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
      `project: ${v.project} — ready=${v.ready.length}` +
        (readyIds.length ? ` [${readyIds.join(" ")}]` : "") +
        ` · not-ready=${v.notReady.length} · in-progress=${v.inProgress} · in-review=${v.inReview}`,
    );
    for (const n of v.notReady) {
      lines.push(`  ! ${n.issue_id} (${n.domain ?? "no-domain"}) ${n.reasons.join("; ")}`);
    }
  }
  return lines.join("\n");
}

/** Expand a leading `~` in a registry `repo_path` to the user's home directory. */
function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return resolve(homedir(), p.slice(2));
  return p;
}

/** Find a registry project by id or linear_project. */
function findRegistryProject(
  registry: RegistryProject[],
  name: string,
): RegistryProject | undefined {
  return registry.find((p) => p.id === name || p.linearProject === name);
}

/**
 * Warn (stderr) when the CWD's repo root is not the registered repo for the
 * project being reported — the board may be right, but the working tree is not.
 */
function warnWrongRepoRoot(repoRoot: string, configuredProject: string): void {
  let entry: RegistryProject | undefined;
  try {
    entry = findRegistryProject(loadRegistry(), configuredProject);
  } catch {
    return; // registry unavailable — nothing to compare
  }
  if (!entry?.repoPath) return;
  const registeredRoot = resolve(expandHome(entry.repoPath));
  if (resolve(repoRoot) !== registeredRoot) {
    console.error(
      `warning: working directory ${repoRoot} is not the registered repo for ` +
        `${configuredProject} (${registeredRoot}) — verify you are in the right checkout`,
    );
  }
}

/** Report one explicitly-named project, independent of CWD. */
async function runProject(name: string, jsonMode: boolean): Promise<number> {
  const registry = loadRegistry();
  const entry = findRegistryProject(registry, name);
  if (!entry) {
    console.error(`unknown project: ${name}`);
    return 1;
  }
  if (!entry.repoPath) {
    console.error(`registry project ${entry.id} has no repo_path — cannot load its config`);
    return 1;
  }
  const config = loadConfig(resolve(expandHome(entry.repoPath)));
  const view = await workView(config, entry.linearProject ?? entry.id);
  if (jsonMode) console.log(JSON.stringify(view, null, 2));
  else console.log(formatViews([view]));
  return view.ready.length > 0 ? 0 : 1;
}

export async function runWork(args: string[], jsonMode: boolean): Promise<number> {
  const projectIdx = args.indexOf("--project");
  if (projectIdx !== -1) return runProject(args[projectIdx + 1], jsonMode);

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

  warnWrongRepoRoot(repoRoot, config.linear.project);

  const view = await workView(config, config.linear.project);
  if (jsonMode) console.log(JSON.stringify(view, null, 2));
  else console.log(formatViews([view]));
  return view.ready.length > 0 ? 0 : 1;
}