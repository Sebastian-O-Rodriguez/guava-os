"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Today", href: "/" },
  { label: "Monthly", href: "/monthly" },
  { label: "Progress", href: "/progress" },
  { label: "Settings", href: "/settings" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 right-0 left-0 z-50 border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <span className="text-sm font-semibold tracking-widest text-zinc-100 uppercase">
          RoutineMe
        </span>

        <ul className="flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={[
                    "relative px-3 py-1.5 text-sm font-medium transition-colors duration-150 rounded-md",
                    isActive
                      ? "text-emerald-400"
                      : "text-zinc-400 hover:text-zinc-100",
                  ].join(" ")}
                >
                  {label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[1px] h-px bg-emerald-400" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
