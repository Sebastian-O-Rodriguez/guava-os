# Limitations

- **Classifier commands are stdin-only.** `doctor`/`status`/`validate`/`next`
  never call Linear; BLOCKED detection needs caller-provided `blocks` data.
- **No stale-claim detection.** The CLI can't see git branch activity or
  comment timestamps; an In Progress issue may be abandoned and invisible.
- **No git state.** The CLI doesn't read git — branch naming, commits, and merge
  state are GitHub's domain, not the classifier's.
- **No per-issue history.** `status`/`validate` see current state, not
  transitions; illegal status moves aren't detectable locally.
- **Partial blocker visibility.** A snapshot can't see `blocks` from issues
  outside the dataset (`V307` warns).
- **Session gate is best-effort.** `work` skips a project whose Linear mapping
  is missing or unreachable rather than failing the whole gate.