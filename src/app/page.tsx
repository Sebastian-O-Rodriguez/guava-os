export const dynamic = "force-dynamic";

import { getHabits } from "@/actions/habits";
import { getCompletionsForDate, getDailyProgress } from "@/actions/completions";
import { HabitList } from "@/components/habit-list";
import { AddHabitDialog } from "@/components/add-habit-dialog";
import { ProgressRing } from "@/components/progress-ring";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function TodayPage() {
  const today = new Date();

  const [habitsResult, completions, progress] = await Promise.all([
    getHabits(),
    getCompletionsForDate(today),
    getDailyProgress(today),
  ]);

  const habits = habitsResult.success ? habitsResult.data : [];

  // Shape completions for HabitList — only pass what the component needs
  const completionProps = completions.map((c) => ({ habitId: c.habitId }));

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Today
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(today)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ProgressRing
              completed={progress.completed}
              total={progress.total}
              size={100}
            />

            <AddHabitDialog />
          </div>
        </header>

        {/* Habit list card */}
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                Habits
              </span>
              {progress.total > 0 && (
                <span className="text-xs text-muted-foreground">
                  {progress.completed === progress.total ? (
                    <span className="font-semibold text-emerald-500">
                      All done!
                    </span>
                  ) : (
                    <>{progress.total - progress.completed} remaining</>
                  )}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-2 pb-2">
            <HabitList habits={habits} completions={completionProps} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
