---
name: behavior
description: "The two terminal behaviors every worker closes on: implement (edit, verify, commit, comment, move to In Review) or judge (verdict only, no code edit). Each issue ends in exactly one terminal action."
domain: core
role: any
order: 2
load_when: always — every task ends in one terminal behavior
guidance: implement → edit, verify, commit, comment, move In Review | judge → verdict only, comment, move

metadata:
  author: guava-os
  version: "0.2.0"
---

## Behavior

Every task ends in exactly one terminal behavior, chosen from the task
contract: an **implement** (an editor leaves a diff + a board move) or a
**judge** (a read-only verdict leaves a comment + a board move). Never both,
never neither.

## Implement

- guidance: produce the outcome through edits — write the code, run it, verify against acceptance
- terminal: commit `GUA-### <outcome>` to the dev branch
- terminal: `pm comment <issue>` the result
- terminal: `pm move <issue> In Review`
- authorization: write

## Judge

- guidance: verdict only — inspect the diff and acceptance criteria, never edit code
- terminal: `pm comment <issue>` the verdict (approve / findings)
- terminal: `pm move <issue>` the status
- authorization: judge (read-only against the code)