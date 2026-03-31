"use client";

import { useTransition } from "react";
import { Footprints, ArrowUpFromLine, Dumbbell, Timer } from "lucide-react";
import type { GymBodyPartCount, GoalProgress, RunningSummary } from "@/lib/types";
import type { GaugeActionCallbacks } from "./liquid-gauge";
import { LiquidGauge } from "./liquid-gauge";
import {
  quickIncrementGym,
  quickDecrementGym,
  quickAddRun,
  quickDecrementRun,
} from "@/actions/quick-log";

type FitnessCardProps = {
  gymSummary: GymBodyPartCount[];
  gymGoals: GoalProgress[];
  runningSummary: RunningSummary;
  runGoals: GoalProgress[];
  readOnly?: boolean;
};

function getGymIcon(bodyPart: string): React.ReactNode {
  const key = bodyPart.toLowerCase();
  if (key.includes("leg")) return <Footprints size={28} />;
  if (key.includes("back")) return <ArrowUpFromLine size={28} />;
  if (key.includes("chest")) return <Dumbbell size={28} />;
  return <Dumbbell size={28} />;
}

export function FitnessCard({
  gymSummary,
  gymGoals,
  runningSummary,
  runGoals,
  readOnly = false,
}: FitnessCardProps) {
  const [, startTransition] = useTransition();

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

  const milesGoal = runGoals.find((g) => g.metric === "miles");
  const runTarget = milesGoal?.target ?? 0;

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

  const hasGym = gymRows.length > 0;
  const hasRunning = runTarget > 0 || runningSummary.totalMiles > 0;

  if (!hasGym && !hasRunning) {
    return (
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
        <h2 className="font-semibold text-foreground">Fitness</h2>
        <p className="text-sm text-muted-foreground">No fitness categories set up.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-card p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-foreground">Fitness</h2>

      <div role="group" aria-label="Fitness gauges" className="flex justify-around items-end">
        {gymRows.map((row) => (
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
