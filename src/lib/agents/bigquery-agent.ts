// BigQuery analytics agent — translates natural-language questions into BigQuery SQL
// using tool/function calling, then summarizes results in natural language.
// Supports Anthropic, OpenAI, Google Gemini, and Mistral via raw fetch (no SDKs).
// Dataset is read from the integration's providerFields.datasetId. Uses the synchronous queries API.
//
// ⚠ Known limitation: sync queries API has a ~20s timeout. Not suitable for large
// datasets. Migrate to the BigQuery Jobs API (POST /projects/{id}/jobs) when queries
// exceed this limit. See README for details.

import { callLLMForSummaryStream, extractChartData, extractTableData } from "@/lib/agents/ga4-agent";
import type { StreamWriterFn, VisualData } from "@/lib/types";
import { writeSseEvent } from "@/lib/utils";
import type { LLMProvider } from "@/types/llm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface LLMToolResult {
  toolCall?: ToolCall;
  text?: string;
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

const RUN_BQ_QUERY_TOOL_NAME = "runBigQueryQuery";

function buildRunBqQuerySchema(projectId: string, datasetId: string) {
  return {
    name: RUN_BQ_QUERY_TOOL_NAME,
    description:
      "Execute a read-only BigQuery SQL query against the GA4 export dataset. " +
      "Use this to answer analytics questions with real data from BigQuery. " +
      "Always use standard SQL (useLegacySql is false). Always include a LIMIT clause.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description:
            `A read-only SQL query (SELECT or WITH only). Must reference tables as ` +
            `\`${projectId}.${datasetId}.events_*\` using the wildcard for all date partitions, ` +
            `or a specific date table like \`${projectId}.${datasetId}.events_20240101\`. ` +
            "Always include LIMIT (max 20 rows). Never use INSERT, UPDATE, DELETE, MERGE, DROP, ALTER, TRUNCATE, or CREATE."
        }
      },
      required: ["sql"]
    }
  };
}

// ─── Read-only query guard ─────────────────────────────────────────────────────

function isSafeReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  const blocked = ["INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "ALTER", "TRUNCATE", "CREATE"];
  return (
    (normalized.startsWith("SELECT") || normalized.startsWith("WITH")) &&
    !blocked.some((kw) => normalized.includes(kw))
  );
}

// ─── BigQuery sync query execution ────────────────────────────────────────────

async function executeBigQueryQuery(
  accessToken: string,
  projectId: string,
  sql: string
): Promise<{ columns: string[]; rows: Record<string, string | number | null>[] }> {
  if (!isSafeReadOnlyQuery(sql)) {
    throw new Error("Blocked: only read-only SELECT or WITH queries are allowed.");
  }

  const response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        timeoutMs: 20000,
        maxResults: 20
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = `BigQuery error ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch { /* use raw text */ }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    schema?: { fields?: Array<{ name: string }> };
    rows?: Array<{ f: Array<{ v: string | number | null }> }>;
    jobComplete?: boolean;
  };

  if (data.jobComplete === false) {
    throw new Error(
      "Query timed out (20s limit). This is a known limitation of the sync API. " +
      "Try a more specific query with a tighter date range."
    );
  }

  const columns = data.schema?.fields?.map((f) => f.name) ?? [];
  const rows = (data.rows ?? []).map((row) =>
    Object.fromEntries(
      row.f.map((cell, i) => [columns[i] ?? `col_${i}`, cell.v ?? null])
    )
  );

  return { columns, rows };
}

function formatRowsAsText(columns: string[], rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return "Query returned no rows.";
  const header = columns.join(" | ");
  const separator = columns.map(() => "---").join(" | ");
  const dataRows = rows.map((row) => columns.map((c) => String(row[c] ?? "")).join(" | "));
  return [header, separator, ...dataRows].join("\n");
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(projectId: string, datasetId: string, propertyName: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `You are an analytics assistant with access to a BigQuery GA4 export dataset.
Today's date is ${today}.

ACTIVE SOURCE: BigQuery
  GCP Project: ${projectId}
  Dataset: ${datasetId}
  GA4 Property: ${propertyName}

QUERYING:
- Use the runBigQueryQuery tool to fetch data from BigQuery
- Table pattern: \`${projectId}.${datasetId}.events_*\` (wildcard for all dates)
- For a specific date: \`${projectId}.${datasetId}.events_YYYYMMDD\`
- Always use standard SQL (useLegacySql: false)
- Always include a LIMIT clause (max 20 rows)
- For date filtering use: WHERE _TABLE_SUFFIX BETWEEN 'YYYYMMDD' AND 'YYYYMMDD'
  or: WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY))

COMMON PATTERNS:
  Event counts:       SELECT event_name, COUNT(*) as count FROM \`${projectId}.${datasetId}.events_*\` GROUP BY event_name ORDER BY count DESC LIMIT 10
  Sessions by date:   SELECT event_date, COUNT(DISTINCT (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'ga_session_id')) as sessions FROM \`${projectId}.${datasetId}.events_*\` GROUP BY event_date ORDER BY event_date DESC LIMIT 30
  Recent events:      SELECT event_date, event_name, COUNT(*) as count FROM \`${projectId}.${datasetId}.events_*\` WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)) GROUP BY event_date, event_name ORDER BY event_date DESC, count DESC LIMIT 20

DO NOT use the GA4 Data API or runGA4Report — use SQL only.
For conceptual questions, answer from your knowledge without calling any tool.

CHART RENDERING RULE:
- When the query includes a date column, ALWAYS alias it as \`date\`: SELECT event_date AS date, ...
- This alias is REQUIRED — without it, no chart will render.
- Include \`event_date AS date\` whenever the user asks about trends, by day, over time, or across a date range.

TABLE RENDERING RULE:
- A table will render automatically when the result has a non-date dimension (e.g. country, channel, device).
- When a chart or table will render, keep your final summary to 1–2 sentences. Do NOT narrate individual rows or data points.`;
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error = new Error("Request failed");
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const retryAfter = res.headers.get("Retry-After");
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : Math.min(1000 * 2 ** attempt, 16000);
    lastError = new Error(`Rate limited (429). Retrying after ${Math.round(waitMs / 1000)}s…`);
    if (attempt < maxRetries - 1) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  throw lastError;
}

// ─── LLM provider dispatchers ─────────────────────────────────────────────────

async function callAnthropic(config: LLMConfig, messages: Message[], schema: ReturnType<typeof buildRunBqQuerySchema>): Promise<LLMToolResult> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 1024,
    tools: [{ name: schema.name, description: schema.description, input_schema: schema.parameters }],
    messages: chatMessages.map((m) => ({ role: m.role, content: m.content }))
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Anthropic API error ${res.status}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: "text"; text: string } | { type: "tool_use"; name: string; input: Record<string, unknown> }>;
  };

  for (const block of data.content) {
    if (block.type === "tool_use" && block.name === RUN_BQ_QUERY_TOOL_NAME) {
      return { toolCall: { name: block.name, arguments: block.input } };
    }
  }
  const textBlock = data.content.find((b) => b.type === "text");
  return { text: textBlock?.type === "text" ? textBlock.text : "" };
}

async function callOpenAI(config: LLMConfig, messages: Message[], schema: ReturnType<typeof buildRunBqQuerySchema>): Promise<LLMToolResult> {
  const body = {
    model: config.model,
    max_tokens: 1024,
    tools: [{ type: "function", function: schema }],
    tool_choice: "auto",
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  };

  const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `OpenAI API error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
  };

  const msg = data.choices[0]?.message;
  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0].function;
    return { toolCall: { name: tc.name, arguments: JSON.parse(tc.arguments) as Record<string, unknown> } };
  }
  return { text: msg?.content ?? "" };
}

async function callGemini(config: LLMConfig, messages: Message[], schema: ReturnType<typeof buildRunBqQuerySchema>): Promise<LLMToolResult> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    contents: chatMessages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    tools: [{ functionDeclarations: [schema] }],
    generationConfig: { maxOutputTokens: 1024 }
  };
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Gemini API error ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{ content: { parts: Array<{ text: string } | { functionCall: { name: string; args: Record<string, unknown> } }> } }>;
  };

  const parts = data.candidates[0]?.content?.parts ?? [];
  for (const part of parts) {
    if ("functionCall" in part && part.functionCall.name === RUN_BQ_QUERY_TOOL_NAME) {
      return { toolCall: { name: part.functionCall.name, arguments: part.functionCall.args } };
    }
  }
  const textPart = parts.find((p): p is { text: string } => "text" in p);
  return { text: textPart?.text ?? "" };
}

async function callMistral(config: LLMConfig, messages: Message[], schema: ReturnType<typeof buildRunBqQuerySchema>): Promise<LLMToolResult> {
  const body = {
    model: config.model,
    max_tokens: 1024,
    tools: [{ type: "function", function: schema }],
    tool_choice: "auto",
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  };

  const res = await fetchWithRetry("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    const errMsg = (data.error as unknown as { message?: string })?.message;
    throw new Error(errMsg ?? `Mistral API error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content?: string; tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
  };

  const msg = data.choices[0]?.message;
  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0].function;
    return { toolCall: { name: tc.name, arguments: JSON.parse(tc.arguments) as Record<string, unknown> } };
  }
  return { text: msg?.content ?? "" };
}

async function callLLMWithTools(config: LLMConfig, messages: Message[], schema: ReturnType<typeof buildRunBqQuerySchema>): Promise<LLMToolResult> {
  switch (config.provider) {
    case "anthropic": return callAnthropic(config, messages, schema);
    case "openai":    return callOpenAI(config, messages, schema);
    case "google":    return callGemini(config, messages, schema);
    case "mistral":   return callMistral(config, messages, schema);
  }
}

// ─── Summarization ────────────────────────────────────────────────────────────

async function callLLMForSummary(config: LLMConfig, messages: Message[]): Promise<string> {
  switch (config.provider) {
    case "anthropic": {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");
      const body: Record<string, unknown> = { model: config.model, max_tokens: 512, messages: chatMessages.map((m) => ({ role: m.role, content: m.content })) };
      if (systemMsg) body.system = systemMsg.content;
      const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Anthropic summarization error ${res.status}`);
      const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
      return data.content.find((b) => b.type === "text")?.text ?? "";
    }
    case "openai":
    case "mistral": {
      const endpoint = config.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.mistral.ai/v1/chat/completions";
      const res = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: config.model, max_tokens: 512, messages: messages.map((m) => ({ role: m.role, content: m.content })) })
      });
      if (!res.ok) throw new Error(`${config.provider} summarization error ${res.status}`);
      const data = (await res.json()) as { choices: Array<{ message: { content?: string } }> };
      return data.choices[0]?.message.content ?? "";
    }
    case "google": {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");
      const body: Record<string, unknown> = {
        contents: chatMessages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: 512 }
      };
      if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg.content }] };
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) throw new Error(`Gemini summarization error ${res.status}`);
      const data = (await res.json()) as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
      return data.candidates[0]?.content.parts.find((p) => p.text)?.text ?? "";
    }
  }
}

// ─── Main agent entry point ───────────────────────────────────────────────────

export interface BigQueryAgentTurnResult {
  summary: string;
  visual?: VisualData;
}

export async function runBigQueryAgentTurn(
  llmConfig: LLMConfig,
  accessToken: string,
  projectId: string,
  datasetId: string,
  propertyName: string,
  question: string,
  writer?: StreamWriterFn
): Promise<BigQueryAgentTurnResult> {
  const schema = buildRunBqQuerySchema(projectId, datasetId);
  const systemPrompt = buildSystemPrompt(projectId, datasetId, propertyName);

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question }
  ];

  // Step 1: Ask LLM — it either calls the tool or answers directly
  const result = await callLLMWithTools(llmConfig, messages, schema);

  if (!result.toolCall) {
    return { summary: result.text || "I couldn't generate a response for that question." };
  }

  // Step 2: Execute the SQL
  if (writer) writeSseEvent(writer, { type: "progress", step: "querying" });
  const { sql } = result.toolCall.arguments as { sql: string };
  const { columns, rows } = await executeBigQueryQuery(accessToken, projectId, sql);
  const rawTable = formatRowsAsText(columns, rows);

  // Step 3: Detect chart / table from query results
  const coercedRows = rows.map((row) =>
    Object.fromEntries(columns.map((col) => [col, String(row[col] ?? "")]))
  );
  const chartData = extractChartData(coercedRows);
  const tableData = chartData ? undefined : extractTableData(coercedRows);
  const visual: VisualData | undefined = chartData
    ? { type: "chart", data: chartData }
    : tableData
      ? { type: "table", data: tableData }
      : undefined;

  // Step 4: Summarize — short prompt when a chart will render
  const summaryInstruction = chartData
    ? "A line chart will be rendered automatically for this data. Respond with only a 1–2 sentence insight about the trend — do not list individual data points."
    : "Based on the data above, provide a concise, human-readable insight that directly answers my question. Keep it to 1–3 sentences.";

  const summaryMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
    { role: "assistant", content: `I queried BigQuery and got:\n\n${rawTable}` },
    { role: "user", content: summaryInstruction }
  ];

  if (writer) writeSseEvent(writer, { type: "progress", step: "summarizing" });
  const summary = writer
    ? await callLLMForSummaryStream(llmConfig, summaryMessages, writer)
    : await callLLMForSummary(llmConfig, summaryMessages);
  return { summary: summary || rawTable, visual };
}
