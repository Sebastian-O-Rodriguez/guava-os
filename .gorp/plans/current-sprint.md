# Current Sprint — Ready for Planning

No active sprint. Previous sprints archived below.

---

<details>
<summary>Sprint 5 — UI Polish (COMPLETED 2026-03-11)</summary>

### Summary
Design system polish pass across all pages. Shipped in commit `112f339`.

### What shipped
- **Shadow hierarchy**: `shadow-card` → `shadow-elevated` → `shadow-glow-emerald`
- **Animations**: `animate-fade-in` on page load, `animate-slide-up` with stagger on habit rows
- **Containers**: All `rounded-2xl` with consistent `border-zinc-800/60 bg-zinc-900/80`
- **Nav**: Backdrop blur, hover backgrounds, thicker active bar
- **Today**: Frequency icons, staggered row animations, wider weekly bars
- **Monthly**: Weekly habit badge, shadow containers, Next.js Link nav
- **Progress**: Metric card hover lift + accent borders, chart title, tighter spacing
- **Chat**: Message animations, tool card shadows, blur drawer
- **Settings**: Shadow cards, wider button spacing

### QA
- `tsc --noEmit`: clean
- `next build`: clean (5 dynamic routes + /api/chat)
- Deployed to Vercel

</details>

<details>
<summary>Sprint 4 — AI Chat / Brain Dump → Habits (COMPLETED 2026-03-11)</summary>

### Summary
Chat interface where user brain-dumps goals, Claude extracts and creates habits automatically.

### What shipped
- **OpenRouter integration**: `openai` SDK → OpenRouter API → `anthropic/claude-haiku-4.5`
- **Tool use**: `create_habit`, `update_habit`, `delete_habit`, `list_habits` — calls existing server actions
- **API route**: POST `/api/chat` with tool use loop (max 10 iterations)
- **System prompt**: Teaches Claude about daily/scheduled/weekly frequency modes
- **Chat UI**: Session-only message history, example prompts, inline tool result cards
- **Chat drawer**: Floating emerald button on all pages, collapsible 420px drawer
- **Full page**: `/chat` route for full-screen use

### Files created
```
src/lib/openrouter.ts        — OpenAI client for OpenRouter
src/lib/chat-tools.ts        — Tool definitions + executor
src/lib/chat-prompt.ts       — System prompt
src/app/api/chat/route.ts    — POST handler
src/app/chat/page.tsx         — Full-page chat
src/components/chat.tsx        — Chat client component
src/components/chat-drawer.tsx — Floating drawer
```

### Commits
- `5ee621a` docs(sprint): plan Sprint 4
- `f1fc3a4` feat(app): AI chat — brain dump goals, Claude creates habits
- `0e42c12` fix(chat): correct model ID + inline chat drawer on all pages
- `6f8c4a1` fix(chat): flatten tool schemas + robust frequency parsing

### QA
- `tsc --noEmit`: clean
- `next build`: clean
- Chat creates habits end-to-end, habits appear on Today page

</details>

<details>
<summary>Sprint 3 — Polish + Deploy (COMPLETED 2026-03-11)</summary>

### Waves 1-3: Settings, responsive, theme polish — all done
### Wave 4: QA + Deploy — done
### Post-sprint: Today upgrades, habit modes, delete — done

### QA Summary
- `tsc --noEmit`: clean
- `next build`: clean (4 dynamic routes)
- 5 warnings found and fixed (W1-W5)
- Deployed to Vercel, production DB connected
- Recommendation: Ship

</details>
