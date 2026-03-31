"use client";

import { useTransition } from "react";
import type { NutritionDailySummary, GoalProgress } from "@/lib/types";
import type { GaugeActionCallbacks } from "./liquid-gauge";
import { LiquidGauge } from "./liquid-gauge";
import { quickAddNutrition, quickRemoveNutrition } from "@/actions/quick-log";

type NutritionCardProps = {
  summary: NutritionDailySummary;
  goals: GoalProgress[];
  readOnly?: boolean;
};

function getGoalTarget(goals: GoalProgress[], metric: string): number {
  return goals.find((g) => g.metric === metric)?.target ?? 0;
}

export function NutritionCard({ summary, goals, readOnly = false }: NutritionCardProps) {
  const [, startTransition] = useTransition();

  const calTarget = getGoalTarget(goals, "calories");
  const proteinTarget = getGoalTarget(goals, "protein");
  const fatTarget = getGoalTarget(goals, "fat");
  const carbsTarget = getGoalTarget(goals, "carbs");

  function handleIncrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        const result = await quickAddNutrition(macro, amount);
        if (!result.success) cbs?.rollback();
      });
    };
  }

  function handleDecrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number, cbs?: GaugeActionCallbacks) => {
      startTransition(async () => {
        const result = await quickRemoveNutrition(macro, amount);
        if (!result.success) cbs?.rollback();
      });
    };
  }

  const macros: {
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
      value: summary.calories,
      target: calTarget,
      unit: "kcal",
      tapAmount: Math.round((calTarget || 2500) * 0.1),
    },
    {
      key: "protein",
      label: "Prot",
      value: summary.protein,
      target: proteinTarget,
      unit: "g",
      tapAmount: Math.round((proteinTarget || 180) * 0.1),
    },
    {
      key: "fat",
      label: "Fat",
      value: summary.fat,
      target: fatTarget,
      unit: "g",
      tapAmount: Math.round((fatTarget || 80) * 0.1),
    },
    {
      key: "carbs",
      label: "Carb",
      value: summary.carbs,
      target: carbsTarget,
      unit: "g",
      tapAmount: Math.round((carbsTarget || 200) * 0.1),
    },
  ];

  const activeMacros = macros.filter((m) => m.target > 0);
  const displayMacros = activeMacros.length > 0 ? activeMacros : macros;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-foreground">Nutrition</h2>

      <div
        role="group"
        aria-label="Nutrition gauges"
        className="flex flex-wrap justify-around items-end gap-y-3"
      >
        {displayMacros.map((macro) => (
          <LiquidGauge
            key={macro.key}
            label={macro.label}
            value={macro.value}
            max={macro.target > 0 ? macro.target : 100}
            unit={macro.unit}
            size={80}
            tapAmount={macro.tapAmount}
            onIncrement={readOnly ? undefined : handleIncrement(macro.key)}
            onDecrement={readOnly ? undefined : handleDecrement(macro.key)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
