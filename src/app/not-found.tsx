import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="mx-auto max-w-md w-full animate-fade-in">
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/80 shadow-elevated p-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase mb-4">404</p>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">Page not found</h1>
          <p className="text-sm text-zinc-400 mb-8">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-semibold hover:bg-zinc-200 transition-colors duration-150"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
