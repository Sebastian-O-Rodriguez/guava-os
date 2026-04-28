import { requireAuth } from "../../lib/auth-server";
import { classifyMessage } from "../../lib/chat-classifier";
import { estimateNutrition } from "../../lib/chat-estimator";
import { normalize, type NormalizedInput } from "../../lib/chat-normalizer";
import { proposeAction, executeAction } from "../../lib/chat-executor";
import { logNutritionParamsSchema } from "../../lib/chat-scenarios";
import type { EstimatedNutritionEntry, ClassifierOutput } from "../../lib/chat-scenarios";

type ChatMessage = { role: "user" | "assistant"; content: string };

type PendingAction = {
  input: NormalizedInput;
  estimates?: EstimatedNutritionEntry[];
};

/**
 * Chat API — requires authentication.
 * Pipeline: classify → normalize → estimate (if nutrition) → propose → confirm → execute
 */
export async function POST(request: Request): Promise<Response> {
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
      const pending = body.pendingAction as PendingAction;
      // SECURITY: override userId AND re-resolve categoryId for authenticated user.
      // Never trust client-sent userId or categoryId — they could be replayed from another user.
      pending.input.userId = userId;
      if (pending.input.intent !== "unknown" && pending.input.intent !== "query_progress") {
        const reclassified = { scenario: pending.input.intent, params: pending.input.params, confidence: pending.input.confidence } as ClassifierOutput;
        const reNormalized = await normalize(reclassified, userId);
        pending.input.categoryId = reNormalized.categoryId;
        pending.input.categoryName = reNormalized.categoryName;
      }

      if (isConfirm(userContent)) {
        const result = await executeAction(pending.input, pending.estimates);
        return json({
          message: result.message,
          status: result.status,
          mutation: result.mutation ?? null,
          scenario: pending.input.intent,
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

    if (input.intent === "query_progress") {
      const result = await executeAction(input);
      return json({
        message: result.message,
        status: result.status,
        scenario: input.intent,
        confidence: classified.confidence,
        data: result.data ?? null,
      });
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

    return json({
      message: proposal.message,
      status: proposal.status,
      scenario: input.intent,
      confidence: classified.confidence,
      data: null,
      pendingAction: { input, estimates },
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
