# Architect — Settings View Design (Sprint 3, Task 1A)

Date: 2026-03-11

## New Type

Add to `src/lib/types.ts`:

```ts
export type HabitSummary = {
  id: string;
  name: string;
  frequency: FrequencyConfig;
  active: boolean;
  createdAt: Date;
};
```

## Component Tree

```
src/app/settings/page.tsx                        Server component, force-dynamic
src/components/settings/habit-settings-list.tsx   Client — layout, two sections
src/components/settings/edit-habit-dialog.tsx      Client — edit modal
src/components/settings/archive-habit-button.tsx   Client — archive / reactivate
```

## Component Contracts

### `src/app/settings/page.tsx` (Server)
- `export const dynamic = "force-dynamic"`
- Call `getHabits(true)`, split into active/archived
- Render header: `<h1>Settings</h1>` + `<AddHabitDialog />`
- Pass both arrays to `<HabitSettingsList>`

### `HabitSettingsList`
```ts
interface HabitSettingsListProps {
  activeHabits: HabitSummary[];
  archivedHabits: HabitSummary[];
}
```
- Two sections: Active + Archived (archived only if non-empty)
- Each row: `[name] [frequency badge] [Edit] [Archive]`
- Empty state: "No active habits. Add one above."

### `EditHabitDialog`
```ts
interface EditHabitDialogProps {
  habit: HabitSummary;
}
```
- Trigger: ghost Edit button in row
- Pre-filled name + frequency picker (daily/weekdays only in v1)
- Submit: `updateHabit(habit.id, { name, frequency })`
- shadcn: Dialog, Input, Label, Button

### `ArchiveHabitButton`
```ts
interface ArchiveHabitButtonProps {
  habit: HabitSummary;
}
```
- Active habit: "Archive" (rose text), calls `archiveHabit(habit.id)`
- Archived habit: "Reactivate" (emerald text), calls `updateHabit(habit.id, { active: true })`
- No confirmation — reversible in same view (2-click max)

## Backend Change

Add `revalidatePath("/settings")` to `archiveHabit`, `updateHabit`, and `createHabit` in `src/actions/habits.ts`.

## Nav Change

Add `{ label: "Settings", href: "/settings" }` to `NAV_LINKS` in `src/components/app-nav.tsx`.

## Decisions
- **Dialog over inline edit** — frequency picker is multi-element, dialog already established by AddHabitDialog
- **No confirmation for archive** — reversible via reactivate in same view
- **No custom days in v1** — daily/weekdays only in edit dialog
