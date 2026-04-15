import { randomUUID } from "node:crypto";

import { runBigQueryExecution } from "@/lib/connectors/bigquery";
import { runPowerBIExecution } from "@/lib/connectors/powerbi";
import { getIntegrationStatusSummaries } from "@/lib/integration-store";
import { planExecution } from "@/lib/planner";
import type { ChatMessage, SessionState, SourceId } from "@/lib/types";
import type { LLMProvider } from "@/types/llm";

export interface ChatContext {
  ga4PropertyId?: string | null;
  llmConfig?: { provider: LLMProvider; model: string; apiKey: string } | null;
}

const PROVIDER_TO_SOURCE: Record<string, SourceId> = {
  bigquery: "bigquery",
  powerbi: "powerbi"
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
  powerbi: "/settings/integrations/powerbi"
};

export async function handleQuestion(session: SessionState, question: string, context?: ChatContext) {
  // context.ga4PropertyId and context.llmConfig are available for GA4 queries and LLM-powered planning.
  // The rule-based planner is used as fallback when llmConfig is null.
  void context; // will be consumed by LLM planner in a future change
  const userMessage: ChatMessage = {
    id: randomUUID(),
    role: "user",
    content: question,
    createdAt: new Date().toISOString(),
    status: "complete"
  };

  session.chat.push(userMessage);

  const plan = planExecution(question, session);
  if (plan.clarification) {
    session.chat.push({
      id: randomUUID(),
      role: "assistant",
      content: plan.clarification,
      createdAt: new Date().toISOString(),
      status: "error"
    });
    return session;
  }

  // Check integration health before dispatching to a source
  const healthySources = getHealthySourceIds();
  const legacyConnected =
    session.connections[plan.source]?.status === "connected";

  if (!legacyConnected && !healthySources.has(plan.source)) {
    const providerName = plan.source === "powerbi" ? "Power BI" : "BigQuery";
    const settingsLink = PROVIDER_SETTINGS_LINKS[plan.source];
    session.chat.push({
      id: randomUUID(),
      role: "assistant",
      content: `${providerName} is not connected. Set it up in Settings > Integrations to use this source. (${settingsLink})`,
      createdAt: new Date().toISOString(),
      status: "error"
    });
    return session;
  }

  try {
    const result =
      plan.source === "bigquery"
        ? await runBigQueryExecution(session.connections.bigquery, plan)
        : await runPowerBIExecution(session.connections.powerbi, plan);

    session.chat.push({
      id: randomUUID(),
      role: "assistant",
      content: result.answer,
      createdAt: new Date().toISOString(),
      source: plan.source,
      status: "complete"
    });
  } catch (error) {
    session.chat.push({
      id: randomUUID(),
      role: "assistant",
      content:
        error instanceof Error
          ? error.message
          : "The source query failed. Check the selected connection and try again.",
      createdAt: new Date().toISOString(),
      source: plan.source,
      status: "error"
    });
  }

  return session;
}
