import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Platform } from "react-native";
import { View, Text, YStack, useTheme } from "tamagui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Segment = {
  label: string;
  value: number;
  /** Goal / target value — shown on hover as "/ max" */
  max?: number;
  /** Unit label — shown on hover (e.g. "g", "kcal") */
  unit?: string;
  /** Color override — defaults to purple monochrome stepping */
  color?: string;
};

type MacroDoughnutProps = {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  centerUnit?: string;
  label?: string;
  startAngle?: number;
  endAngle?: number;
  thickness?: number;
};

export { MacroDoughnut as NestedDoughnut };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function purpleStep(index: number, total: number): string {
  const baseLightness = 58;
  const step = Math.min(12, 30 / Math.max(total, 1));
  const l = baseLightness - index * step;
  return `hsl(270, 46%, ${Math.max(25, l)}%)`;
}

type ResolvedSeg = Segment & { color: string };

function resolveColors(segments: Segment[]): ResolvedSeg[] {
  return segments.map((seg, i) => ({
    ...seg,
    color: seg.color || purpleStep(i, segments.length),
  }));
}

/** Stable key from segment data — only changes when actual data changes */
function segmentsKey(segments: Segment[]): string {
  return segments.map(s => `${s.label}:${s.value}:${s.max ?? ""}:${s.unit ?? ""}`).join("|");
}

/** Hit-test: which segment index is the mouse/touch over? -1 if none. */
function hitTest(
  mx: number,
  my: number,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  segments: ResolvedSeg[],
  startAngle: number,
  totalArc: number,
): number {
  const dx = mx - cx;
  const dy = my - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < innerR || dist > outerR) return -1;

  let angle = Math.atan2(dy, dx);
  while (angle < startAngle) angle += Math.PI * 2;
  while (angle > startAngle + Math.PI * 2) angle -= Math.PI * 2;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) return -1;

  let cur = startAngle;
  for (let i = 0; i < segments.length; i++) {
    const segArc = (segments[i].value / total) * totalArc;
    if (angle >= cur && angle <= cur + segArc) return i;
    cur += segArc;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  segments: ResolvedSeg[],
  startAngle: number,
  totalArc: number,
  progress: number,
  trackColor: string,
  strokeColor: string,
  activeIndex: number,
) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) return;

  const midR = (innerR + outerR) / 2;
  const ringW = outerR - innerR;

  // Track background
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, midR, startAngle, startAngle + totalArc);
  ctx.lineWidth = ringW;
  ctx.strokeStyle = trackColor;
  ctx.lineCap = "butt";
  ctx.stroke();
  ctx.restore();

  // Segments
  let currentAngle = startAngle;
  const hasActive = activeIndex >= 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segArc = (seg.value / total) * totalArc * progress;
    if (segArc <= 0) { currentAngle += segArc; continue; }

    const isActive = i === activeIndex;
    // Active: slight thickness increase. Inactive when something else is active: slight opacity reduction.
    const drawW = isActive ? ringW + 4 : ringW;
    const alpha = hasActive && !isActive ? 0.45 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(cx, cy, midR, currentAngle, currentAngle + segArc);
    ctx.lineWidth = drawW;
    ctx.strokeStyle = seg.color;
    ctx.lineCap = "butt";
    ctx.stroke();
    ctx.restore();

    // Separator
    if (segments.length > 1 && segArc > 0.02) {
      ctx.save();
      ctx.beginPath();
      const sepAngle = currentAngle + segArc;
      ctx.moveTo(cx + (innerR - 1) * Math.cos(sepAngle), cy + (innerR - 1) * Math.sin(sepAngle));
      ctx.lineTo(cx + (outerR + 1) * Math.cos(sepAngle), cy + (outerR + 1) * Math.sin(sepAngle));
      ctx.lineWidth = 2;
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      ctx.restore();
    }

    currentAngle += segArc;
  }
}

type Colors = { bg: string; track: string; text: string; muted: string; dim: string; stroke: string };
type Center = { label?: string; value: string; unit?: string };

function drawFrame(
  ctx: CanvasRenderingContext2D,
  size: number,
  innerR: number,
  outerR: number,
  resolved: ResolvedSeg[],
  startRad: number,
  totalArc: number,
  progress: number,
  activeIndex: number,
  colors: Colors,
  center: Center,
) {
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  drawRing(ctx, cx, cy, innerR, outerR, resolved, startRad, totalArc, progress, colors.track, colors.stroke, activeIndex);

  // Center hole background
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR - 1, 0, Math.PI * 2);
  ctx.fillStyle = colors.bg;
  ctx.fill();
  ctx.restore();

  // Center text — either segment detail or default summary
  if (activeIndex >= 0 && activeIndex < resolved.length) {
    const seg = resolved[activeIndex];

    // Segment label (colored to match segment)
    ctx.save();
    ctx.font = `500 ${size * 0.055}px "Plus Jakarta Sans", Inter, sans-serif`;
    ctx.fillStyle = colors.text;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(seg.label, cx, cy - size * 0.02);
    ctx.restore();

    // Value + unit on one line
    const valStr = String(seg.value);
    const unitStr = seg.unit || "";
    const valFont = `700 ${size * 0.11}px "Plus Jakarta Sans", Inter, sans-serif`;
    const unitFont = `400 ${size * 0.06}px "Plus Jakarta Sans", Inter, sans-serif`;

    ctx.save();
    ctx.font = valFont;
    const valW = ctx.measureText(valStr).width;
    let lineW = valW;
    if (unitStr) {
      ctx.font = unitFont;
      lineW += 3 + ctx.measureText(unitStr).width;
    }
    const startX = cx - lineW / 2;

    ctx.font = valFont;
    ctx.fillStyle = colors.text;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(valStr, startX, cy + 2);

    if (unitStr) {
      ctx.font = unitFont;
      ctx.fillStyle = colors.dim;
      ctx.fillText(unitStr, startX + valW + 3, cy + 2 + size * 0.025);
    }
    ctx.restore();

    // Goal line: "/ 180"
    if (seg.max != null) {
      ctx.save();
      ctx.font = `400 ${size * 0.05}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.fillStyle = colors.dim;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`/ ${seg.max}`, cx, cy + size * 0.12);
      ctx.restore();
    }
  } else {
    // Default center: total summary
    if (center.label) {
      ctx.save();
      ctx.font = `500 ${size * 0.055}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(center.label, cx, cy - 1);
      ctx.restore();
    }

    if (center.value) {
      const valFont = `700 ${size * 0.13}px "Plus Jakarta Sans", Inter, sans-serif`;
      const unitFont = `400 ${size * 0.065}px "Plus Jakarta Sans", Inter, sans-serif`;

      if (center.unit) {
        ctx.save();
        ctx.font = valFont;
        const valW = ctx.measureText(center.value).width;
        ctx.font = unitFont;
        const totalW = valW + 4 + ctx.measureText(center.unit).width;
        const startX = cx - totalW / 2;

        ctx.font = valFont;
        ctx.fillStyle = colors.text;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(center.value, startX, cy + 3);

        ctx.font = unitFont;
        ctx.fillStyle = colors.muted;
        ctx.fillText(center.unit, startX + valW + 4, cy + 3 + size * 0.03);
        ctx.restore();
      } else {
        ctx.save();
        ctx.font = valFont;
        ctx.fillStyle = colors.text;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(center.value, cx, cy + 3);
        ctx.restore();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MacroDoughnut({
  segments,
  size = 220,
  centerLabel,
  centerValue,
  centerUnit,
  label,
  startAngle = 160,
  endAngle = 380,
  thickness = 0.3,
}: MacroDoughnutProps) {
  const theme = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation state — only reset on real data change
  const progressRef = useRef(0);
  const animIdRef = useRef(0);

  // Interaction state — fully independent from animation
  const activeRef = useRef(-1);
  const [activeIndex, setActiveIndex] = useState(-1);

  const colors: Colors = {
    bg: (theme.color2?.val as string) || "#1c1c1c",
    track: (theme.color3?.val as string) || "#333",
    text: (theme.color12?.val as string) || "#fff",
    muted: (theme.color7?.val as string) || "#888",
    dim: (theme.color5?.val as string) || "#3d3d3d",
    stroke: (theme.color1?.val as string) || "#111",
  };

  // Memoize resolved segments — only recompute when segment data changes
  const key = segmentsKey(segments);
  const resolved = useMemo(() => resolveColors(segments), [key]);

  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const totalArc = endRad - startRad;

  const maxR = size / 2 - 4;
  const outerR = maxR * 0.95;
  const innerR = outerR * (1 - thickness);

  const displayValue = centerValue ?? "";
  const center: Center = { label: centerLabel, value: displayValue, unit: centerUnit };

  // Store current values in refs for the draw functions
  const renderRef = useRef({ resolved, colors, center, size, innerR, outerR, startRad, totalArc });
  renderRef.current = { resolved, colors, center, size, innerR, outerR, startRad, totalArc };

  // -----------------------------------------------------------------------
  // Static redraw — called by interaction events, NOT by an effect
  // -----------------------------------------------------------------------
  const redraw = useCallback(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const r = renderRef.current;
    drawFrame(ctx, r.size, r.innerR, r.outerR, r.resolved, r.startRad, r.totalArc, progressRef.current, activeRef.current, r.colors, r.center);
  }, []);

  // -----------------------------------------------------------------------
  // Pointer events — update interaction state only, never touch animation
  // -----------------------------------------------------------------------
  const getCanvasPos = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width / dpr),
      y: (e.clientY - rect.top) * (canvas.height / rect.height / dpr),
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const pos = getCanvasPos(e);
    if (!pos) return;
    const r = renderRef.current;
    const idx = hitTest(pos.x, pos.y, r.size / 2, r.size / 2, r.innerR, r.outerR, r.resolved, r.startRad, r.totalArc);
    if (idx !== activeRef.current) {
      activeRef.current = idx;
      setActiveIndex(idx);
      redraw();
    }
  }, [getCanvasPos, redraw]);

  const handleMouseLeave = useCallback(() => {
    if (activeRef.current !== -1) {
      activeRef.current = -1;
      setActiveIndex(-1);
      redraw();
    }
  }, [redraw]);

  // Mobile: tap toggles segment
  const handleClick = useCallback((e: MouseEvent) => {
    const pos = getCanvasPos(e);
    if (!pos) return;
    const r = renderRef.current;
    const idx = hitTest(pos.x, pos.y, r.size / 2, r.size / 2, r.innerR, r.outerR, r.resolved, r.startRad, r.totalArc);
    // Toggle: tap same segment again → deselect
    const next = idx === activeRef.current ? -1 : idx;
    activeRef.current = next;
    setActiveIndex(next);
    redraw();
  }, [getCanvasPos, redraw]);

  // Attach pointer listeners
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleClick);
    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleClick);
    };
  }, [handleMouseMove, handleMouseLeave, handleClick]);

  // -----------------------------------------------------------------------
  // Entrance animation — only runs on mount or when segment data changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Reset animation for new data
    progressRef.current = 0;

    function animate() {
      progressRef.current += (1 - progressRef.current) * 0.035;
      if (progressRef.current > 0.999) progressRef.current = 1;

      const r = renderRef.current;
      drawFrame(ctx!, r.size, r.innerR, r.outerR, r.resolved, r.startRad, r.totalArc, progressRef.current, activeRef.current, r.colors, r.center);

      if (progressRef.current < 1) {
        animIdRef.current = requestAnimationFrame(animate);
      }
    }

    animIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animIdRef.current);
  }, [key, size]); // key = segmentsKey — only resets on real data change

  // -----------------------------------------------------------------------
  // Redraw when theme colors change (no animation reset)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (progressRef.current >= 1) {
      redraw();
    }
  }, [colors.bg, colors.track, colors.text, colors.muted, colors.stroke, redraw]);

  // -----------------------------------------------------------------------
  // Native fallback
  // -----------------------------------------------------------------------
  if (Platform.OS !== "web") {
    return (
      <YStack items="center" gap="$1">
        {label && (
          <Text fontSize={10} fontWeight="500" textTransform="uppercase" letterSpacing={1} color="$color8" text="center">
            {label}
          </Text>
        )}
        <View width={size} height={size} bg="$color2" rounded={size / 2} items="center" justify="center">
          {centerLabel && <Text fontSize={size * 0.055} fontWeight="500" color="$color7">{centerLabel}</Text>}
          <Text fontSize={size * 0.13} fontWeight="700" color="$color12">{displayValue}</Text>
        </View>
      </YStack>
    );
  }

  return (
    <YStack items="center" gap="$1" select="none">
      {label && (
        <Text fontSize={10} fontWeight="500" textTransform="uppercase" letterSpacing={1} color="$color8" text="center">
          {label}
        </Text>
      )}
      <canvas
        ref={canvasRef as any}
        style={{ width: size, height: size, cursor: activeIndex >= 0 ? "pointer" : "default" }}
      />
    </YStack>
  );
}
