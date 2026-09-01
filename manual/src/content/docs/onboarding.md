---
title: Onboarding
description: Bring a new machine up to a working guava-os environment.
---

# Onboarding a new machine

## 1. Clone + install

```bash
git clone https://github.com/Sebastian-O-Rodriguez/guava-os.git ~/dev/guava-os
cd ~/dev/guava-os
npm install
```

## 2. Restore the skills store

Skills live in `~/.agents/skills/` (canonical, **not** in git). Rebuild:

- Clone guava-os, then re-add skills via `add-skill` (the store's MANIFEST lists
  provenance), or
- Restore real dirs from guava-os git history (before the symlink refactor), or
  re-run `npx skills add <repo>` for ecosystem skills.

Symlink consumers (`~/dev/guava-os/.omp/skills/*`) resolve into the store.

## 3. Linear key

Add the key to the gitignored `.env` at the guava-os checkout root:

```bash
echo 'LINEAR_API_KEY=<key>' >> ~/dev/guava-os/.env
```

The CLI anchors to the checkout (not cwd), so `pm`/`work` resolve it from any
directory. Never load the key into agent context.

## 4. Register projects

```bash
gos register <id> --repo ~/dev/repos/<id> --remote <url>
gos doctor   # verify remotes + config
```

## 5. Converge existing consumers

For registered projects on a stale guava-os contract (e.g. after a gos update
or a repo rollback):

```bash
gos sync <repo>                 # report drift (writes nothing)
gos sync --fix <repo>           # prompt [A]ccept/[C]ancel, then apply
gos sync --all --fix --force    # batch every active project, no prompt
```

`register` converges new projects at birth; `sync` reconciles drift and
migration. See `docs/architecture/sync-convergence.md`.

## 6. Verify

```bash
npm test          # 162+ tests
gos work --all   # session gate
```