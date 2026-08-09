import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { Config } from "./config.js";
import { allPersonaLabels } from "./config.js";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface LinearLabelInfo {
  labels: string[];
}

/**
 * Doctor checks. All checks are read-only — filesystem reads only.
 *
 * LINEAR DATA:
 * The CLI has no network layer. It does not query Linear directly.
 * "Linear data provided" means the caller (agent, MCP tools) successfully
 * fetched data from Linear and piped it to this CLI via stdin.
 * The `linearDataProvided` parameter is a signal from the caller, not
 * a connectivity check performed by the CLI.
 *
 * This is by design: the CLI is a pure data processor. Network access
 * is the caller's responsibility. The CLI validates structure, not connectivity.
 */
export function runDoctor(
  repoRoot: string,
  config: Config,
  linearDataProvided: boolean,
  linearLabels?: LinearLabelInfo,
): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Config file exists and parses
  const configPath = resolve(repoRoot, ".guava-os", "config.json");
  results.push({
    name: "config",
    passed: existsSync(configPath),
    detail: existsSync(configPath)
      ? ".guava-os/config.json valid"
      : ".guava-os/config.json not found",
  });

  // 2. AGENTS.md exists and has authority hierarchy
  const agentsPath = resolve(repoRoot, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    const hasAuthority = content.includes("ADR_001");
    results.push({
      name: "agents-md",
      passed: hasAuthority,
      detail: hasAuthority
        ? "AGENTS.md present, ADR_001 authority reference found"
        : "AGENTS.md present but missing ADR_001 authority reference",
    });
  } else {
    results.push({ name: "agents-md", passed: false, detail: "AGENTS.md not found" });
  }


  // 3. Process docs exist
  const processEntries = Object.entries(config.process_files);
  const processFound = processEntries.filter(([, p]) => existsSync(resolve(repoRoot, p))).length;
  results.push({
    name: "protocol",
    passed: processFound === processEntries.length,
    detail: `${processFound}/${processEntries.length} process docs found`,
  });

  // 4. Linear issue graph loaded
  // NOTE: This check does NOT query Linear. It checks whether the caller
  // provided data via stdin. Network connectivity is the caller's domain.
  results.push({
    name: "linear",
    passed: linearDataProvided,
    detail: linearDataProvided
      ? `${config.linear.team} / ${config.linear.project} — issue graph loaded`
      : "no Linear data provided (caller must pipe issue/label data via stdin)",
  });

  // 5. Every configured persona has a matching Linear label (if data provided)
  if (linearDataProvided && linearLabels) {
    const requiredLabels = allPersonaLabels(config);
    const missingLabels = requiredLabels.filter(l => !linearLabels.labels.includes(l));
    results.push({
      name: "labels",
      passed: missingLabels.length === 0,
      detail: missingLabels.length === 0
        ? `${requiredLabels.length}/${requiredLabels.length} persona labels found in Linear data`
        : `missing Linear labels: ${missingLabels.join(", ")}`,
    });
  } else {
    results.push({
      name: "labels",
      passed: false,
      detail: linearDataProvided
        ? "label data not provided — pass {labels:[...]} via stdin for full check"
        : "skipped (no Linear data provided)",
    });
  }

  // 6. Gitignore includes manifest
  const gitignorePath = resolve(repoRoot, ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf-8");
    const hasManifest = gitignore.includes(config.manifest_path);
    results.push({
      name: "gitignore",
      passed: hasManifest,
      detail: hasManifest
        ? `${config.manifest_path} is gitignored`
        : `${config.manifest_path} not in .gitignore`,
    });
  } else {
    results.push({ name: "gitignore", passed: false, detail: ".gitignore not found" });
  }

  return results;
}

export function formatDoctor(results: CheckResult[]): string {
  const lines: string[] = ["DOCTOR", ""];
  for (const r of results) {
    const icon = r.passed ? "\u2713" : "\u2717";
    lines.push(`  ${icon} ${r.name.padEnd(14)} ${r.detail}`);
  }
  const passed = results.filter(r => r.passed).length;
  lines.push("");
  lines.push(`RESULT: ${passed}/${results.length} passed`);
  return lines.join("\n");
}
