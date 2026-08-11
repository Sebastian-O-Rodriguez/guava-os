/**
 * Registry loader — maps Linear project names to canonical GOS registry ids.
 *
 * The project registry (projects.yml) is the single source of truth
 * for project identity. Linear project names are a fetch-time concern;
 * SprintDocument.projectId MUST carry the registry id, never a Linear name.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface RegistryProject {
  id: string;
  name?: string;
  linearProject?: string;
  repoPath?: string;
}

/**
 * Resolve the registry path from GORP_PROJECT_REGISTRY env var, or derive it
 * from this module's location (works regardless of cwd).
 */
function resolveRegistryPath(registryPath?: string): string {
  if (registryPath) return registryPath;
  const envPath = process.env["GORP_PROJECT_REGISTRY"];
  if (envPath) return resolve(envPath);
  // Derive from module location: .guava-os/src/registry.ts → .guava-os/registry/projects.yml
  const modDir = dirname(fileURLToPath(import.meta.url));
  return resolve(modDir, "..", "registry", "projects.yml");
}

/**
 * Conservative line-based YAML subset parser.
 * Reads exactly `- id:` blocks with `name:`, `linear_project:`, `repo_path:` scalar keys.
 * Unknown keys are ignored. Throws if the file is missing or parses to zero projects.
 */
export function loadRegistry(registryPath?: string): RegistryProject[] {
  const path = resolveRegistryPath(registryPath);
  if (!existsSync(path)) {
    throw new Error(`Registry file not found: ${path}`);
  }

  const lines = readFileSync(path, "utf-8").split("\n");
  const projects: RegistryProject[] = [];
  let current: RegistryProject | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    // Detect project start: "- id: <value>"
    const idMatch = line.match(/^\s*-\s+id:\s*(.+?)\s*$/);
    if (idMatch) {
      if (current) projects.push(current);
      current = { id: idMatch[1] };
      continue;
    }

    if (current) {
      // Skip comment-only and empty lines inside a block
      if (line === "" || line.startsWith("#")) continue;

      const nameMatch = line.match(/^\s+name:\s*(.+?)\s*$/);
      if (nameMatch) { current.name = nameMatch[1]; continue; }

      const lpMatch = line.match(/^\s+linear_project:\s*(.+?)\s*$/);
      if (lpMatch) { current.linearProject = lpMatch[1]; continue; }

      const rpMatch = line.match(/^\s+repo_path:\s*(.+?)\s*$/);
      if (rpMatch) { current.repoPath = rpMatch[1]; continue; }

      // Unknown keys (lifecycle, notes, etc.) intentionally ignored
    }
  }

  if (current) projects.push(current);

  if (projects.length === 0) {
    throw new Error(`Registry parsed zero projects from: ${path}`);
  }

  return projects;
}

/**
 * Resolve a Linear project name to its canonical registry id.
 *
 * Match rule:
 * 1. Entry whose `linearProject` equals the argument.
 * 2. Fall back to entry whose `id` equals the argument.
 * 3. Otherwise throw — never return undefined, never silently emit the Linear name.
 */
export function resolveRegistryProjectId(
  linearProject: string,
  registry: RegistryProject[],
): string {
  // Match by linear_project
  const byLinear = registry.find(
    (r) => r.linearProject === linearProject,
  );
  if (byLinear) return byLinear.id;

  // Fall back to id match
  const byId = registry.find((r) => r.id === linearProject);
  if (byId) return byId.id;

  throw new Error(
    `Unregistered Linear project "${linearProject}" — no matching linear_project or id in registry`,
  );
}
