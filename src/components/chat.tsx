"use client";

import { useRef, useState } from "react";
import { SendIcon, LoaderIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const EXAMPLE_PROMPTS = [
  "I had 200g chicken breast and a cup of rice",
  "Did chest today — bench press and flys",
  "Ran 1.5 miles this morning",
];

export function Chat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();

    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message ?? "Done.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 100);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleExampleClick(prompt: string) {
    setInput(prompt);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className={cn("flex flex-col gap-4", compact ? "min-h-[100px]" : "min-h-[200px]")}>
        {messages.length === 0 && !loading && (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-4 text-center",
              compact ? "py-6" : "py-12 gap-6",
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20",
                compact ? "size-12" : "size-16",
              )}
            >
              <SparklesIcon className={cn("text-emerald-400", compact ? "size-5" : "size-7")} />
            </div>
            <div>
              <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
                Log food, workouts, and runs
              </p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Tell me what you ate, where you trained, or how far you ran.
              </p>
            </div>

            <div className={cn("flex flex-col gap-2 w-full", compact ? "max-w-full" : "max-w-md")}>
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExampleClick(prompt)}
                  className={cn(
                    "rounded-xl border border-zinc-800 bg-zinc-900 text-left text-sm text-muted-foreground hover:border-zinc-700 hover:text-foreground transition-colors shadow-card",
                    compact ? "px-3 py-2" : "px-4 py-3",
                  )}
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "flex flex-col gap-2 animate-slide-up",
              msg.role === "user" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]",
                msg.role === "user"
                  ? "bg-emerald-500 text-white rounded-br-md"
                  : "bg-zinc-800 text-foreground rounded-bl-md",
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start">
            <div className="rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3">
              <LoaderIcon className="size-5 text-muted-foreground animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Log food, gym, run, or ask about progress..."
          rows={1}
          disabled={loading}
          className={cn(
            "flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[44px] max-h-[120px]",
          )}
          style={{ fieldSizing: "content" } as unknown as React.CSSProperties}
        />
        <Button
          type="submit"
          size="sm"
          disabled={loading || !input.trim()}
          className="h-[44px] px-4"
        >
          <SendIcon className="size-4" />
        </Button>
      </form>
    </div>
  );
}
