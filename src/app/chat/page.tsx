export const dynamic = "force-dynamic";

import { Chat } from "@/components/chat";

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe your goals and I&apos;ll set up your habits.
          </p>
        </header>

        <Chat />
      </div>
    </div>
  );
}
