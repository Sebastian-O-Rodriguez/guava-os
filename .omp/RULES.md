# guava-os — hard rules

- Prefer skills and native tools first; MCP integrations are expensive and unreliable — last resort only. For Linear, use `guava-os pm` (the `linear` skill); Linear MCP is the fallback.
- Never read `.env` or `LINEAR_API_KEY` into agent context — the key is used only inside the `guava-os pm`/`work` subprocess and never surfaced to an agent.
- Never commit or push unless the operator asks.
- Workers (subagents) never merge to staging/production; GitHub authorizes merges.
- One role label per Linear issue; roles are `task`, `reviewer`, `scout`, `designer`, `sonic`, `librarian`.