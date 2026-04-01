import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, Platform } from "react-native";
import { YStack, Text } from "tamagui";
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

  // Called by MetricsCard after a successful mutation — refetch data
  const handleMutate = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  function handleDateNavigate(newIso: string) {
    const [y, m, d] = newIso.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (next > today) return;
    setViewDate(next);
  }

  const hasData = !loading && !error && data && (data.hasNutrition || data.hasGym || data.hasRunning);
  const isEmpty = !loading && !error && data && !data.hasNutrition && !data.hasGym && !data.hasRunning;

  // ---------------------------------------------------------------------------
  // Single card content — shared between web and native
  // ---------------------------------------------------------------------------

  const cardContent = (
    <>
      <DayHeader
        dateString={dateString}
        isoDate={isoDate}
        isToday={isToday}
        onNavigate={handleDateNavigate}
      />

      {isToday && <InlineChat onSuccess={handleMutate} />}

      {loading && (
        <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          Loading...
        </div>
      )}

      {error && !loading && (
        <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          {error}
        </div>
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
        <div style={{ textAlign: "center", padding: 24, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
          No categories set up yet. Use the chat to get started.
        </div>
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Web render
  // ---------------------------------------------------------------------------

  if (Platform.OS === "web") {
    return (
      <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
        <VendingBackground />
        <AppNav currentPath="/" />

        <div
          style={{
            position: "relative",
            zIndex: 10,
            paddingTop: 40,
          }}
        >
          <div
            style={{
              maxWidth: 640,
              margin: "0 auto",
              width: "100%",
              padding: "8px 16px 32px",
            }}
          >
            {/* Single card: DayHeader + Chat + Metrics */}
            <div
              style={{
                borderRadius: 20,
                border: "2px solid yellow", // TESTING — remove later
                backgroundColor: "transparent",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflow: "hidden",
              }}
            >
              {cardContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Native render
  // ---------------------------------------------------------------------------

  return (
    <View style={{ flex: 1, backgroundColor: "#09090b" }}>
      <VendingBackground />
      <View style={{ zIndex: 20 }}>
        <AppNav currentPath="/" />
      </View>
      <ScrollView
        style={{ flex: 1, zIndex: 10 }}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <YStack
          borderRadius={20}
          borderWidth={2}
          borderColor="yellow"
          padding={16}
          gap={12}
        >
          {cardContent}
        </YStack>
      </ScrollView>
    </View>
  );
}
