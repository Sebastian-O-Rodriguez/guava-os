export const dynamic = "force-dynamic";

import {
  getAllCategoryProgress,
  getDailyNutritionSummary,
  getWeeklyGymSummary,
  getWeeklyRunningSummary,
} from "@/actions/logs";
import { getCategories } from "@/actions/categories";
import { NutritionCard } from "@/components/dashboard/nutrition-card";
import { FitnessCard } from "@/components/dashboard/fitness-card";
import { CustomCard } from "@/components/dashboard/custom-card";
import { InlineChat } from "@/components/dashboard/inline-chat";
import { DayHeader } from "@/components/dashboard/day-header";

function formatDate(date: Date): string {
  // e.g. "Wednesday, 25 March 2026"
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

/** Parse YYYY-MM-DD string into a local-time Date. Returns null on invalid input. */
function parseDateParam(param: string | undefined): Date | null {
  if (!param) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(param);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(y, m - 1, d);
  // Guard against invalid calendar dates like 2026-02-30
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/** Format a Date as YYYY-MM-DD for use in URL params. */
function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const todayIso = toISODateString(today);

  // Parse ?date= param; clamp future dates to today
  const parsedDate = parseDateParam(params.date);
  const viewDate = parsedDate && parsedDate <= today ? parsedDate : today;
  const viewIso = toISODateString(viewDate);
  const isToday = viewIso === todayIso;

  const [progressResult, nutritionResult, gymResult, runResult, categoriesResult] =
    await Promise.all([
      getAllCategoryProgress(viewDate),
      getDailyNutritionSummary(viewDate),
      getWeeklyGymSummary(viewDate),
      getWeeklyRunningSummary(viewDate),
      getCategories(),
    ]);

  const allProgress = progressResult.success ? progressResult.data : [];
  const nutritionSummary = nutritionResult.success
    ? nutritionResult.data
    : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const gymSummary = gymResult.success ? gymResult.data : [];
  const runningSummary = runResult.success ? runResult.data : { totalMiles: 0, sessions: 0 };
  const categories = categoriesResult.success ? categoriesResult.data : [];

  const nutritionProgress = allProgress.find((p) => p.categoryType === "nutrition");
  const gymProgress = allProgress.find((p) => p.categoryType === "gym");
  const runProgress = allProgress.find((p) => p.categoryType === "running");
  const customProgress = allProgress.filter((p) => p.categoryType === "custom");

  const hasNutrition = categories.some((c) => c.type === "nutrition");
  const hasGym = categories.some((c) => c.type === "gym");
  const hasRunning = categories.some((c) => c.type === "running");
  const hasFitness = hasGym || hasRunning;

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8 animate-fade-in">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <DayHeader dateString={formatDate(viewDate)} isoDate={viewIso} isToday={isToday} />
        </header>

        <div className="flex flex-col gap-6">
          {isToday && <InlineChat />}

          {hasNutrition && (
            <NutritionCard
              summary={nutritionSummary}
              goals={nutritionProgress?.goals ?? []}
              readOnly={!isToday}
            />
          )}

          {hasFitness && (
            <FitnessCard
              gymSummary={gymSummary}
              gymGoals={gymProgress?.goals ?? []}
              runningSummary={runningSummary}
              runGoals={runProgress?.goals ?? []}
              readOnly={!isToday}
            />
          )}

          {customProgress.map((cat) => (
            <CustomCard key={cat.categoryId} category={cat} />
          ))}

          {!hasNutrition && !hasFitness && customProgress.length === 0 && (
            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-8 text-center">
              <p className="text-muted-foreground text-sm">
                No categories set up yet. Use the chat to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
