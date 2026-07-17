# Record guava-os's first governed change through the Gorp control plane

artifact: docs/governance/first-governed-change.md
graph: guava-os-canary-1
node: n1
run: run-1
task-type: governed-canary

acceptance criteria:
- this file was produced by the deterministic fixture worker inside an isolated git worktree, never in the working tree
- the scope gate and the real project gates (npm ci, vitest, tsc) passed at run time and again at promotion time
- the full audit trail (worker result, gate record, review decision, promotion record, hash chain) is reconstructable from the machine-local Gorp state root via gorp inspect
