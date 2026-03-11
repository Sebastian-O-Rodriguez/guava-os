# UI Patterns — PM Lad Frontend

## Three-Layer Rule

| Layer | Library | Use Case |
|-------|---------|----------|
| App shell + forms | shadcn/ui + Tailwind | Buttons, cards, inputs, dialogs, tables, navigation |
| AI surfaces | assistant-ui | Chat panel, streaming responses, tool-use display |
| Analytics surfaces | Tremor (standard) / Observable Plot (custom) | KPI cards, area charts, bar charts, custom viz |

**Rule:** Pick one layer per component. Never mix Tremor charts inside assistant-ui threads.

## Server-First Default

- Default to Server Components. Add `"use client"` only for interactivity (event handlers, hooks, browser APIs).
- Data fetching happens server-side via `async` Server Components or React Query in client components.
- Lazy-load heavy client libs: `dynamic(() => import(...), { ssr: false })` for Observable Plot.

## Token System

All colors use CSS custom properties defined in `globals.css`. shadcn/ui and Tremor inherit these tokens.

- **Primitives:** `:root` and `.dark` blocks (OKLCH values)
- **Semantics:** `@theme inline` block maps primitives to Tailwind utilities
- **Usage:** `bg-primary`, `text-muted-foreground`, `border-border` — never hardcode hex values

## When to Use Each Library

| Need | Use |
|------|-----|
| Button, Input, Dialog, Select, Table | shadcn/ui (`components/ui/`) |
| Page layout, spacing, grid | Tailwind classes + layout components (`components/layout/`) |
| KPI card with delta | Tremor `Card` + `BadgeDelta` |
| Area/bar/line chart | Tremor chart components |
| Custom data visualization | Observable Plot (client-only, lazy-loaded) |
| AI chat interface | assistant-ui `Thread` + `RuntimeProvider` |
| Status indicator | `Badge` with status variants (pending, approved, etc.) |
| Loading placeholder | `Skeleton` component |
| Empty state | `EmptyState` composition |

## Component Creation Checklist

1. Check if shadcn/ui has the primitive — use it
2. Use `cn()` from `@/lib/utils` for class merging
3. Use `cva()` for variant-driven components
4. Respect token system — no hardcoded colors
5. Add `"use client"` only if interactive
6. Export from the component file, import via `@/components/ui/` or `@/components/layout/`

## Layout Components

| Component | Purpose |
|-----------|---------|
| `PageShell` | Max-width container with responsive padding |
| `SectionHeader` | Page title + description + optional action slot |
| `FilterBar` | Horizontal filter/search toolbar |
| `SplitPane` | Responsive two-column layout with ratio control |
| `DetailPanel` | Bordered aside panel for detail views |
| `DataTableShell` | Table wrapper with toolbar + pagination slots |
