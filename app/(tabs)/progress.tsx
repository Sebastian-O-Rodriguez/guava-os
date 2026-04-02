import { useEffect, useState } from "react";
import { ScrollView, Platform, View } from "react-native";
import { YStack, XStack, Text } from "tamagui";
import type { CategoryProgress, GymBodyPartCount, RunningSummary } from "../../lib/types";
import { API_BASE } from "../../lib/api";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

type ProgressData = {
  allProgress: CategoryProgress[];
  gymSummary: GymBodyPartCount[];
  runningSummary: RunningSummary;
};

async function fetchProgressData(): Promise<ProgressData> {
  const [progressRes, gymRes, runRes] = await Promise.all([
    fetch(`${API_BASE}/api/logs?type=progress`),
    fetch(`${API_BASE}/api/logs?type=gym_summary`),
    fetch(`${API_BASE}/api/logs?type=run_summary`),
  ]);

  const [progress, gym, run] = await Promise.all([
    progressRes.json() as Promise<{ success: boolean; data: CategoryProgress[] }>,
    gymRes.json() as Promise<{ success: boolean; data: GymBodyPartCount[] }>,
    runRes.json() as Promise<{ success: boolean; data: RunningSummary }>,
  ]);

  return {
    allProgress: progress.success ? progress.data : [],
    gymSummary: gym.success ? gym.data : [],
    runningSummary: run.success ? run.data : { totalMiles: 0, sessions: 0 },
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function pctColor(pct: number): string {
  if (pct >= 100) return "rgb(52,211,153)"; // emerald-400
  if (pct >= 50) return "rgb(251,191,36)"; // amber-400
  return "rgb(113,113,122)"; // zinc-500
}

type GoalRowProps = {
  categoryName: string;
  metric: string;
  period: string;
  actual: number;
  target: number;
  percentComplete: number;
};

function GoalRow({ categoryName, metric, period, actual, target, percentComplete }: GoalRowProps) {
  const pct = Math.round(percentComplete);
  const displayActual = Number.isInteger(actual) ? String(actual) : actual.toFixed(1);
  const displayTarget = Number.isInteger(target) ? String(target) : target.toFixed(1);
  const barWidth = `${Math.min(100, pct)}%`;

  if (Platform.OS === "web") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingTop: 12,
          paddingBottom: 12,
          borderBottom: "1px solid rgba(39,39,42,0.6)",
        }}
      >
        <div style={{ width: 100, color: "rgb(113,113,122)", fontSize: 13, flexShrink: 0 }}>
          {categoryName}
        </div>
        <div
          style={{
            flex: 1,
            color: "rgb(250,250,250)",
            fontSize: 13,
            textTransform: "capitalize",
          }}
        >
          {metric.replace(/_/g, " ")}
        </div>
        <div style={{ width: 60, color: "rgb(113,113,122)", fontSize: 12, textTransform: "capitalize" }}>
          {period}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: 140 }}>
          <div
            style={{
              height: 6,
              width: 80,
              borderRadius: 3,
              backgroundColor: "rgb(39,39,42)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "linear-gradient(to right, rgb(5,150,105), rgb(52,211,153))",
                width: barWidth,
                transition: "width 500ms",
              }}
            />
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: pctColor(pct),
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayActual}/{displayTarget}
          </span>
        </div>
      </div>
    );
  }

  return (
    <YStack
      py={12}
      borderBottomWidth={1}
      borderBottomColor="rgba(39,39,42,0.6)"
      gap={6}
    >
      <XStack justify="space-between" items="center">
        <Text fontSize={13} color="$placeholderColor" textTransform="capitalize">
          {categoryName} — {metric.replace(/_/g, " ")}
        </Text>
        <Text fontSize={12} color="$placeholderColor" textTransform="capitalize">
          {period}
        </Text>
      </XStack>
      <XStack items="center" gap={8}>
        <View
          style={{
            height: 6,
            flex: 1,
            borderRadius: 3,
            backgroundColor: "rgb(39,39,42)",
          }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: pctColor(pct),
              width: barWidth as `${number}%`,
            }}
          />
        </View>
        <Text
          fontSize={13}
          fontWeight="500"
          color={pctColor(pct) as never}
        >
          {displayActual}/{displayTarget}
        </Text>
      </XStack>
    </YStack>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ProgressScreen() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchProgressData()
      .then(setData)
      .catch((err) => {
        console.error("[ProgressScreen] fetch error", err);
        setError("Failed to load progress");
      })
      .finally(() => setLoading(false));
  }, []);

  if (Platform.OS === "web") {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#09090b",
          padding: "32px 16px",
          animationName: "fadeIn",
          animationDuration: "200ms",
        }}
      >
        <div style={{ maxWidth: 768, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
          {/* Header */}
          <div>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "rgb(250,250,250)",
                margin: 0,
              }}
            >
              Progress
            </h1>
            <p style={{ marginTop: 4, fontSize: 14, color: "rgb(113,113,122)" }}>
              Goal completion across all categories
            </p>
          </div>

          {loading && (
            <p style={{ fontSize: 14, color: "rgb(113,113,122)", textAlign: "center", padding: 32 }}>
              Loading...
            </p>
          )}

          {error && !loading && (
            <p style={{ fontSize: 14, color: "rgb(113,113,122)", textAlign: "center", padding: 32 }}>
              {error}
            </p>
          )}

          {!loading && !error && data && <WebProgressContent data={data} />}
        </div>
      </div>
    );
  }

  // Native
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#09090b" }}
      contentContainerStyle={{ padding: 16, gap: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <YStack gap={24} pb={32}>
        {/* Header */}
        <YStack gap={4}>
          <Text fontSize={28} fontWeight="700" color="$color" letterSpacing={-0.5}>
            Progress
          </Text>
          <Text fontSize={14} color="$placeholderColor">
            Goal completion across all categories
          </Text>
        </YStack>

        {loading && (
          <YStack items="center" p={32}>
            <Text fontSize={14} color="$placeholderColor">
              Loading...
            </Text>
          </YStack>
        )}

        {error && !loading && (
          <YStack items="center" p={32}>
            <Text fontSize={14} color="$placeholderColor">
              {error}
            </Text>
          </YStack>
        )}

        {!loading && !error && data && <NativeProgressContent data={data} />}
      </YStack>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Web content
// ---------------------------------------------------------------------------

function WebProgressContent({ data }: { data: ProgressData }) {
  const { allProgress, gymSummary, runningSummary } = data;
  const gymProgress = allProgress.find((p) => p.categoryType === "gym");
  const runProgress = allProgress.find((p) => p.categoryType === "running");

  const gymGoalsMet = gymProgress?.goals.filter((g) => g.percentComplete >= 100).length ?? 0;
  const gymGoalsTotal = gymProgress?.goals.length ?? 0;
  const runMilesGoal = runProgress?.goals.find((g) => g.metric === "miles");

  const showWeekly = gymGoalsTotal > 0 || runningSummary.sessions > 0;

  const flatGoals = allProgress.flatMap((cat) =>
    cat.goals.map((g) => ({
      ...g,
      categoryName: cat.categoryName,
    })),
  );

  const cardStyle: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(39,39,42,0.6)",
    backgroundColor: "rgba(24,24,27,0.8)",
    padding: 16,
  };

  return (
    <>
      {showWeekly && (
        <section>
          <h2
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "rgb(113,113,122)",
              marginBottom: 16,
              margin: "0 0 16px 0",
            }}
          >
            Weekly Overview
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {gymGoalsTotal > 0 && (
              <div style={cardStyle}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgb(113,113,122)", margin: "0 0 8px 0" }}>
                  Gym
                </p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "rgb(250,250,250)", margin: 0 }}>
                  {gymGoalsMet}
                  <span style={{ fontSize: 16, fontWeight: 400, color: "rgb(113,113,122)" }}>
                    /{gymGoalsTotal}
                  </span>
                </p>
                <p style={{ fontSize: 12, color: "rgb(113,113,122)", margin: "4px 0 0 0" }}>goals met</p>
              </div>
            )}
            {gymSummary.length > 0 && (
              <div style={cardStyle}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgb(113,113,122)", margin: "0 0 8px 0" }}>
                  Body Parts
                </p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "rgb(250,250,250)", margin: 0 }}>
                  {gymSummary.length}
                </p>
                <p style={{ fontSize: 12, color: "rgb(113,113,122)", margin: "4px 0 0 0" }}>trained this week</p>
              </div>
            )}
            {(runningSummary.sessions > 0 || runMilesGoal) && (
              <div style={cardStyle}>
                <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgb(113,113,122)", margin: "0 0 8px 0" }}>
                  Running
                </p>
                <p style={{ fontSize: 24, fontWeight: 700, color: "rgb(250,250,250)", margin: 0 }}>
                  {runningSummary.totalMiles.toFixed(1)}
                  {runMilesGoal && (
                    <span style={{ fontSize: 16, fontWeight: 400, color: "rgb(113,113,122)" }}>
                      /{runMilesGoal.target} mi
                    </span>
                  )}
                  {!runMilesGoal && (
                    <span style={{ fontSize: 16, fontWeight: 400, color: "rgb(113,113,122)" }}>
                      {" "}mi
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "rgb(113,113,122)", margin: "4px 0 0 0" }}>
                  {runningSummary.sessions} session{runningSummary.sessions !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2
          style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "rgb(113,113,122)",
            margin: "0 0 16px 0",
          }}
        >
          All Goals
        </h2>
        {flatGoals.length === 0 ? (
          <div
            style={{
              ...cardStyle,
              padding: 32,
              textAlign: "center",
              color: "rgb(113,113,122)",
              fontSize: 14,
            }}
          >
            No goals configured yet.
          </div>
        ) : (
          <div style={{ ...cardStyle, padding: "0 16px" }}>
            {flatGoals.map((g) => (
              <GoalRow
                key={g.goalId}
                categoryName={g.categoryName}
                metric={g.metric}
                period={g.period}
                actual={g.actual}
                target={g.target}
                percentComplete={g.percentComplete}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Native content
// ---------------------------------------------------------------------------

function NativeProgressContent({ data }: { data: ProgressData }) {
  const { allProgress, gymSummary, runningSummary } = data;
  const gymProgress = allProgress.find((p) => p.categoryType === "gym");
  const runProgress = allProgress.find((p) => p.categoryType === "running");

  const gymGoalsMet = gymProgress?.goals.filter((g) => g.percentComplete >= 100).length ?? 0;
  const gymGoalsTotal = gymProgress?.goals.length ?? 0;
  const runMilesGoal = runProgress?.goals.find((g) => g.metric === "miles");

  const showWeekly = gymGoalsTotal > 0 || runningSummary.sessions > 0;

  const flatGoals = allProgress.flatMap((cat) =>
    cat.goals.map((g) => ({
      ...g,
      categoryName: cat.categoryName,
    })),
  );

  const cardStyle = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(39,39,42,0.6)",
    backgroundColor: "rgba(24,24,27,0.8)",
    padding: 16,
  };

  return (
    <YStack gap={24}>
      {showWeekly && (
        <YStack gap={12}>
          <Text
            fontSize={12}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing={1}
            color="$placeholderColor"
          >
            Weekly Overview
          </Text>
          <XStack gap={12} flexWrap="wrap">
            {gymGoalsTotal > 0 && (
              <YStack style={cardStyle} flex={1} minW={100} gap={4}>
                <Text fontSize={11} fontWeight="600" textTransform="uppercase" letterSpacing={1} color="$placeholderColor">
                  Gym
                </Text>
                <Text fontSize={24} fontWeight="700" color="$color">
                  {gymGoalsMet}
                  <Text fontSize={16} fontWeight="400" color="$placeholderColor">
                    /{gymGoalsTotal}
                  </Text>
                </Text>
                <Text fontSize={12} color="$placeholderColor">goals met</Text>
              </YStack>
            )}
            {gymSummary.length > 0 && (
              <YStack style={cardStyle} flex={1} minW={100} gap={4}>
                <Text fontSize={11} fontWeight="600" textTransform="uppercase" letterSpacing={1} color="$placeholderColor">
                  Body Parts
                </Text>
                <Text fontSize={24} fontWeight="700" color="$color">{gymSummary.length}</Text>
                <Text fontSize={12} color="$placeholderColor">trained this week</Text>
              </YStack>
            )}
            {(runningSummary.sessions > 0 || runMilesGoal) && (
              <YStack style={cardStyle} flex={1} minW={100} gap={4}>
                <Text fontSize={11} fontWeight="600" textTransform="uppercase" letterSpacing={1} color="$placeholderColor">
                  Running
                </Text>
                <Text fontSize={24} fontWeight="700" color="$color">
                  {runningSummary.totalMiles.toFixed(1)}
                  {runMilesGoal && (
                    <Text fontSize={16} fontWeight="400" color="$placeholderColor">
                      /{runMilesGoal.target} mi
                    </Text>
                  )}
                  {!runMilesGoal && (
                    <Text fontSize={16} fontWeight="400" color="$placeholderColor">
                      {" "}mi
                    </Text>
                  )}
                </Text>
                <Text fontSize={12} color="$placeholderColor">
                  {runningSummary.sessions} session{runningSummary.sessions !== 1 ? "s" : ""}
                </Text>
              </YStack>
            )}
          </XStack>
        </YStack>
      )}

      <YStack gap={12}>
        <Text
          fontSize={12}
          fontWeight="600"
          textTransform="uppercase"
          letterSpacing={1}
          color="$placeholderColor"
        >
          All Goals
        </Text>
        {flatGoals.length === 0 ? (
          <YStack style={cardStyle} p={32} items="center">
            <Text fontSize={14} color="$placeholderColor">
              No goals configured yet.
            </Text>
          </YStack>
        ) : (
          <YStack style={{ ...cardStyle, padding: 16 }}>
            {flatGoals.map((g) => (
              <GoalRow
                key={g.goalId}
                categoryName={g.categoryName}
                metric={g.metric}
                period={g.period}
                actual={g.actual}
                target={g.target}
                percentComplete={g.percentComplete}
              />
            ))}
          </YStack>
        )}
      </YStack>
    </YStack>
  );
}
