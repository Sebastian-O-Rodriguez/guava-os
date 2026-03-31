"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InlineChat() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up banner timer on unmount to prevent state updates on dead component
  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    const msg = trimmed;
    setInput("");

    startTransition(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: msg }],
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        const text: string = data.message ?? "Done.";
        setResponse(text);

        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === "AbortError";
        setResponse(
          isTimeout ? "Request timed out. Try again." : "Something went wrong. Try again.",
        );
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-2 gap-3 transition-colors focus-within:border-white/15">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Log food, gym, run, or ask about progress..."
            maxLength={500}
            disabled={isPending}
            aria-label="Log activity or ask about progress"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-zinc-500 outline-none disabled:text-zinc-500 disabled:cursor-not-allowed"
          />
        </div>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Send message"
          disabled={!input.trim() || isPending}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/15 hover:text-foreground hover:bg-white/[0.06]"
        >
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Button>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {response && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm px-4 py-2 text-sm text-zinc-300 animate-fade-in">
            {response}
          </div>
        )}

        {isPending && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-sm px-4 py-2 text-sm text-zinc-400 animate-fade-in">
            Processing...
          </div>
        )}
      </div>
    </div>
  );
}
