#!/usr/bin/env node

/**
 * agent-os CLI — Guava internal tooling
 *
 * READ-ONLY: This CLI never mutates Linear, git, or any external state.
 * It reads issue data from stdin (JSON) and validates/reports execution state.
 *
 * Usage:
 *   npx tsx .agent-os/src/cli.ts doctor
 *   npx tsx .agent-os/src/cli.ts status < issues.json
 *   npx tsx .agent-os/src/cli.ts validate < issues.json
 *   npx tsx .agent-os/src/cli.ts validate --strict < issues.json
 *
 * Stdin format for doctor:
 *   { "issues": [...], "labels": ["architect", "backend", ...] }
 *
 * Stdin format for status/validate:
 *   [issue, issue, ...]   (array of Linear issues)
 */

import { findRepoRoot, loadConfig } from "./config.js";
import { buildGraph, type LinearIssue } from "./linear.js";
import { runDoctor, formatDoctor, type LinearLabelInfo } from "./doctor.js";
import { formatStatus, formatStatusJson } from "./status.js";
import { runValidate, formatValidate } from "./validate.js";
import { generateNext, formatNext } from "./next.js";
import { readFileSync } from "fs";

function usage(): never {
  console.log(`agent-os <command> [flags]

Commands:
  doctor    Verify repo Agent OS setup
  status    Show executable queue by persona
  validate  Detect protocol violations in issue graph
  next      Generate operator-ready launch directives

Flags:
  --json           Output as JSON instead of human-readable text
  --strict         (validate only) Treat warnings as errors
  --persona <name> (next only) Filter directives to a single persona

Stdin:
  doctor accepts: { "issues": [...], "labels": [...] }
  status/validate/next accept: [ issue, issue, ... ]

All commands are read-only. No Linear mutations.`);
  process.exit(0);
}

function readStdin(): string {
  try {
    return readFileSync("/dev/stdin", "utf-8");
  } catch {
    return "";
  }
}

function parseIssuesFromStdin(stdin: string): LinearIssue[] {
  if (!stdin) {
    console.error("error: command requires issue data on stdin");
    console.error("usage: echo '<issues json>' | agent-os <command>");
    process.exit(1);
  }
  try {
    const parsed = JSON.parse(stdin);
    if (!Array.isArray(parsed)) {
      throw new Error("expected array");
    }
    return parsed;
  } catch {
    console.error("error: stdin must be a JSON array of Linear issues");
    process.exit(1);
  }
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jsonMode = args.includes("--json");
  const strictMode = args.includes("--strict");

  if (!command || command === "--help" || command === "-h") usage();

  // Subcommand --help: show usage for any known command
  if (args.includes("--help") || args.includes("-h")) {
    const known = ["doctor", "status", "validate", "next"];
    if (known.includes(command)) usage();
  }

  const repoRoot = findRepoRoot();
  const config = loadConfig(repoRoot);

  switch (command) {
    case "doctor": {
      const stdin = readStdin().trim();
      let linearDataProvided = false;
      let linearLabels: LinearLabelInfo | undefined;

      if (stdin) {
        try {
          const parsed = JSON.parse(stdin);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            linearDataProvided = Array.isArray(parsed.issues);
            if (Array.isArray(parsed.labels)) {
              linearLabels = { labels: parsed.labels };
            }
          } else if (Array.isArray(parsed)) {
            linearDataProvided = true;
          }
        } catch {
          linearDataProvided = false;
        }
      }

      const results = runDoctor(repoRoot, config, linearDataProvided, linearLabels);
      if (jsonMode) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(formatDoctor(results));
      }
      process.exit(results.every(r => r.passed) ? 0 : 1);
    }

    case "status": {
      const issues = parseIssuesFromStdin(readStdin().trim());
      const graph = buildGraph(issues, config);

      if (jsonMode) {
        console.log(JSON.stringify(formatStatusJson(graph), null, 2));
      } else {
        console.log(formatStatus(graph));
      }
      process.exit(graph.summary.totalExecutable > 0 ? 0 : 1);
    }

    case "validate": {
      const issues = parseIssuesFromStdin(readStdin().trim());
      const graph = buildGraph(issues, config);
      const result = runValidate(graph, issues, config);

      if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatValidate(result));
      }

      // Exit 0 if no errors (warnings OK unless --strict)
      const hasFailures = strictMode
        ? result.summary.total > 0
        : result.summary.errors > 0;
      process.exit(hasFailures ? 1 : 0);
    }

    case "next": {
      const issues = parseIssuesFromStdin(readStdin().trim());
      const graph = buildGraph(issues, config);

      // Parse --persona flag
      const personaIdx = args.indexOf("--persona");
      const personaFilter = personaIdx !== -1 ? args[personaIdx + 1] : undefined;

      const result = generateNext(graph, config, personaFilter);

      if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatNext(result));
      }
      process.exit(result.directives.length > 0 ? 0 : 1);
    }

    default:
      console.error(`unknown command: ${command}`);
      console.error("run 'agent-os --help' for usage");
      process.exit(1);
  }
}

main();
