import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { View } from "tamagui";
import { TILE_SIZES } from "../../lib/layout";
import { ACCENT } from "../../lib/palette";
import { subscribe, unsubscribe } from "../../lib/tile-animation-driver";
import type { TileSize } from "../../lib/layout";

// ---------------------------------------------------------------------------
// TileFluidFill — Design Intent
//
// PURPOSE: Make progress feel alive, then make completion feel earned.
//
// WHAT THIS IS:
//   Lightweight fluid wave fill for GoalTile. Subtle sine-wave motion
//   while filling, then gradual resolution to a solid dark-purple
//   completion state. The completion moment should feel like a quiet
//   reward — "oh nice" — not a visual event.
//
// WHAT THIS IS NOT:
//   Not a particle system. Not a shader. Not a full FluidMeter clone.
//   Not reusable beyond GoalTile. Not a general animation primitive.
//
// WHAT MUST NOT BE ADDED:
//   - Bubbles (too noisy at 64-80px)
//   - Shimmer/glow effects (draws attention to the effect, not the data)
//   - Canvas-drawn text (Tamagui text overlay handles this)
//   - Border ring (TileFrame handles this)
//   - Any ornament that competes with readability
//
// BOUNDARIES:
//   FluidMeter is a separate, richer system for standalone circular meters.
//   These are kept separate because the visual contexts are fundamentally
//   different (80px square vs 200px circle). Do not unify them.
//
// PLATFORM:
//   Web-first. Native gets a solid fill fallback with no animation.
//   The primary surface for this project is Expo web.
//
// REDUCED MOTION:
//   When prefers-reduced-motion is active, fill renders as solid color
//   at the correct level — no wave, but fill height and completion
//   color state are preserved.
// ---------------------------------------------------------------------------

type Props = {
  /** 0–100 fill percentage */
  fillPct: number;
  /** Whether the tile has reached 100% */
  isComplete: boolean;
  /** Whether the tile is over the goal */
  isOver: boolean;
  /** Tile size token */
  size: TileSize;
};

/** Linearly interpolate between two HSL color strings */
function lerpHsl(a: string, b: string, t: number): string {
  const parse = (s: string) => {
    const m = s.match(/([\d.]+)/g);
    if (!m || m.length < 3) return [270, 46, 55];
    return [parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2])];
  };
  const [h1, s1, l1] = parse(a);
  const [h2, s2, l2] = parse(b);
  const h = h1 + (h2 - h1) * t;
  const s = s1 + (s2 - s1) * t;
  const l = l1 + (l2 - l1) * t;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Draw a solid fill — used for completed state and reduced-motion */
function drawSolid(ctx: CanvasRenderingContext2D, px: number, fillPct: number, color: string) {
  ctx.clearRect(0, 0, px, px);
  const fillHeight = (Math.min(fillPct, 100) / 100) * px;
  if (fillHeight <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(0, px - fillHeight, px, fillHeight);
}

/** Check prefers-reduced-motion (cached per session) */
let _reducedMotion: boolean | null = null;
function prefersReducedMotion(): boolean {
  if (_reducedMotion !== null) return _reducedMotion;
  if (typeof window === "undefined") return false;
  _reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  return _reducedMotion;
}

export function TileFluidFill({ fillPct, isComplete, isOver, size }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Use a ref for the draw callback so subscribe/unsubscribe always
  // references the same function identity. This prevents orphan
  // subscriptions when useCallback deps change and React creates a
  // new function before the cleanup of the old effect runs.
  const drawRef = useRef<((time: number, dt: number) => void) | null>(null);

  const stateRef = useRef({
    currentFill: 0,
    targetFill: fillPct,
    waveAngle: 0,
    waveHorizontal: 0,
    dampening: isComplete ? 0 : 1, // mount in correct state
    isSubscribed: false,
  });

  const px = TILE_SIZES[size];

  // Colors — explicit hex from ACCENT palette, not theme tokens.
  // Theme tokens get remapped by <Theme name="purple"> and break neutral whites.
  // In-progress: very pale purple on white tile bg
  const fillColor = ACCENT.fluidFill;
  // Complete: dark purple (solid reward state)
  const completeFill = ACCENT.mid;
  // Over: blue
  const overFill = "#3b82f6";
  // Wave tint: slightly deeper for subtle motion
  const waveTint = ACCENT.fluidWave;

  // Keep refs current for the draw callback
  const colorsRef = useRef({ fillColor, completeFill, overFill, waveTint, isComplete, isOver });
  colorsRef.current = { fillColor, completeFill, overFill, waveTint, isComplete, isOver };

  // Update target on prop change
  useEffect(() => {
    stateRef.current.targetFill = fillPct;
  }, [fillPct]);

  // When leaving complete, restore dampening and re-subscribe
  useEffect(() => {
    const s = stateRef.current;
    if (!isComplete) {
      s.dampening = 1;
      if (!s.isSubscribed && drawRef.current && Platform.OS === "web" && !prefersReducedMotion()) {
        s.isSubscribed = true;
        subscribe(drawRef.current);
      }
    }
  }, [isComplete]);

  // Main effect: setup canvas, define draw, subscribe
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = px * dpr;
    canvas.height = px * dpr;
    ctx.scale(dpr, dpr);

    // Clear immediately so the canvas is transparent — prevents black flash
    // before the first animation frame fires
    ctx.clearRect(0, 0, px, px);

    const s = stateRef.current;

    // Reduced motion: draw solid, no animation
    if (prefersReducedMotion()) {
      const color = colorsRef.current.isOver
        ? colorsRef.current.overFill
        : colorsRef.current.isComplete
          ? colorsRef.current.completeFill
          : colorsRef.current.fillColor;
      drawSolid(ctx, px, s.targetFill, color);
      return;
    }

    // If mounting in already-complete solid state, draw solid and skip animation
    if (isComplete && s.dampening === 0) {
      const color = isOver ? overFill : completeFill;
      drawSolid(ctx, px, s.targetFill, color);
      s.currentFill = s.targetFill;
      return;
    }

    // Capture ctx for closure — guaranteed non-null at this point
    const c2d = ctx;

    // Define the stable draw callback
    function draw(_time: number, dt: number) {
      const c = colorsRef.current;

      // Ease fill toward target
      const diff = s.targetFill - s.currentFill;
      s.currentFill += diff * 0.06;
      if (Math.abs(diff) < 0.2) s.currentFill = s.targetFill;

      // Wave motion
      s.waveAngle += 35 * dt;
      if (s.waveAngle > 360) s.waveAngle -= 360;
      s.waveHorizontal -= 30 * dt;

      // Dampening: complete → reduce to 0. Not complete → restore to 1.
      if (c.isComplete && s.currentFill >= 99) {
        s.dampening = Math.max(0, s.dampening - 0.6 * dt);
      } else if (!c.isComplete) {
        s.dampening = Math.min(1, s.dampening + 2 * dt);
      }

      // Dampening reached 0 and fill settled → draw solid, stop
      if (s.dampening === 0 && Math.abs(diff) < 0.5) {
        drawSolid(c2d, px, s.currentFill, c.isOver ? c.overFill : c.completeFill);
        unsubscribe(draw);
        s.isSubscribed = false;
        return;
      }

      c2d.clearRect(0, 0, px, px);

      const fillHeight = (s.currentFill / 100) * px;
      if (fillHeight <= 0) return;
      const baseY = px - fillHeight;

      // Color: interpolate fill → complete based on dampening
      const t = 1 - s.dampening;
      const mainColor = c.isOver
        ? c.overFill
        : c.isComplete
          ? lerpHsl(c.fillColor, c.completeFill, t)
          : c.fillColor;

      // Wave amplitude — scales with dampening and fill height
      const maxAmplitude = 3.5 * s.dampening * Math.min(1, fillHeight / 20);
      const amplitude = maxAmplitude * Math.sin((s.waveAngle * Math.PI) / 180);
      const frequency = 25;

      // Primary wave fill
      c2d.save();
      c2d.beginPath();
      c2d.moveTo(0, baseY);
      for (let x = 0; x <= px; x++) {
        c2d.lineTo(x, baseY + amplitude * Math.sin((x + s.waveHorizontal) / frequency));
      }
      c2d.lineTo(px, px);
      c2d.lineTo(0, px);
      c2d.closePath();
      c2d.fillStyle = mainColor;
      c2d.fill();
      c2d.restore();

      // Subtle secondary wave (only when dampening > 0.3)
      if (s.dampening > 0.3) {
        const amp2 = 2.5 * s.dampening * Math.min(1, fillHeight / 20);
        const a2 = amp2 * Math.cos((s.waveAngle * Math.PI) / 180);
        c2d.save();
        c2d.globalAlpha = 0.1 * s.dampening;
        c2d.beginPath();
        c2d.moveTo(0, baseY);
        for (let x = 0; x <= px; x++) {
          c2d.lineTo(x, baseY + a2 * Math.sin((x + s.waveHorizontal * 0.7 + 40) / (frequency * 1.3)));
        }
        c2d.lineTo(px, px);
        c2d.lineTo(0, px);
        c2d.closePath();
        c2d.fillStyle = c.waveTint;
        c2d.fill();
        c2d.restore();
      }
    }

    drawRef.current = draw;
    s.isSubscribed = true;
    subscribe(draw);

    return () => {
      if (s.isSubscribed) {
        unsubscribe(draw);
        s.isSubscribed = false;
      }
      drawRef.current = null;
    };
  }, [px]); // Only re-run on size change — colors read from ref

  // Reduced-motion: redraw solid when fillPct or completion changes
  useEffect(() => {
    if (Platform.OS !== "web" || !prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const color = isOver ? overFill : isComplete ? completeFill : fillColor;
    drawSolid(ctx, px, fillPct, color);
  }, [fillPct, isComplete, isOver, px, fillColor, completeFill, overFill]);

  // Native fallback — solid fill, no animation (web-first feature)
  if (Platform.OS !== "web") {
    const color = isOver ? "$blue9" : isComplete ? ACCENT.light : ACCENT.fluidFill;
    return (
      <View
        position="absolute"
        b={0}
        l={0}
        r={0}
        height={`${Math.min(fillPct, 100)}%` as any}
        bg={color}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef as any}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        width: px,
        height: px,
        pointerEvents: "none",
        background: "transparent",
      }}
    />
  );
}
