/**
 * Git-worktree isolation for the launcher (GOS-45 / GUA-178).
 *
 * A local re-implementation of gorp's `runtime/control/src/sandbox/worktree.ts`
 * pattern (gorp is a separate package with its own GorpError boundary, so it is
 * not importable from guava-os). The worktree directory lives under the
 * machine-local launch state root — never inside the consumer working tree.
 * Creating a worktree necessarily registers git-native metadata (a branch ref
 * and a `.git/worktrees` entry) in the consumer's `.git`; the consumer WORKING
 * TREE is never touched and stays clean.
 *
 * Shell is used only at this git boundary; all calls are synchronous.
 */

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

export interface Worktree {
  readonly dir: string;
  readonly branch: string;
  readonly repositoryPath: string;
  readonly baseCommit: string;
}

function git(args: readonly string[], cwd: string): string {
  try {
    return execFileSync("git", args as string[], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e as { status?: number; stderr?: string; message?: string };
    throw new Error(
      `launch worktree: git ${args[0] ?? ""} failed (exit ${
        err.status ?? "?"
      }): ${(err.stderr ?? err.message ?? "").toString().slice(0, 2000)}`,
    );
  }
}

/**
 * Create an isolated worktree on a new branch at the repository's HEAD.
 * Fails closed on missing repo, non-git repo, or an already-existing dir.
 */
export function createWorktree(
  repositoryPath: string,
  dir: string,
  branch: string,
): Worktree {
  if (!existsSync(repositoryPath)) {
    throw new Error(`launch worktree: repository does not exist: ${repositoryPath}`);
  }
  git(["rev-parse", "--git-dir"], repositoryPath);
  if (existsSync(dir)) {
    throw new Error(`launch worktree: directory already exists: ${dir}`);
  }
  const baseCommit = git(["rev-parse", "HEAD"], repositoryPath).trim();
  git(["worktree", "add", "-b", branch, dir, baseCommit], repositoryPath);
  return { dir, branch, repositoryPath, baseCommit };
}

/** Destroy the worktree: remove the worktree and its branch (best-effort). */
export function destroyWorktree(worktree: Worktree): void {
  try {
    git(["worktree", "remove", "--force", worktree.dir], worktree.repositoryPath);
  } catch {
    rmSync(worktree.dir, { recursive: true, force: true });
    try {
      git(["worktree", "prune"], worktree.repositoryPath);
    } catch {
      /* best-effort */
    }
  }
  try {
    git(["branch", "-D", worktree.branch], worktree.repositoryPath);
  } catch {
    /* branch may not exist if creation failed early */
  }
}
