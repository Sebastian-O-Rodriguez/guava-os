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

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const today = new Date();

  const [progressResult, nutritionResult, gymResult, runResult, categoriesResult] =
    await Promise.all([
      getAllCategoryProgress(),
      getDailyNutritionSummary(today),
      getWeeklyGymSummary(),
      getWeeklyRunningSummary(),
      getCategories(),
    ]);

  const allProgress = progressResult.success ? progressResult.data : [];
  const nutritionSummary = nutritionResult.success
    ? nutritionResult.data
    : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const gymSummary = gymResult.success ? gymResult.data : [];
  const runningSummary = runResult.success
    ? runResult.data
    : { totalMiles: 0, sessions: 0 };
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
        <header className="mb-6 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">{formatDate(today)}</p>
        </header>

        <div className="flex flex-col gap-6">
          <InlineChat />

          {hasNutrition && (
            <NutritionCard
              summary={nutritionSummary}
              goals={nutritionProgress?.goals ?? []}
            />
          )}

          {hasFitness && (
            <FitnessCard
              gymSummary={gymSummary}
              gymGoals={gymProgress?.goals ?? []}
              runningSummary={runningSummary}
              runGoals={runProgress?.goals ?? []}
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
