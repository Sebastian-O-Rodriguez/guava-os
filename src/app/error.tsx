"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="mx-auto max-w-md w-full animate-fade-in">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-elevated p-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-4">
            Error
          </p>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Something went wrong</h1>
          <p className="text-sm text-zinc-400 mb-8">
            An unexpected error occurred. You can try again or return to the dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={reset}
              className="w-full sm:w-auto px-5 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-semibold hover:bg-zinc-200 transition-colors duration-150"
            >
              Try again
            </button>
            <a
              href="/"
              className="w-full sm:w-auto px-5 py-2 rounded-lg border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800/50 hover:text-zinc-100 transition-colors duration-150 text-center"
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
