import { NextRequest, NextResponse } from "next/server";
import { classifyMessage } from "@/lib/chat-classifier";
import { executeScenario } from "@/lib/chat-executor";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatCompletionMessageParam[] = body.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json({ message: "No messages provided", error: true }, { status: 400 });
    }

    // Only the latest user message is used for classification
    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");

    const rawContent =
      typeof latestUserMessage?.content === "string" ? latestUserMessage.content : "";

    const userContent = rawContent.trim();

    if (!userContent) {
      return NextResponse.json({ message: "No user message found", error: true }, { status: 400 });
    }

    if (userContent.length > 500) {
      return NextResponse.json(
        { message: "Message too long (max 500 characters)", error: true },
        { status: 400 },
      );
    }

    // Step 1: classify intent (single LLM call)
    const classified = await classifyMessage(userContent);

    // Step 2: execute deterministically
    const result = await executeScenario(
      classified.scenario,
      classified.params as Record<string, unknown>,
    );

    return NextResponse.json({
      message: result.message,
      scenario: classified.scenario,
      data: result.data ?? null,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { message: "Failed to process chat request", error: true },
      { status: 500 },
    );
  }
}
