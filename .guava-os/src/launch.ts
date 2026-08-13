/**
 * Launcher — v1 agent permission model (GOS-45 / GUA-178).
 *
 * Prompt decides intent; permissions decide authority; repo ownership = write
 * authority. v1 is deliberately small: a launcher, a role manifest, git-worktree
 * isolation, and a fail-closed path allowlist. NO IAM/K8s/Vault.
 *
 * Flow:
 *   1. Read the role manifest (roles.ts) and project registry (registry.ts).
 *   2. Resolve --project to a registry id → repo_path.
 *   3. Bind the writable-root allowlist from the role (owned repo only;
 *      reviewer = none; operator = all registry repos).
 *   4. For a single-owned-repo role, create an isolated git worktree; that
 *      worktree dir joins the allowlist (it is a checkout of the owned repo).
 *   5. Emit the launch result: role, project, writable roots, worktree, and
 *      the stable GOS CLI path. Every downstream write must pass
 *      `assertWriteAllowed` — out-of-scope writes fail closed with a
 *      classified error, before anything touches disk.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cross-repo defect flow (foreign / GOS defect handling)
 *
 * A `project-agent` has write authority over ONLY its own repo. When it
 * detects a defect in a foreign project's repo or in guava-os itself:
 *
 *   1. RECORD — the agent records evidence in its own worktree (or a handoff
 *      note): affected paths, observed vs expected behavior, repro steps,
 *      and any relevant hashes/versions. It does NOT patch the foreign repo.
 *   2. HANDOFF — it creates a GOS issue (Linear ticket) under the owning
 *      project, attaching the evidence. The `operator` role owns approvals
 *      and cross-repo handoffs and is the only cross-repo writer.
 *   3. FIX — a GOS maintainer (or gos-agent) fixes the defect in the owning
 *      repo through its own governed path.
 *   4. RETRY — the project agent retries against stable GOS once the fix
 *      lands, never by reaching into the foreign checkout itself.
 *
 * This keeps repo ownership == write authority: the project agent cannot
 * silently "help" by patching a repo it does not own; evidence + handoff is
 * the only permitted response.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { loadRegistry, resolveRegistryProjectId, type RegistryProject } from "./registry.js";
import { loadRoles, resolveWritableRoots, type RoleDef } from "./roles.js";
import { normalizePath } from "./path-guard.js";
import { createWorktree, type Worktree } from "./worktree.js";

/** Resolve the guava-os repo root from this module's location. */
export function guavaOsRoot(): string {
  // .guava-os/src/launch.ts → repo root
  return resolve(dirname(dirname(__dirname)));
}

/** Path to the stable GOS CLI exposed to launched agents. */
export function gosCliPath(): string {
  return join(guavaOsRoot(), ".guava-os", "bin", "guava-os");
}

/** Machine-local state root for launch worktrees (never inside a consumer tree). */
export function launchStateRoot(): string {
  const xdg = process.env["XDG_STATE_HOME"];
  return xdg
    ? resolve(xdg, "guava-os")
    : resolve(homedir(), ".local", "state", "guava-os");
}

/** Deterministic worktree directory given a state root + ids + unique suffix. */
export function computeWorktreeDir(
  stateRoot: string,
  projectId: string,
  roleId: string,
  suffix: string,
): string {
  return join(stateRoot, "worktrees", projectId, `${roleId}-${suffix}`);
}

/** Registry entry repo_path → absolute path. */
function repoPathOf(projectId: string, registry: RegistryProject[]): string {
  const entry = registry.find((r) => r.id === projectId);
  if (!entry || !entry.repoPath) {
    throw new Error(`Registry project "${projectId}" has no repo_path`);
  }
  return normalizePath(entry.repoPath);
}

export interface LaunchTarget {
  role: RoleDef;
  roleId: string;
  /** Registry id of the target project (undefined for a bare operator launch). */
  projectId?: string;
  /** Absolute repo path of the target project (read target / owned repo). */
  projectRepoPath?: string;
  /** Absolute writable roots (the allowlist). Reviewer → []. */
  writableRoots: string[];
  /** True when exactly one owned repo → create an isolated worktree. */
  createWorktree: boolean;
}

/**
 * Resolve a launch to its target + allowlist. Pure w.r.t. git/filesystem:
 * reads only the in-memory roles + registry. This is the testable core.
 */
export function resolveLaunchTarget(
  roleId: string,
  projectArg: string | undefined,
  roles: RoleDef[],
  registry: RegistryProject[],
): LaunchTarget {
  const role = roles.find((r) => r.id === roleId);
  if (!role) {
    throw new Error(
      `Unknown role "${roleId}" — known roles: ${roles.map((r) => r.id).join(", ")}`,
    );
  }

  // A single concrete registry-id root (e.g. gos-agent → "guava-os") pins the
  // target project without needing --project.
  const singleSpec =
    role.writableRoots.length === 1 ? role.writableRoots[0] : undefined;
  const pinnedId =
    singleSpec && singleSpec !== "self" && singleSpec !== "*" ? singleSpec : undefined;

  let projectId = pinnedId;
  let projectRepoPath = pinnedId ? repoPathOf(pinnedId, registry) : undefined;

  if (projectArg) {
    projectId = resolveRegistryProjectId(projectArg, registry);
    projectRepoPath = repoPathOf(projectId, registry);
  }

  if (role.writableRoots.length === 0 && !projectArg && !pinnedId) {
    throw new Error(
      `Role "${roleId}" is read-only and requires --project to select its read target`,
    );
  }

  const writableRoots = resolveWritableRoots(role, {
    projectId,
    projectRepoPath,
    registry,
  });

  // Single owned repo → worktree isolation; the worktree dir joins the
  // allowlist at launch time (a checkout of the owned repo).
  const createWorktree = writableRoots.length === 1;
  if (createWorktree) {
    projectRepoPath = writableRoots[0];
  }

  return { role, roleId, projectId, projectRepoPath, writableRoots, createWorktree };
}

export interface LaunchResult {
  role: string;
  roleDescription?: string;
  projectId?: string;
  projectRepoPath?: string;
  writableRoots: string[];
  worktree: { dir: string; branch: string; baseCommit: string } | null;
  gosCli: string;
  enforcement: "path-allowlist (fail-closed)";
}

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

/**
 * Run the launch command: parse argv, bind the allowlist, create the worktree,
 * and emit the result. Writes only the worktree (created under the state root)
 * and stdout — nothing else.
 */
export function runLaunch(args: string[], jsonMode: boolean): LaunchResult {
  const roleId = flag(args, "--role");
  const projectArg = flag(args, "--project");

  if (!roleId) {
    throw new Error(
      "launch: --role is required (project-agent | gos-agent | reviewer | operator)",
    );
  }

  const roles = loadRoles();
  const registry = loadRegistry();
  const target = resolveLaunchTarget(roleId, projectArg, roles, registry);

  let worktree: LaunchResult["worktree"] = null;
  let writableRoots = target.writableRoots;

  if (target.createWorktree && target.projectRepoPath && target.projectId) {
    const stateRoot = launchStateRoot();
    const suffix = `${Date.now()}`;
    const dir = computeWorktreeDir(
      stateRoot,
      target.projectId,
      target.roleId,
      suffix,
    );
    mkdirSync(dirname(dir), { recursive: true });
    const branch = `guava-os/launch/${target.projectId}/${target.roleId}-${suffix}`;
    const wt: Worktree = createWorktree(target.projectRepoPath, dir, branch);
    worktree = { dir: wt.dir, branch: wt.branch, baseCommit: wt.baseCommit };
    // The worktree is a checkout of the owned repo — writing inside it is in scope.
    writableRoots = [...writableRoots, wt.dir];
  }

  const result: LaunchResult = {
    role: target.roleId,
    roleDescription: target.role.description,
    projectId: target.projectId,
    projectRepoPath: target.projectRepoPath,
    writableRoots,
    worktree,
    gosCli: gosCliPath(),
    enforcement: "path-allowlist (fail-closed)",
  };

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatLaunch(result));
  }
  return result;
}

function formatLaunch(r: LaunchResult): string {
  const lines: string[] = [];
  lines.push("guava-os launch — v1 permission model");
  lines.push(`role:            ${r.role}${r.roleDescription ? ` (${r.roleDescription})` : ""}`);
  if (r.projectId) {
    lines.push(`project:         ${r.projectId}${r.projectRepoPath ? ` → ${r.projectRepoPath}` : ""}`);
  }
  lines.push(`writable roots:  ${r.writableRoots.length}`);
  if (r.writableRoots.length === 0) {
    lines.push("  (none — read/test only)");
  }
  for (const root of r.writableRoots) {
    lines.push(`  - ${root}`);
  }
  if (r.worktree) {
    lines.push(`worktree:        ${r.worktree.dir}`);
    lines.push(`  branch:        ${r.worktree.branch}`);
    lines.push(`  base:          ${r.worktree.baseCommit}`);
  } else {
    lines.push("worktree:        (none)");
  }
  lines.push(`GOS CLI:         ${r.gosCli}`);
  lines.push("enforcement:     fail-closed path allowlist — writes outside writable roots are rejected");
  return lines.join("\n");
}
