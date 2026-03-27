import { randomUUID } from "node:crypto";

import { runBigQueryExecution } from "@/lib/connectors/bigquery";
import { runPowerBIExecution } from "@/lib/connectors/powerbi";
import { planExecution } from "@/lib/planner";
import type { ChatMessage, SessionState } from "@/lib/types";

export async function handleQuestion(session: SessionState, question: string) {
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
      status: "complete",
      evidence: {
        source: plan.source,
        queryLanguage: plan.queryLanguage,
        queryText: plan.queryText,
        context: plan.context,
        filters: plan.filters,
        resultPreview: result.preview,
        report: result.report
      }
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
      status: "error",
      evidence: {
        source: plan.source,
        queryLanguage: plan.queryLanguage,
        queryText: plan.queryText,
        context: plan.context,
        filters: plan.filters,
        resultPreview: []
      }
    });
  }

  return session;
}
