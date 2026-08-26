---
name: add-skill
description: "Add a new skill to this workspace's canonical skill store and wire it into consumers (omp, claude). Use when asked to add/install/download a skill, make a skill available, or after fetching a skill via the skills ecosystem (npx skills add). Provenance: single source of truth for skills is ~/.agents/skills; every consumer (project .omp/skills, project .claude/skills, ~/.claude/skills) references it via symlinks; no duplicate real copies live anywhere else."
domain: pm
role: manager
order: 7

metadata:
  author: guava-os
  version: "0.1.0"
---

# add-skill (skill management)

The workspace keeps **one** canonical skills store: `~/.agents/skills/<name>/` (real dirs). Consumers reference it via symlinks only. This skill standardizes adding a new skill so the "hiccups" (dangling links, duplicate copies, manual copy-into-.omp) never recur.

## Core principles

1. **Single source of truth.** A skill's real files exist ONLY at `~/.agents/skills/<name>`. Never create a duplicate real `SKILL.md` in another project dir. Referencing = symlink.
2. **Canonical before referenced.** Add the skill to the canonical store FIRST, then symlink it into consumers.
3. **No dangling, no duplicates.** Every symlink must resolve; no real copies outside canonical. After any add, run the verification (below) and confirm 0 broken links + 0 extra real SKILL.md.
4. **Verify.** Frontmatter must parse (name/description/metadata) and a consumer read must return the content before calling it done.

## What every skill dir looks like

```
~/.agents/skills/<name>/
  SKILL.md          # YAML frontmatter (name, description, metadata{author,version}) + body
  assets/           # optional helper scripts (e.g. add-skill.sh)
  references/       # optional deeper docs
  CHANGELOG.md      # optional, for downloaded skills
```

## How to add a skill

### A. Download from the ecosystem (preferred)
```bash
npx skills add <owner>/<repo> -s <skill-name> -g     # global -> ~/.agents/skills + ~/.claude/skills
```
- `-g` installs user-global, landing directly in `~/.agents/skills/<name>` (the canonical store) + a `~/.claude/skills` link. Do NOT use project-scoped `skills add` (it would create a non-canonical `./.agents/skills`).
- If it landed in `./.claude/skills`/`./.agents/skills` in the cwd instead (project scope), move the real dir into `~/.agents/skills/<name>` and remove the project copy.
- Always use `-l` first to list a package's skills before installing.

### B. Author a new one manually
```bash
mkdir -p ~/.agents/skills/<name>
# write SKILL.md with valid frontmatter:
#   ---
#   name: <name>
#   description: "Triggers + scope..."
#   metadata: { author: ..., version: "0.1.0" }
#   ---
```

## Wiring into consumers

```bash
CANON=~/.agents/skills/<name>
for d in \
  /Users/sebroot/dev/guava-os/.omp/skills \
  /Users/sebroot/dev/repos/resume-site/.omp/skills \
  /Users/sebroot/.claude/skills; do
  ln -s "$CANON" "$d/<name>"
done
```
Add to the other project `.claude/skills` dirs (guava-site, demo-dashboard) only if the skill is needed there.

### Verify (acceptance)
1. `test -f ~/.agents/skills/<name>/SKILL.md`
2. No broken links: any symlink whose target is missing under the skill roots is an ERROR.
3. No duplicate real content: `find <roots> -name SKILL.md` must return ONLY canonical (plus symlink-resolved ones — they resolve into canonical, which is fine).
4. Frontmatter parses (name == dirname; description present; metadata.author + version present).
5. A consumer read returns the SKILL.md body.

### Commit reference changes
- The `.omp/skills` dirs are git-tracked in `guava-os` and `resume-site` → `git add -A` + commit the new symlink.
- `~/.agents/skills` is user-global (not in a repo) — no commit.

## Restoring the store on a fresh machine / after wipe
The canonical store is `~/.agents/skills` (not in git). To rebuild:
1. Clone `guava-os`; the previous real skill content is in git history under `.omp/skills/<name>/` (the repo now tracks symlinks). Restore real dirs from the commit BEFORE the symlink refactor, or
2. Re-run the download for ecosystem skills (step A), and reconstruct hand-authored ones (linear, planning, dispatch, verify, handoff, review, add-skill, supabase, vercel) from `~/.agents/skills` backups or the guava-os git history.

See `MANIFEST.md` in `~/.agents/skills` for the index + provenance.