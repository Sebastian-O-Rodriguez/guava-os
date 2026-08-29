/**
 * `guava-os triage` — readiness triage (read → check → write, live Linear).
 *
 * Readiness labels (untriaged / ready / needs-rescoping) are mutually
 * exclusive and set ONLY by this command. It queries Linear directly, builds
 * the execution graph, runs the validator, then classifies each open Todo
 * non-container deliverable:
 *
 *   • ZERO error violations → `ready` (config.readiness.ready)
 *   • any error violation    → `needs-rescoping` (config.readiness.needs_rescoping)
 *
 * It then writes the computed readiness label, preserving the issue's domain
 * and type labels and replacing only the readiness label (so exactly one
 * readiness label remains). Idempotent: unchanged issues are not re-written.
 *
 *   triage                     → this project (repo config)
 *   triage --project <name>    → that project (resolved like `pm search`)
 *   triage --all               → every active registry project
 *   --json                     → machine-readable output
 */
import { findRepoRoot, loadConfig, type Config } from "./config.js";
import { allDomains, readinessLabels } from "./config.js";
import { buildGraph, type LinearIssue } from "./linear.js";
import { runValidate } from "./validate.js";
import * as pm from "./linear-client.js";
import { loadRegistry } from "./registry.js";

/** Per-issue triage decision (classification + the replacement label array). */
export interface TriageIssue {
  issue_id: string;
  identifier: string;
  title: string;
  /** Readiness label before triage (null = none present). */
  old_readiness: string | null;
  /** Readiness label after triage (ready | needs_rescoping). */
  new_readiness: string;
  /** Error violations that drove a needs_rescoping verdict. Empty when ready. */
  reasons: string[];
  /** Replacement label array: [domain(s)] + [type(s)] + [new_readiness]. */
  labels: string[];
}

export interface TriageView {
  project: string;
  issues: TriageIssue[];
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

/**
 * Classify open Todo non-container deliverables from a pre-fetched issue set.
 *
 * Pure — no Linear calls. Returns only the deliverables triage acts on:
 *   • not completed and not canceled (open)
 *   • in the Todo status
 *   • not a container (no children)
 *   • carries ≥1 domain label (no-domain issues are separate V400 cases — left alone)
 *
 * The readiness verdict ignores V404 (readiness_label_count): triage itself
 * fixes the readiness label, so its current state must not drive the
 * classification — otherwise fixing a missing/stale label would flip an
 * otherwise-clean issue and break idempotency.
 */
export function classifyTriage(config: Config, issues: LinearIssue[]): TriageIssue[] {
  const graph = buildGraph(issues, config);
  const violations = runValidate(graph, issues, config).violations;

  const domainLabels = allDomains(config);
  const typeLabels = config.types;
  const readinessAll = readinessLabels(config);

  // Containers (have ≥1 non-canceled child) are groupings, not deliverables.
  const containerIds = new Set(
    issues
      .filter((i) => !i.canceledAt && issues.some((c) => c.parentId === i.id && !c.canceledAt))
      .map((i) => i.id),
  );
  const byId = new Map(issues.map((i) => [i.id, i]));

  // Error violations attributable to a single issue. Exclude aggregate codes
  // (issue_id "(domain)"/"(executable)") and V404 (readiness label count).
  const errorsByIssue = new Map<string, string[]>();
  for (const v of violations) {
    if (v.severity !== "error") continue;
    if (v.issue_id.startsWith("(")) continue;
    if (v.code === "V404") continue;
    const list = errorsByIssue.get(v.issue_id) ?? [];
    list.push(`${v.code} ${v.name}: ${v.detail}`);
    errorsByIssue.set(v.issue_id, list);
  }

  const out: TriageIssue[] = [];
  for (const issue of issues) {
    if (issue.completedAt || issue.canceledAt) continue;
    if (issue.status !== config.statuses.todo) continue;
    if (containerIds.has(issue.id)) continue;

    const domains = issue.labels.filter((l) => domainLabels.includes(l));
    if (domains.length === 0) continue; // V400 case — leave untouched

    const types = issue.labels.filter((l) => typeLabels.includes(l));
    const oldReadiness = issue.labels.find((l) => readinessAll.includes(l)) ?? null;

    const reasons = [...(errorsByIssue.get(issue.id) ?? [])];
    for (const blocker of openBlockers(issue, byId)) reasons.push(`blocked by ${blocker}`);
    const newReadiness =
      reasons.length === 0 ? config.readiness.ready : config.readiness.needs_rescoping;

    out.push({
      issue_id: issue.id,
      identifier: issue.identifier ?? issue.id,
      title: issue.title,
      old_readiness: oldReadiness,
      new_readiness: newReadiness,
      reasons,
      labels: [...domains, ...types, newReadiness],
    });
  }

  return out;
}

/** Classify + write readiness labels for one Linear project. */
async function triageProject(config: Config, linearProject: string): Promise<TriageView> {
  const { issues } = await pm.searchIssues(config, { projectId: linearProject });
  const decisions = classifyTriage(config, issues);
  for (const t of decisions) {
    if (t.old_readiness === t.new_readiness) continue; // already converged
    await pm.updateIssue(t.issue_id, { labels: t.labels });
  }
  return { project: linearProject, issues: decisions };
}

function formatTriage(views: TriageView[]): string {
  if (views.length === 0) return "(no active projects with Linear mapping)";
  const lines: string[] = [];
  for (const v of views) {
    lines.push(`== ${v.project} ==`);
    if (v.issues.length === 0) {
      lines.push("  (no open Todo deliverables to triage)");
      continue;
    }
    for (const t of v.issues) {
      const old = t.old_readiness ?? "(none)";
      const changed = t.old_readiness === t.new_readiness ? " (unchanged)" : "";
      lines.push(`  ${t.identifier}  ${t.title}`);
      lines.push(`    readiness: ${old} → ${t.new_readiness}${changed}`);
      for (const reason of t.reasons) lines.push(`    ! ${reason}`);
    }
  }
  return lines.join("\n");
}

export async function runTriage(args: string[], jsonMode: boolean): Promise<number> {
  const repoRoot = findRepoRoot();
  const config = loadConfig(repoRoot);

  const views: TriageView[] = [];

  if (args.includes("--all")) {
    const registry = loadRegistry();
    const active = registry.filter(
      (p) => p.lifecycle !== "retired" && p.lifecycle !== "paused" && p.linearProject,
    );
    for (const p of active) {
      try {
        views.push(await triageProject(config, p.linearProject!));
      } catch {
        // unqueryable project (no Linear mapping / network) — skip, never block
      }
    }

    const changed = views.reduce(
      (s, v) => s + v.issues.filter((t) => t.old_readiness !== t.new_readiness).length,
      0,
    );
    if (jsonMode) console.log(JSON.stringify({ triage: views, changed }, null, 2));
    else console.log(formatTriage(views));
    return 0;
  }

  // Resolve --project <name> like `pm search` does (getProject honors
  // config.linear.aliases), falling back to the repo's configured project.
  // triageProject resolves the name to a UUID when searching and reports the
  // project name — so pass the canonical name rather than the UUID.
  const projectIdx = args.indexOf("--project");
  const linearProject = projectIdx !== -1
    ? (await pm.getProject(config, args[projectIdx + 1])).name
    : config.linear.project;
  const view = await triageProject(config, linearProject);
  if (jsonMode) console.log(JSON.stringify(view, null, 2));
  else console.log(formatTriage([view]));
  return 0;
}