// RoutineMe — Shared types
// Frequency configuration for habits.

export type FrequencyType = "daily" | "weekdays" | "custom";

export type FrequencyConfig =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "custom"; days: string[] };

// Consistent result type for server actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Monthly Grid types
// ---------------------------------------------------------------------------

export type CellStatus = "completed" | "missed" | "na";

export interface MonthlyGridRow {
  habitId: string;
  habitName: string;
  frequency: FrequencyConfig;
  /** Length === daysInMonth. Index i === calendar day (i + 1). */
  days: CellStatus[];
}

export interface MonthlyGridData {
  year: number;
  /** 1-based month number (January = 1). */
  month: number;
  daysInMonth: number;
  rows: MonthlyGridRow[];
}

export interface MonthlyGridProps {
  data: MonthlyGridData;
  /** ISO string of today's date for highlighting the current day column. */
  todayISO: string;
}

// ---------------------------------------------------------------------------
// Progress Dashboard types
// ---------------------------------------------------------------------------

export type OverallStreaks = {
  currentStreak: number;
  longestStreak: number;
  bestHabitName: string | null;
};

export type TrendPoint = {
  date: string;
  rate: number | null;
  completed: number;
  total: number;
};

export type HabitSparkline = {
  habitId: string;
  name: string;
  currentStreak: number;
  points: {
    date: string;
    completed: boolean;
    applicable: boolean;
  }[];
};

export type DashboardStats = {
  weeklyRate: number | null;
  monthlyRate: number | null;
  trend: TrendPoint[];
  sparklines: HabitSparkline[];
};

export type MetricCardData = {
  currentStreak: number;
  longestStreak: number;
  bestHabitName: string | null;
  weeklyRate: number | null;
  monthlyRate: number | null;
};

// ---------------------------------------------------------------------------
// Settings types
// ---------------------------------------------------------------------------

export type HabitSummary = {
  id: string;
  name: string;
  frequency: FrequencyConfig;
  active: boolean;
  createdAt: Date;
};
