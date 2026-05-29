// RoutineMe v2 — Shared types

// Consistent result type for server actions
export type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Category types
// ---------------------------------------------------------------------------

export type CategoryType = "gym" | "nutrition" | "running" | "custom";

export type GoalPeriod = "daily" | "weekly";

export type GoalUnit = "count" | "minutes" | "hours" | "miles" | "km" | "grams" | "calories";

export const GOAL_UNITS: GoalUnit[] = ["count", "minutes", "hours", "miles", "km", "grams", "calories"];

// ---------------------------------------------------------------------------
// Log data payload types (stored as JSON in the logs table)
// ---------------------------------------------------------------------------

export type NutritionLogData = {
  item: string;
  calories: number;
  protein: number;
  fat: number;
  carbs?: number;
  source?: "user" | "estimated" | "confirmed";
};

export type GymLogData = {
  bodyPart: string;
  notes?: string;
};

export type RunLogData = {
  miles: number;
  duration?: string;
  notes?: string;
};

export type CustomLogData = {
  value: number;
  notes?: string;
};

export type LogData = NutritionLogData | GymLogData | RunLogData | CustomLogData;

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

export type NutritionDailySummary = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type GymBodyPartCount = {
  bodyPart: string;
  count: number;
};

export type RunningSummary = {
  totalMiles: number;
  sessions: number;
};

export type GoalProgress = {
  goalId: string;
  metric: string;
  unit: string;
  target: number;
  period: GoalPeriod;
  actual: number;
  percentComplete: number;
};

export type CategoryProgress = {
  categoryId: string;
  categoryName: string;
  categoryType: CategoryType;
  goals: GoalProgress[];
};
