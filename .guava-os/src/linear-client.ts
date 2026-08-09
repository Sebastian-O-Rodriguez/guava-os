/**
 * guava-os Linear tooling — the single supported Linear interface.
 *
 * This module is the ONLY place in guava-os that talks to Linear's network
 * API. All Linear network access lives here; commands and skills call this
 * module; agents never use Linear MCP directly (GOS-18/GOS-19).
 *
 * Linear only — no generic provider abstraction.
 *
 * Authentication: reads the Linear API key from the `LINEAR_API_KEY`
 * environment variable (or `LINEAR_TOKEN` as a fallback), then from the
 * gitignored `.env` file at the repo root. The key is a personal API key
 * from Linear Settings → API → Personal API keys. Tooling never prints the
 * key and never logs it.
 *
 * IDs: every operation accepts Linear UUIDs OR human identifiers
 * (`GUA-113`) OR documented names where the field allows (`--team "Guava AI"`,
 * `--project guava-os`, `--label backend`, `--status Todo`). Linear itself
 * accepts identifiers for issue ids; names for team/project/label/status are
 * resolved here against the Linear API, never passed through raw
 * (GUA-96).
 *
 * Per GOS-18: guava-os owns project management via Linear. Per GOS-21:
 * conventions (native fields for workflow, labels for metadata) are
 * enforced by the callers, not here — this module is a thin transport.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { LinearIssue } from "./linear.js";
import type { Config } from "./config.js";
import { findRepoRoot } from "./config.js";

const LINEAR_API_URL = "https://api.linear.app/graphql";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when a value is already a Linear UUID (the only id form the API accepts). */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Load the Linear API key: env first (`LINEAR_API_KEY`, then
 * `LINEAR_TOKEN`), then the gitignored `.env` at the repo root.
 * Fails with a canonical, actionable message — never the secret.
 */
export function loadToken(): string {
  const fromEnv = process.env.LINEAR_API_KEY ?? process.env.LINEAR_TOKEN;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv;
  try {
    const repoRoot = findRepoRoot();
    const envPath = join(repoRoot, ".env");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split(/\r?\n/)) {
        const m = /^(?:export\s+)?LINEAR_API_KEY\s*=\s*(\S+)\s*$/.exec(line);
        if (m && m[1].trim().length > 0) return m[1];
      }
    }
  } catch {
    // Not inside a repo — fall through to the canonical error.
  }
  throw new Error(
    "Linear API key not found. Set LINEAR_API_KEY (or LINEAR_TOKEN) env var, " +
      "or add LINEAR_API_KEY=<key> to the gitignored .env at the repo root " +
      "(Linear Settings → API → Personal API keys). The key is never printed.",
  );
}

function getToken(): string {
  return loadToken();
}

/** Minimal GraphQL request helper. Linear-specific types stay here. */
async function gql<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = getToken();
  const res = await fetch(LINEAR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`Linear API error ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown[] };
  if (json.errors) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}

// ── Provider-neutral types (no Linear-specific fields leak above) ──────────

export interface ProjectInfo {
  id: string;
  name: string;
  url?: string;
}

export interface SprintInfo {
  id: string;
  title: string;
  status: string;
  children: LinearIssue[];
}

export interface SearchResult {
  issues: LinearIssue[];
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  teamId: string;
  projectId?: string;
  parentId?: string;
  labels?: string[];
  priority?: number;
  status?: string;
  assigneeId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  priority?: number;
  assigneeId?: string | null;
  status?: string;
  labels?: string[];
}

// ── Name / identifier resolution (GUA-96: no raw names into UUID fields) ───

/** Resolve a project name to its UUID. */
async function resolveProjectId(name: string): Promise<string> {
  if (isUuid(name)) return name;
  const data = await gql<{ projects: { nodes: { id: string }[] } }>(
    `query ($name: String!) { projects(filter: { name: { eq: $name } }) { nodes { id } } }`,
    { name },
  );
  const proj = data.projects?.nodes?.[0];
  if (!proj) {
    throw new Error(`Project not found: ${name} — check the Linear project name.`);
  }
  return proj.id;
}

/** Resolve a team name to its UUID. */
async function resolveTeamId(name: string): Promise<string> {
  if (isUuid(name)) return name;
  const data = await gql<{ teams: { nodes: { id: string; name: string }[] } }>(
    `query { teams { nodes { id name } } }`,
  );
  const team = data.teams?.nodes?.find((t) => t.name === name);
  if (!team) {
    const available = (data.teams?.nodes ?? []).map((t) => t.name).join(", ");
    throw new Error(`Team not found: ${name}. Available: ${available}`);
  }
  return team.id;
}

/** Resolve issue label names to UUIDs (unknown names fail). */
async function resolveLabelIds(names: string[]): Promise<string[]> {
  const unresolved = names.filter((n) => !isUuid(n));
  if (unresolved.length === 0) return names;
  const data = await gql<{ issueLabels: { nodes: { id: string; name: string }[] } }>(
    `query { issueLabels { nodes { id name } } }`,
  );
  const byName = new Map((data.issueLabels?.nodes ?? []).map((l) => [l.name, l.id]));
  const out: string[] = [];
  for (const n of names) {
    if (isUuid(n)) {
      out.push(n);
      continue;
    }
    const id = byName.get(n);
    if (!id) {
      const available = [...byName.keys()].join(", ");
      throw new Error(`Label not found: ${n}. Available: ${available}`);
    }
    out.push(id);
  }
  return out;
}

/** Resolve a status name to a state UUID for a team (create path). */
async function resolveTeamStateId(teamId: string, statusName: string): Promise<string> {
  if (isUuid(statusName)) return statusName;
  const data = await gql<{ team: { states: { nodes: { id: string; name: string }[] } } }>(
    `query ($id: String!) { team(id: $id) { states { nodes { id name } } } }`,
    { id: teamId },
  );
  const state = data.team?.states?.nodes?.find(
    (s) => s.name.toLowerCase() === statusName.toLowerCase(),
  );
  if (!state) {
    const available = (data.team?.states?.nodes ?? []).map((s) => s.name).join(", ");
    throw new Error(`Status "${statusName}" not found. Available: ${available}`);
  }
  return state.id;
}

/** Resolve an issue id or identifier (`GUA-113`) to its UUID. */
async function resolveIssueId(value: string): Promise<string> {
  if (isUuid(value)) return value;
  const data = await gql<{ issue: { id: string } }>(
    `query ($v: String!) { issue(id: $v) { id } }`,
    { v: value },
  );
  if (!data?.issue?.id) throw new Error(`Issue not found: ${value}`);
  return data.issue.id;
}

/** Resolve an assignee: "me" -> viewer; uuid passthrough. */
async function resolveAssigneeId(value: string): Promise<string> {
  if (value === "me") {
    const data = await gql<{ viewer: { id: string } }>(`query { viewer { id } }`);
    return data.viewer.id;
  }
  return value;
}

// ── Nine operations ────────────────────────────────────────────────────────

/** get project — fetch project metadata by name. */
export async function getProject(
  config: Config,
  projectName?: string,
): Promise<ProjectInfo> {
  const name = projectName ?? config.linear.project;
  const data = await gql<{
    project?: { id: string; name: string; url: string };
    projects?: { nodes: { id: string; name: string; url: string }[] };
  }>(
    `query ($name: String!) {
      projects(filter: { name: { eq: $name } }) {
        nodes { id name url }
      }
    }`,
    { name },
  );
  const proj = data.projects?.nodes?.[0] ?? data.project;
  if (!proj) throw new Error(`Project not found: ${name}`);
  return { id: proj.id, name: proj.name, url: proj.url };
}

/** Issue relations load. Included in every issue query (GOS-28). */
const ISSUE_RELATIONS_FRAGMENT = `
        relations { nodes { id type issue { id } relatedIssue { id } } }`;

/** get sprint — fetch the sprint (parent issue) + children. */
export async function getSprint(
  config: Config,
  parentId?: string,
): Promise<SprintInfo> {
  const parent = parentId ?? await getDefaultParentId(config);
  const data = await gql<{
    issue: {
      id: string;
      title: string;
      state: { name: string };
      children: { nodes: RawLinearIssue[] };
    };
  }>(
    `query ($id: String!) {
      issue(id: $id) {
        id title
        state { name }
        children { nodes {
          id title
          description
          state { name type }
          priority
          labels { nodes { name } }
          parent { id }
          project { name }
          createdAt updatedAt
          completedAt canceledAt
          assignee { name }
          ${ISSUE_RELATIONS_FRAGMENT}
        } }
      }
    }`,
    { id: parent },
  );
  const issue = data.issue;
  const children = issue.children.nodes.map(normalizeIssue);
  return { id: issue.id, title: issue.title, status: issue.state.name, children };
}

/** get issue — fetch a single issue by id or identifier. */
export async function getIssue(issueId: string): Promise<LinearIssue> {
  const data = await gql<{
    issue: RawLinearIssue;
  }>(
    `query ($id: String!) {
      issue(id: $id) {
        id title
        description
        state { name type }
        priority
        labels { nodes { name } }
        parent { id }
        project { name }
        createdAt updatedAt
        completedAt canceledAt
        assignee { name }
        ${ISSUE_RELATIONS_FRAGMENT}
      }
    }`,
    { id: issueId },
  );
  return normalizeIssue(data.issue);
}

/** search issues — query by project, status, label, assignee. */
export async function searchIssues(
  config: Config,
  opts: {
    projectId?: string;
    status?: string;
    label?: string;
    assignee?: string;
    includeArchived?: boolean;
  } = {},
): Promise<SearchResult> {
  const proj = opts.projectId ? await resolveProjectId(opts.projectId) : (await getProject(config)).id;
  // Linear's GraphQL filter is limited; we fetch by project and filter client-side.
  const data = await gql<{
    project: {
      issues: { nodes: RawLinearIssue[] };
    };
  }>(
    `query ($id: String!, $archived: Boolean) {
      project(id: $id) {
        issues(includeArchived: $archived) {
          nodes {
            id title
            description
            state { name type }
            priority
            labels { nodes { name } }
            parent { id }
            project { name }
            createdAt updatedAt
            completedAt canceledAt
            assignee { name }
            ${ISSUE_RELATIONS_FRAGMENT}
          }
        }
      }
    }`,
    { id: proj, archived: opts.includeArchived ?? false },
  );
  let issues = data.project.issues.nodes.map(normalizeIssue);
  if (opts.status) issues = issues.filter((i) => i.status === opts.status);
  if (opts.label) issues = issues.filter((i) => i.labels.includes(opts.label!));
  if (opts.assignee)
    issues = issues.filter((i) => i.assignee === opts.assignee);
  return { issues };
}

/** create issue — create an issue. Names and identifiers resolved here. */
export async function createIssue(input: CreateIssueInput): Promise<LinearIssue> {
  const teamId = await resolveTeamId(input.teamId);
  const projectId = input.projectId ? await resolveProjectId(input.projectId) : undefined;
  const parentId = input.parentId ? await resolveIssueId(input.parentId) : undefined;
  const labelIds = input.labels && input.labels.length > 0
    ? await resolveLabelIds(input.labels)
    : undefined;
  const stateId = input.status ? await resolveTeamStateId(teamId, input.status) : undefined;
  const assigneeId = input.assigneeId ? await resolveAssigneeId(input.assigneeId) : undefined;
  const data = await gql<{
    issueCreate: { issue: { id: string; title: string } };
  }>(
    `mutation ($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue { id title }
      }
    }`,
    {
      input: {
        title: input.title,
        description: input.description,
        teamId,
        projectId,
        parentId,
        labelIds,
        priority: input.priority,
        stateId,
        assigneeId,
      },
    },
  );
  return getIssue(data.issueCreate.issue.id);
}

/** update issue — update title, description, priority, assignee, status, labels. */
export async function updateIssue(
  issueId: string,
  input: UpdateIssueInput,
): Promise<LinearIssue> {
  const labelIds = input.labels !== undefined
    ? await resolveLabelIds(input.labels)
    : undefined;
  const stateId = input.status !== undefined
    ? (isUuid(input.status) ? input.status : await resolveStateId(issueId, input.status))
    : undefined;
  const assigneeId = input.assigneeId !== undefined
    ? (input.assigneeId === null ? null : await resolveAssigneeId(input.assigneeId))
    : undefined;
  await gql(
    `mutation ($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success }
    }`,
    {
      id: issueId,
      input: {
        title: input.title,
        description: input.description,
        priority: input.priority,
        assigneeId,
        stateId,
        // labelIds only when explicitly provided — never `[]` (a bare []
        // would wipe existing labels; GUA-96).
        ...(labelIds !== undefined ? { labelIds } : {}),
      },
    },
  );
  return getIssue(issueId);
}

/** link dependencies — create native Linear blocks relations (GUA-96). */
export async function linkDependencies(
  issueId: string,
  opts: { blocks?: string[]; blockedBy?: string[] },
): Promise<void> {
  const a = await resolveIssueId(issueId);
  for (const raw of opts.blocks ?? []) {
    const b = await resolveIssueId(raw);
    if (a === b) throw new Error(`Cannot link an issue to itself: ${issueId}`);
    await createBlocksRelation(a, b);
  }
  for (const raw of opts.blockedBy ?? []) {
    const b = await resolveIssueId(raw);
    if (a === b) throw new Error(`Cannot link an issue to itself: ${issueId}`);
    // A --blocked-by B  <=>  B blocks A
    await createBlocksRelation(b, a);
  }
}

/** One native "blocks" relation: `from` blocks `to`. */
async function createBlocksRelation(from: string, to: string): Promise<void> {
  try {
    await gql(
      `mutation ($input: IssueRelationCreateInput!) {
        issueRelationCreate(input: $input) { success }
      }`,
      {
        input: {
          type: "blocks",
          issueId: from,
          relatedIssueId: to,
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Failed to link dependency ${from} blocks ${to}: ${msg}`,
    );
  }
}

/** Resolve a status name (e.g. "Done") to a Linear state UUID for the issue's team. */
async function resolveStateId(issueId: string, statusName: string): Promise<string> {
  const data = await gql<{
    issue: { team: { states: { nodes: { id: string; name: string }[] } } };
  }>(
    `query ($id: String!) {
      issue(id: $id) {
        team { states { nodes { id name } } }
      }
    }`,
    { id: issueId },
  );
  const state = data.issue.team.states.nodes.find(
    (s) => s.name.toLowerCase() === statusName.toLowerCase(),
  );
  if (!state) {
    const available = data.issue.team.states.nodes.map((s) => s.name).join(", ");
    throw new Error(`Status "${statusName}" not found. Available: ${available}`);
  }
  return state.id;
}

/** move status — transition an issue's Status. */
export async function moveStatus(issueId: string, statusName: string): Promise<LinearIssue> {
  const stateId = await resolveStateId(issueId, statusName);
  return updateIssue(issueId, { status: stateId });
}

/** assign issue — set an issue's Assignee. */
export async function assignIssue(
  issueId: string,
  assigneeId: string,
): Promise<LinearIssue> {
  const resolved = await resolveAssigneeId(assigneeId);
  return updateIssue(issueId, { assigneeId: resolved });
}

// ── Extended capabilities (comments, links) ───────────────────────────────

/** create a comment on an issue. */
export async function createComment(
  issueId: string,
  body: string,
): Promise<void> {
  await gql(
    `mutation ($input: CommentCreateInput!) {
      commentCreate(input: $input) { success }
    }`,
    { input: { issueId, body } },
  );
}

/** link an external URL to an issue. */
export async function linkUrl(
  issueId: string,
  url: string,
  title?: string,
): Promise<void> {
  await gql(
    `mutation ($input: AttachmentCreateInput!) {
      attachmentCreate(input: $input) { success }
    }`,
    { input: { issueId, url, title: title ?? url } },
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Raw Linear GraphQL issue node shape (Linear-specific; stays in this module). */
interface RawLinearIssue {
  id: string;
  title: string;
  state: { name: string; type: string };
  priority: number;
  labels: { nodes: { name: string }[] };
  parent?: { id: string };
  project: { name: string };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  canceledAt: string | null;
  assignee?: { name: string };
  description?: string | null;
  relations?: {
    nodes: {
      id: string;
      type: string;
      issue: { id: string };
      relatedIssue: { id: string };
    }[];
  };
}

/** Normalize a Linear GraphQL issue node to the provider-neutral LinearIssue type. */
function normalizeIssue(raw: RawLinearIssue): LinearIssue {
  const blocks: string[] = [];
  for (const rel of raw.relations?.nodes ?? []) {
    // `type: "blocks"` means the initiating issue (rel.issue) blocks
    // rel.relatedIssue. We record the out-edge on the initiator.
    if (rel.type === "blocks" && rel.issue.id === raw.id && rel.relatedIssue) {
      blocks.push(rel.relatedIssue.id);
    }
  }
  return {
    id: raw.id,
    title: raw.title,
    status: raw.state.name,
    statusType: raw.state.type,
    priority: { value: raw.priority, name: priorityName(raw.priority) },
    labels: raw.labels.nodes.map((l) => l.name),
    parentId: raw.parent?.id,
    project: raw.project.name,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    completedAt: raw.completedAt,
    canceledAt: raw.canceledAt,
    assignee: raw.assignee?.name,
    description: raw.description ?? undefined,
    blocks,
  };
}

const PRIORITY_NAMES: Record<number, string> = {
  0: "None", 1: "Urgent", 2: "High", 3: "Medium", 4: "Low",
};

function priorityName(value: number): string {
  return PRIORITY_NAMES[value] ?? `P${value}`;
}

/** Resolve the default sprint parent for the configured project. */
async function getDefaultParentId(config: Config): Promise<string> {
  const { issues } = await searchIssues(config, { status: "Todo" });
  // Find a parent issue (one that has children)
  const parents = issues.filter(
    (i) => issues.some((c) => c.parentId === i.id),
  );
  if (parents.length === 0)
    throw new Error("No sprint parent found in the configured project.");
  return parents[0].id;
}