import { useCallback, useEffect, useState } from "react";
import { styled, YStack, View, Text, ScrollView } from "tamagui";
import { VendingBackground } from "../../components/dashboard/vending-background";
import { DayHeader } from "../../components/dashboard/day-header";
import { InlineChat } from "../../components/dashboard/inline-chat";
import { MetricsCard } from "../../components/dashboard/metrics-card";
import { AppNav } from "../../components/app-nav";
import { API_BASE } from "../../lib/api";
import type { MetricsCardProps } from "../../components/dashboard/metrics-card";
import type {
  NutritionDailySummary,
  GymBodyPartCount,
  RunningSummary,
  CategoryProgress,
} from "../../lib/types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(date: Date): string {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const year = date.getFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

function isTodayDate(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// ---------------------------------------------------------------------------
// Data shapes
// ---------------------------------------------------------------------------

type CategoryData = {
  id: string;
  type: string;
  name: string;
  active: boolean;
};

type DashboardData = Omit<MetricsCardProps, "readOnly" | "apiBaseUrl" | "onMutate"> & {
  hasNutrition: boolean;
  hasGym: boolean;
  hasRunning: boolean;
};

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const DashboardCard = styled(YStack, {
  name: "DashboardCard",
  borderRadius: "$5",
  borderWidth: 1,
  borderColor: "$glassBorder",
  backgroundColor: "transparent",
  padding: "$4",
  gap: "$3",
  overflow: "hidden",
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchDashboardData(date: Date): Promise<DashboardData> {
  const iso = toISODateString(date);

  const [progressRes, nutritionRes, gymRes, runRes, categoriesRes] = await Promise.all([
    fetch(`${API_BASE}/api/logs?type=progress&date=${iso}`),
    fetch(`${API_BASE}/api/logs?type=nutrition_summary&date=${iso}`),
    fetch(`${API_BASE}/api/logs?type=gym_summary&date=${iso}`),
    fetch(`${API_BASE}/api/logs?type=run_summary&date=${iso}`),
    fetch(`${API_BASE}/api/categories`),
  ]);

  const [progress, nutrition, gym, run, categories] = await Promise.all([
    progressRes.json() as Promise<{ success: boolean; data: CategoryProgress[] }>,
    nutritionRes.json() as Promise<{ success: boolean; data: NutritionDailySummary }>,
    gymRes.json() as Promise<{ success: boolean; data: GymBodyPartCount[] }>,
    runRes.json() as Promise<{ success: boolean; data: RunningSummary }>,
    categoriesRes.json() as Promise<{ success: boolean; data: CategoryData[] }>,
  ]);

  const allProgress: CategoryProgress[] = progress.success ? progress.data : [];
  const nutritionSummary: NutritionDailySummary = nutrition.success
    ? nutrition.data
    : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const gymSummary: GymBodyPartCount[] = gym.success ? gym.data : [];
  const runningSummary: RunningSummary = run.success ? run.data : { totalMiles: 0, sessions: 0 };
  const cats: CategoryData[] = categories.success ? categories.data : [];

  const nutritionProgress = allProgress.find((p) => p.categoryType === "nutrition");
  const gymProgress = allProgress.find((p) => p.categoryType === "gym");
  const runProgress = allProgress.find((p) => p.categoryType === "running");

  const hasNutrition = cats.some((c) => c.type === "nutrition");
  const hasGym = cats.some((c) => c.type === "gym");
  const hasRunning = cats.some((c) => c.type === "running");

  return {
    nutritionSummary,
    nutritionGoals: nutritionProgress?.goals ?? [],
    gymSummary,
    gymGoals: gymProgress?.goals ?? [],
    runningSummary,
    runGoals: runProgress?.goals ?? [],
    hasNutrition,
    hasGym,
    hasRunning,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardScreen() {
  const [viewDate, setViewDate] = useState(new Date());
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  const isToday = isTodayDate(viewDate);
  const isoDate = toISODateString(viewDate);
  const dateString = formatDate(viewDate);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboardData(viewDate)
      .then(setData)
      .catch((err) => {
        console.error("[DashboardScreen] fetch error", err);
        setError("Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [isoDate, fetchKey]);

  const handleMutate = useCallback(() => {
    // Small delay so the DB write completes before we refetch
    setTimeout(() => setFetchKey((k) => k + 1), 500);
  }, []);

  function handleDateNavigate(newIso: string) {
    const [y, m, d] = newIso.split("-").map(Number);
    setViewDate(new Date(y, m - 1, d));
  }

  const hasData = !loading && !error && data && (data.hasNutrition || data.hasGym || data.hasRunning);
  const isEmpty = !loading && !error && data && !data.hasNutrition && !data.hasGym && !data.hasRunning;

  return (
    <View flex={1} backgroundColor="$background">
      <VendingBackground />

      <View zIndex={20}>
        <AppNav currentPath="/" />
      </View>

      <ScrollView
        flex={1}
        zIndex={10}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }}
        $md={{ contentContainerStyle: { padding: 12 } }}
      >
        <YStack maxWidth={640} alignSelf="center" width="100%">
          <DashboardCard>
            <DayHeader
              dateString={dateString}
              isoDate={isoDate}
              isToday={isToday}
              onNavigate={handleDateNavigate}
            />

            <InlineChat onSuccess={handleMutate} />

            {loading && (
              <Text
                textAlign="center"
                padding="$6"
                color="$placeholderColor"
                fontSize={14}
              >
                Loading...
              </Text>
            )}

            {error && !loading && (
              <Text
                textAlign="center"
                padding="$6"
                color="$placeholderColor"
                fontSize={14}
              >
                {error}
              </Text>
            )}

            {hasData && (
              <MetricsCard
                nutritionSummary={data.nutritionSummary}
                nutritionGoals={data.nutritionGoals}
                gymSummary={data.gymSummary}
                gymGoals={data.gymGoals}
                runningSummary={data.runningSummary}
                runGoals={data.runGoals}
                readOnly={!isToday}
                hasNutrition={data.hasNutrition}
                hasGym={data.hasGym}
                hasRunning={data.hasRunning}
                onMutate={handleMutate}
              />
            )}

            {isEmpty && (
              <Text
                textAlign="center"
                padding="$6"
                color="$placeholderColor"
                fontSize={14}
              >
                No categories set up yet. Use the chat to get started.
              </Text>
            )}
          </DashboardCard>
        </YStack>
      </ScrollView>
    </View>
  );
}
