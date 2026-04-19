import { randomUUID } from "node:crypto";

import { runBigQueryAgentTurn } from "@/lib/agents/bigquery-agent";
import { getActiveIntegration } from "@/lib/integration-store";
import { runGA4AgentTurn } from "@/lib/agents/ga4-agent";
import { getFreshAccessToken as getBQFreshToken } from "@/lib/providers/bigquery";
import { getFreshAccessToken as getGA4FreshToken } from "@/lib/providers/google-analytics";
import type { BigQueryFields, GoogleAnalyticsFields } from "@/types/integration";
import type { ChatMessage, SessionState, SourceId } from "@/lib/types";
import type { LLMProvider } from "@/types/llm";

export interface ChatContext {
  llmConfig?: { provider: LLMProvider; model: string; apiKey: string } | null;
}

function pushAssistantMessage(
  session: SessionState,
  content: string,
  source?: SourceId,
  status: "complete" | "error" = "complete"
): void {
  session.chat.push({
    id: randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    source,
    status
  });
}

export async function handleQuestion(session: SessionState, question: string, context?: ChatContext) {
  const { llmConfig } = context ?? {};

  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
    status: "complete"
  };
  session.chat.push(userMessage);

  // ─── Resolve active source ────────────────────────────────────────────────

  const activeIntegration = getActiveIntegration();

  if (!activeIntegration) {
    pushAssistantMessage(
      session,
      "No analytics source is connected. Go to Settings > Integrations to connect Google Analytics or BigQuery.",
      undefined,
      "error"
    );
    return session;
  }

  if (!llmConfig) {
    pushAssistantMessage(
      session,
      "An LLM must be configured to query your data. Go to Settings > LLM to set up a provider.",
      undefined,
      "error"
    );
    return session;
  }

  // ─── GA4 path ─────────────────────────────────────────────────────────────

  if (activeIntegration.provider === "google-analytics") {
    const fields = activeIntegration.providerFields as GoogleAnalyticsFields;
    const propertyId = fields?.propertyId;

    if (!propertyId) {
      pushAssistantMessage(
        session,
        "No GA4 property selected. Go to Settings > Integrations > Google Analytics to select a property.",
        "ga4",
        "error"
      );
      return session;
    }

    let accessToken: string;
    try {
      accessToken = await getGA4FreshToken(activeIntegration.id);
    } catch {
      pushAssistantMessage(
        session,
        "Google Analytics is not authenticated or the session has expired. Click \"Connect with Google\" in Settings > Integrations > Google Analytics.",
        "ga4",
        "error"
      );
      return session;
    }

    try {
      const { summary, visual } = await runGA4AgentTurn(llmConfig, accessToken, propertyId, question);
      const message: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        content: summary,
        createdAt: new Date().toISOString(),
        source: "ga4",
        status: "complete",
        ...(visual ? { visual } : {})
      };
      session.chat.push(message);
    } catch (error) {
      console.error("GA4 query failed", {
        question,
        propertyId,
        message: error instanceof Error ? error.message : String(error)
      });
      pushAssistantMessage(
        session,
        "I couldn't complete that Google Analytics query. Please try rephrasing it or check the selected GA4 property and date range.",
        "ga4",
        "error"
      );
    }

    return session;
  }

  // ─── BigQuery path ────────────────────────────────────────────────────────

  if (activeIntegration.provider === "bigquery") {
    const fields = activeIntegration.providerFields as BigQueryFields;
    const projectId = fields?.projectId;
    // Derive datasetId from propertyId if not explicitly stored (backfill for existing integrations)
    const datasetId = fields?.datasetId ||
      (fields?.propertyId ? `analytics_${fields.propertyId.replace(/^properties\//, "")}` : undefined);
    const propertyName = fields?.propertyName || fields?.propertyId || "GA4 Export";

    if (!projectId) {
      pushAssistantMessage(
        session,
        "BigQuery project ID is not configured. Go to Settings > Integrations > BigQuery to set it up.",
        "bigquery",
        "error"
      );
      return session;
    }

    if (!datasetId) {
      pushAssistantMessage(
        session,
        "BigQuery dataset is not configured. Select a GA4 property in Settings > Integrations > BigQuery.",
        "bigquery",
        "error"
      );
      return session;
    }

    let bqAccessToken: string;
    try {
      bqAccessToken = await getBQFreshToken(activeIntegration.id);
    } catch {
      pushAssistantMessage(
        session,
        "BigQuery is not authenticated or the session has expired. Click \"Connect with Google\" in Settings > Integrations > BigQuery.",
        "bigquery",
        "error"
      );
      return session;
    }

    try {
      const { summary, visual } = await runBigQueryAgentTurn(llmConfig, bqAccessToken, projectId, datasetId, propertyName, question);
      session.chat.push({
        id: randomUUID(),
        role: "assistant",
        content: summary,
        createdAt: new Date().toISOString(),
        source: "bigquery",
        status: "complete",
        ...(visual ? { visual } : {})
      });
    } catch (error) {
      console.error("BigQuery query failed", {
        question,
        projectId,
        message: error instanceof Error ? error.message : String(error)
      });
      pushAssistantMessage(
        session,
        error instanceof Error ? error.message : "The BigQuery query failed. Try rephrasing or check your connection.",
        "bigquery",
        "error"
      );
    }

    return session;
  }

  // ─── Unknown provider ─────────────────────────────────────────────────────

  pushAssistantMessage(
    session,
    "The active integration uses an unsupported provider. Go to Settings > Integrations to reconfigure.",
    undefined,
    "error"
  );
  return session;
}
