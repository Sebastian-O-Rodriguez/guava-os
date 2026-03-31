"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "Progress", href: "/progress" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <nav
        data-nav-root
        className="fixed top-0 right-0 left-0 z-50 backdrop-blur-md bg-zinc-950/60 border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-10 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: logo */}
          <Link href="/">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50 uppercase">
              routineme
            </span>
          </Link>

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
            className="absolute top-10 right-4 bg-zinc-900/95 backdrop-blur-lg border border-white/10 rounded-xl shadow-2xl overflow-hidden"
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
