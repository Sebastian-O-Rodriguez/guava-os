// ---------------------------------------------------------------------------
// Suggestion model — static + time-of-day only (v1)
// No priority, no conditions, no onboarding hooks.
// ---------------------------------------------------------------------------

export type Suggestion = {
  id: string;
  label: string;       // chip display text (≤25 chars)
  seedMessage: string; // prefilled into input on tap
};

type TimeOfDay = "morning" | "afternoon" | "evening";

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// ---------------------------------------------------------------------------
// Static suggestion sets by time of day
// ---------------------------------------------------------------------------

const MORNING: Suggestion[] = [
  { id: "m1", label: "Log breakfast", seedMessage: "For breakfast I had " },
  { id: "m2", label: "Plan today", seedMessage: "What should I focus on today?" },
  { id: "m3", label: "Check streaks", seedMessage: "What are my streaks?" },
  { id: "m4", label: "Log a habit", seedMessage: "I just finished " },
];

const AFTERNOON: Suggestion[] = [
  { id: "a1", label: "Log lunch", seedMessage: "For lunch I had " },
  { id: "a2", label: "Mark a habit", seedMessage: "I just finished " },
  { id: "a3", label: "How's my day?", seedMessage: "How am I doing today?" },
  { id: "a4", label: "Log food", seedMessage: "I ate " },
];

const EVENING: Suggestion[] = [
  { id: "e1", label: "Log dinner", seedMessage: "For dinner I had " },
  { id: "e2", label: "Progress check", seedMessage: "How am I doing today?" },
  { id: "e3", label: "Mark a habit", seedMessage: "I just finished " },
  { id: "e4", label: "Weekly review", seedMessage: "How was my week?" },
];

/**
 * Get default suggestions based on time of day.
 * Returns max 4 suggestions.
 */
export function getDefaultSuggestions(): Suggestion[] {
  const time = getTimeOfDay();
  switch (time) {
    case "morning":
      return MORNING;
    case "afternoon":
      return AFTERNOON;
    case "evening":
      return EVENING;
  }
}

// ---------------------------------------------------------------------------
// Reactive suggestions — shown after a chat action
// ---------------------------------------------------------------------------

type LastAction = {
  scenario: string;
  status: string;
};

const POST_ACTION: Record<string, Suggestion[]> = {
  log_nutrition: [
    { id: "pa1", label: "Log more food", seedMessage: "I also ate " },
    { id: "pa2", label: "Check macros", seedMessage: "How are my macros today?" },
  ],
  log_gym: [
    { id: "pa3", label: "Log another set", seedMessage: "I also did " },
    { id: "pa4", label: "Weekly gym count", seedMessage: "How many gym sessions this week?" },
  ],
  mark_habit: [
    { id: "pa5", label: "What's left?", seedMessage: "What habits are left today?" },
    { id: "pa6", label: "Log food", seedMessage: "I ate " },
  ],
  increment_goal: [
    { id: "pa7", label: "Check progress", seedMessage: "How am I doing today?" },
    { id: "pa8", label: "Mark another", seedMessage: "I also finished " },
  ],
};

/**
 * Get reactive suggestions based on the last action.
 * Falls back to defaults if no reactive set exists for the action.
 */
export function getPostActionSuggestions(lastAction: LastAction): Suggestion[] {
  if (lastAction.status !== "executed" && lastAction.status !== "proposed") {
    return getDefaultSuggestions();
  }

  const reactive = POST_ACTION[lastAction.scenario];
  if (!reactive) {
    return getDefaultSuggestions();
  }

  // Reactive suggestions (2) + fill remaining from defaults (2) = max 4
  const defaults = getDefaultSuggestions().filter(
    (d) => !reactive.some((r) => r.seedMessage === d.seedMessage),
  );
  return [...reactive, ...defaults.slice(0, 2)];
}
