"use client";

import { useRef, useState } from "react";
import { SendIcon, LoaderIcon, SparklesIcon, CheckIcon, PencilIcon, Trash2Icon, ListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolResult = {
  tool: string;
  args: Record<string, unknown>;
  result: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
};

const EXAMPLE_PROMPTS = [
  "I want to go to the gym 3x a week, meditate daily, and read on weekends",
  "Set up habits for: journal every morning, run 2x/week, call mom on Sundays",
  "I need to message clients on Mondays and do yoga on Tue/Thu/Sat",
];

function ToolResultCard({ result }: { result: ToolResult }) {
  const parsed = JSON.parse(result.result);
  const success = parsed.success;

  const iconMap: Record<string, React.ReactNode> = {
    create_habit: <CheckIcon className="size-3.5" />,
    update_habit: <PencilIcon className="size-3.5" />,
    delete_habit: <Trash2Icon className="size-3.5" />,
    list_habits: <ListIcon className="size-3.5" />,
  };

  const labelMap: Record<string, string> = {
    create_habit: "Created",
    update_habit: "Updated",
    delete_habit: "Deleted",
    list_habits: "Listed habits",
  };

  if (result.tool === "list_habits") return null;

  const habitName =
    parsed.habit?.name ?? (result.args.name as string) ?? "Habit";

  function formatFreq(freq: Record<string, unknown> | undefined): string {
    if (!freq) return "";
    if (freq.type === "daily") return "Every day";
    if (freq.type === "scheduled" && Array.isArray(freq.days)) {
      const dayLabels: Record<string, string> = {
        mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu",
        fri: "Fri", sat: "Sat", sun: "Sun",
      };
      return (freq.days as string[]).map((d) => dayLabels[d] ?? d).join(", ");
    }
    if (freq.type === "weekly") return `${freq.timesPerWeek}x/week`;
    return "";
  }

  const freq = parsed.habit?.frequency ?? result.args.frequency;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2 text-sm",
        success
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-rose-500/20 bg-rose-500/5",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full",
          success
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-rose-500/20 text-rose-400",
        )}
      >
        {iconMap[result.tool] ?? <CheckIcon className="size-3.5" />}
      </span>
      <div className="flex flex-col">
        <span className="font-medium text-foreground">
          {labelMap[result.tool] ?? result.tool}: {habitName}
        </span>
        {freq && (
          <span className="text-xs text-muted-foreground">
            {formatFreq(freq as Record<string, unknown>)}
          </span>
        )}
        {!success && parsed.error && (
          <span className="text-xs text-rose-400">{parsed.error}</span>
        )}
      </div>
    </div>
  );
}

export function Chat() {
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
        toolResults: data.toolResults,
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
      {/* Messages */}
      <div className="flex flex-col gap-4 min-h-[200px]">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center gap-6 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <SparklesIcon className="size-7 text-emerald-400" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Brain dump your goals
              </p>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Tell me what you want to be consistent at and I&apos;ll create
                the habits for you.
              </p>
            </div>

            {/* Example prompts */}
            <div className="flex flex-col gap-2 w-full max-w-md">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExampleClick(prompt)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-left text-sm text-muted-foreground hover:border-zinc-700 hover:text-foreground transition-colors"
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
              "flex flex-col gap-2",
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

            {/* Tool result cards */}
            {msg.toolResults && msg.toolResults.length > 0 && (
              <div className="flex flex-col gap-1.5 max-w-[85%] w-full">
                {msg.toolResults.map((tr, j) => (
                  <ToolResultCard key={j} result={tr} />
                ))}
              </div>
            )}
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your habits or goals..."
          rows={1}
          disabled={loading}
          className={cn(
            "flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "min-h-[44px] max-h-[120px]",
          )}
          style={{ fieldSizing: "content" } as React.CSSProperties}
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
