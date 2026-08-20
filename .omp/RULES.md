# guava-os — hard rules

- Never call Linear MCP; only `guava-os pm` (or the `linear` skill) touches Linear.
- Never commit or push unless the operator asks.
- Workers (subagents) never merge to staging/production; GitHub authorizes merges.
- One role label per Linear issue; roles are `task`, `reviewer`, `scout`, `designer`, `sonic`, `librarian`.