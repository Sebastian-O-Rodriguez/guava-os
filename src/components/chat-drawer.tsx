"use client";

import { useState } from "react";
import { MessageSquareIcon, XIcon } from "lucide-react";
import { Chat } from "@/components/chat";
import { cn } from "@/lib/utils";

export function ChatDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full",
            "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25",
            "hover:bg-emerald-400 active:scale-95 transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
          )}
          aria-label="Open chat"
        >
          <MessageSquareIcon className="size-6" />
        </button>
      )}

      {/* Drawer panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-0 right-0 z-50 flex flex-col",
            "w-full sm:w-[420px] sm:right-6 sm:bottom-6 sm:rounded-2xl",
            "h-[70vh] sm:h-[560px] max-h-[80vh]",
            "bg-zinc-950 border border-zinc-800 shadow-2xl shadow-black/50",
            "sm:rounded-2xl overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareIcon className="size-4 text-emerald-400" />
              <span className="text-sm font-semibold text-foreground">
                Chat
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:text-foreground hover:bg-zinc-800 transition-colors"
              aria-label="Close chat"
            >
              <XIcon className="size-4" />
            </button>
          </div>

          {/* Chat body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <Chat compact />
          </div>
        </div>
      )}
    </>
  );
}
