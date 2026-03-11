// RoutineMe — Shared types

// Frequency configuration for habits.
export type FrequencyType = "daily" | "scheduled" | "weekly";

export type FrequencyConfig =
  | { type: "daily" }
  | { type: "scheduled"; days: string[] }
  | { type: "weekly"; timesPerWeek: number };

// Consistent result type for server actions
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Monthly Grid types
// ---------------------------------------------------------------------------

export type CellStatus = "completed" | "missed" | "late" | "na";

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
// Today page types
// ---------------------------------------------------------------------------

export type HabitWithStreak = {
  id: string;
  name: string;
  currentStreak: number;
};

export type WeeklyProgress = {
  habitId: string;
  completed: number;
  target: number;
};

export type OverdueHabit = {
  habitId: string;
  habitName: string;
  missedDate: Date;
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
