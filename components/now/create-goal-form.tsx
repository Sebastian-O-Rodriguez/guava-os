/**
 * Minimal create routine form.
 * Fields: name, category (select from existing or type new).
 * Posts to /api/goals + /api/categories if new category needed.
 */
import { useState } from "react";
import { styled, YStack, XStack, Input, Button, Text, Select } from "tamagui";
import { authFetch, API_BASE } from "../../lib/api";

type Props = {
  categories: Array<{ id: string; name: string; type: string }>;
  onCreated: () => void;
  onClose: () => void;
};

const FormCard = styled(YStack, {
  bg: "$color2",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$4",
  px: "$3",
  py: "$3",
  gap: "$2.5",
});

const Field = styled(Input, {
  bg: "$color1",
  borderWidth: 1,
  borderColor: "$color3",
  rounded: "$3",
  px: "$3",
  height: 44,
  fontSize: 14,
  color: "$color",
  focusStyle: { borderColor: "$accent9" },
});

const ActionBtn = styled(Button, {
  rounded: "$3",
  height: 40,
  items: "center",
  justify: "center",
  pressStyle: { opacity: 0.8 },
});

export function CreateGoalForm({ categories, onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const trimName = name.trim();
    if (!trimName) {
      setError("Name is required.");
      return;
    }
    if (!categoryId) {
      setError("Select a category.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authFetch(`${API_BASE}/api/goals`, {
        method: "POST",
        body: JSON.stringify({
          categoryId,
          metric: trimName.toLowerCase().replace(/\s+/g, "_"),
          target: 1,
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
      <Text fontSize={15} fontWeight="600" color="$color">
        Add Routine
      </Text>

      <Field
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Meditate, Read)"
        placeholderTextColor="$color6"
        disabled={loading}
        maxLength={50}
        onSubmitEditing={handleCreate}
      />

      <XStack gap="$2">
        {categories.map((cat) => (
          <ActionBtn
            key={cat.id}
            bg={categoryId === cat.id ? "$accent9" : "$color3"}
            onPress={() => setCategoryId(cat.id)}
            disabled={loading}
            flex={1}
          >
            <Text
              fontSize={12}
              fontWeight="500"
              color={categoryId === cat.id ? "white" : "$color11"}
            >
              {cat.name}
            </Text>
          </ActionBtn>
        ))}
      </XStack>

      <XStack gap="$2">
        <ActionBtn
          bg={period === "daily" ? "$accent9" : "$color3"}
          onPress={() => setPeriod("daily")}
          disabled={loading}
          flex={1}
        >
          <Text fontSize={12} fontWeight="500" color={period === "daily" ? "white" : "$color11"}>
            Daily
          </Text>
        </ActionBtn>
        <ActionBtn
          bg={period === "weekly" ? "$accent9" : "$color3"}
          onPress={() => setPeriod("weekly")}
          disabled={loading}
          flex={1}
        >
          <Text fontSize={12} fontWeight="500" color={period === "weekly" ? "white" : "$color11"}>
            Weekly
          </Text>
        </ActionBtn>
      </XStack>

      {error && (
        <Text fontSize={12} color="$red10">
          {error}
        </Text>
      )}

      <XStack gap="$2">
        <ActionBtn bg="$color3" onPress={onClose} disabled={loading} flex={1}>
          <Text fontSize={13} color="$color11">Cancel</Text>
        </ActionBtn>
        <ActionBtn bg="$accent9" onPress={handleCreate} disabled={loading} flex={1}>
          <Text fontSize={13} fontWeight="600" color="white">
            {loading ? "..." : "Create"}
          </Text>
        </ActionBtn>
      </XStack>
    </FormCard>
  );
}
