import { useState, useEffect, useTransition } from "react";
import { YStack, XStack, Text, Input, Button, Spinner } from "tamagui";
import { motion, AnimatePresence } from "motion/react";
import { useActionModal, type ActionType } from "../../lib/action-modal-context";
import { authFetch, API_BASE } from "../../lib/api";

// ---------------------------------------------------------------------------
// Field config per action type
// ---------------------------------------------------------------------------

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder: string;
  required?: boolean;
};

const FIELD_CONFIG: Record<ActionType, FieldDef[]> = {
  nutrition: [
    { key: "item", label: "Food item", type: "text", placeholder: "e.g. 2 tacos", required: true },
    { key: "calories", label: "Calories", type: "number", placeholder: "0" },
    { key: "protein", label: "Protein (g)", type: "number", placeholder: "0" },
    { key: "fat", label: "Fat (g)", type: "number", placeholder: "0" },
    { key: "carbs", label: "Carbs (g)", type: "number", placeholder: "0" },
  ],
  running: [
    { key: "miles", label: "Miles", type: "number", placeholder: "0", required: true },
    { key: "duration", label: "Duration", type: "text", placeholder: "e.g. 30 min" },
    { key: "notes", label: "Notes", type: "text", placeholder: "Optional" },
  ],
  gym: [
    { key: "bodyPart", label: "Body part", type: "text", placeholder: "e.g. chest, legs", required: true },
    { key: "notes", label: "Notes", type: "text", placeholder: "Optional" },
  ],
  custom: [
    { key: "value", label: "Amount / Count", type: "number", placeholder: "1", required: true },
    { key: "notes", label: "Context", type: "text", placeholder: "Optional" },
  ],
};

const TYPE_LABELS: Record<ActionType, string> = {
  nutrition: "Log Food",
  running: "Log Run",
  gym: "Log Gym",
  custom: "Log Activity",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionModal() {
  const { isOpen, payload, close, onSuccess } = useActionModal();
  const [selectedType, setSelectedType] = useState<ActionType>("nutrition");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isOpen && payload) {
      setSelectedType(payload.type);
      const initial: Record<string, string> = {};
      const defs = FIELD_CONFIG[payload.type] ?? FIELD_CONFIG.custom;
      for (const def of defs) {
        const prefill = payload.fields[def.key];
        initial[def.key] = prefill != null ? String(prefill) : "";
      }
      setFields(initial);
      setError(null);
    }
  }, [isOpen, payload]);

  function switchType(type: ActionType) {
    setSelectedType(type);
    const initial: Record<string, string> = {};
    for (const def of FIELD_CONFIG[type] ?? FIELD_CONFIG.custom) {
      initial[def.key] = "";
    }
    setFields(initial);
    setError(null);
  }

  if (!isOpen || !payload) return null;

  const actionType = selectedType;
  const fieldDefs = FIELD_CONFIG[actionType] ?? FIELD_CONFIG.custom;
  const showTypeTabs = payload.source === "manual";

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handleConfirm() {
    if (!payload) return;
    setError(null);

    for (const def of fieldDefs) {
      if (def.required && !fields[def.key]?.trim()) {
        setError(`${def.label} is required`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const body = buildQuickLogBody(actionType, fields);
        const res = await authFetch(`${API_BASE}/api/quick-log`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `${res.status}`);
        }
        close();
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="action-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            backgroundColor: "var(--backdrop, rgba(0,0,0,0.5))",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            key="action-modal-card"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{ width: "100%", maxWidth: 400, margin: "0 12px" }}
          >
            <YStack bg="$color2" rounded="$5" px="$4" py="$4" gap="$3" borderWidth={1} borderColor="$color3">
              {/* Header */}
              <XStack items="center" justify="space-between">
                <Text fontSize={16} fontWeight="600" color="$color12">
                  {TYPE_LABELS[actionType]}
                </Text>
                <Button unstyled onPress={close} pressStyle={{ opacity: 0.5 }} disabled={isPending}>
                  <Text fontSize={16} color="$color7">{"\u00d7"}</Text>
                </Button>
              </XStack>

              {/* Type tabs */}
              {showTypeTabs && (
                <XStack gap="$2">
                  {(["nutrition", "gym", "running"] as ActionType[]).map((t) => (
                    <Button
                      key={t}
                      bg={actionType === t ? "$accent9" : "$color3"}
                      rounded="$3"
                      height={36}
                      px="$3"
                      onPress={() => switchType(t)}
                      pressStyle={{ opacity: 0.8 }}
                    >
                      <Text fontSize={12} fontWeight="500" color={actionType === t ? "white" : "$color11"}>
                        {TYPE_LABELS[t].replace("Log ", "")}
                      </Text>
                    </Button>
                  ))}
                </XStack>
              )}

              {/* Fields */}
              {fieldDefs.map((def) => (
                <YStack key={def.key}>
                  <Text fontSize={12} fontWeight="500" color="$color7" mb="$1">{def.label}</Text>
                  <Input
                    value={fields[def.key] ?? ""}
                    onChangeText={(v: string) => updateField(def.key, v)}
                    placeholder={def.placeholder}
                    placeholderTextColor="$color6"
                    bg="$color1"
                    borderColor="$color3"
                    color="$color"
                    height={48}
                    rounded="$3"
                    px="$3"
                    fontSize={14}
                    borderWidth={1}
                    focusStyle={{ borderColor: "$accent9" }}
                    keyboardType={def.type === "number" ? "numeric" : "default"}
                    inputMode={def.type === "number" ? "decimal" : "text"}
                    disabled={isPending}
                  />
                </YStack>
              ))}

              {/* Error */}
              {error && (
                <YStack bg="$red2" rounded="$2" px="$3" py="$2">
                  <Text fontSize={12} color="$red10">{error}</Text>
                </YStack>
              )}

              {/* Actions */}
              <XStack gap="$3" justify="flex-end" pt="$1">
                <Button
                  bg="$color3"
                  rounded="$3"
                  height={36}
                  px="$4"
                  onPress={close}
                  disabled={isPending}
                  pressStyle={{ opacity: 0.7 }}
                >
                  <Text fontSize={14} color="$color11">Cancel</Text>
                </Button>
                <Button
                  bg="$accent9"
                  rounded="$3"
                  height={48}
                  px="$5"
                  onPress={handleConfirm}
                  disabled={isPending}
                  pressStyle={{ opacity: 0.8 }}
                >
                  {isPending ? (
                    <Spinner size="small" color="white" />
                  ) : (
                    <Text fontSize={14} fontWeight="600" color="white">Confirm</Text>
                  )}
                </Button>
              </XStack>
            </YStack>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Build quick-log body
// ---------------------------------------------------------------------------

function buildQuickLogBody(type: ActionType, fields: Record<string, string>) {
  switch (type) {
    case "nutrition":
      return {
        action: "log_food",
        item: fields.item || "Food",
        calories: parseNum(fields.calories),
        protein: parseNum(fields.protein),
        fat: parseNum(fields.fat),
        carbs: parseNum(fields.carbs),
      };
    case "running":
      return {
        action: "add_run",
        miles: parseNum(fields.miles) || 1,
        duration: fields.duration || undefined,
        notes: fields.notes || undefined,
      };
    case "gym":
      return {
        action: "log_gym",
        bodyPart: fields.bodyPart || undefined,
        notes: fields.notes || undefined,
      };
    case "custom":
      return {
        action: "log_gym",
        bodyPart: fields.notes || "session",
      };
  }
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
