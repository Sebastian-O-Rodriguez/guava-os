import { useCallback, useEffect, useState } from "react";
import { Text, ScrollView, YStack, XStack, View, Theme, Spinner, Button } from "tamagui";
import { motion } from "motion/react";
import { Shell, Content } from "../components/ui/shell";
import { Hamburger } from "../components/nav/hamburger";
import { ChatSurface } from "../components/now/chat-surface";
import { GoalTile, type TileCallbacks } from "../components/now/goal-tile";
import { NestedDoughnut } from "../components/ui/nested-doughnut";
import { DailyCard, CollectionCard } from "../components/ui/card-templates";
import { ProgressBar } from "../components/ui/progress-bar";
import { CreateGoalForm } from "../components/now/create-goal-form";
import { SECTION_THEMES } from "../lib/palette";
import { useTileData, type FeedEntry } from "../hooks/use-tile-data";
import { authFetch, API_BASE } from "../lib/api";
import { useActionModal } from "../lib/action-modal-context";


function formatDate(d: Date) {
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const dd = String(d.getDate()).padStart(2, "0");
  const mon = d.toLocaleDateString("en-GB", { month: "long" });
  return `${day}, ${dd} ${mon}`;
}

// Staggered entrance for tiles
function AnimatedTile({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 14, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function NowScreen() {
  const today = new Date();
  const {
    dailyTiles,
    weeklyTiles,
    doughnutSegments,
    calorieTotal,
    calorieTarget,
    nutritionSummary,
    feedEntries,
    categories,
    loading,
    error,
    refresh,
  } = useTileData();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const actionModal = useActionModal();

  // Wire modal onSuccess to refresh
  useEffect(() => {
    actionModal.setOnSuccess(() => { refresh(); });
    return () => actionModal.setOnSuccess(null);
  }, [refresh, actionModal]);

  // Open action modal for manual entry (type tabs in modal)
  const openAddModal = useCallback(() => {
    actionModal.open({
      type: "nutrition",
      fields: {},
      source: "manual",
    });
  }, [actionModal]);

  // Tap → persist to DB → refresh. Rollback on failure.
  const handleTileIncrement = useCallback(
    (categoryId: string, goalUnit: string) =>
      async (amount: number, cbs: TileCallbacks) => {
        try {
          const res = await authFetch(`${API_BASE}/api/quick-log`, {
            method: "POST",
            body: JSON.stringify({
              action: "increment_goal",
              categoryId,
              amount,
              unit: goalUnit,
            }),
          });
          if (!res.ok) throw new Error(`${res.status}`);
          refresh();
        } catch {
          cbs.rollback();
        }
      },
    [refresh],
  );

  // Delete goal — confirm then DELETE /api/goals
  const handleDeleteGoal = useCallback(
    async (goalId: string, label: string) => {
      const confirmed = window.confirm(`Delete "${label}"?`);
      if (!confirmed) return;
      try {
        const res = await authFetch(`${API_BASE}/api/goals?id=${goalId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`${res.status}`);
        refresh();
      } catch (err) {
        console.error("[deleteGoal]", err);
      }
    },
    [refresh],
  );

  return (
    <Shell>
      {/* 1. Nav */}
      <Hamburger currentPath="/" />

      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <Content>
          {/* 2. Orientation */}
          <Text fontSize={20} fontWeight="600" color="$color" letterSpacing={-0.3} text="center" pt="$2">
            The Stub is the Way
          </Text>
          <Text fontSize={12} color="$color7" text="center">
            {formatDate(today)}
          </Text>

          {/* 3. Input bar — chat + inline "+" button */}
          <ChatSurface onSuccess={refresh} onAdd={openAddModal} />

          {/* Loading state */}
          {loading && (
            <YStack items="center" py="$6">
              <Spinner size="large" color="$color7" />
            </YStack>
          )}

          {/* Error state */}
          {error && !loading && (
            <YStack items="center" py="$4">
              <Text fontSize={13} color="$color7">{error}</Text>
            </YStack>
          )}

          {/* 4. Daily — doughnut + tiles + totals + feed */}
          {!loading && (
            <Theme name={SECTION_THEMES.daily}>
              <DailyCard
                label="Daily"
                doughnut={(size) => (
                  <NestedDoughnut
                    size={size}
                    centerLabel="calories"
                    centerValue={calorieTotal.toLocaleString()}
                    centerUnit="kcal"
                    segments={doughnutSegments}
                  />
                )}
                footer={
                  <>
                    <TotalsRow
                      calories={nutritionSummary.calories}
                      protein={nutritionSummary.protein}
                      fat={nutritionSummary.fat}
                      carbs={nutritionSummary.carbs}
                    />
                    <FeedBreakdown entries={feedEntries} />
                  </>
                }
              >
                {dailyTiles.map((tile, i) => (
                  <AnimatedTile key={tile.key} delay={i * 0.12}>
                    <GoalTile
                      label={tile.label}
                      value={tile.value}
                      max={tile.max}
                      unit={tile.unit}
                      size="md"
                      tapAmount={tile.tapAmount}
                      onIncrement={handleTileIncrement(tile.categoryId, tile.goalUnit)}
                      onLongPress={() => handleDeleteGoal(tile.key, tile.label)}
                    />
                  </AnimatedTile>
                ))}
              </DailyCard>
            </Theme>
          )}

          {/* 7. Weekly — progress bars */}
          {!loading && (
            <CollectionCard label="Weekly">
              {weeklyTiles.map((tile) => (
                <ProgressBar
                  key={tile.key}
                  label={tile.label}
                  value={tile.value}
                  max={tile.max}
                  unit={tile.unit}
                />
              ))}
            </CollectionCard>
          )}

          {/* 8. Add routine (goal/category setup) */}
          {!loading && (
            showCreateForm && categories.length > 0 ? (
              <CreateGoalForm
                categories={categories}
                onCreated={() => {
                  setShowCreateForm(false);
                  refresh();
                }}
                onClose={() => setShowCreateForm(false)}
              />
            ) : (
              <Button
                bg="$color3"
                rounded="$3"
                height={48}
                items="center"
                justify="center"
                onPress={() => setShowCreateForm(true)}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text fontSize={14} color="$color11">+ Add Routine</Text>
              </Button>
            )
          )}
        </Content>
      </ScrollView>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Totals Row (inside DailyCard footer)
// ---------------------------------------------------------------------------

function TotalsRow({ calories, protein, fat, carbs }: {
  calories: number; protein: number; fat: number; carbs: number;
}) {
  return (
    <XStack justify="space-between" items="center">
      <XStack gap="$2" items="baseline">
        <Text fontSize={16} fontWeight="700" color="$color11">{calories}</Text>
        <Text fontSize={12} color="$color7">cal</Text>
      </XStack>
      <XStack gap="$3">
        <Text fontSize={12} color="$color7">P {protein}g</Text>
        <Text fontSize={12} color="$color7">F {fat}g</Text>
        <Text fontSize={12} color="$color7">C {carbs}g</Text>
      </XStack>
    </XStack>
  );
}

// ---------------------------------------------------------------------------
// Feed Breakdown (breakdown slot for SummaryBreakdownCard)
// ---------------------------------------------------------------------------

const FEED_GROUP_ORDER: Record<string, number> = {
  nutrition: 0, gym: 1, running: 2, custom: 3,
};

const FEED_GROUP_LABELS: Record<string, string> = {
  nutrition: "Food", gym: "Gym", running: "Running", custom: "Activity",
};

const FEED_DOT_COLORS: Record<string, string> = {
  nutrition: "$green9", gym: "$accent9", running: "$blue9", custom: "$color7",
};

function FeedBreakdown({ entries }: { entries: FeedEntry[] }) {
  if (entries.length === 0) {
    return <Text fontSize={12} color="$color7">No entries yet</Text>;
  }

  const groups = new Map<string, FeedEntry[]>();
  for (const entry of entries) {
    const t = entry.categoryType;
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(entry);
  }

  const sorted = [...groups.entries()].sort(
    (a, b) => (FEED_GROUP_ORDER[a[0]] ?? 9) - (FEED_GROUP_ORDER[b[0]] ?? 9),
  );

  return (
    <YStack gap="$3">
      {sorted.map(([type, items]) => (
        <YStack key={type} gap="$1.5">
          <XStack gap="$1" items="center">
            <View width={6} height={6} rounded="$2" bg={(FEED_DOT_COLORS[type] ?? "$color7") as never} />
            <Text fontSize={10} fontWeight="600" color="$color7" textTransform="uppercase" letterSpacing={0.5}>
              {FEED_GROUP_LABELS[type] ?? type}
            </Text>
          </XStack>
          {items.map((entry) => (
            <XStack key={entry.id} justify="space-between" items="center" pl="$2">
              <Text fontSize={14} color="$color11" flex={1} numberOfLines={1}>
                {entry.label}
              </Text>
              <Text fontSize={12} color="$color7" ml="$2">
                {entry.detail}
              </Text>
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

