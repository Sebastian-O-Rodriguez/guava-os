"use client";

import { EditHabitDialog } from "@/components/settings/edit-habit-dialog";
import { ArchiveHabitButton } from "@/components/settings/archive-habit-button";
import type { FrequencyConfig, HabitSummary } from "@/lib/types";

function frequencyLabel(frequency: FrequencyConfig): string {
  if (frequency.type === "weekdays") return "Weekdays";
  if (frequency.type === "custom") return "Custom";
  return "Daily";
}

interface HabitRowProps {
  habit: HabitSummary;
}

function HabitRow({ habit }: HabitRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-800/60 transition-colors duration-150">
      <div className="flex min-w-0 items-center gap-3">
        <span className="truncate text-sm font-medium text-foreground">
          {habit.name}
        </span>
        <span className="shrink-0 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-muted-foreground">
          {frequencyLabel(habit.frequency)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <EditHabitDialog habit={habit} />
        <ArchiveHabitButton habit={habit} />
      </div>
    </div>
  );
}

interface HabitSettingsListProps {
  activeHabits: HabitSummary[];
  archivedHabits: HabitSummary[];
}

export function HabitSettingsList({
  activeHabits,
  archivedHabits,
}: HabitSettingsListProps) {
  return (
    <div className="space-y-8">
      {/* Active habits */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Active Habits
        </h2>
        {activeHabits.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-muted-foreground">
            No active habits. Add one above.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
            {activeHabits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </div>
        )}
      </section>

      {/* Archived habits — only shown when non-empty */}
      {archivedHabits.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Archived
          </h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 opacity-70">
            {archivedHabits.map((habit) => (
              <HabitRow key={habit.id} habit={habit} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
