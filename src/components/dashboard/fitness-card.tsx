"use client";

import { useTransition } from "react";
import { Footprints, ArrowUpFromLine, Dumbbell, Timer } from "lucide-react";
import type { GymBodyPartCount, GoalProgress, RunningSummary } from "@/lib/types";
import { VerticalBar } from "./vertical-bar";
import { quickIncrementGym, quickDecrementGym, quickAddRun, quickDecrementRun } from "@/actions/quick-log";

type FitnessCardProps = {
  gymSummary: GymBodyPartCount[];
  gymGoals: GoalProgress[];
  runningSummary: RunningSummary;
  runGoals: GoalProgress[];
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
    return () => {
      startTransition(async () => {
        await quickIncrementGym(bodyPart);
      });
    };
  }

  function handleGymDecrement(bodyPart: string) {
    return () => {
      startTransition(async () => {
        await quickDecrementGym(bodyPart);
      });
    };
  }

  function handleRunIncrement(amount: number) {
    startTransition(async () => {
      await quickAddRun(amount);
    });
  }

  function handleRunDecrement(amount: number) {
    startTransition(async () => {
      await quickDecrementRun(amount);
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

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${gymRows.length + (hasRunning ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {gymRows.map((row) => (
          <VerticalBar
            key={row.bodyPart}
            label={row.label}
            value={row.done}
            max={row.target}
            mode="increment"
            quickIncrement
            onIncrement={handleGymIncrement(row.bodyPart)}
            onDecrement={handleGymDecrement(row.bodyPart)}
            icon={getGymIcon(row.bodyPart)}
          />
        ))}

        {hasRunning && (
          <VerticalBar
            label="Run"
            value={runningSummary.totalMiles}
            max={runTarget > 0 ? runTarget : 10}
            unit="mi"
            mode="increment"
            quickIncrement
            onIncrement={handleRunIncrement}
            onDecrement={handleRunDecrement}
            icon={<Timer size={28} />}
          />
        )}
      </div>
    </div>
  );
}
