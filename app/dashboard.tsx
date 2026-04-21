import { Text, YStack } from "tamagui";
import { Shell, Content } from "../components/ui/shell";
import { Hamburger } from "../components/nav/hamburger";
import { useTileData } from "../hooks/use-tile-data";

export default function DashboardScreen() {
  const { dailyTiles, weeklyTiles, calorieTotal, calorieTarget, loading } = useTileData();

  const dailyDone = dailyTiles.filter((t) => t.value >= t.max).length;
  const weeklyDone = weeklyTiles.filter((t) => t.value >= t.max).length;

  return (
    <Shell>
      <Hamburger currentPath="/dashboard" />
      <Content>
        <Text fontSize={17} fontWeight="600" color="$color" letterSpacing={-0.3} text="center" pt="$2">
          Dashboard
        </Text>

        {loading ? (
          <Text fontSize={13} color="$color7" text="center" py="$6">Loading...</Text>
        ) : (
          <YStack gap="$3" py="$4">
            <YStack bg="$color2" rounded="$4" px="$4" py="$3" borderWidth={1} borderColor="$color3">
              <Text fontSize={13} color="$color7">Today</Text>
              <Text fontSize={22} fontWeight="700" color="$color">
                {dailyDone}/{dailyTiles.length} daily goals
              </Text>
              <Text fontSize={14} color="$color7">
                {calorieTotal.toLocaleString()} / {calorieTarget.toLocaleString()} cal
              </Text>
            </YStack>

            <YStack bg="$color2" rounded="$4" px="$4" py="$3" borderWidth={1} borderColor="$color3">
              <Text fontSize={13} color="$color7">This Week</Text>
              <Text fontSize={22} fontWeight="700" color="$color">
                {weeklyDone}/{weeklyTiles.length} weekly goals
              </Text>
            </YStack>

            {[...dailyTiles, ...weeklyTiles].map((tile) => {
              const pct = tile.max > 0 ? Math.round((tile.value / tile.max) * 100) : 0;
              return (
                <YStack key={tile.key} bg="$color2" rounded="$3" px="$3" py="$2" borderWidth={1} borderColor="$color3">
                  <Text fontSize={14} fontWeight="500" color="$color">{tile.label}</Text>
                  <Text fontSize={12} color="$color7">
                    {tile.value}/{tile.max} {tile.unit ?? ""} ({pct}%)
                  </Text>
                </YStack>
              );
            })}
          </YStack>
        )}
      </Content>
    </Shell>
  );
}
