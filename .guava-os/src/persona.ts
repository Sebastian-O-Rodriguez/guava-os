/**
 * Persona → worker-profile resolution (GOS-46 / GUA-179).
 *
 * guava-os owns persona resolution (ADR_001). A graph node carries a
 * `persona` label; this module resolves that label to the concrete worker
 * profile — the OMP model tier, the persona body delivered as the system
 * prompt, and (GOS-74-lite) a capability-scoped tool allowlist — by reading
 * `.guava-os/personas/<name>/persona.md`.
 *
 * The gorp omp adapter stays source-neutral: it never reads these paths. It
 * consumes the resolved profile as environment (`GORP_OMP_MODEL`,
 * `GORP_OMP_SYSTEM_PROMPT_APPEND`, `GORP_OMP_TOOLS`) plus `node.persona` as
 * data, and FAILS CLOSED when the profile is not present (no weak/default
 * fallback).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** A fully resolved worker profile for one persona. */
export interface ResolvedPersona {
  /** The persona label (matches the directory name under `.guava-os/personas/`). */
  readonly name: string;
  /** OMP model tier (`smol` | `default` | `slow`), from the persona frontmatter. */
  readonly model: string;
  /** The persona body — everything after the frontmatter — delivered as the system prompt. */
  readonly systemPrompt: string;
  /** Optional capability-scoped tool allowlist (GOS-74-lite), from frontmatter `tools:`. */
  readonly tools?: readonly string[];
}

/** The worker-profile environment the gorp omp adapter consumes. */
export type PersonaEnv = {
  readonly GORP_OMP_MODEL: string;
  readonly GORP_OMP_SYSTEM_PROMPT_APPEND: string;
  /** Comma-joined tool allowlist (optional). Absent = adapter uses its default tool set. */
  readonly GORP_OMP_TOOLS?: string;
};

/** `---`-delimited frontmatter followed by the body. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * Resolve a persona label to its worker profile.
 *
 * Fails closed: a missing file, a missing/empty `model`, or an empty body is
 * a resolution error — never a silent default.
 */
export function resolvePersona(name: string, repoRoot: string): ResolvedPersona {
  const file = join(repoRoot, ".guava-os", "personas", name, "persona.md");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    throw new Error(`persona '${name}' not found at ${file}`);
  }

  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(`persona '${name}' has no valid frontmatter (expected '---'-delimited YAML) at ${file}`);
  }
  const frontmatter = match[1]!;
  const body = match[2]!;

  const model = /^model:\s*(\S+)\s*$/m.exec(frontmatter)?.[1]?.trim();
  if (!model) {
    throw new Error(
      `persona '${name}' has no model tier (add 'model: <smol|default|slow>' to its frontmatter at ${file})`,
    );
  }

  // GOS-74-lite: capability-scoped tool allowlist from frontmatter `tools: [...]`.
  const toolsRaw = /^tools:\s*\[([^\]]*)\]\s*$/m.exec(frontmatter)?.[1];
  const tools = toolsRaw
    ? toolsRaw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
    : undefined;

  const systemPrompt = body.trim();
  if (!systemPrompt) {
    throw new Error(`persona '${name}' has an empty body (nothing to append as the system prompt)`);
  }

  return { name, model, systemPrompt, ...(tools ? { tools } : {}) };
}

/** Turn a resolved persona into the environment the omp adapter reads. */
export function personaEnv(resolved: ResolvedPersona): PersonaEnv {
  return {
    GORP_OMP_MODEL: resolved.model,
    GORP_OMP_SYSTEM_PROMPT_APPEND: resolved.systemPrompt,
    ...(resolved.tools ? { GORP_OMP_TOOLS: resolved.tools.join(",") } : {}),
  };
}
