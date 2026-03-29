"use client";

import { useTransition } from "react";
import type { NutritionDailySummary, GoalProgress } from "@/lib/types";
import { VerticalBar } from "./vertical-bar";
import { quickAddNutrition } from "@/actions/quick-log";

type NutritionCardProps = {
  summary: NutritionDailySummary;
  goals: GoalProgress[];
};

function getGoalTarget(goals: GoalProgress[], metric: string): number {
  return goals.find((g) => g.metric === metric)?.target ?? 0;
}

export function NutritionCard({ summary, goals }: NutritionCardProps) {
  const [, startTransition] = useTransition();

  const calTarget = getGoalTarget(goals, "calories");
  const proteinTarget = getGoalTarget(goals, "protein");
  const fatTarget = getGoalTarget(goals, "fat");
  const carbsTarget = getGoalTarget(goals, "carbs");

  function handleIncrement(macro: "calories" | "protein" | "fat" | "carbs") {
    return (amount: number) => {
      startTransition(async () => {
        await quickAddNutrition(macro, amount);
      });
    };
  }

  const macros: {
    key: "calories" | "protein" | "fat" | "carbs";
    label: string;
    value: number;
    target: number;
    unit: string;
  }[] = [
    { key: "calories", label: "Cal", value: summary.calories, target: calTarget, unit: "kcal" },
    { key: "protein", label: "Prot", value: summary.protein, target: proteinTarget, unit: "g" },
    { key: "fat", label: "Fat", value: summary.fat, target: fatTarget, unit: "g" },
    { key: "carbs", label: "Carb", value: summary.carbs, target: carbsTarget, unit: "g" },
  ];

  const activeMacros = macros.filter((m) => m.target > 0);
  const displayMacros = activeMacros.length > 0 ? activeMacros : macros;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Nutrition</h2>
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Daily
        </span>
      </div>

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${displayMacros.length}, minmax(0, 1fr))` }}
      >
        {displayMacros.map((macro) => (
          <VerticalBar
            key={macro.key}
            label={macro.label}
            value={macro.value}
            max={macro.target > 0 ? macro.target : 100}
            unit={macro.unit}
            mode="increment"
            onIncrement={handleIncrement(macro.key)}
          />
        ))}
      </div>
    </div>
  );
}
