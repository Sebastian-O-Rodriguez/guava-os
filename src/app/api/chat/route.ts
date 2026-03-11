import { NextRequest, NextResponse } from "next/server";
import { openrouter, CHAT_MODEL } from "@/lib/openrouter";
import { SYSTEM_PROMPT } from "@/lib/chat-prompt";
import { tools, executeTool } from "@/lib/chat-tools";
import type {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages: ChatCompletionMessageParam[] = body.messages ?? [];

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 },
      );
    }

    // Build the full message array with system prompt
    const fullMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // Call Claude via OpenRouter with tool use
    let response = await openrouter.chat.completions.create({
      model: CHAT_MODEL,
      messages: fullMessages,
      tools,
      tool_choice: "auto",
      max_tokens: 1024,
    });

    let assistantMessage = response.choices[0]?.message;

    // Tool use loop — execute tools and feed results back until Claude is done
    const toolResults: Array<{
      tool: string;
      args: Record<string, unknown>;
      result: string;
    }> = [];
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (
      assistantMessage?.tool_calls &&
      assistantMessage.tool_calls.length > 0 &&
      iterations < MAX_ITERATIONS
    ) {
      iterations++;

      // Execute each tool call
      const toolMessages: ChatCompletionToolMessageParam[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;

        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args);

        toolResults.push({
          tool: toolCall.function.name,
          args,
          result,
        });

        toolMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }

      // Send tool results back to Claude for summarization
      fullMessages.push(assistantMessage);
      fullMessages.push(...toolMessages);

      response = await openrouter.chat.completions.create({
        model: CHAT_MODEL,
        messages: fullMessages,
        tools,
        tool_choice: "auto",
        max_tokens: 1024,
      });

      assistantMessage = response.choices[0]?.message;
    }

    return NextResponse.json({
      message: assistantMessage?.content ?? "Done.",
      toolResults,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 },
    );
  }
}
