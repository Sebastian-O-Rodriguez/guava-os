/**
 * Role manifest loader + writable-root resolution (GOS-45 / GUA-178).
 *
 * The role manifest (registry/roles.yml) is the single source of truth for
 * v1 permissions: it maps each role to its allowed writable-root SPECIFIERS
 * (`self`, a registry id, `*`, or nothing). Specifiers are resolved to
 * absolute repo paths at launch time against the project registry — the
 * manifest never hardcodes a filesystem path (except the `guava-os` registry
 * id, which the registry owns).
 *
 * Prompt decides intent; permissions decide authority; repo ownership = write
 * authority.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { normalizePath } from "./path-guard.js";
import type { RegistryProject } from "./registry.js";

export interface RoleDef {
  id: string;
  description?: string;
  /** Writable-root specifiers: "self" | "<registry-id>" | "*" (empty = none). */
  writableRoots: string[];
}

/** Resolve the manifest path from GORP_ROLE_MANIFEST or module location. */
function resolveRolesPath(rolesPath?: string): string {
  if (rolesPath) return resolve(rolesPath);
  const envPath = process.env["GORP_ROLE_MANIFEST"];
  if (envPath) return resolve(envPath);
  // .guava-os/src/roles.ts → .guava-os/registry/roles.yml (works regardless of cwd)
  return resolve(dirname(__dirname), "registry", "roles.yml");
}

/** Strip surrounding single/double quotes from a parsed scalar. */
function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Conservative line-based YAML subset parser for the role manifest.
 * Reads `- id:` blocks with optional `description:` and a `writable_roots:`
 * list (`- <spec>` items; `writable_roots: []` = empty). Unknown keys ignored.
 * Throws if the content parses to zero roles.
 */
export function parseRoles(content: string): RoleDef[] {
  const roles: RoleDef[] = [];
  let current: RoleDef | null = null;
  let inRoots = false;

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();

    const idMatch = line.match(/^\s*-\s+id:\s*(.+?)\s*$/);
    if (idMatch) {
      if (current) roles.push(current);
      current = { id: unquote(idMatch[1]), writableRoots: [] };
      inRoots = false;
      continue;
    }

    if (!current) continue;
    if (line === "" || line.startsWith("#")) continue;

    const rootsHeader = line.match(/^\s+writable_roots:\s*(.*?)\s*$/);
    if (rootsHeader) {
      inRoots = true;
      // `writable_roots: []` — explicit empty list, stop collecting.
      if (rootsHeader[1] === "[]") {
        current.writableRoots = [];
        inRoots = false;
      }
      continue;
    }

    if (inRoots) {
      const item = line.match(/^\s*-\s+(.+?)\s*$/);
      if (item) current.writableRoots.push(unquote(item[1]));
      continue;
    }

    const descMatch = line.match(/^\s+description:\s*(.+?)\s*$/);
    if (descMatch) {
      current.description = unquote(descMatch[1]);
      continue;
    }
    // Unknown keys intentionally ignored
  }

  if (current) roles.push(current);

  if (roles.length === 0) {
    throw new Error("Role manifest parsed zero roles");
  }
  return roles;
}

/** Load and parse the role manifest from disk (or an explicit path). */
export function loadRoles(rolesPath?: string): RoleDef[] {
  const path = resolveRolesPath(rolesPath);
  if (!existsSync(path)) {
    throw new Error(`Role manifest not found: ${path}`);
  }
  return parseRoles(readFileSync(path, "utf-8"));
}

export interface ResolveRootsOptions {
  /** Registry id of the launched project (from --project). */
  projectId?: string;
  /** Absolute repo path of the launched project (from --project). */
  projectRepoPath?: string;
  registry: RegistryProject[];
}

/**
 * Resolve a role's writable-root specifiers to absolute repo paths.
 *
 *   self          -> the launched project's repo (requires projectRepoPath)
 *   <registry-id> -> that project's repo_path (throws if absent)
 *   *             -> every registry project's repo_path
 *
 * Results are deduplicated, order-preserving, and absolute.
 */
export function resolveWritableRoots(
  role: RoleDef,
  opts: ResolveRootsOptions,
): string[] {
  const roots: string[] = [];

  for (const spec of role.writableRoots) {
    if (spec === "self") {
      if (!opts.projectRepoPath) {
        throw new Error(
          `Role "${role.id}" uses writable root "self" but no --project repo_path was resolved`,
        );
      }
      roots.push(normalizePath(opts.projectRepoPath));
    } else if (spec === "*") {
      for (const r of opts.registry) {
        if (r.repoPath) roots.push(normalizePath(r.repoPath));
      }
    } else {
      const entry = opts.registry.find((r) => r.id === spec);
      if (!entry || !entry.repoPath) {
        throw new Error(
          `Role "${role.id}" writable root "${spec}" is not a registered project with a repo_path`,
        );
      }
      roots.push(normalizePath(entry.repoPath));
    }
  }

  return [...new Set(roots)];
}
