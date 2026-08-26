---
name: react-nextjs
description: "Build React components and Next.js App Router apps — hooks, composition, Server vs Client Components, Server Actions, and data fetching/revalidation."
domain: frontend
role: designer
order: 1
load_when: React/Next.js implementation guidance is needed
guidance: prefer server components unless client state is required | reuse existing component patterns | use the existing data-fetching approach

metadata:
  author: guava-os
  version: "0.1.0"
---

## Purpose

Author production React (18/19) and Next.js (13+, App Router) features: components, hooks, state, data fetching, SEO, and client/server boundaries.

## Core Principles

- Server Components by default; push `'use client'` to the leaf where interactivity begins.
- Prefer composition over context; lift state to the nearest common ancestor.
- Pass only serializable data from Server to Client Components.

## Hooks Reference

| Hook | Use |
|------|-----|
| `useState` | Local component state |
| `useEffect` | Side effects, subscriptions — always return cleanup |
| `useMemo` | Memoize expensive derived values |
| `useCallback` | Stable function refs for memoized children |
| `useRef` | Mutable refs, DOM access |
| `useContext` | Read a context value |
| `useReducer` | Complex state transitions |
| `useActionState` | Form actions with pending state (React 19) |

Custom hooks: `useDebounce`, `useLocalStorage`, `useMediaQuery`, `useApi`; guard SSR with `typeof window !== 'undefined'` in lazy initializers.

## Server vs Client Components

| | Server (default) | Client (`'use client'`) |
|---|---|---|
| Can | async/await, DB, fs, secrets | hooks, events, browser APIs |
| Cannot | hooks, onClick, browser APIs | async component body, server-only deps |

- Fetch on the server first; never convert to a Client Component just to read data.
- Wrap slow async subtrees in `<Suspense fallback={...}>` to stream.

## Next.js App Router Conventions

```
app/
├── layout.tsx       # root layout (required): <html>/<body>
├── page.tsx         # route UI
├── loading.tsx      # Suspense fallback for the segment
├── error.tsx        # 'use client' boundary: (error, reset)
├── not-found.tsx    # 404
├── (group)/         # route group: no URL segment
├── [slug]/page.tsx  # dynamic segment
├── [...slug]/       # catch-all; [[...slug]] optional
└── api/route.ts     # route handler: GET/POST on NextRequest/Response
```

`template.tsx` remounts on every navigation; parallel routes use `@slot/`; intercepting routes use `(.)`. Seed `next/font` in the root layout; use `next/image` for content images.

## Server Actions & Mutations

- `'use server'` function in an `actions.ts` file (or inline in a Server Component).
- Bind with `<form action={action}>`; `FormData` arrives server-side.
- Validate with zod, return `{ errors }`, render via client `useActionState`/`useFormStatus`.
- After mutation call `revalidatePath('/x')`, `revalidateTag('tag')`, or `redirect()`.

## Data Fetching & Caching

- Use native `fetch` with explicit options — never rely on implicit defaults:
  - `{ cache: 'force-cache' }` static · `{ cache: 'no-store' }` dynamic · `{ next: { revalidate: 60 } }` ISR · `{ next: { tags: ['posts'] } }` tagged.
- `generateMetadata` (or static `metadata`) for SEO — never hardcode `<title>`.
- Fetch independent data in parallel with `Promise.all`; `React.cache()` dedupes repeated calls.

## Hard Rules

- App Router only; never Pages Router.
- `key` props: stable unique ids, never array index for dynamic lists.
- Clean up effects; never mutate state directly.
- Add `loading.tsx`/`error.tsx` on async segments; verify with `next build`.

## Uses

- Authoring or refactoring React components, hooks, or forms
- Choosing Server vs Client Component boundaries
- Adding Next.js routes, layouts, metadata, or route handlers
- Implementing Server Actions, mutations, and cache revalidation

## Source

Distilled from Jeffallan `react-expert` and `nextjs-developer` skills (github.com/Jeffallan/claude-skills).