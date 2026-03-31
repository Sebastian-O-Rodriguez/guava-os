"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

type AppNavProps = {
  /** YYYY-MM-DD of current view date */
  isoDate?: string;
  /** Formatted date string like "Wednesday, 25 March 2026" */
  dateString?: string;
  /** Whether viewing today */
  isToday?: boolean;
};

function offsetDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, "0");
  const nd = String(date.getDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Progress", href: "/progress" },
] as const;

export function AppNav({ isoDate, dateString, isToday = true }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  function goBack() {
    if (!isoDate) return;
    router.push(`/?date=${offsetDate(isoDate, -1)}`);
  }

  function goForward() {
    if (!isoDate || isToday) return;
    const next = offsetDate(isoDate, 1);
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    router.push(next === todayIso ? "/" : `/?date=${next}`);
  }

  const showDateNav = isoDate && dateString;

  return (
    <>
      <nav
        data-nav-root
        className="fixed top-0 right-0 left-0 z-50 backdrop-blur-md bg-zinc-950/60 border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-11 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: logo */}
          <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
            routineme
          </span>

          {/* Center: date nav */}
          {showDateNav && (
            <div className="flex items-center gap-2">
              <button
                onClick={goBack}
                aria-label="Previous day"
                className="p-1 text-white/30 hover:text-white/70 transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-white/50 font-medium min-w-[140px] text-center">
                {dateString}
              </span>
              <button
                onClick={goForward}
                disabled={isToday}
                aria-label="Next day"
                className="p-1 text-white/30 hover:text-white/70 transition-colors disabled:text-white/10 disabled:cursor-default"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Right: hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="p-1 text-white/40 hover:text-white/70 transition-colors"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </nav>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-11 right-4 bg-zinc-900/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            style={{ marginTop: "env(safe-area-inset-top)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    "block px-6 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "text-emerald-400 bg-white/5"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/5",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
