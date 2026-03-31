# Sprint: Repo Cleanup & Doc Restructure

**Status:** Complete
**Date:** 2026-03-07
**Type:** Maintenance
**Owner:** Gorp (Architect, solo)

---

## Goal

Restructure the pmlad-shoal workspace so docs are concise, non-duplicated, and clearly separate PM Lad (product) from Shoal (tool). Establish conventions for sprints, commits, and agent workflow.

---

## Tasks

| ID  | Task                                                    | Status | Notes                                       |
| --- | ------------------------------------------------------- | ------ | ------------------------------------------- |
| C1  | Disconnect shoal/ from root git                         | Done   | Already separate — no .git at root          |
| C2  | Write root `CLAUDE.md` (replaces README as primary doc) | Done   | TOC, project overview, points to everything |
| C3  | Rewrite root `README.md` (brief, points to CLAUDE.md)   | Done   |                                             |
| C4  | Create `shoal.md` at root (Shoal TOC + context)         | Done   | First place pointed to for Shoal            |
| C5  | Create `.shoal/project/process.md`                      | Done   | How we work, points to shoal resources      |
| C6  | Create `.shoal/project/conventions.md`                  | Done   | Git, commit, push, sprint format            |
| C7  | Create `.shoal/project/stack.md`                        | Done   | Tech stack + project details                |
| C8  | Create `.shoal/plans/roadmap.md`                        | Done   | Pointer to canonical roadmap                |
| C9  | Reset `current-sprint.md`                               | Done   | Cleared for Phase 4                         |
| C10 | Trim `pmlad/CLAUDE.md`                                  | Done   | Codebase rules only, no duplication         |
| C11 | Trim `pmlad/.claude/CLAUDE.md`                          | Done   | Points to process.md + conventions.md       |
| C12 | Clean persona references to missing files               | Done   | Updated all 5 personas                      |
| C13 | Postpone PM Lad project context update                  | N/A    | Deferred until after restructure            |
| C14 | Create agent-protocol.md (XML dispatch/report)          | Done   | Standardized I/O for all agents             |
| C15 | Update robo.md with XML dispatch protocol               | Done   | References agent-protocol.md                |
| C16 | Update all personas with agent protocol + work loop     | Done   | All 5 personas updated                      |
| C17 | Update process.md with protocol reference               | Done   |                                             |
| C18 | Update root CLAUDE.md with protocol link                | Done   |                                             |
| C19 | Disconnect shoal from usm-ricardoroche remote           | Done   | `git remote remove origin`                  |

---

## Progress Log

- **2026-03-07 start:** Sprint created. Beginning execution.
- **2026-03-07 done:** All 12 tasks complete.
  - Root docs: CLAUDE.md (primary), README.md (brief pointer), shoal.md (framework TOC)
  - Project docs: process.md, conventions.md, stack.md
  - Plans: roadmap.md (pointer), current-sprint.md (reset)
  - Trimmed: pmlad/CLAUDE.md (codebase only), .claude/CLAUDE.md (workflow pointer)
  - Updated: all 5 personas (removed refs to nonexistent files)
- **2026-03-07 phase 2:** Agent protocol established.
  - Created agent-protocol.md with XML dispatch/report templates
  - Updated robo.md dispatch protocol to use XML format
  - Added agent protocol + work loop to all 5 personas
  - Disconnected shoal from usm-ricardoroche/shoal remote (history preserved)
  - PM Lad build verified: 7/7 tasks pass
