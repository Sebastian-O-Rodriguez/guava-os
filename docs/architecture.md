# RoutineMe Architecture

## Overview

Single Next.js app deployed on Vercel. No separate backend, no microservices.

```
Browser → Vercel Edge → Next.js App Router → Server Actions → Prisma → PostgreSQL
```

## Stack

```
Next.js 15 (App Router)
├── app/                    # Routes + layouts
│   ├── page.tsx           # Today view (/)
│   ├── monthly/           # Monthly grid (/monthly)
│   ├── progress/          # Progress dashboard (/progress)
│   └── settings/          # Habit management (/settings)
├── actions/               # Server actions ("use server")
│   ├── habits.ts          # CRUD: create, update, archive
│   ├── completions.ts     # Toggle, bulk ops
│   └── stats.ts           # Streaks, rates, trends
├── components/
│   ├── ui/                # shadcn/ui primitives
│   ├── habits/            # Habit-specific components
│   ├── charts/            # Tremor + Plot wrappers
│   └── layout/            # Shell, nav, theme
├── lib/
│   ├── db.ts              # Prisma client singleton
│   ├── dates.ts           # Date utilities
│   └── frequency.ts       # Habit frequency logic
└── prisma/
    └── schema.prisma      # Data model
```

## Data Model

```prisma
model User {
  id     String  @id @default(cuid())
  habits Habit[]
}

model Habit {
  id          String       @id @default(cuid())
  userId      String
  name        String
  frequency   Json         // "daily" | "weekdays" | ["mon","wed","fri"]
  active      Boolean      @default(true)
  createdAt   DateTime     @default(now())
  user        User         @relation(fields: [userId], references: [id])
  completions Completion[]

  @@index([userId, active])
}

model Completion {
  id        String   @id @default(cuid())
  habitId   String
  date      DateTime @db.Date
  completed Boolean  @default(true)
  note      String?
  habit     Habit    @relation(fields: [habitId], references: [id])

  @@unique([habitId, date])
  @@index([date])
}

model DailyNote {
  id         String   @id @default(cuid())
  date       DateTime @db.Date @unique
  reflection String

  @@index([date])
}
```

## Key Patterns

### Server Actions (no REST API)
All data mutations go through Next.js server actions. No API routes needed for v1.

### Optimistic UI
Toggle actions use `useOptimistic` for instant feedback. Server reconciles async.

### Frequency Filtering
`shouldShowToday(habit)` checks frequency JSON against current day of week.

### Streak Calculation
Application-level: query completions ordered by date DESC, count consecutive `completed: true`.

### Single User
No auth system. Single user record seeded on first visit. Environment variable for basic protection if desired.

## Deployment

```
git push main → Vercel auto-deploy
                ├── Build: next build
                ├── DB: Vercel Postgres / Neon / Supabase
                └── Domain: routineme.vercel.app (or custom)
```

## What This Is NOT

- Not event-sourced
- Not microservices
- Not multi-tenant
- Not API-first
- Not mobile-native
