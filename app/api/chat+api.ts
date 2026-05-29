import { requireAuth } from "../../lib/auth-server";
import { rateLimit, getClientIp } from "../../lib/rate-limit";
import { classifyMessage } from "../../lib/chat-classifier";
import { estimateNutrition } from "../../lib/chat-estimator";
import { normalize } from "../../lib/chat-normalizer";
import { proposeAction, buildAction } from "../../lib/chat-executor";
import { executeAction } from "../../lib/actions/executor";
import { ActionSchema } from "../../lib/actions/types";
import type { Action } from "../../lib/actions/types";
import { logNutritionParamsSchema } from "../../lib/chat-scenarios";
import type { EstimatedNutritionEntry, ClassifierOutput } from "../../lib/chat-scenarios";

type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * Chat API — requires authentication.
 * Pipeline: classify → normalize → estimate (if nutrition) → propose → confirm → execute
 *
 * Proposals return an Action object as pendingAction.
 * Confirmations execute the Action via lib/actions/executor.
 */
export async function POST(request: Request): Promise<Response> {
  // Rate limit — 20 requests per minute per IP (LLM cost protection)
  const rl = rateLimit(`chat:${getClientIp(request)}`, 20, 60_000);
  if (rl) return rl;

  // Auth gate — every request must be authenticated
  const authResult = await requireAuth(request);
  if (authResult instanceof Response) return authResult;
  const userId = authResult;

  try {
    const body = await request.json();
    const messages: ChatMessage[] = body.messages ?? [];

    if (messages.length === 0) {
      return json({ message: "No messages provided", status: "error" }, 400);
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const userContent = (latestUserMessage?.content ?? "").trim();

    if (!userContent) {
      return json({ message: "No user message found", status: "error" }, 400);
    }

    if (userContent.length > 500) {
      return json({ message: "Message too long (max 500 characters)", status: "error" }, 400);
    }

    // ----- Confirmation flow -----
    if (body.pendingAction) {
      // pendingAction is now an Action object (from lib/actions/types.ts)
      const parsed = ActionSchema.safeParse(body.pendingAction);
      if (!parsed.success) {
        return json({ message: "Invalid action data", status: "error" }, 400);
      }

      // SECURITY: override userId — never trust client-sent userId
      const action: Action = { ...parsed.data, userId };

      if (isConfirm(userContent)) {
        const result = await executeAction(action);
        return json({
          message: result.message,
          status: result.status,
          mutation: result.mutation ?? null,
          scenario: action.intent,
          data: result.data ?? null,
          timestamp: result.timestamp ?? Date.now(),
        });
      }

      if (isReject(userContent)) {
        return json({
          message: "No problem. What would you like to do instead?",
          status: "info",
          scenario: "cancelled",
        });
      }
    }

    // ----- Normal flow: classify → normalize → estimate → propose -----

    const conversationContext = messages.slice(0, -1).slice(-4);

    const classified = await classifyMessage(
      userContent,
      conversationContext.length > 0 ? conversationContext : undefined,
    );

    if (classified.confidence < 0.7 && classified.scenario !== "unknown") {
      return json({
        message: "I'm not sure what you mean. Could you rephrase that?",
        status: "clarify",
        scenario: classified.scenario,
        confidence: classified.confidence,
      });
    }

    // Normalize with authenticated userId
    const input = await normalize(classified, userId);

    let estimates: EstimatedNutritionEntry[] | undefined;
    if (input.intent === "log_nutrition") {
      const parsed = logNutritionParamsSchema.safeParse(classified.params);
      if (parsed.success) {
        const items = parsed.data.entries.map((e) => e.item);
        estimates = await estimateNutrition(items);
      }
    }

    // Queries execute immediately — no confirmation needed
    if (input.intent === "query_progress") {
      const action = buildAction(input);
      if (action) {
        const result = await executeAction(action);
        return json({
          message: result.message,
          status: result.status,
          scenario: input.intent,
          confidence: classified.confidence,
          data: result.data ?? null,
        });
      }
    }

    const proposal = proposeAction(input, estimates);

    if (proposal.status === "info") {
      return json({
        message: proposal.message,
        status: "info",
        scenario: input.intent,
        confidence: classified.confidence,
      });
    }

    // Build Action object to include in response
    const action = buildAction(input, estimates);

    return json({
      message: proposal.message,
      status: proposal.status,
      scenario: input.intent,
      confidence: classified.confidence,
      data: null,
      pendingAction: action,
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return json(
      { message: "Something went wrong — try again?", status: "error" },
      500,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(data: Record<string, unknown>, status = 200): Response {
  return Response.json(data, { status });
}

const CONFIRM = /^(yes|yeah|yep|yup|sure|ok|okay|go ahead|do it|log it|sounds? (right|good|correct)|that'?s? (right|correct|good)|confirm|perfect|exactly|correct)[\.\!\s]*$/i;
const REJECT = /^(no|nope|nah|cancel|never ?mind|stop|don'?t|skip|wrong|incorrect)[\.\!\s]*$/i;

function isConfirm(msg: string): boolean {
  return CONFIRM.test(msg.trim());
}

function isReject(msg: string): boolean {
  return REJECT.test(msg.trim());
}
