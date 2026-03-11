"use client";

import { useRef, useEffect } from "react";
import * as Plot from "@observablehq/plot";
import type { TrendPoint } from "@/lib/types";

interface TrendChartProps {
  trend: TrendPoint[];
}

export function TrendChart({ trend }: TrendChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Filter to points that have a rate (skip days with no applicable habits)
    const data = trend
      .filter((p) => p.rate !== null)
      .map((p) => ({
        date: new Date(p.date + "T00:00:00Z"),
        rate: (p.rate as number) * 100,
      }));

    if (data.length === 0) return;

    const width = containerRef.current.offsetWidth || 600;

    const plot = Plot.plot({
      width,
      height: 180,
      marginLeft: 40,
      marginRight: 16,
      marginTop: 16,
      marginBottom: 32,
      style: {
        background: "transparent",
        color: "#a1a1aa", // zinc-400
        fontFamily: "inherit",
        fontSize: "11px",
      },
      x: {
        type: "utc",
        label: null,
        tickFormat: (d: unknown) =>
          (d as Date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          }),
        ticks: Math.min(data.length, 6),
        tickSize: 0,
        line: false,
      },
      y: {
        domain: [0, 100],
        label: null,
        tickFormat: (d: unknown) => `${d as number}%`,
        ticks: 4,
        tickSize: 0,
        grid: true,
        line: false,
      },
      marks: [
        // Grid lines — styled via CSS on the plot SVG
        Plot.gridY({
          stroke: "oklch(1 0 0 / 8%)",
          strokeDasharray: "3,3",
        }),
        // Area fill below the line
        Plot.areaY(data, {
          x: "date",
          y: "rate",
          fill: "#10b981",
          fillOpacity: 0.08,
          curve: "monotone-x",
        }),
        // Main trend line
        Plot.lineY(data, {
          x: "date",
          y: "rate",
          stroke: "#10b981",
          strokeWidth: 2,
          curve: "monotone-x",
        }),
        // Dots at each data point
        Plot.dot(data, {
          x: "date",
          y: "rate",
          r: 2.5,
          fill: "#10b981",
          fillOpacity: 0.9,
        }),
      ],
    });

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(plot);

    return () => {
      plot.remove();
    };
  }, [trend]);

  if (trend.filter((p) => p.rate !== null).length === 0) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
        <p className="text-sm text-muted-foreground">No completion data yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4">
      <div ref={containerRef} className="w-full" style={{ minHeight: 180 }} />
    </div>
  );
}
