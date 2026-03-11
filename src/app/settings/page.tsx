export const dynamic = "force-dynamic";

import { getHabits } from "@/actions/habits";
import { AddHabitDialog } from "@/components/add-habit-dialog";
import { HabitSettingsList } from "@/components/settings/habit-settings-list";
import type { HabitSummary } from "@/lib/types";

export default async function SettingsPage() {
  const habitsResult = await getHabits(true);
  const allHabits: HabitSummary[] = habitsResult.success
    ? habitsResult.data
    : [];

  const activeHabits = allHabits.filter((h) => h.active);
  const archivedHabits = allHabits.filter((h) => !h.active);

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl animate-fade-in">
        {/* Page header */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your habits
            </p>
          </div>
          <AddHabitDialog />
        </header>

        <HabitSettingsList
          activeHabits={activeHabits}
          archivedHabits={archivedHabits}
        />
      </div>
    </div>
  );
}
