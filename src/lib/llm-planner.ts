// LLM analytics agent — translates natural-language questions into GA4 Data API
// calls using tool/function calling, then summarizes results in natural language.
// Supports Anthropic, OpenAI, Google Gemini, and Mistral via raw fetch (no SDKs).

import { formatMetadataForPrompt, getGA4Metadata, runGA4Report } from "@/lib/connectors/ga4";
import type { ChartData } from "@/lib/types";
import type { LLMProvider } from "@/types/llm";

// ─── Shared types ─────────────────────────────────────────────────────────────

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

// ─── GA4 tool schema ──────────────────────────────────────────────────────────

const RUN_GA4_REPORT_TOOL_NAME = "runGA4Report";

const RUN_GA4_REPORT_SCHEMA = {
  name: RUN_GA4_REPORT_TOOL_NAME,
  description:
    "Execute a Google Analytics 4 Data API report. Use this to answer analytics questions with real data from the user's GA4 property.",
  parameters: {
    type: "object",
    properties: {
      metrics: {
        type: "array",
        description: "GA4 metrics to include (e.g. sessions, activeUsers, screenPageViews, purchaseRevenue)",
        items: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      },
      dimensions: {
        type: "array",
        description: "GA4 dimensions to group by (e.g. country, city, deviceCategory, sessionSource)",
        items: {
          type: "object",
          properties: { name: { type: "string" } },
          required: ["name"]
        }
      },
      dateRanges: {
        type: "array",
        description: "Date ranges for the report. Use absolute dates in YYYY-MM-DD format (e.g. '2025-04-01') for specific date ranges, or relative values like 'today', 'yesterday', 'NdaysAgo' (e.g. '7daysAgo', '30daysAgo') for rolling windows. Prefer absolute dates when the user mentions specific dates or months.",
        items: {
          type: "object",
          properties: {
            startDate: { type: "string" },
            endDate: { type: "string" }
          },
          required: ["startDate", "endDate"]
        }
      },
      orderBys: {
        type: "array",
        description: "Sort order for the report results",
        items: {
          type: "object",
          properties: {
            metric: {
              type: "object",
              properties: { metricName: { type: "string" } },
              required: ["metricName"]
            },
            dimension: {
              type: "object",
              properties: { dimensionName: { type: "string" } },
              required: ["dimensionName"]
            },
            desc: { type: "boolean", description: "Sort descending if true" }
          }
        }
      },
      limit: {
        type: "number",
        description: "Maximum number of rows to return (default 10, max 20)"
      }
    },
    required: ["metrics", "dateRanges"]
  }
};

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error = new Error("Request failed");
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;

    // Respect Retry-After header if present, otherwise use exponential backoff
    const retryAfter = res.headers.get("Retry-After");
    const waitMs = retryAfter
      ? parseFloat(retryAfter) * 1000
      : Math.min(1000 * 2 ** attempt, 16000);

    lastError = new Error(`Rate limited (429). Retrying after ${Math.round(waitMs / 1000)}s…`);

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw lastError;
}

// ─── Provider-specific tool-call implementations ──────────────────────────────

async function callAnthropic(
  config: LLMConfig,
  messages: Message[],
): Promise<LLMToolResult> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 1024,
    tools: [
      {
        name: RUN_GA4_REPORT_SCHEMA.name,
        description: RUN_GA4_REPORT_SCHEMA.description,
        input_schema: RUN_GA4_REPORT_SCHEMA.parameters
      }
    ],
    messages: chatMessages.map((m) => ({ role: m.role, content: m.content }))
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Anthropic API error ${res.status}`);
  }

  const data = (await res.json()) as {
    content: Array<
      | { type: "text"; text: string }
      | { type: "tool_use"; name: string; input: Record<string, unknown> }
    >;
  };

  for (const block of data.content) {
    if (block.type === "tool_use" && block.name === RUN_GA4_REPORT_TOOL_NAME) {
      return { toolCall: { name: block.name, arguments: block.input } };
    }
  }

  const textBlock = data.content.find((b) => b.type === "text");
  return { text: textBlock?.type === "text" ? textBlock.text : "" };
}

async function callOpenAI(
  config: LLMConfig,
  messages: Message[],
): Promise<LLMToolResult> {
  const body = {
    model: config.model,
    max_tokens: 1024,
    tools: [{ type: "function", function: RUN_GA4_REPORT_SCHEMA }],
    tool_choice: "auto",
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  };

  const res = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `OpenAI API error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{
      message: {
        content?: string;
        tool_calls?: Array<{
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const msg = data.choices[0]?.message;
  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0].function;
    return {
      toolCall: {
        name: tc.name,
        arguments: JSON.parse(tc.arguments) as Record<string, unknown>
      }
    };
  }

  return { text: msg?.content ?? "" };
}

async function callGemini(
  config: LLMConfig,
  messages: Message[],
): Promise<LLMToolResult> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");

  const contents = chatMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));

  const body: Record<string, unknown> = {
    contents,
    tools: [{ functionDeclarations: [RUN_GA4_REPORT_SCHEMA] }],
    generationConfig: { maxOutputTokens: 1024 }
  };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  const res = await fetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Gemini API error ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{
      content: {
        parts: Array<
          | { text: string }
          | { functionCall: { name: string; args: Record<string, unknown> } }
        >;
      };
    }>;
  };

  const parts = data.candidates[0]?.content?.parts ?? [];
  for (const part of parts) {
    if ("functionCall" in part && part.functionCall.name === RUN_GA4_REPORT_TOOL_NAME) {
      return {
        toolCall: { name: part.functionCall.name, arguments: part.functionCall.args }
      };
    }
  }

  const textPart = parts.find((p): p is { text: string } => "text" in p);
  return { text: textPart?.text ?? "" };
}

async function callMistral(
  config: LLMConfig,
  messages: Message[],
): Promise<LLMToolResult> {
  const body = {
    model: config.model,
    max_tokens: 1024,
    tools: [{ type: "function", function: RUN_GA4_REPORT_SCHEMA }],
    tool_choice: "auto",
    messages: messages.map((m) => ({ role: m.role, content: m.content }))
  };

  const res = await fetchWithRetry("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    const errMsg = (data.error as unknown as { message?: string })?.message;
    throw new Error(errMsg ?? `Mistral API error ${res.status}`);
  }

  const data = (await res.json()) as {
    choices: Array<{
      message: {
        content?: string;
        tool_calls?: Array<{
          function: { name: string; arguments: string };
        }>;
      };
    }>;
  };

  const msg = data.choices[0]?.message;
  if (msg?.tool_calls?.length) {
    const tc = msg.tool_calls[0].function;
    return {
      toolCall: {
        name: tc.name,
        arguments: JSON.parse(tc.arguments) as Record<string, unknown>
      }
    };
  }

  return { text: msg?.content ?? "" };
}

// ─── Common dispatcher ────────────────────────────────────────────────────────

export async function callLLMWithTools(
  config: LLMConfig,
  messages: Message[],
): Promise<LLMToolResult> {
  switch (config.provider) {
    case "anthropic": return callAnthropic(config, messages);
    case "openai": return callOpenAI(config, messages);
    case "google": return callGemini(config, messages);
    case "mistral": return callMistral(config, messages);
  }
}

// ─── Summarization (plain LLM call, no tools) ────────────────────────────────

async function callLLMForSummary(config: LLMConfig, messages: Message[]): Promise<string> {
  switch (config.provider) {
    case "anthropic": {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");
      const body: Record<string, unknown> = {
        model: config.model,
        max_tokens: 512,
        messages: chatMessages.map((m) => ({ role: m.role, content: m.content }))
      };
      if (systemMsg) body.system = systemMsg.content;
      const res = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`Anthropic summarization error ${res.status}`);
      const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
      return data.content.find((b) => b.type === "text")?.text ?? "";
    }

    case "openai":
    case "mistral": {
      const endpoint = config.provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://api.mistral.ai/v1/chat/completions";
      const authHeader = { Authorization: `Bearer ${config.apiKey}` };
      const res = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: { ...authHeader, "content-type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 512,
          messages: messages.map((m) => ({ role: m.role, content: m.content }))
        })
      });
      if (!res.ok) throw new Error(`${config.provider} summarization error ${res.status}`);
      const data = (await res.json()) as { choices: Array<{ message: { content?: string } }> };
      return data.choices[0]?.message.content ?? "";
    }

    case "google": {
      const systemMsg = messages.find((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");
      const body: Record<string, unknown> = {
        contents: chatMessages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
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

// ─── GA4 Analytics Agent ──────────────────────────────────────────────────────

const MAX_ROWS_FOR_SUMMARY = 20;

function buildSystemPrompt(metadataBlock: string): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const metadataSection = metadataBlock
    ? `\n\nWhen calling runGA4Report, ONLY use metric and dimension apiNames from this list:\n\n${metadataBlock}`
    : "";

  return `You are an analytics assistant with access to a Google Analytics 4 property.
Today's date is ${today}.

For questions that require data (e.g. "how many sessions last week?", "top countries by revenue", "sessions between April 1 and April 10"):
- Use the runGA4Report tool to fetch real data from GA4
- When the user mentions specific dates or date ranges, convert them to YYYY-MM-DD format (e.g. "April 1" → "${new Date().getFullYear()}-04-01")
- Summarize the results in a concise, insightful natural-language response
- Default date range is last 28 days if not specified

METRIC NAME TRANSLATIONS — always map these common user terms to the correct GA4 apiName:
  "pageviews" / "page views" / "views"       → screenPageViews
  "sessions"                                  → sessions
  "users" / "visitors" / "active users"       → activeUsers
  "new users"                                 → newUsers
  "bounce rate"                               → bounceRate
  "revenue" / "purchase revenue"              → purchaseRevenue
  "conversions" / "transactions"              → transactions
  "engagement rate"                           → engagementRate
  "avg session duration" / "time on site"     → averageSessionDuration

MULTI-METRIC RULE — when the user asks for more than one metric, you MUST include ALL of them in the metrics array using the correct GA4 apiNames above. Never drop a metric the user explicitly requested.
Examples:
  - "sessions and pageviews by day"           → metrics: [{ name: "sessions" }, { name: "screenPageViews" }]
  - "revenue and transactions last month"     → metrics: [{ name: "purchaseRevenue" }, { name: "transactions" }]

CHART RENDERING RULE — whenever the user asks for a metric broken down over time, as a trend, by day, by week, or across a date range, you MUST include { "name": "date" } in the dimensions array of the runGA4Report tool call. The UI will automatically render a line chart — you do not need to narrate the individual numbers.
Examples that require date dimension:
  - "sessions per day last 30 days"           → metrics: [{ name: "sessions" }], dimensions: [{ name: "date" }]
  - "sessions and pageviews by day"           → metrics: [{ name: "sessions" }, { name: "screenPageViews" }], dimensions: [{ name: "date" }]
  - "show me traffic trend this month"        → dimensions: [{ name: "date" }]
  - "pageviews last 5 days"                   → metrics: [{ name: "screenPageViews" }], dimensions: [{ name: "date" }]
Examples that do NOT need date dimension:
  - "top 5 countries by sessions"             → no date dimension
  - "total revenue last month"                → no date dimension
  - "bounce rate by device category"          → no date dimension

For conceptual or definitional questions (e.g. "what is the difference between X and Y?", "explain metric Z", "how does GA4 calculate bounce rate?"):
- Answer directly from your knowledge without calling any tool${metadataSection}`;
}

const MAX_CHART_POINTS = 365;

export function normaliseGA4Date(raw: string): string {
  if (raw.length === 8 && /^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

export function extractChartData(rows: Record<string, string>[]): ChartData | undefined {
  if (!rows.length) return undefined;

  const keys = Object.keys(rows[0]);
  if (!keys.includes("date")) return undefined;

  const metrics = keys.filter((k) => k !== "date" && !isNaN(Number(rows[0][k])));
  if (metrics.length === 0) return undefined;

  const points = rows
    .slice(0, MAX_CHART_POINTS)
    .map((row) => {
      const point: Record<string, string | number> = { date: normaliseGA4Date(row["date"]) };
      for (const m of metrics) point[m] = Number(row[m]);
      return point;
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return points.length > 0 ? { points, metrics } : undefined;
}

// Deterministic mapping from natural-language terms users write → GA4 apiNames.
// Used to supplement the LLM's tool call when the LLM drops a metric the user
// explicitly requested (LLMs reliably pick a "primary" metric but sometimes omit
// secondary ones even when instructed).
const USER_TERM_TO_GA4_METRIC: Record<string, string> = {
  "pageview": "screenPageViews",
  "pageviews": "screenPageViews",
  "page view": "screenPageViews",
  "page views": "screenPageViews",
  "sessions": "sessions",
  "session": "sessions",
  "user": "activeUsers",
  "users": "activeUsers",
  "visitor": "activeUsers",
  "visitors": "activeUsers",
  "active user": "activeUsers",
  "active users": "activeUsers",
  "new user": "newUsers",
  "new users": "newUsers",
  "bounce rate": "bounceRate",
  "revenue": "purchaseRevenue",
  "purchase revenue": "purchaseRevenue",
  "conversion": "transactions",
  "conversions": "transactions",
  "transaction": "transactions",
  "transactions": "transactions",
  "engagement rate": "engagementRate",
};

function supplementMetrics(
  llmMetrics: Array<{ name: string }>,
  question: string
): Array<{ name: string }> {
  const lower = question.toLowerCase();
  const present = new Set(llmMetrics.map((m) => m.name));
  const extra: Array<{ name: string }> = [];
  for (const [term, apiName] of Object.entries(USER_TERM_TO_GA4_METRIC)) {
    if (!present.has(apiName) && lower.includes(term)) {
      extra.push({ name: apiName });
      present.add(apiName); // avoid duplicates if multiple terms map to the same metric
    }
  }
  return extra.length > 0 ? [...llmMetrics, ...extra] : llmMetrics;
}

export interface GA4AgentTurnResult {
  summary: string;
  rows?: Record<string, string>[];
}

export async function runGA4AgentTurn(
  llmConfig: LLMConfig,
  ga4AccessToken: string,
  propertyId: string,
  question: string
): Promise<GA4AgentTurnResult> {
  // Fetch property metadata (cached after first call) to ground the LLM in real metric/dimension names
  const metadata = await getGA4Metadata(ga4AccessToken, propertyId);
  const metadataBlock = formatMetadataForPrompt(metadata);
  const systemPrompt = buildSystemPrompt(metadataBlock);

  // Step 1: Send question to LLM with GA4 tool definition
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question }
  ];

  const result = await callLLMWithTools(llmConfig, messages);

  // Step 2: If LLM chose to answer directly (no tool call), return as-is
  if (!result.toolCall) {
    return { summary: result.text ?? "I couldn't generate an analytics response for that question." };
  }

  // Step 3: Execute the GA4 tool call
  const params = result.toolCall.arguments as {
    metrics: Array<{ name: string }>;
    dimensions?: Array<{ name: string }>;
    dateRanges?: Array<{ startDate: string; endDate: string }>;
    orderBys?: Array<{ metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }>;
    limit?: number;
  };

  // Supplement: add any metrics the user explicitly mentioned that the LLM dropped
  params.metrics = supplementMetrics(params.metrics, question);

  // For date-dimension queries the limit drives chart resolution.
  // Capped at 20 days during the testing phase to keep GA4 API usage and LLM
  // context size predictable while the chart feature is being validated.
  // Raise MAX_CHART_DAYS once the feature is stable and pagination is in place.
  const MAX_CHART_DAYS = 20;
  const hasDateDim = params.dimensions?.some((d) => d.name === "date") ?? false;
  const maxRows = hasDateDim ? MAX_CHART_DAYS : MAX_ROWS_FOR_SUMMARY;
  const limit = Math.min(params.limit ?? (hasDateDim ? MAX_CHART_DAYS : 10), maxRows);

  const { table: rawTable, rows } = await runGA4Report(ga4AccessToken, propertyId, {
    metrics: params.metrics,
    dimensions: params.dimensions,
    dateRanges: params.dateRanges ?? [{ startDate: "28daysAgo", endDate: "today" }],
    orderBys: params.orderBys,
    limit
  });

  // Step 4: Detect whether this result warrants a chart.
  const chartData = extractChartData(rows);
  const isChartQuery = chartData !== undefined;

  // Step 5: Send rows back to LLM for natural-language summarization
  const summarisationInstruction = isChartQuery
    ? "A line chart will be rendered automatically for this data. Respond with only a 1-2 sentence insight about the trend — do not list or narrate individual data points."
    : "Based on the data above, provide a concise, human-readable analytics insight that directly answers my question.";

  const summaryMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
    {
      role: "assistant",
      content: `I fetched the following data from GA4:\n\n${rawTable}`
    },
    {
      role: "user",
      content: summarisationInstruction
    }
  ];

  const summary = await callLLMForSummary(llmConfig, summaryMessages);
  return { summary: summary || rawTable, rows };
}
