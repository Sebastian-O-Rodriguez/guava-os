/**
 * `guava-os sync` — convergence engine (Wave 1: foundational modules).
 *
 * One primitive, SyncPlan, powers the three sync surfaces: config, Linear
 * labels, and canonical skill symlinks. Every function is pure — it computes
 * drift and returns a plan; nothing here touches disk or Linear.
 *
 *   buildSyncPlan(opts)      -> SyncPlan            (compose all three surfaces)
 *   migrateConfig(raw)       -> {config, changes}   (legacy -> canonical schema)
 *   reconcileLabels(c, e)    -> {create, stray}     (missing vs legacy labels)
 *   reconcileSymlinks(r, c)  -> {add, broken}       (missing vs dead symlinks)
 *   formatSyncPlan(plan)     -> string              (human-readable report)
 */

import { existsSync, readdirSync, readlinkSync, type Dirent } from "node:fs";
import { resolve } from "node:path";

/** One unit of drift: an item that must be added, changed, or flagged. */
export type SyncChangeKind = "add" | "change" | "flag";

export interface SyncChange {
  kind: SyncChangeKind;
  item: string;
  detail: string;
}

export interface SyncPlan {
  repo: string;
  /** True when any surface (config, labels, symlinks) has drifted. */
  drift: boolean;
  changes: {
    config: SyncChange[];
    labels: SyncChange[];
    symlinks: SyncChange[];
  };
}

/** One canonical skill's repo-link state (empty target = no link). */
export interface SkillLink {
  name: string;
  target: string;
  broken: boolean;
}

export interface BuildSyncPlanOpts {
  repoRoot: string;
  config: unknown;
  linearLabels: string[];
  skillLinks: SkillLink[];
}

export interface MigrateResult {
  config: Record<string, unknown>;
  changes: SyncChange[];
}

export interface LabelReconcile {
  create: string[];
  stray: string[];
}

export interface SymlinkReconcile {
  add: string[];
  broken: string[];
}

/** Canonical work classification labels. */
const CANONICAL_TYPES = ["Feature", "Bug", "Improvement", "Chore", "Spike"];

/** Canonical readiness label names. */
const CANONICAL_READINESS = {
  untriaged: "untriaged",
  ready: "ready-for-work",
  needs_rescoping: "needs-rescoping",
};

/** Canonical skill domains. */
const CANONICAL_DOMAINS = ["pm", "qa", "security", "backend", "frontend", "devops", "ai-ml"];

/** Legacy role labels (+ architect) that were removed in the domain model. */
const LEGACY_ROLE_LABELS = ["architect", "task", "reviewer", "designer", "scout", "sonic", "librarian"];

/**
 * Migrate a legacy config to the canonical schema. Idempotent: re-running on
 * an already-migrated config yields no changes.
 *
 * Roles are agent types, NOT domains — domains are never derived from roles.
 * They are seeded from the repo hint (`raw.domains`, falling back to the
 * canonical seven) and flagged for owner confirmation.
 */
export function migrateConfig(raw: unknown): MigrateResult {
  const changes: SyncChange[] = [];
  const src = isRecord(raw) ? raw : {};
  const config: Record<string, unknown> = { ...src };

  const invariants = isRecord(src.invariants)
    ? { ...(src.invariants as Record<string, unknown>) }
    : undefined;

  // 1. Drop the legacy role list.
  if ("roles" in config) {
    delete config.roles;
    changes.push({
      kind: "change",
      item: "roles",
      detail: "removed — roles are agent types, not domains",
    });
  }

  // 2. invariants.max_todo_per_role -> max_todo_per_domain.
  if (invariants && "max_todo_per_role" in invariants) {
    const value = invariants.max_todo_per_role;
    delete invariants.max_todo_per_role;
    invariants.max_todo_per_domain = value;
    config.invariants = invariants;
    changes.push({
      kind: "change",
      item: "invariants.max_todo_per_role",
      detail: "renamed to max_todo_per_domain",
    });
  } else if (invariants) {
    config.invariants = invariants;
  }

  // 3. branch_pattern dev/{role} -> dev/{domain}.
  if (typeof config.branch_pattern === "string" && config.branch_pattern.includes("{role}")) {
    config.branch_pattern = config.branch_pattern.split("{role}").join("{domain}");
    changes.push({
      kind: "change",
      item: "branch_pattern",
      detail: "dev/{role} → dev/{domain}",
    });
  }

  // 4. Inject canonical work types.
  if (!isStringArray(config.types)) {
    config.types = [...CANONICAL_TYPES];
    changes.push({ kind: "add", item: "types", detail: "injected canonical work types" });
  }

  // 5. Inject canonical readiness labels.
  if (!hasReadiness(config.readiness)) {
    config.readiness = { ...CANONICAL_READINESS };
    changes.push({ kind: "add", item: "readiness", detail: "injected canonical readiness labels" });
  }

  // 6. Seed domains + domainAgents from the repo hint; flag for confirmation.
  if (!hasDomainAgents(config.domainAgents)) {
    const hint = isStringArray(src.domains) ? (src.domains as string[]) : CANONICAL_DOMAINS;
    config.domains = dedupe(hint);
    config.domainAgents = buildDomainAgents(config.domains as string[]);
    changes.push({
      kind: "flag",
      item: "domainAgents",
      detail: "seeded from repo hint — confirm domain ownership",
    });
  }

  return { config, changes };
}

/**
 * Split labels: `create` = configured labels missing from Linear; `stray` =
 * known legacy/role labels present in Linear. Pure — never deletes. Stray
 * labels are reported for owner review, not removed.
 */
export function reconcileLabels(configured: string[], existing: string[]): LabelReconcile {
  const create = configured.filter((label) => !existing.includes(label));
  const stray = existing.filter((label) => LEGACY_ROLE_LABELS.includes(label));
  return { create, stray };
}

/**
 * Compare a repo's skill symlinks against the canonical skill store.
 * `add` = canonical skills missing a repo link; `broken` = repo links whose
 * target no longer exists.
 */
export function reconcileSymlinks(repoSkillDir: string, canonicalSkillDir: string): SymlinkReconcile {
  const canonical = listCanonicalSkills(canonicalSkillDir);
  const links = listRepoSkillLinks(repoSkillDir);

  const linked = new Set(links.map((l) => l.name));
  const add = canonical.filter((name) => !linked.has(name));
  const broken = links.filter((l) => l.broken).map((l) => l.name);

  return { add, broken };
}

/**
 * Compose all three surfaces into one SyncPlan. Pure: takes pre-scanned
 * inputs and returns drift; no writes.
 */
export function buildSyncPlan(opts: BuildSyncPlanOpts): SyncPlan {
  const { config: migrated, changes: configChanges } = migrateConfig(opts.config);

  const configured = configuredLabels(migrated);
  const { create, stray } = reconcileLabels(configured, opts.linearLabels);

  const labelChanges: SyncChange[] = [
    ...create.map(
      (label): SyncChange => ({ kind: "add", item: label, detail: "missing label — create" }),
    ),
    ...stray.map(
      (label): SyncChange => ({ kind: "flag", item: label, detail: "legacy/role label — review, never auto-delete" }),
    ),
  ];

  const symlinkChanges: SyncChange[] = opts.skillLinks
    .filter((link) => link.target === "" || link.broken)
    .map((link): SyncChange =>
      link.target === ""
        ? { kind: "add", item: link.name, detail: "missing symlink to canonical skill" }
        : { kind: "flag", item: link.name, detail: `dead symlink target → ${link.target}` },
    );

  const changes = { config: configChanges, labels: labelChanges, symlinks: symlinkChanges };
  const drift = configChanges.length + labelChanges.length + symlinkChanges.length > 0;

  return { repo: opts.repoRoot, drift, changes };
}

/** Human-readable report, grouped config / labels / symlinks. */
export function formatSyncPlan(plan: SyncPlan): string {
  const lines: string[] = [];
  lines.push(`sync plan — repo: ${plan.repo}`);
  lines.push(`drift: ${plan.drift ? "yes" : "none"}`);
  lines.push("");
  lines.push(`config (${plan.changes.config.length})`);
  appendChanges(lines, plan.changes.config);
  lines.push("");
  lines.push(`labels (${plan.changes.labels.length})`);
  appendChanges(lines, plan.changes.labels);
  lines.push("");
  lines.push(`symlinks (${plan.changes.symlinks.length})`);
  appendChanges(lines, plan.changes.symlinks);
  return lines.join("\n");
}

function appendChanges(lines: string[], changes: SyncChange[]): void {
  if (changes.length === 0) {
    lines.push("  (no drift)");
    return;
  }
  for (const change of changes) {
    lines.push(`  [${change.kind}] ${change.item} - ${change.detail}`);
  }
}

/** Union of type, readiness, and domain labels a repo's Linear should hold. */
function configuredLabels(config: Record<string, unknown>): string[] {
  const types = isStringArray(config.types) ? (config.types as string[]) : [];
  const domains = isStringArray(config.domains) ? (config.domains as string[]) : [];
  const readiness = isRecord(config.readiness)
    ? [
        (config.readiness as Record<string, unknown>).untriaged,
        (config.readiness as Record<string, unknown>).ready,
        (config.readiness as Record<string, unknown>).needs_rescoping,
      ].filter((v): v is string => typeof v === "string")
    : [];
  return dedupe([...types, ...readiness, ...domains]);
}

/** Domain → OMP agent type. */
function agentForDomain(domain: string): string {
  if (domain === "qa") return "reviewer";
  if (domain === "security") return "security-reviewer";
  if (domain === "frontend") return "designer";
  return "task";
}

function buildDomainAgents(domains: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const domain of domains) out[domain] = agentForDomain(domain);
  return out;
}

function listCanonicalSkills(canonicalSkillDir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(canonicalSkillDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => !e.name.startsWith(".") && (e.isDirectory() || e.isSymbolicLink()))
    .map((e) => e.name)
    .sort();
}

function listRepoSkillLinks(repoSkillDir: string): SkillLink[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(repoSkillDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isSymbolicLink())
    .map((e) => {
      const target = readlinkSafe(resolve(repoSkillDir, e.name));
      return { name: e.name, target, broken: !existsSync(resolve(repoSkillDir, target)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readlinkSafe(path: string): string {
  try {
    return readlinkSync(path);
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string");
}

function hasReadiness(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.untriaged === "string" &&
    typeof r.ready === "string" &&
    typeof r.needs_rescoping === "string"
  );
}

function hasDomainAgents(value: unknown): boolean {
  return isRecord(value) && Object.keys(value as Record<string, unknown>).length > 0;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
