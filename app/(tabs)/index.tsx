import { useEffect, useState } from "react";
import { View, ScrollView, Platform } from "react-native";
import { YStack, Text } from "tamagui";
import { motion } from "motion/react";
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

type DashboardData = Omit<MetricsCardProps, "readOnly" | "apiBaseUrl"> & {
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
  }, [isoDate]);

  function handleDateNavigate(newIso: string) {
    const [y, m, d] = newIso.split("-").map(Number);
    const next = new Date(y, m - 1, d);
    // Clamp to today — do not allow future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (next > today) return;
    setViewDate(next);
  }

  // ---------------------------------------------------------------------------
  // Web render — fixed background, AppNav fixed at top, content flush below
  // ---------------------------------------------------------------------------

  if (Platform.OS === "web") {
    return (
      <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
        {/* Fixed animated background */}
        <VendingBackground />

        {/* Fixed nav — sits at z-50, h-10 */}
        <AppNav currentPath="/" />

        {/* Content — starts right under the nav (pt-10 = 40px nav height) */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            paddingTop: 40, // nav height
          }}
        >
          <div
            style={{
              maxWidth: 896,
              margin: "0 auto",
              width: "100%",
              padding: "8px 16px 32px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <DayHeader
              dateString={dateString}
              isoDate={isoDate}
              isToday={isToday}
              onNavigate={handleDateNavigate}
            />

            {isToday && <InlineChat />}

            {loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                }}
              >
                Loading...
              </div>
            )}

            {error && !loading && (
              <div
                style={{
                  textAlign: "center",
                  padding: 32,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && data && (data.hasNutrition || data.hasGym || data.hasRunning) && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
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
                />
              </motion.div>
            )}

            {!loading && !error && data && !data.hasNutrition && !data.hasGym && !data.hasRunning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.06)",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  padding: 32,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 14,
                }}
              >
                No categories set up yet. Use the chat to get started.
              </motion.div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Native render — solid background + scroll view, AppNav at top
  // ---------------------------------------------------------------------------

  const content = (
    <YStack flex={1} zIndex={10} padding={16} gap={12}>
      <DayHeader
        dateString={dateString}
        isoDate={isoDate}
        isToday={isToday}
        onNavigate={handleDateNavigate}
      />

      {isToday && <InlineChat />}

      {loading && (
        <YStack alignItems="center" justifyContent="center" flex={1}>
          <Text color="$placeholderColor" fontSize={14}>
            Loading...
          </Text>
        </YStack>
      )}

      {error && !loading && (
        <YStack alignItems="center" justifyContent="center" flex={1}>
          <Text color="$placeholderColor" fontSize={14}>
            {error}
          </Text>
        </YStack>
      )}

      {!loading && !error && data && (data.hasNutrition || data.hasGym || data.hasRunning) && (
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
        />
      )}

      {!loading && !error && data && !data.hasNutrition && !data.hasGym && !data.hasRunning && (
        <YStack
          borderRadius={16}
          borderWidth={1}
          borderColor="rgba(255,255,255,0.06)"
          backgroundColor="rgba(255,255,255,0.03)"
          padding={32}
          alignItems="center"
        >
          <Text color="$placeholderColor" fontSize={14} textAlign="center">
            No categories set up yet. Use the chat to get started.
          </Text>
        </YStack>
      )}
    </YStack>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#09090b" }}>
      <VendingBackground />
      {/* AppNav at very top on native */}
      <View style={{ zIndex: 20 }}>
        <AppNav currentPath="/" />
      </View>
      <ScrollView
        style={{ flex: 1, zIndex: 10 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>
    </View>
  );
}
