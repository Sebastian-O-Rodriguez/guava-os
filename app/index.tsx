import { useCallback, useState } from "react";
import { Text, ScrollView, YStack, XStack, Theme, Spinner, Button } from "tamagui";
import { motion } from "motion/react";
import { Shell, Content } from "../components/ui/shell";
import { Hamburger } from "../components/nav/hamburger";
import { ChatSurface } from "../components/now/chat-surface";
import { GoalTile, type TileCallbacks } from "../components/now/goal-tile";
import { NestedDoughnut } from "../components/ui/nested-doughnut";
import { DailyCard, CollectionCard } from "../components/ui/card-templates";
import { CreateGoalForm } from "../components/now/create-goal-form";
import { SECTION_THEMES } from "../lib/palette";
import { useTileData } from "../hooks/use-tile-data";
import { authFetch, API_BASE } from "../lib/api";

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
    categories,
    loading,
    error,
    refresh,
  } = useTileData();

  const [showCreateForm, setShowCreateForm] = useState(false);

  // Tap → persist to DB → refresh. Rollback on failure.
  const handleTileIncrement = useCallback(
    (categoryId: string) =>
      async (amount: number, cbs: TileCallbacks) => {
        try {
          const res = await authFetch(`${API_BASE}/api/quick-log`, {
            method: "POST",
            body: JSON.stringify({
              action: "increment_goal",
              categoryId,
              amount,
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
          <Text fontSize={17} fontWeight="600" color="$color" letterSpacing={-0.3} text="center" pt="$2">
            The Stub is the Way
          </Text>
          <Text fontSize={12} color="$color7" text="center">
            {formatDate(today)}
          </Text>

          {/* 3. Chat — refresh() wired to onSuccess */}
          <ChatSurface onSuccess={refresh} />

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

          {/* 4. Daily — tiles (left) + doughnut (right) */}
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
                      onIncrement={handleTileIncrement(tile.categoryId)}
                      onLongPress={() => handleDeleteGoal(tile.key, tile.label)}
                    />
                  </AnimatedTile>
                ))}
              </DailyCard>
            </Theme>
          )}

          {/* 5. Weekly — always rendered for stable layout */}
          {!loading && (
            <CollectionCard label="Weekly">
              {weeklyTiles.map((tile, i) => (
                <AnimatedTile key={tile.key} delay={(dailyTiles.length + i) * 0.12}>
                  <GoalTile
                    label={tile.label}
                    value={tile.value}
                    max={tile.max}
                    unit={tile.unit}
                    size="md"
                    tapAmount={tile.tapAmount}
                    onIncrement={handleTileIncrement(tile.categoryId)}
                    onLongPress={() => handleDeleteGoal(tile.key, tile.label)}
                  />
                </AnimatedTile>
              ))}
            </CollectionCard>
          )}

          {/* 6. Add routine */}
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
                height={40}
                items="center"
                justify="center"
                onPress={() => setShowCreateForm(true)}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text fontSize={13} color="$color11">+ Add Routine</Text>
              </Button>
            )
          )}
        </Content>
      </ScrollView>
    </Shell>
  );
}
