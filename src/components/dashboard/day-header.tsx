"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type DayHeaderProps = {
  dateString: string;
};

export function DayHeader({ dateString }: DayHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        aria-label="Previous day"
        className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xl font-semibold text-foreground tracking-tight">
          The Stub is the Way
        </span>
        <span className="text-sm text-muted-foreground">{dateString}</span>
      </div>

      <button
        type="button"
        aria-label="Next day"
        className="text-zinc-600 hover:text-zinc-400 transition-colors p-1"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
