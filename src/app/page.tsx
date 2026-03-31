export const dynamic = "force-dynamic";

import {
  getAllCategoryProgress,
  getDailyNutritionSummary,
  getWeeklyGymSummary,
  getWeeklyRunningSummary,
} from "@/actions/logs";
import { getCategories } from "@/actions/categories";
import { VendingBackground } from "@/components/dashboard/vending-background";
import { MetricsCard } from "@/components/dashboard/metrics-card";
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
    <div className="relative min-h-screen overflow-hidden">
      {/* Rive vending machine background — full screen, z-0 */}
      <VendingBackground />

      {/* Content layer — floats above background */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header — top */}
        <header className="px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <DayHeader dateString={formatDate(viewDate)} isoDate={viewIso} isToday={isToday} />
          </div>
        </header>

        {/* Metrics — pushed toward bottom */}
        <div className="flex-1 flex items-end pb-8 px-4 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-4xl flex flex-col gap-6">
            {isToday && <InlineChat />}

            {(hasNutrition || hasFitness) && (
              <MetricsCard
                nutritionSummary={nutritionSummary}
                nutritionGoals={nutritionProgress?.goals ?? []}
                gymSummary={gymSummary}
                gymGoals={gymProgress?.goals ?? []}
                runningSummary={runningSummary}
                runGoals={runProgress?.goals ?? []}
                readOnly={!isToday}
                hasNutrition={hasNutrition}
                hasGym={hasGym}
                hasRunning={hasRunning}
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
    </div>
  );
}
