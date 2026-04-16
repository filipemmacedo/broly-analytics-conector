import { randomUUID } from "node:crypto";

import { runBigQueryExecution } from "@/lib/connectors/bigquery";
import { runPowerBIExecution } from "@/lib/connectors/powerbi";
import { getIntegrationStatusSummaries } from "@/lib/integration-store";
import { extractChartData, runGA4AgentTurn } from "@/lib/llm-planner";
import { planExecution } from "@/lib/planner";
import type { ChatMessage, SessionState, SourceId } from "@/lib/types";
import type { LLMProvider } from "@/types/llm";

export interface ChatContext {
  ga4PropertyId?: string | null;
  ga4AccessToken?: string | null;
  llmConfig?: { provider: LLMProvider; model: string; apiKey: string } | null;
}

const PROVIDER_TO_SOURCE: Record<string, SourceId> = {
  bigquery: "bigquery",
  powerbi: "powerbi",
  "google-analytics": "ga4"
};

function getHealthySourceIds(): Set<SourceId> {
  const summaries = getIntegrationStatusSummaries();
  const healthy = new Set<SourceId>();
  for (const s of summaries) {
    const sourceId = PROVIDER_TO_SOURCE[s.provider];
    if (sourceId && s.status === "configured" && (s.healthState === "healthy" || s.healthState === "unknown")) {
      healthy.add(sourceId);
    }
  }
  return healthy;
}

const PROVIDER_SETTINGS_LINKS: Record<SourceId, string> = {
  bigquery: "/settings/integrations/bigquery",
  powerbi: "/settings/integrations/powerbi",
  ga4: "/settings/integrations/google-analytics"
};

const PROVIDER_DISPLAY_NAMES: Record<SourceId, string> = {
  bigquery: "BigQuery",
  powerbi: "Power BI",
  ga4: "Google Analytics"
};

const GENERIC_GA4_QUERY_ERROR =
  "I couldn't complete that Google Analytics query. Please try rephrasing it or check the selected GA4 property and date range.";

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
  const { ga4PropertyId, ga4AccessToken, llmConfig } = context ?? {};

  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
    status: "complete"
  };
  session.chat.push(userMessage);

  // ─── GA4 path (LLM-powered analytics agent) ───────────────────────────────

  const healthySources = getHealthySourceIds();

  if (healthySources.has("ga4") || ga4PropertyId) {
    if (!llmConfig) {
      pushAssistantMessage(
        session,
        "An LLM must be configured to query Google Analytics. Go to Settings > LLM to set up a provider.",
        "ga4",
        "error"
      );
      return session;
    }

    if (!ga4PropertyId) {
      pushAssistantMessage(
        session,
        "No GA4 property selected. Go to Settings > Integrations > Google Analytics to select a property.",
        "ga4",
        "error"
      );
      return session;
    }

    if (!ga4AccessToken) {
      pushAssistantMessage(
        session,
        "Google Analytics is not connected. Set it up in Settings > Integrations to use this source. (/settings/integrations/google-analytics)",
        "ga4",
        "error"
      );
      return session;
    }

    try {
      const { summary, rows } = await runGA4AgentTurn(llmConfig, ga4AccessToken, ga4PropertyId, question);
      const chartData = rows ? extractChartData(rows) : undefined;
      const message: ChatMessage = {
        id: randomUUID(),
        role: "assistant",
        content: summary,
        createdAt: new Date().toISOString(),
        source: "ga4",
        status: "complete",
        ...(chartData ? { chartData } : {})
      };
      session.chat.push(message);
    } catch (error) {
      console.error("GA4 query failed", {
        question,
        propertyId: ga4PropertyId,
        message: error instanceof Error ? error.message : String(error)
      });

      pushAssistantMessage(
        session,
        GENERIC_GA4_QUERY_ERROR,
        "ga4",
        "error"
      );
    }

    return session;
  }

  // ─── BigQuery / Power BI path (rule-based planner) ────────────────────────

  const plan = planExecution(question, session);
  if (plan.clarification) {
    pushAssistantMessage(session, plan.clarification, undefined, "error");
    return session;
  }

  const legacyConnected =
    plan.source !== "ga4" && session.connections[plan.source as "bigquery" | "powerbi"]?.status === "connected";

  if (!legacyConnected && !healthySources.has(plan.source)) {
    const providerName = PROVIDER_DISPLAY_NAMES[plan.source];
    const settingsLink = PROVIDER_SETTINGS_LINKS[plan.source];
    pushAssistantMessage(
      session,
      `${providerName} is not connected. Set it up in Settings > Integrations to use this source. (${settingsLink})`,
      plan.source,
      "error"
    );
    return session;
  }

  try {
    const result =
      plan.source === "bigquery"
        ? await runBigQueryExecution(session.connections.bigquery, plan)
        : await runPowerBIExecution(session.connections.powerbi, plan);

    pushAssistantMessage(session, result.answer, plan.source, "complete");
  } catch (error) {
    pushAssistantMessage(
      session,
      error instanceof Error ? error.message : "The source query failed. Check the selected connection and try again.",
      plan.source,
      "error"
    );
  }

  return session;
}
