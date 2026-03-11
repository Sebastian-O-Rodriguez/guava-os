export const dynamic = "force-dynamic";

import { getHabits } from "@/actions/habits";
import {
  getCompletionsForDate,
  getDailyProgress,
  getStreaksForActiveHabits,
} from "@/actions/completions";
import { HabitList } from "@/components/habit-list";
import { AddHabitDialog } from "@/components/add-habit-dialog";
import { ProgressRing } from "@/components/progress-ring";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Calculate daily XP score: completed habits × streak multiplier */
function calcScore(
  completedCount: number,
  streaks: Array<{ habitId: string; currentStreak: number }>,
  completedIds: Set<string>,
): number {
  if (completedCount === 0) return 0;

  // Sum streaks of completed habits, compute average
  let streakSum = 0;
  let count = 0;
  for (const s of streaks) {
    if (completedIds.has(s.habitId)) {
      streakSum += s.currentStreak;
      count++;
    }
  }

  const avgStreak = count > 0 ? streakSum / count : 0;
  const multiplier = 1 + Math.floor(avgStreak / 7) * 0.1;
  return Math.round(completedCount * 10 * multiplier);
}

export default async function TodayPage() {
  const today = new Date();

  const [habitsResult, completions, progress, streaks] = await Promise.all([
    getHabits(),
    getCompletionsForDate(today),
    getDailyProgress(today),
    getStreaksForActiveHabits(),
  ]);

  const habits = habitsResult.success ? habitsResult.data : [];

  const completionProps = completions.map((c) => ({ habitId: c.habitId }));
  const completedIds = new Set(completions.map((c) => c.habitId));

  const isAllDone =
    progress.total > 0 && progress.completed >= progress.total;
  const score = isAllDone
    ? calcScore(progress.completed, streaks, completedIds)
    : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}
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
              score={score}
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
                  {isAllDone ? (
                    <span className="font-semibold text-emerald-500">
                      All done! +{score} XP
                    </span>
                  ) : (
                    <>{progress.total - progress.completed} remaining</>
                  )}
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="pt-2 pb-2">
            <HabitList
              habits={habits}
              completions={completionProps}
              streaks={streaks}
              applicableCount={progress.total}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
