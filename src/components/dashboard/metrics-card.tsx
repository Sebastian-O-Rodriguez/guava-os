"use client";

import { useTransition } from "react";
import { Footprints, ArrowUpFromLine, Dumbbell, Timer } from "lucide-react";
import type {
  NutritionDailySummary,
  GoalProgress,
  GymBodyPartCount,
  RunningSummary,
} from "@/lib/types";
import type { GaugeActionCallbacks } from "./liquid-gauge";
import { LiquidGauge } from "./liquid-gauge";
import {
  quickAddNutrition,
  quickRemoveNutrition,
  quickIncrementGym,
  quickDecrementGym,
  quickAddRun,
  quickDecrementRun,
} from "@/actions/quick-log";

export type MetricsCardProps = {
  nutritionSummary: NutritionDailySummary;
  nutritionGoals: GoalProgress[];
  gymSummary: GymBodyPartCount[];
  gymGoals: GoalProgress[];
  runningSummary: RunningSummary;
  runGoals: GoalProgress[];
  readOnly?: boolean;
  /** When provided, suppresses the nutrition gauges entirely. */
  hasNutrition?: boolean;
  /** When provided, suppresses the gym gauges entirely. */
  hasGym?: boolean;
  /** When provided, suppresses the running gauge entirely. */
  hasRunning?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGoalTarget(goals: GoalProgress[], metric: string): number {
  return goals.find((g) => g.metric === metric)?.target ?? 0;
}

function getGymIcon(bodyPart: string): React.ReactNode {
  const key = bodyPart.toLowerCase();
  if (key.includes("leg")) return <Footprints size={28} />;
  if (key.includes("back")) return <ArrowUpFromLine size={28} />;
  if (key.includes("chest")) return <Dumbbell size={28} />;
  return <Dumbbell size={28} />;
}

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

  // Only show macros that have an active goal; fall back to all if none are set.
  const activeMacros = allMacros.filter((m) => m.target > 0);
  const displayMacros = activeMacros.length > 0 ? activeMacros : allMacros;

  function handleNutritionIncrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        const result = await quickAddNutrition(macro, amount);
        if (!result.success) cbs?.rollback();
      });
    };
  }

  function handleNutritionDecrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        const result = await quickRemoveNutrition(macro, amount);
        if (!result.success) cbs?.rollback();
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
        const result = await quickIncrementGym(bodyPart);
        if (!result.success) cbs?.rollback();
      });
    };
  }

  function handleGymDecrement(bodyPart: string) {
    return (_amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        const result = await quickDecrementGym(bodyPart);
        if (!result.success) cbs?.rollback();
      });
    };
  }

  // --- Running -------------------------------------------------------------

  const milesGoal = runGoals.find((g) => g.metric === "miles");
  const runTarget = milesGoal?.target ?? 0;
  // hasRunningProp lets the page explicitly hide the gauge; fall back to data-derived check.
  const hasRunning =
    hasRunningProp !== undefined
      ? hasRunningProp
      : runTarget > 0 || runningSummary.totalMiles > 0;

  function handleRunIncrement(amount: number, cbs?: GaugeActionCallbacks) {
    startTransition(async () => {
      const result = await quickAddRun(amount);
      if (!result.success) cbs?.rollback();
    });
  }

  function handleRunDecrement(amount: number, cbs?: GaugeActionCallbacks) {
    startTransition(async () => {
      const result = await quickDecrementRun(amount);
      if (!result.success) cbs?.rollback();
    });
  }

  // --- Render --------------------------------------------------------------

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-6">
      <div
        role="group"
        aria-label="All metrics"
        className="flex flex-wrap justify-around items-end gap-4"
      >
        {/* Nutrition macros */}
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

        {/* Gym body parts */}
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
              icon={getGymIcon(row.bodyPart)}
              readOnly={readOnly}
            />
          ))}

        {/* Running */}
        {hasRunning && (
          <LiquidGauge
            label="Run"
            value={runningSummary.totalMiles}
            max={runTarget > 0 ? runTarget : 10}
            unit="mi"
            tapAmount={1}
            onIncrement={readOnly ? undefined : handleRunIncrement}
            onDecrement={readOnly ? undefined : handleRunDecrement}
            icon={<Timer size={28} />}
            readOnly={readOnly}
          />
        )}
      </div>
    </div>
  );
}
