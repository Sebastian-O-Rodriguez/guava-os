#!/usr/bin/env node
/**
 * inject.mjs — assemble the worker's context (the "compiler").
 *
 * Small stable core (pulled from engineering-principles) + explicit task
 * contract + decision-tree routing + activated guidance + progressive retrieval
 * + measurable verification. Full skills are reference material, not default
 * prompt — the worker loads a full SKILL.md only when it decides it's needed.
 *
 * Usage:
 *   node manual/scripts/inject.mjs <task.json>
 *   cat task.json | node manual/scripts/inject.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { TREES } from "./trees.mjs";

const SKILLS = "/Users/sebroot/.agents/skills";
const CORE_SKILL = "engineering-principles";

function parseSkill(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = { name: "", description: "", domain: "", role: "", order: 0, load_when: "", guidance: "" };
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) continue;
    let val = kv[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (kv[1] === "order") fm.order = Number(val) || 0;
    else if (kv[1] in fm) fm[kv[1]] = val;
  }
  return { frontmatter: fm, body: m[2].trim() };
}

/** Pull list items (bullets or numbered) from a `## Heading` section. */
function extract(body, heading) {
  const i = body.indexOf(`## ${heading}`);
  if (i === -1) return [];
  const section = body.slice(i).split("\n## ")[0];
  return section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-•] /.test(l) || /^\d+\. /.test(l))
    .map((l) => l.replace(/^[-•] /, "").replace(/^\d+\. /, ""));
}

async function loadSkills() {
  const dirs = await readdir(SKILLS, { withFileTypes: true });
  const byName = {};
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    let text;
    try { text = await readFile(join(SKILLS, d.name, "SKILL.md"), "utf8"); } catch { continue; }
    const s = parseSkill(text);
    if (s && s.frontmatter.name) byName[s.frontmatter.name] = s;
  }
  return byName;
}

const bullets = (s) => (s ? s.split("|").map((x) => x.trim()).filter(Boolean) : []);

async function main() {
  const taskPath = process.argv[2];
  let task;
  if (taskPath) {
    task = JSON.parse(await readFile(taskPath, "utf8"));
  } else {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    task = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  const skills = await loadSkills();
  const core = skills[CORE_SKILL];
  const INVARIANTS = extract(core.body, "Invariants");
  const PROTOCOL = extract(core.body, "Execution protocol");
  const COMPLETION = extract(core.body, "Completion contract");

  const domainSkills = Object.values(skills)
    .filter((s) => s.frontmatter.domain === task.domain)
    .sort((a, b) => (a.frontmatter.order - b.frontmatter.order) || a.frontmatter.name.localeCompare(b.frontmatter.name));
  const tree = TREES[task.domain];

  const o = [];
  const L = (x = "") => o.push(x);

  L("# TASK CONTRACT");
  L("");
  L(`role: ${task.role}`);
  L(`domain: ${task.domain}`);
  L(`issue: ${task.issue}`);
  L("");
  L("why:");
  L(`  ${task.why}`);
  L("");
  L("scope:");
  for (const s of task.scope || []) L(`  - ${s}`);
  L("");
  L("out_of_scope:");
  for (const s of task.out_of_scope || []) L(`  - ${s}`);
  L("");
  L("acceptance:");
  for (const s of task.acceptance || []) L(`  - ${s}`);
  L("");

  if (tree) {
    L("# ROUTING");
    L("");
    L(`${task.domain}: ${tree.question}`);
    for (const b of tree.branches) L(`- ${b.label} → ${b.skills.join(" → ")}`);
    L("");
  }

  L("# ENGINEERING INVARIANTS");
  L("");
  for (const s of INVARIANTS) L(`- ${s}`);
  L("");
  L("# EXECUTION PROTOCOL");
  L("");
  PROTOCOL.forEach((s, i) => L(`${i + 1}. ${s}`));
  L("");
  L("# ACTIVATED GUIDANCE");
  L("");
  for (const s of domainSkills) {
    const g = bullets(s.frontmatter.guidance);
    if (g.length === 0) continue;
    L(`${s.frontmatter.name}:`);
    for (const b of g) L(`  - ${b}`);
    L("");
  }
  L("# AVAILABLE SKILLS");
  L("");
  for (const s of domainSkills) {
    L(`${s.frontmatter.name}:`);
    L(`  path: skill://${s.frontmatter.name}`);
    L(`  load_when: ${s.frontmatter.load_when || s.frontmatter.description}`);
    L("");
  }
  L("# COMPLETION CONTRACT");
  L("");
  L("Return:");
  for (const s of COMPLETION) L(`- ${s}`);

  console.log(o.join("\n"));
}

main().catch((e) => { console.error(e.message); process.exit(1); });