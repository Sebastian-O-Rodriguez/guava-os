"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowRightIcon } from "lucide-react";

export function InlineChat() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isPending) return;

    const msg = trimmed;
    setInput("");

    startTransition(async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: msg }],
          }),
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);

        const data = await res.json();
        const text: string = data.message ?? "Done.";
        setResponse(text);

        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      } catch {
        setResponse("Something went wrong. Try again.");
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setResponse(null), 4000);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="flex flex-col gap-2">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center rounded-xl border border-zinc-800/60 bg-zinc-900/80 px-4 py-2.5 gap-3 transition-colors focus-within:border-zinc-700">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Log food, gym, run, or ask about progress..."
            disabled={isPending}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-zinc-600 outline-none disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || isPending}
          className="rounded-xl border border-zinc-800/60 bg-zinc-900/80 p-2.5 text-muted-foreground transition-all hover:border-zinc-700 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ArrowRightIcon className="size-4" />
        </button>
      </form>

      {response && (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/60 px-4 py-2.5 text-sm text-muted-foreground animate-fade-in">
          {response}
        </div>
      )}

      {isPending && (
        <div className="rounded-xl border border-zinc-800/40 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-600 animate-fade-in">
          Processing...
        </div>
      )}
    </div>
  );
}
