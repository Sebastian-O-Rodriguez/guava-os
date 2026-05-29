# DEPRECATED

> This file is archival only.
> react-liquid-gauge was replaced by canvas-based fluid fill (`components/ui/tile-fluid-fill.tsx`).

# react-liquid-gauge — RoutineMe Usage Guide

## What It Is

Circular SVG gauge with animated liquid/wave fill. Shows a percentage visually as a filling circle. Good for nutrition macros, fitness goal completion, any 0-100% metric.

## Install

Already installed: `react-liquid-gauge@1.2.4`

## Import

```tsx
"use client"; // Required — uses D3 DOM manipulation

import LiquidFillGauge from "react-liquid-gauge";
```

**No TypeScript types included.** Add a declaration if needed:

```ts
// src/types/react-liquid-gauge.d.ts
declare module "react-liquid-gauge" {
  import { Component } from "react";
  interface LiquidFillGaugeProps {
    id?: string;
    width?: number;
    height?: number;
    value?: number;
    percent?: string | React.ReactNode;
    textSize?: number;
    textOffsetX?: number;
    textOffsetY?: number;
    textRenderer?: (props: Record<string, unknown>) => React.ReactNode;
    riseAnimation?: boolean;
    riseAnimationTime?: number;
    riseAnimationEasing?: string;
    waveAnimation?: boolean;
    waveAnimationTime?: number;
    waveAnimationEasing?: string;
    waveAmplitude?: number;
    waveFrequency?: number;
    gradient?: boolean;
    gradientStops?:
      | Array<{ key: string; stopColor: string; stopOpacity: number; offset: string }>
      | React.ReactNode;
    onClick?: (event: React.MouseEvent) => void;
    innerRadius?: number;
    outerRadius?: number;
    margin?: number;
    circleStyle?: Record<string, string>;
    waveStyle?: Record<string, string>;
    textStyle?: Record<string, string>;
    waveTextStyle?: Record<string, string>;
    style?: React.CSSProperties;
  }
  export default class LiquidFillGauge extends Component<LiquidFillGaugeProps> {}
}
```

## Props Reference

### Core

| Prop     | Type   | Default | Notes                                                      |
| -------- | ------ | ------- | ---------------------------------------------------------- |
| `value`  | number | 0       | **0-100 range** (percentage). Map our actual/goal to this. |
| `width`  | number | 400     | Pixel width. Use small values for our sub-cards (~80-100). |
| `height` | number | 400     | Pixel height. Keep equal to width for circle.              |

### Appearance

| Prop          | Type   | Default                       | Notes                                                           |
| ------------- | ------ | ----------------------------- | --------------------------------------------------------------- |
| `circleStyle` | object | `{ fill: 'rgb(23,139,202)' }` | Outer ring color. Use `{ fill: 'rgb(39,39,42)' }` for zinc-800. |
| `waveStyle`   | object | `{ fill: 'rgb(23,139,202)' }` | Liquid fill color. Use emerald for on-track, amber for over.    |
| `innerRadius` | number | 0.9                           | Inner circle size ratio (0-1). Smaller = thicker ring.          |
| `outerRadius` | number | 1.0                           | Outer circle size ratio.                                        |
| `margin`      | number | 0.025                         | Gap between ring and liquid.                                    |

### Text

| Prop            | Type     | Default            | Notes                                                          |
| --------------- | -------- | ------------------ | -------------------------------------------------------------- |
| `textSize`      | number   | 1                  | Relative to radius. 1 = 50% of radius.                         |
| `textStyle`     | object   | `{ fill: '#000' }` | Text color when NOT behind wave.                               |
| `waveTextStyle` | object   | `{ fill: '#fff' }` | Text color when behind wave (auto-contrast).                   |
| `percent`       | string   | '%'                | Suffix after the number. Use `'g'`, `'kcal'`, `'mi'`, or `''`. |
| `textRenderer`  | function | default            | Custom render function — see examples below.                   |

### Animation

| Prop                | Type    | Default | Notes                                                          |
| ------------------- | ------- | ------- | -------------------------------------------------------------- |
| `riseAnimation`     | boolean | false   | Animate fill from 0 to value on mount/change. **Enable this.** |
| `riseAnimationTime` | number  | 2000    | ms. Use 800-1200 for snappy feel.                              |
| `waveAnimation`     | boolean | false   | Continuous wave motion. Enable for premium feel.               |
| `waveFrequency`     | number  | 2       | Number of waves. 2-3 looks good.                               |
| `waveAmplitude`     | number  | 1       | Wave height. 1-3 range.                                        |

### Gradient

| Prop            | Type    | Default | Notes                                               |
| --------------- | ------- | ------- | --------------------------------------------------- |
| `gradient`      | boolean | false   | Enable gradient fill.                               |
| `gradientStops` | array   | auto    | Array of `{ key, offset, stopColor, stopOpacity }`. |

### Events

| Prop      | Type     | Notes                                                 |
| --------- | -------- | ----------------------------------------------------- |
| `onClick` | function | Click handler. Wire up our increment/decrement logic. |

## RoutineMe Integration Patterns

### Nutrition Macro Gauge

```tsx
const pct = Math.min(100, (actual / goal) * 100);
const isOver = actual > goal;

<LiquidFillGauge
  width={90}
  height={90}
  value={Math.min(100, pct)}
  percent=""
  textRenderer={(props) => {
    const v = Math.round(props.value as number);
    return <tspan style={{ fontSize: 14, fontWeight: 700 }}>{actual}</tspan>;
  }}
  riseAnimation
  riseAnimationTime={800}
  waveAnimation
  waveFrequency={2}
  waveAmplitude={1}
  circleStyle={{ fill: "rgb(39,39,42)" }} // zinc-800
  waveStyle={{ fill: isOver ? "rgb(245,158,11)" : "rgb(52,211,153)" }} // amber or emerald
  textStyle={{ fill: "rgb(161,161,170)" }} // zinc-400
  waveTextStyle={{ fill: "rgb(255,255,255)" }}
  onClick={handleClick}
/>;
```

### Fitness Toggle Gauge (0% or 100%)

```tsx
<LiquidFillGauge
  width={90}
  height={90}
  value={completed ? 100 : 0}
  percent=""
  textRenderer={() => <tspan style={{ fontSize: 12 }}>{completed ? "Done" : label}</tspan>}
  riseAnimation
  riseAnimationTime={600}
  waveAnimation={completed}
  circleStyle={{ fill: "rgb(39,39,42)" }}
  waveStyle={{ fill: completed ? "rgb(52,211,153)" : "rgb(63,63,70)" }}
  textStyle={{ fill: "rgb(161,161,170)" }}
  waveTextStyle={{ fill: "rgb(255,255,255)" }}
  onClick={handleToggle}
/>
```

### Over-Goal Gradient

```tsx
const gradientStops = [
  { key: "0%", offset: "0%", stopColor: "rgb(16,185,129)", stopOpacity: 1 },
  { key: "50%", offset: "50%", stopColor: "rgb(56,189,248)", stopOpacity: 0.8 },
  { key: "100%", offset: "100%", stopColor: "rgb(59,130,246)", stopOpacity: 0.6 },
];

<LiquidFillGauge
  gradient
  gradientStops={gradientStops}
  // ... rest of props
/>;
```

## Color Mapping (RoutineMe Dark Theme)

| Element          | Color       | RGB                  |
| ---------------- | ----------- | -------------------- |
| Circle ring      | zinc-800    | `rgb(39,39,42)`      |
| Fill (on track)  | emerald-400 | `rgb(52,211,153)`    |
| Fill (at goal)   | emerald-300 | `rgb(110,231,183)`   |
| Fill (over goal) | amber-500   | `rgb(245,158,11)`    |
| Fill (way over)  | sky-400     | `rgb(56,189,248)`    |
| Text (normal)    | zinc-400    | `rgb(161,161,170)`   |
| Text (on wave)   | white       | `rgb(255,255,255)`   |
| Card bg          | zinc-900/60 | `rgba(24,24,27,0.6)` |

## Gotchas

1. **Client component only** — uses D3 DOM manipulation, must be `"use client"`
2. **No SSR** — wrap in dynamic import or guard with `typeof window !== 'undefined'` if needed
3. **Value is 0-100** — map `actual/goal * 100`, not raw values
4. **textRenderer gets animated value** — during rise animation, `props.value` interpolates. Use your own state for the actual number display if needed.
5. **No TypeScript types** — add the declaration above
6. **SVG-based** — all styling uses SVG properties (`fill`, not `backgroundColor`)

## D3 Easing Options

For `riseAnimationEasing` / `waveAnimationEasing`:

- `cubicInOut` (default, smooth)
- `linear` (constant speed)
- `elasticOut` (bouncy)
- `backOut` (slight overshoot)
- `bounceOut` (bounce effect)
