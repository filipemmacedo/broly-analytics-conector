import { NextResponse } from "next/server";

import { getChat, saveChat } from "@/lib/chat-store";
import { getAllIntegrations } from "@/lib/integration-store";
import { getLLMSettings } from "@/lib/llm-settings-store";
import { handleQuestion } from "@/lib/orchestrator";
import { getFreshAccessToken } from "@/lib/providers/google-analytics";
import { ensureSession } from "@/lib/session";
import type { SessionState } from "@/lib/types";
import type { GoogleAnalyticsFields } from "@/types/integration";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { question?: string };

  if (!body.question?.trim()) {
    return NextResponse.json("Question is required.", { status: 400 });
  }

  const chatSession = getChat(id);
  if (!chatSession) return NextResponse.json("Not found.", { status: 404 });

  const isFirstMessage = chatSession.messages.length === 0;

  // Resolve GA4 credentials — use getFreshAccessToken so expired tokens are
  // automatically refreshed using the stored refresh token before the query.
  const integrations = getAllIntegrations();
  const ga4 = integrations.find((i) => i.provider === "google-analytics");
  const ga4Fields = ga4?.providerFields as GoogleAnalyticsFields | undefined;
  const ga4PropertyId = ga4Fields?.propertyId ?? null;

  let ga4AccessToken: string | null = null;
  if (ga4 && (ga4.authConfig.authType === "oauth2" || ga4.authConfig.authType === "oauth2-code-flow")) {
    try {
      ga4AccessToken = await getFreshAccessToken(ga4.id);
    } catch {
      // Token refresh failed — proceed with null; orchestrator will surface the error
      ga4AccessToken = null;
    }
  }

  const llmSettings = getLLMSettings();
  const llmConfig = llmSettings
    ? { provider: llmSettings.provider, model: llmSettings.model, apiKey: llmSettings.apiKey }
    : null;

  // Get connection state (BigQuery / Power BI) from the existing session store
  const { session: connSession } = await ensureSession();

  // Build a temporary SessionState to pass to the orchestrator, seeded with
  // this chat session's message history so the LLM has conversation context.
  const tempSession: SessionState = {
    id: chatSession.id,
    createdAt: chatSession.createdAt,
    activeSource: connSession.activeSource,
    chat: [...chatSession.messages],
    connections: connSession.connections
  };

  const updated = await handleQuestion(tempSession, body.question.trim(), {
    ga4PropertyId,
    ga4AccessToken,
    llmConfig
  });

  // Sync orchestrator results back into the persistent chat session
  chatSession.messages = updated.chat;

  // Auto-title from first user message (max 40 chars)
  if (isFirstMessage) {
    const q = body.question.trim();
    chatSession.title = q.length > 40 ? `${q.slice(0, 40)}…` : q;
  }

  saveChat(chatSession);

  return NextResponse.json(chatSession);
}
