export const dynamic = "force-dynamic";

import { getHabits } from "@/actions/habits";
import {
  getCompletionsForDate,
  getDailyProgress,
  getStreaksForActiveHabits,
  getWeeklyProgress,
  getOverdueHabits,
} from "@/actions/completions";
import { habitShowsOnDate, normalizeDate } from "@/lib/habits";
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

function calcScore(
  completedCount: number,
  streaks: Array<{ habitId: string; currentStreak: number }>,
  completedIds: Set<string>,
): number {
  if (completedCount === 0) return 0;

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
  const normalizedToday = normalizeDate(today);

  const [habitsResult, completions, progress, streaks, weeklyProg, overdue] =
    await Promise.all([
      getHabits(),
      getCompletionsForDate(today),
      getDailyProgress(today),
      getStreaksForActiveHabits(),
      getWeeklyProgress(),
      getOverdueHabits(),
    ]);

  const allHabits = habitsResult.success ? habitsResult.data : [];

  // Filter to only habits that show on today's date
  const todayHabits = allHabits.filter((h) =>
    habitShowsOnDate(h.frequency, normalizedToday),
  );

  const completionProps = completions.map((c) => ({ habitId: c.habitId }));
  const completedIds = new Set(completions.map((c) => c.habitId));

  const isAllDone =
    progress.total > 0 && progress.completed >= progress.total;
  const score = isAllDone
    ? calcScore(progress.completed, streaks, completedIds)
    : null;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto max-w-2xl">
        {/* Page header */}
        <header className="mb-6 flex items-start justify-between gap-4">
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
        <Card className="shadow-card">
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
              habits={todayHabits}
              completions={completionProps}
              streaks={streaks}
              applicableCount={progress.total}
              weeklyProgress={weeklyProg}
              overdueHabits={overdue}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
