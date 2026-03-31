"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type DayHeaderProps = {
  dateString: string;
  /** YYYY-MM-DD of the currently viewed date */
  isoDate: string;
  /** True when the viewed date is today — disables the forward button */
  isToday: boolean;
};

function offsetDate(isoDate: string, days: number): string {
  // Parse as local-time midnight to avoid any UTC shift
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export function DayHeader({ dateString, isoDate, isToday }: DayHeaderProps) {
  const router = useRouter();

  function goBack() {
    router.push(`/?date=${offsetDate(isoDate, -1)}`);
  }

  function goForward() {
    if (isToday) return;
    const next = offsetDate(isoDate, 1);
    // Navigate to root (canonical) when the next day is today
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    router.push(next === todayIso ? "/" : `/?date=${next}`);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Previous day"
        onClick={goBack}
        className="text-zinc-400 hover:text-zinc-200 hover:bg-transparent"
      >
        <ChevronLeft size={20} />
      </Button>

      <div className="flex flex-col items-center gap-0.5">
        <span className="text-xl font-semibold text-foreground tracking-tight">
          The Stub is the Way
        </span>
        <span className="text-sm text-muted-foreground">{dateString}</span>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Next day"
        onClick={goForward}
        disabled={isToday}
        className="text-zinc-400 hover:text-zinc-200 hover:bg-transparent disabled:text-zinc-700 disabled:opacity-100"
      >
        <ChevronRight size={20} />
      </Button>
    </div>
  );
}
