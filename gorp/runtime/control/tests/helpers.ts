/**
 * Shared test helpers (Sprint 5A).
 *
 * Execution state stores projectId only; the repository path is resolved
 * from the project registry. Tests register their temp repos in a throwaway
 * registry file and point GORP_PROJECT_REGISTRY at it.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Write a throwaway registry mapping projectId -> repo path; returns its path. */
export function writeProjectRegistry(entries: Readonly<Record<string, string>>): string {
  const dir = mkdtempSync(join(tmpdir(), "gorp-registry-"));
  const path = join(dir, "projects.yml");
  const body =
    "projects:\n" +
    Object.entries(entries)
      .map(([id, repoPath]) => `  - id: ${id}\n    repo_path: ${repoPath}\n`)
      .join("");
  writeFileSync(path, body, "utf8");
  return path;
}

/** Register entries and set GORP_PROJECT_REGISTRY for the current process. */
export function registerProjects(entries: Readonly<Record<string, string>>): string {
  const path = writeProjectRegistry(entries);
  process.env["GORP_PROJECT_REGISTRY"] = path;
  return path;
}
