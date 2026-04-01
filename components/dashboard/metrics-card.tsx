import { useTransition } from "react";
import { Platform, View } from "react-native";
import { XStack, YStack } from "tamagui";
import { motion } from "motion/react";
import { API_BASE } from "../../lib/api";
import { LiquidGauge } from "./liquid-gauge";
import type { GaugeActionCallbacks } from "./liquid-gauge";

// ---------------------------------------------------------------------------
// Shared types (mirrors src/lib/types.ts)
// ---------------------------------------------------------------------------

export type NutritionDailySummary = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type GymBodyPartCount = {
  bodyPart: string;
  count: number;
};

export type RunningSummary = {
  totalMiles: number;
  sessions: number;
};

export type GoalProgress = {
  goalId: string;
  metric: string;
  target: number;
  period: string;
  actual: number;
  percentComplete: number;
};

// ---------------------------------------------------------------------------
// Icon helpers — plain text symbols for cross-platform compatibility
// ---------------------------------------------------------------------------

function getGymIcon(bodyPart: string): React.ReactNode {
  // Return null for now; icon prop is optional
  // Native Lucide icons won't work here without extra setup
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGoalTarget(goals: GoalProgress[], metric: string): number {
  return goals.find((g) => g.metric === metric)?.target ?? 0;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type MetricsCardProps = {
  nutritionSummary: NutritionDailySummary;
  nutritionGoals: GoalProgress[];
  gymSummary: GymBodyPartCount[];
  gymGoals: GoalProgress[];
  runningSummary: RunningSummary;
  runGoals: GoalProgress[];
  readOnly?: boolean;
  hasNutrition?: boolean;
  hasGym?: boolean;
  hasRunning?: boolean;
  /** Base URL for API calls — required in Expo since there are no relative paths */
  apiBaseUrl?: string;
  /** Called after a successful mutation so the parent can refetch */
  onMutate?: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricsCard({
  nutritionSummary,
  nutritionGoals,
  gymSummary,
  gymGoals,
  runningSummary,
  runGoals,
  readOnly = false,
  hasNutrition = true,
  hasGym = true,
  hasRunning: hasRunningProp,
  apiBaseUrl = API_BASE,
  onMutate,
}: MetricsCardProps) {
  const [, startTransition] = useTransition();

  // --- Nutrition -----------------------------------------------------------

  const calTarget = getGoalTarget(nutritionGoals, "calories");
  const proteinTarget = getGoalTarget(nutritionGoals, "protein");
  const fatTarget = getGoalTarget(nutritionGoals, "fat");
  const carbsTarget = getGoalTarget(nutritionGoals, "carbs");

  const allMacros: {
    key: "calories" | "protein" | "fat" | "carbs";
    label: string;
    value: number;
    target: number;
    unit: string;
    tapAmount: number;
  }[] = [
    {
      key: "calories",
      label: "Cal",
      value: nutritionSummary.calories,
      target: calTarget,
      unit: "kcal",
      tapAmount: Math.round((calTarget || 2500) * 0.1),
    },
    {
      key: "protein",
      label: "Prot",
      value: nutritionSummary.protein,
      target: proteinTarget,
      unit: "g",
      tapAmount: Math.round((proteinTarget || 180) * 0.1),
    },
    {
      key: "fat",
      label: "Fat",
      value: nutritionSummary.fat,
      target: fatTarget,
      unit: "g",
      tapAmount: Math.round((fatTarget || 80) * 0.1),
    },
    {
      key: "carbs",
      label: "Carb",
      value: nutritionSummary.carbs,
      target: carbsTarget,
      unit: "g",
      tapAmount: Math.round((carbsTarget || 200) * 0.1),
    },
  ];

  const activeMacros = allMacros.filter((m) => m.target > 0);
  const displayMacros = activeMacros.length > 0 ? activeMacros : allMacros;

  async function callQuickLog(endpoint: string, body: Record<string, unknown>) {
    const res = await fetch(`${apiBaseUrl}/api/quick-log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: endpoint, ...body }),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  function handleNutritionIncrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        try {
          await callQuickLog("quickAddNutrition", { macro, amount });
          onMutate?.();
        } catch {
          cbs?.rollback();
        }
      });
    };
  }

  function handleNutritionDecrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        try {
          await callQuickLog("quickRemoveNutrition", { macro, amount });
          onMutate?.();
        } catch {
          cbs?.rollback();
        }
      });
    };
  }

  // --- Gym -----------------------------------------------------------------

  const summaryMap = new Map(gymSummary.map((g) => [g.bodyPart.toLowerCase(), g.count]));

  const gymRows: { label: string; bodyPart: string; done: number; target: number }[] =
    gymGoals.length > 0
      ? gymGoals.map((goal) => {
          const bodyPart = goal.metric.replace("_sessions", "").replace(/_/g, " ");
          const normalizedKey = bodyPart.toLowerCase();
          const done = summaryMap.get(normalizedKey) ?? goal.actual;
          return { label: bodyPart, bodyPart: normalizedKey, done, target: goal.target };
        })
      : gymSummary.map((g) => ({
          label: g.bodyPart,
          bodyPart: g.bodyPart.toLowerCase(),
          done: g.count,
          target: 1,
        }));

  function handleGymIncrement(bodyPart: string) {
    return (_amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        try {
          await callQuickLog("quickIncrementGym", { bodyPart });
          onMutate?.();
        } catch {
          cbs?.rollback();
        }
      });
    };
  }

  function handleGymDecrement(bodyPart: string) {
    return (_amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        try {
          await callQuickLog("quickDecrementGym", { bodyPart });
          onMutate?.();
        } catch {
          cbs?.rollback();
        }
      });
    };
  }

  // --- Running -------------------------------------------------------------

  const milesGoal = runGoals.find((g) => g.metric === "miles");
  const runTarget = milesGoal?.target ?? 0;
  const hasRunning =
    hasRunningProp !== undefined
      ? hasRunningProp
      : runTarget > 0 || runningSummary.totalMiles > 0;

  function handleRunIncrement(amount: number, cbs?: GaugeActionCallbacks) {
    startTransition(async () => {
      try {
        await callQuickLog("quickAddRun", { amount });
      } catch {
        cbs?.rollback();
      }
    });
  }

  function handleRunDecrement(amount: number, cbs?: GaugeActionCallbacks) {
    startTransition(async () => {
      try {
        await callQuickLog("quickDecrementRun", { amount });
      } catch {
        cbs?.rollback();
      }
    });
  }

  // --- Render --------------------------------------------------------------

  // Glass card container — use div on web, Stack on native
  const gauges = (
    <>
      {hasNutrition &&
        displayMacros.map((macro) => (
          <LiquidGauge
            key={macro.key}
            label={macro.label}
            value={macro.value}
            max={macro.target > 0 ? macro.target : 100}
            unit={macro.unit}
            size={80}
            tapAmount={macro.tapAmount}
            onIncrement={readOnly ? undefined : handleNutritionIncrement(macro.key)}
            onDecrement={readOnly ? undefined : handleNutritionDecrement(macro.key)}
            readOnly={readOnly}
          />
        ))}

      {hasGym &&
        gymRows.map((row) => (
          <LiquidGauge
            key={row.bodyPart}
            label={row.label}
            value={row.done}
            max={row.target}
            tapAmount={1}
            onIncrement={readOnly ? undefined : handleGymIncrement(row.bodyPart)}
            onDecrement={readOnly ? undefined : handleGymDecrement(row.bodyPart)}
            readOnly={readOnly}
          />
        ))}

      {hasRunning && (
        <LiquidGauge
          label="Run"
          value={runningSummary.totalMiles}
          max={runTarget > 0 ? runTarget : 10}
          unit="mi"
          tapAmount={1}
          onIncrement={readOnly ? undefined : handleRunIncrement}
          onDecrement={readOnly ? undefined : handleRunDecrement}
          readOnly={readOnly}
        />
      )}
    </>
  );

  if (Platform.OS === "web") {
    // Collect all gauge items so we can apply stagger by index
    const gaugeItems: React.ReactNode[] = [];

    if (hasNutrition) {
      displayMacros.forEach((macro) => {
        gaugeItems.push(
          <LiquidGauge
            key={macro.key}
            label={macro.label}
            value={macro.value}
            max={macro.target > 0 ? macro.target : 100}
            unit={macro.unit}
            size={80}
            tapAmount={macro.tapAmount}
            onIncrement={readOnly ? undefined : handleNutritionIncrement(macro.key)}
            onDecrement={readOnly ? undefined : handleNutritionDecrement(macro.key)}
            readOnly={readOnly}
          />,
        );
      });
    }

    if (hasGym) {
      gymRows.forEach((row) => {
        gaugeItems.push(
          <LiquidGauge
            key={row.bodyPart}
            label={row.label}
            value={row.done}
            max={row.target}
            tapAmount={1}
            onIncrement={readOnly ? undefined : handleGymIncrement(row.bodyPart)}
            onDecrement={readOnly ? undefined : handleGymDecrement(row.bodyPart)}
            readOnly={readOnly}
          />,
        );
      });
    }

    if (hasRunning) {
      gaugeItems.push(
        <LiquidGauge
          key="run"
          label="Run"
          value={runningSummary.totalMiles}
          max={runTarget > 0 ? runTarget : 10}
          unit="mi"
          tapAmount={1}
          onIncrement={readOnly ? undefined : handleRunIncrement}
          onDecrement={readOnly ? undefined : handleRunDecrement}
          readOnly={readOnly}
        />,
      );
    }

    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.07 } },
        }}
        style={{
          backgroundColor: "rgba(255,255,255,0.03)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          padding: "12px 20px",
        }}
        role="group"
        aria-label="All metrics"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-around",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          {gaugeItems.map((item, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
              }}
            >
              {item}
            </motion.div>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <View
      style={{
        backgroundColor: "rgba(255,255,255,0.03)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 16,
      }}
    >
      <XStack flexWrap="wrap" justifyContent="space-around" alignItems="flex-end" gap={16}>
        {gauges}
      </XStack>
    </View>
  );
}
