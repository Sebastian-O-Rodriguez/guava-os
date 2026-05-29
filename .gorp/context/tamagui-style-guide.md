# Tamagui Style Guide — RoutineMe

Mandatory reference for all agents writing component code in this repository.
Every rule here is binding. When in doubt, follow this guide; do not invent
alternative patterns.

---

## 0. The Core Contract

Tamagui components compile to native and web from a single code path. That is
the entire reason we use it. Any code that branches on `Platform.OS` for layout,
color, or text styling defeats that purpose and is a defect, not a feature.

---

## 1. Token Usage

### Always use `$`-prefixed tokens

Every color, spacing value, and border-radius value in component props must
reference a token.

```tsx
// CORRECT
<YStack backgroundColor="$background" padding="$4" borderRadius="$4" />

// WRONG — raw hex
<YStack backgroundColor="#09090b" padding={16} borderRadius={8} />

// WRONG — raw rgba
<YStack backgroundColor="rgba(255,255,255,0.05)" />
```

### Defining tokens

All token definitions live exclusively in `/Users/sebastianrodriguez/Projects/ROUTINEME/tamagui.config.ts`.
No component file may define color constants or hardcode color strings.

Current palette tokens available in `tokens.color`:

| Token | Value |
|---|---|
| `$zinc50` | `#fafafa` |
| `$zinc100` | `#f4f4f5` |
| `$zinc200` | `#e4e4e7` |
| `$zinc300` | `#d4d4d8` |
| `$zinc400` | `#a1a1aa` |
| `$zinc500` | `#71717a` |
| `$zinc600` | `#52525b` |
| `$zinc700` | `#3f3f46` |
| `$zinc800` | `#27272a` |
| `$zinc900` | `#18181b` |
| `$zinc950` | `#09090b` |
| `$emerald400` | `#34d399` |
| `$emerald500` | `#10b981` |
| `$sky400` | `#38bdf8` |
| `$red500` | `#ef4444` |
| `$white5` | `rgba(255,255,255,0.05)` |
| `$white10` | `rgba(255,255,255,0.1)` |

### Missing tokens

If a design requires a color, opacity level, or spacing value not in the table
above, add it to `tamagui.config.ts` first, then reference it as a token.
Never inline the raw value in a component.

Tokens to add before using the glass aesthetic, overflow glow, or fill system:

```ts
// Add to tokens.color in tamagui.config.ts
white3: "rgba(255,255,255,0.03)",
white6: "rgba(255,255,255,0.06)",
white8: "rgba(255,255,255,0.08)",
white12: "rgba(255,255,255,0.12)",
white15: "rgba(255,255,255,0.15)",
white50: "rgba(255,255,255,0.5)",
sky400Glow: "rgba(56,189,248,0.3)",
red500Border: "rgba(239,68,68,0.8)",
```

---

## 2. Theme Tokens

Use semantic theme tokens for anything that participates in theming. These
resolve automatically for the active theme (the app is dark-only).

| Token | Meaning |
|---|---|
| `$background` | Page/card background (`zinc950`) |
| `$backgroundHover` | Hover state background (`zinc900`) |
| `$backgroundPress` | Press state background (`zinc800`) |
| `$color` | Primary text (`zinc50`) |
| `$colorHover` | Hovered text (`zinc200`) |
| `$borderColor` | Default border (`zinc800`) |
| `$borderColorHover` | Hovered border (`zinc700`) |
| `$borderColorFocus` | Focused border (`zinc600`) |
| `$placeholderColor` | Muted / secondary text (`zinc500`) |
| `$shadowColor` | Shadow base |

### Custom glass tokens

Add these to the `dark` theme object in `tamagui.config.ts` before using them:

```ts
// In themes.dark
glassBackground: tokens.color.white3,
glassBackgroundHover: tokens.color.white6,  // requires white6 palette token
glassBorder: tokens.color.white8,           // requires white8 palette token
glassLid: tokens.color.white15,             // requires white15 palette token
fillNormal: tokens.color.emerald500,
fillNear: tokens.color.emerald400,
fillOver: tokens.color.sky400,
fillOverGlow: tokens.color.sky400Glow,      // requires sky400Glow palette token
errorBorder: tokens.color.red500Border,     // requires red500Border palette token
```

After adding them, use `$glassBackground`, `$glassBorder`, `$fillOver`, etc.
in components — never write the raw rgba string in a component file.

---

## 3. Component Primitives — Required Substitutions

Never use HTML elements or React Native primitives where Tamagui provides an
equivalent. The following table is exhaustive for this codebase.

| Forbidden | Required replacement |
|---|---|
| `<div>` | `<Stack>`, `<XStack>`, or `<YStack>` |
| `<span>` | `<Text>` |
| `<p>` | `<Paragraph>` |
| `<h1>`–`<h6>` | `<H1>`–`<H6>` |
| `<button>` | `<Button>` (use `unstyled` prop to strip default chrome) |
| `<input>` | `<Input>` |
| `View` (React Native) | `<Stack>` |
| `<motion.div>` for layout | `<Stack>` with Tamagui animation props |

### Unstyled Button pattern

When you need a bare interactive surface (icon button, tap target):

```tsx
import { Button } from "tamagui";

<Button
  unstyled
  onPress={handlePress}
  width={32}
  height={32}
  alignItems="center"
  justifyContent="center"
  pressStyle={{ opacity: 0.6 }}
  accessibilityLabel="Previous day"
>
  {/* child */}
</Button>
```

Do not render a `<div role="button">` with `onClick` and `onKeyDown` manually.
Tamagui `Button` handles keyboard, pointer, and touch correctly.

---

## 4. Platform Branching — Strict Rules

`Platform.OS === "web"` checks are permitted only for these two cases:

1. **Rive / Canvas APIs** — web-only imperative canvas code that has no React
   Native equivalent.
2. **Navigation patterns** — when a native screen transition genuinely differs
   from a web route push.

Platform branching is **never** permitted for:

- Layout (flex direction, alignment, gap, padding)
- Colors or opacity
- Text size or weight
- Border radius or border width
- Hover / press / focus states
- Animation

### Anti-pattern: duplicated platform render trees

Do not create separate `ComponentWeb` and `ComponentNative` variants that
duplicate the full render tree with platform switching. All logic and markup
belong in one component. Web-only visual effects (CSS `backdrop-filter`,
`box-shadow`) should be isolated to a single `Platform.OS === "web"` prop
injection point — not duplicated across two full component trees.

---

## 5. Styled Components

Prefer `styled()` over inline prop repetition for any component used more than
once, or any component with more than ~5 style props.

```tsx
import { styled, YStack, Text } from "tamagui";

// Define once — in the component file or in components/ui/
const GlassCard = styled(YStack, {
  name: "GlassCard",
  backgroundColor: "$glassBackground",
  borderWidth: 1,
  borderColor: "$glassBorder",
  borderRadius: "$6",
  padding: "$4",
  variants: {
    size: {
      sm: { padding: "$3" },
      md: { padding: "$4" },
      lg: { padding: "$5" },
    },
    overflow: {
      true: {
        borderColor: "$fillOver",
        shadowColor: "$fillOverGlow",
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
      },
    },
  } as const,
});

// Use with variant props
<GlassCard size="md" overflow={isOver} />
```

Rules:

- `name` is required for Tamagui devtools and hot reload.
- `variants` must be typed `as const`.
- Shared styled components live in `components/ui/`. Component-specific ones
  may be co-located at the top of the component file.

---

## 6. Animation

Use Tamagui's built-in animation props. Do not use CSS `transition` strings or
`motion/react` for basic enter/exit/press/hover interactions.

```tsx
// CORRECT — Tamagui animation
<Stack
  animation="bouncy"
  enterStyle={{ opacity: 0, y: 12 }}
  exitStyle={{ opacity: 0, y: -12 }}
  hoverStyle={{ scale: 1.03 }}
  pressStyle={{ scale: 0.97, opacity: 0.8 }}
/>

// WRONG — inline CSS transition
<div style={{ transition: "transform 200ms, box-shadow 200ms" }} />

// WRONG — motion for simple interactions
<motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} />
```

`motion/react` (`framer-motion`) is permitted only for complex, web-exclusive
sequenced animations where Tamagui's animation system cannot express the
behavior. Even then, `motion` must wrap a Tamagui component, not raw HTML:

```tsx
// Acceptable — motion wraps a Tamagui Stack, not a raw div
import { motion } from "motion/react";
import { Stack } from "tamagui";

const MotionStack = motion(Stack);

<MotionStack
  variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
>
  {children}
</MotionStack>
```

Animation preset names used in this project: `"quick"`, `"bouncy"`, `"lazy"`.
These come from `@tamagui/config/v3` defaults. Do not define new animation
configs without updating `tamagui.config.ts`.

---

## 7. Responsive Design

Use Tamagui media query props. Never use CSS `@media` rules, inline style
breakpoint logic, or `useWindowDimensions` for layout purposes.

```tsx
// CORRECT
<Stack padding="$3" $md={{ padding: "$5" }} $lg={{ padding: "$6" }}>

// WRONG — CSS media query
<div style={{ padding: 12 }} className="md:p-5 lg:p-6" />

// WRONG — JS breakpoint logic
const { width } = useWindowDimensions();
const padding = width > 768 ? 20 : 12;
```

Media tokens from `@tamagui/config/v3` defaults:

| Token | Breakpoint |
|---|---|
| `$sm` | max-width 660px |
| `$md` | max-width 800px |
| `$lg` | max-width 1120px |
| `$xl` | max-width 1280px |

---

## 8. Shorthands

Use these shorthands consistently. Mixing shorthand and longhand for the same
property in the same component is not permitted.

| Shorthand | Full prop |
|---|---|
| `bg` | `backgroundColor` |
| `p` | `padding` |
| `px` | `paddingHorizontal` |
| `py` | `paddingVertical` |
| `m` | `margin` |
| `mx` | `marginHorizontal` |
| `my` | `marginVertical` |
| `w` | `width` |
| `h` | `height` |
| `br` | `borderRadius` |
| `f` | `flex` |
| `fw` | `flexWrap` |
| `ai` | `alignItems` |
| `jc` | `justifyContent` |

Shorthands must not be used inside `style={{}}` objects — only as direct JSX
props on Tamagui components.

---

## 9. Event Handlers

Avoid anonymous arrow functions in JSX for handlers that reference closures or
trigger state mutations. Use named functions defined in the component body or
`useCallback` for handlers passed to lists.

```tsx
// CORRECT — named function
function handlePress() {
  setCount((c) => c + 1);
}
<Button onPress={handlePress} />

// ACCEPTABLE — simple, no closure cost
<Button onPress={() => setOpen(false)} />

// WRONG — complex logic inline
<Button onPress={() => { doA(); doB(value); setState(x => x + 1); }} />
```

For handlers generated per-item in a list (e.g., per-gauge handlers in
MetricsCard), define a factory function that returns the handler:

```tsx
function handleNutritionIncrement(macro: MacroKey) {
  return (amount: number, cbs?: GaugeActionCallbacks) => {
    // ...
  };
}
```

---

## 10. File Structure

```
tamagui.config.ts          — Tamagui v5 config (fonts, tokens, animations)
themes.ts                  — Dark/light palettes + purple accent + child themes
lib/layout.ts              — Layout constants + computeLayout() + DailyCard constants
lib/palette.ts             — SECTION_THEMES, ACCENT hex palette
components/ui/             — Card templates, tile primitives, shell, doughnut
components/nav/            — Hamburger menu + theme toggle
components/now/            — GoalTile, chat-surface, reply-bubble, suggestion-row, create-goal-form
hooks/                     — use-card-layout (layout), use-tile-data (data fetching)
```

Rules:

- No `.css` files anywhere. Tamagui replaces all CSS.
- No `StyleSheet.create({})`. Use `styled()` or inline Tamagui props.
- No Tailwind utility classes on Tamagui components.

## 10.1 Card Template Rules

Four card templates in `components/ui/card-templates.tsx`:

| Template | Purpose | flexWrap | Children |
|---|---|---|---|
| `DailyCard` | Mixed: tile grid + doughnut | **NO** | GoalTiles (children) + doughnut (prop) |
| `CollectionCard` | Homogeneous tile grid | Yes | GoalTiles only |
| `SummaryBreakdownCard` | Summary viz + breakdown | N/A (slot-based) | summary + breakdown props |
| `SingleFocusCard` | One visualization | N/A | Exactly 1 child |

**DailyCard constraints:**
- Tiles in explicit XStack rows (max `DAILY_TILE_COLUMNS=3` per row)
- Doughnut in right column (visual anchor)
- Breakpoint at `DAILY_TWO_COL_MIN=406px` inner width → stacks vertically
- Tiles grow by adding rows, NEVER by resizing
- No mixed weekly + daily in same card

**CollectionCard constraints:**
- flexWrap allowed (homogeneous content)
- Only GoalTile children

**Spacing:**
- All spacing from `lib/layout.ts` constants only
- No manual margins, spacer elements, or one-off padding tweaks

---

## 11. Anti-Patterns Reference

Patterns that must not be repeated in new code.

| Anti-pattern | Correct approach |
|---|---|
| `Platform.OS === "web"` full render branch | Single Tamagui render tree |
| `<div style={{...}}>` | `<Stack>` / `<XStack>` / `<YStack>` |
| `<button onClick={...}>` | `<Button unstyled onPress={...}>` |
| `<span>` | `<Text>` |
| Raw rgba/hex in `style={{}}` | `$`-token from `tamagui.config.ts` |
| `<motion.div>` wrapping raw HTML | `motion.div` wrapping Tamagui components only |
| `View` from `react-native` for layout | `<Stack>` from Tamagui |
| Local-only tile state | Tap → API → refresh from DB |
| `getOrCreateUser()` | `requireAuth(request)` from `lib/auth-server.ts` |
| Prisma client calls | Supabase JS client (`supabaseAdmin`) |
| Mock/hardcoded data in pages | Live data via `useTileData()` hook |

**Purple theme gotcha**: `<Theme name="purple">` remaps ALL `$color1-12` tokens to purple shades. Components needing neutral colors (white, slate) must use hardcoded hex from `lib/palette.ts` ACCENT object.

---

## 12. Config Change Protocol

Any agent that needs a new token must:

1. Add the palette value to `tokens.color` in `tamagui.config.ts`.
2. If it is a semantic value, add it to `themes.dark` referencing the palette
   token.
3. Use the `$tokenName` reference in the component.
4. Document the addition in this guide under section 1 or 2.

An agent must not define a color constant in a component file as a workaround
for a missing token. File a note in the sprint journal and add the token
properly.
