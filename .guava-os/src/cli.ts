#!/usr/bin/env node

/**
 * guava-os CLI — project management + execution-state tooling.
 *
 * Read-only commands (doctor/status/validate/next) inspect issue data from
 * stdin. PM commands (pm <subcommand>) talk to Linear through the guava-os
 * tooling layer — the single supported Linear interface (GOS-18/GOS-19).
 *
 * Usage:
 *   npx tsx .guava-os/src/cli.ts doctor
 *   npx tsx .guava-os/src/cli.ts status < issues.json
 *   npx tsx .guava-os/src/cli.ts validate < issues.json
 *   npx tsx .guava-os/src/cli.ts work
 *   npx tsx .guava-os/src/cli.ts triage
 *   npx tsx .guava-os/src/cli.ts triage --all
 *   npx tsx .guava-os/src/cli.ts pm get-issue GUA-45
 *   npx tsx .guava-os/src/cli.ts pm search --status Todo
 *   npx tsx .guava-os/src/cli.ts register my-proj --repo ~/dev/repos/my-proj --remote https://github.com/owner/my-proj.git
 *   npx tsx .guava-os/src/cli.ts pm create --title "..." --team "Guava AI"
 *   npx tsx .guava-os/src/cli.ts pm update GUA-45 --status Done
 *   npx tsx .guava-os/src/cli.ts pm link GUA-45 --blocked-by GUA-47
 *   npx tsx .guava-os/src/cli.ts pm unlink GUA-45 --blocked-by GUA-47
 *   npx tsx .guava-os/src/cli.ts pm move GUA-45 --status "In Progress"
 *   npx tsx .guava-os/src/cli.ts pm assign GUA-45 --assignee me
 *   npx tsx .guava-os/src/cli.ts pm archive GUA-45
 *   npx tsx .guava-os/src/cli.ts pm comment GUA-45 --body "..."
 *
 * Stdin format for doctor: { "issues": [...], "labels": [...] }
 * Stdin format for status/validate/next: [ issue, issue, ... ]
 */

import { findRepoRoot, loadConfig, type Config } from "./config.js";
import { buildGraph, type LinearIssue } from "./linear.js";
import { runDoctor, formatDoctor, type LinearLabelInfo } from "./doctor.js";
import { formatStatus, formatStatusJson } from "./status.js";
import { runValidate, formatValidate } from "./validate.js";
import { generateNext, formatNext } from "./next.js";
import { readFileSync } from "fs";
import * as pm from "./linear-client.js";
import { runRegister } from "./register.js";
import { runWork } from "./work.js";
import { runTriage } from "./triage.js";

function usage(): never {
  console.log(`guava-os <command> [flags]

Commands:
  doctor    Verify repo Guava OS setup
  status    Show executable queue by domain
  validate  Detect protocol violations in issue graph
  next      Generate operator-ready launch directives
  pm        Project management via Linear (see: pm --help)
  work      Show open work by domain (--all for every project; session gate)
  triage    Set readiness labels on open Todo deliverables (--all for every project)
  register  Register a project: create repo + record git_remote (see: register --help)
Flags:
  --json           Output as JSON instead of human-readable text
  --strict         (validate only) Treat warnings as errors
  --domain <name> (next only) Filter directives to a single domain

Stdin:
  doctor accepts: { "issues": [...], "labels": [...] }
  status/validate/next accept: [ issue, issue, ... ]

PM commands talk to Linear through the guava-os tooling layer.`);
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
    console.error("usage: echo '<issues json>' | guava-os <command>");
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

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const jsonMode = args.includes("--json");
  const strictMode = args.includes("--strict");

  if (!command || command === "--help" || command === "-h") usage();

  // Subcommand --help: show usage for any known command
  if (args.includes("--help") || args.includes("-h")) {
    const known = ["doctor", "status", "validate", "next", "work", "triage", "register"];
    if (known.includes(command)) usage();
  }


  // register creates the repo + registry entry; no config needed.
  if (command === "register") {
    runRegister(args.slice(1), jsonMode);
    process.exit(0);
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

      // Parse --domain flag
      const domainIdx = args.indexOf("--domain");
      const domainFilter = domainIdx !== -1 ? args[domainIdx + 1] : undefined;

      const result = generateNext(graph, config, domainFilter);

      if (jsonMode) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatNext(result));
      }
      process.exit(result.directives.length > 0 ? 0 : 1);
    }

    case "pm": {
      await runPm(args.slice(1), config, jsonMode);
      process.exit(0);
    }
    case "work": {
      process.exit(await runWork(args.slice(1), jsonMode));
    }
    case "triage": {
      process.exit(await runTriage(args.slice(1), jsonMode));
    }


    default:
      console.error(`unknown command: ${command}`);
      console.error("run 'guava-os --help' for usage");
      process.exit(1);
  }
}

main();

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function flagAll(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && i + 1 < args.length) out.push(args[i + 1]);
  }
  return out;
}

async function runPm(
  args: string[],
  config: Config,
  jsonMode: boolean,
): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);

  if (!sub || sub === "--help" || sub === "-h") {
    console.log(`guava-os pm <subcommand> [flags]

Subcommands:
  get-project              Fetch project metadata
  get-sprint [parent-id]   Fetch sprint (parent + children)
  get-issue <id>           Fetch a single issue
  search [flags]           Search issues (--project, --status, --label, --assignee, --archived)
  create [flags]           Create an issue (--title, --team, --project, --parent, --label, --priority, --status, --assignee)
  update <id> [flags]      Update an issue (--title, --description, --priority, --assignee, --status, --label, --parent; --parent none detaches)
  link <id> [flags]        Link dependencies (--blocks, --blocked-by)
  unlink <id> [flags]      Remove dependencies (--blocks, --blocked-by)
  move <id> --status <s> [--allow-no-commit]  Move status
  assign <id> --assignee <a>  Assign issue
  archive <id>             Archive an issue (non-destructive; keeps full history)
  comment <id> --body <t>  Create a comment

All PM commands talk to Linear through the guava-os tooling layer.`);
    return;
  }

  switch (sub) {
    case "get-project": {
      const proj = await pm.getProject(config, flag(rest, "--project"));
      console.log(jsonMode ? JSON.stringify(proj, null, 2) : `${proj.name} (${proj.id})\n${proj.url ?? ""}`);
      return;
    }
    case "get-sprint": {
      const sprint = await pm.getSprint(config, rest[0]);
      console.log(jsonMode ? JSON.stringify(sprint, null, 2) : `${sprint.title} (${sprint.id}) [${sprint.status}]\n${sprint.children.length} children`);
      return;
    }
    case "get-issue": {
      const issue = await pm.getIssue(rest[0]);
      console.log(jsonMode ? JSON.stringify(issue, null, 2) : `${issue.identifier ?? issue.id} ${issue.title} [${issue.status}]`);
      return;
    }
    case "search": {
      const projectName = flag(rest, "--project");
      const result = await pm.searchIssues(config, {
        projectId: projectName ? (await pm.getProject(config, projectName)).id : undefined,
        status: flag(rest, "--status"),
        label: flag(rest, "--label"),
        assignee: flag(rest, "--assignee"),
        includeArchived: rest.includes("--archived"),
      });
      console.log(jsonMode ? JSON.stringify(result.issues, null, 2) : result.issues.map((i) => `${i.identifier ?? i.id} ${i.title} [${i.status}]`).join("\n") || "(none)");
      return;
    }
    case "create": {
      const description = flag(rest, "--description");
      const labels = flagAll(rest, "--label");
      pm.assertCanonicalDescription(description);
      const resolvedLabels = pm.resolveCreateLabels(config, labels);
      const issue = await pm.createIssue({
        title: flag(rest, "--title")!,
        description,
        teamId: flag(rest, "--team") ?? config.linear.team,
        projectId: flag(rest, "--project"),
        parentId: flag(rest, "--parent"),
        labels: resolvedLabels,
        priority: flag(rest, "--priority") ? Number(flag(rest, "--priority")) : undefined,
        status: flag(rest, "--status"),
        assigneeId: flag(rest, "--assignee"),
      });
      console.log(jsonMode ? JSON.stringify(issue, null, 2) : `Created: ${issue.identifier ?? issue.id} ${issue.title}`);
      return;
    }
    case "update": {
      const labels = flagAll(rest, "--label");
      const parentRaw = flag(rest, "--parent");
      const issue = await pm.updateIssue(rest[0], {
        title: flag(rest, "--title"),
        description: flag(rest, "--description"),
        priority: flag(rest, "--priority") ? Number(flag(rest, "--priority")) : undefined,
        assigneeId: flag(rest, "--assignee"),
        status: flag(rest, "--status"),
        // --parent <GUA-N> attaches; --parent none detaches (clears parent).
        parentId: parentRaw === undefined ? undefined : (parentRaw === "none" || parentRaw === "null" ? null : parentRaw),
        // undefined (not []) when --label omitted — never wipe existing labels (GUA-96)
        labels: labels.length > 0 ? labels : undefined,
      });
      console.log(jsonMode ? JSON.stringify(issue, null, 2) : `Updated: ${issue.id} ${issue.title}`);
      return;
    }
    case "link": {
      await pm.linkDependencies(rest[0], {
        blocks: flagAll(rest, "--blocks"),
        blockedBy: flagAll(rest, "--blocked-by"),
      });
      console.log("Dependencies linked.");
      return;
    }
    case "unlink": {
      await pm.unlinkDependencies(rest[0], {
        blocks: flagAll(rest, "--blocks"),
        blockedBy: flagAll(rest, "--blocked-by"),
      });
      console.log("Dependencies unlinked.");
      return;
    }
    case "move": {
      const issueId = rest[0];
      const status = flag(rest, "--status")!;
      const allowNoCommit = rest.includes("--allow-no-commit");
      const issue = await pm.moveStatus(issueId, status, config, { allowNoCommit });
      if (allowNoCommit) {
        const body = `Done-commit gate waived via --allow-no-commit: moved to ${status} without a commit referencing ${issue.identifier}.`;
        await pm.createComment(issue.id, body);
        console.error(`Waiver recorded: ${body}`);
      }
      console.log(jsonMode ? JSON.stringify(issue, null, 2) : `Moved: ${issue.id} → ${issue.status}`);
      return;
    }
    case "assign": {
      const issue = await pm.assignIssue(rest[0], flag(rest, "--assignee")!);
      console.log(jsonMode ? JSON.stringify(issue, null, 2) : `Assigned: ${issue.id} → ${issue.assignee ?? "(none)"}`);
      return;
    }
    case "archive": {
      await pm.archiveIssue(rest[0]);
      console.log(jsonMode ? JSON.stringify({ archived: true, id: rest[0] }) : `Archived: ${rest[0]}`);
      return;
    }
    case "comment": {
      await pm.createComment(rest[0], flag(rest, "--body")!);
      console.log("Comment added.");
      return;
    }
    default:
      console.error(`unknown pm subcommand: ${sub}`);
      console.error("run 'guava-os pm --help' for usage");
      process.exit(1);
  }
}

