import { useState } from "react";
import { styled, YStack, XStack, Input, Button, Text } from "tamagui";
import { authFetch, API_BASE } from "../../lib/api";
import { GOAL_UNITS, type GoalUnit } from "../../lib/types";

type Props = {
  categories: Array<{ id: string; name: string; type: string }>;
  onCreated: () => void;
  onClose: () => void;
};

const FormCard = styled(YStack, {
  bg: "$color2",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$5",
  px: "$4",
  py: "$4",
  gap: "$3",
});

const Field = styled(Input, {
  bg: "$color1",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$3",
  px: "$3",
  height: 48,
  fontSize: 14,
  color: "$color",
  focusStyle: { borderColor: "$accent9" },
});

const UNIT_LABELS: Record<string, string> = {
  count: "Count",
  minutes: "Min",
  hours: "Hrs",
  miles: "Miles",
  km: "Km",
  grams: "Grams",
  calories: "Cal",
};

export function CreateGoalForm({ categories, onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [target, setTarget] = useState("1");
  const [unit, setUnit] = useState<GoalUnit>("count");
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimName = name.trim();
    if (!trimName) { setError("Name is required."); return; }
    if (!categoryId) { setError("Select a category."); return; }
    const targetNum = parseFloat(target);
    if (!targetNum || targetNum <= 0) { setError("Target must be a positive number."); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(`${API_BASE}/api/goals`, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          metric: trimName.toLowerCase().replace(/\s+/g, "_"),
          unit,
          target: targetNum,
          period,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create goal");
      }

      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormCard>
      <Text fontSize={16} fontWeight="600" color="$color12">
        Add Routine
      </Text>

      <Field
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Running, Reading)"
        placeholderTextColor="$color6"
        disabled={loading}
        maxLength={50}
      />

      {/* Target + Unit */}
      <YStack gap="$2">
        <Text fontSize={12} fontWeight="500" color="$color7">Target</Text>
        <XStack gap="$2">
          <Field
            value={target}
            onChangeText={setTarget}
            placeholder="1"
            placeholderTextColor="$color6"
            disabled={loading}
            keyboardType="numeric"
            inputMode="decimal"
            flex={1}
          />
          <XStack gap="$1" flex={2} flexWrap="wrap">
            {GOAL_UNITS.map((u) => (
              <Button
                key={u}
                bg={unit === u ? "$accent9" : "$color3"}
                rounded="$3"
                height={36}
                px="$2"
                onPress={() => setUnit(u)}
                disabled={loading}
                pressStyle={{ opacity: 0.8 }}
              >
                <Text fontSize={12} fontWeight="500" color={unit === u ? "white" : "$color11"}>
                  {UNIT_LABELS[u]}
                </Text>
              </Button>
            ))}
          </XStack>
        </XStack>
      </YStack>

      {/* Category */}
      <YStack gap="$2">
        <Text fontSize={12} fontWeight="500" color="$color7">Category</Text>
        <XStack gap="$2" flexWrap="wrap">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              bg={categoryId === cat.id ? "$accent9" : "$color3"}
              rounded="$3"
              height={36}
              px="$3"
              onPress={() => setCategoryId(cat.id)}
              disabled={loading}
              pressStyle={{ opacity: 0.8 }}
            >
              <Text fontSize={12} fontWeight="500" color={categoryId === cat.id ? "white" : "$color11"}>
                {cat.name}
              </Text>
            </Button>
          ))}
        </XStack>
      </YStack>

      {/* Period */}
      <XStack gap="$2">
        <Button
          bg={period === "daily" ? "$accent9" : "$color3"}
          rounded="$3"
          height={36}
          onPress={() => setPeriod("daily")}
          disabled={loading}
          pressStyle={{ opacity: 0.8 }}
          flex={1}
        >
          <Text fontSize={14} fontWeight="500" color={period === "daily" ? "white" : "$color11"}>
            Daily
          </Text>
        </Button>
        <Button
          bg={period === "weekly" ? "$accent9" : "$color3"}
          rounded="$3"
          height={36}
          onPress={() => setPeriod("weekly")}
          disabled={loading}
          pressStyle={{ opacity: 0.8 }}
          flex={1}
        >
          <Text fontSize={14} fontWeight="500" color={period === "weekly" ? "white" : "$color11"}>
            Weekly
          </Text>
        </Button>
      </XStack>

      {error && (
        <YStack bg="$red2" rounded="$2" px="$3" py="$2">
          <Text fontSize={12} color="$red10">{error}</Text>
        </YStack>
      )}

      <XStack gap="$2">
        <Button bg="$color3" rounded="$3" height={36} onPress={onClose} disabled={loading} flex={1} pressStyle={{ opacity: 0.8 }}>
          <Text fontSize={14} color="$color11">Cancel</Text>
        </Button>
        <Button bg="$accent9" rounded="$3" height={48} onPress={handleCreate} disabled={loading} flex={1} pressStyle={{ opacity: 0.8 }}>
          <Text fontSize={14} fontWeight="600" color="white">
            {loading ? "..." : "Create"}
          </Text>
        </Button>
      </XStack>
    </FormCard>
  );
}
