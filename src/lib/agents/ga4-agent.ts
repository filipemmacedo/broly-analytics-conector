// GA4 analytics agent — translates natural-language questions into GA4 Data API
// calls using tool/function calling, then summarizes results in natural language.
// Supports Anthropic, OpenAI, Google Gemini, and Mistral via raw fetch (no SDKs).

import { formatMetadataForPrompt, getGA4Metadata, runGA4Report } from "@/lib/connectors/ga4";
import type { ChartData, StreamWriterFn, TableData, VisualData } from "@/lib/types";
import { writeSseEvent } from "@/lib/utils";
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
      },
      dimensionFilter: {
        type: "object",
        description: "Filter rows by dimension values. Use this whenever the user asks for specific dimension values (e.g. 'only Direct and Referral', 'just mobile', 'United States only'). Structure: { \"filter\": { \"fieldName\": \"<dimensionName>\", \"inListFilter\": { \"values\": [\"Value1\", \"Value2\"] } } }. For a single value use stringFilter instead: { \"filter\": { \"fieldName\": \"<dimensionName>\", \"stringFilter\": { \"value\": \"Value\", \"matchType\": \"EXACT\" } } }. Examples: filter sessionDefaultChannelGroup to Direct+Referral: { \"filter\": { \"fieldName\": \"sessionDefaultChannelGroup\", \"inListFilter\": { \"values\": [\"Direct\", \"Referral\"] } } }. Filter deviceCategory to mobile: { \"filter\": { \"fieldName\": \"deviceCategory\", \"stringFilter\": { \"value\": \"mobile\", \"matchType\": \"EXACT\" } } }."
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

// ─── Streaming summarization helpers (one per provider) ──────────────────────

async function* callAnthropicStream(config: LLMConfig, messages: Message[]): AsyncIterable<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const chatMessages = messages.filter((m) => m.role !== "system");
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 512,
    stream: true,
    messages: chatMessages.map((m) => ({ role: m.role, content: m.content }))
  };
  if (systemMsg) body.system = systemMsg.content;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic stream error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw) as { type: string; delta?: { type: string; text?: string } };
        if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta.text) {
          yield parsed.delta.text;
        }
      } catch { /* skip malformed lines */ }
    }
  }
}

async function* callOpenAIStream(config: LLMConfig, messages: Message[], endpoint: string): AsyncIterable<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 512,
      stream: true,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
  });
  if (!res.ok || !res.body) throw new Error(`${config.provider} stream error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        const parsed = JSON.parse(raw) as { choices: Array<{ delta: { content?: string } }> };
        const chunk = parsed.choices[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch { /* skip malformed lines */ }
    }
  }
}

async function* callGeminiStream(config: LLMConfig, messages: Message[]): AsyncIterable<string> {
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok || !res.body) throw new Error(`Gemini stream error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      try {
        const parsed = JSON.parse(raw) as { candidates: Array<{ content: { parts: Array<{ text?: string }> } }> };
        const text = parsed.candidates[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch { /* skip malformed lines */ }
    }
  }
}

export async function callLLMForSummaryStream(
  config: LLMConfig,
  messages: Message[],
  writer: StreamWriterFn
): Promise<string> {
  let accumulated = "";

  let stream: AsyncIterable<string>;
  if (config.provider === "anthropic") {
    stream = callAnthropicStream(config, messages);
  } else if (config.provider === "openai") {
    stream = callOpenAIStream(config, messages, "https://api.openai.com/v1/chat/completions");
  } else if (config.provider === "mistral") {
    stream = callOpenAIStream(config, messages, "https://api.mistral.ai/v1/chat/completions");
  } else {
    stream = callGeminiStream(config, messages);
  }

  for await (const chunk of stream) {
    accumulated += chunk;
    writeSseEvent(writer, { type: "text", delta: chunk });
  }

  return accumulated;
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
  const today = new Date().toISOString().split("T")[0];

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

TABLE RENDERING RULE — whenever the user asks for a breakdown by a non-time dimension (e.g. by country, device, channel, page, source), include that dimension in the dimensions array and do NOT include the date dimension. The UI will automatically render a data table — you do not need to narrate individual rows, only provide a 1-2 sentence insight.
Examples that require a non-date dimension (renders as table):
  - "top 5 countries by sessions"             → metrics: [{ name: "sessions" }], dimensions: [{ name: "country" }]
  - "sessions by device category"             → metrics: [{ name: "sessions" }], dimensions: [{ name: "deviceCategory" }]
  - "pageviews by channel"                    → metrics: [{ name: "screenPageViews" }], dimensions: [{ name: "sessionDefaultChannelGroup" }]
  - "bounce rate by page"                     → metrics: [{ name: "bounceRate" }], dimensions: [{ name: "pagePath" }]
Distinguishing chart from table:
  - "sessions by day"     → date dimension → line chart
  - "sessions by country" → country dimension → data table

FILTER RULE — when the user names specific dimension values (e.g. "only Direct and Referral", "just mobile", "United States only"), you MUST add a dimensionFilter to restrict results to exactly those values. Never return all values when the user asked for specific ones.
Examples:
  - "direct and referral sessions"            → dimensionFilter: { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: ["Direct", "Referral"] } } }
  - "only mobile sessions"                    → dimensionFilter: { filter: { fieldName: "deviceCategory", stringFilter: { value: "mobile", matchType: "EXACT" } } }
  - "sessions from United States"             → dimensionFilter: { filter: { fieldName: "country", stringFilter: { value: "United States", matchType: "EXACT" } } }

For conceptual or definitional questions (e.g. "what is the difference between X and Y?", "explain metric Z", "how does GA4 calculate bounce rate?"):
- Answer directly from your knowledge without calling any tool${metadataSection}`;
}

const MAX_CHART_POINTS = 365;

// ─── Date gap filling ─────────────────────────────────────────────────────────

function resolveGA4Date(date: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date === "today") return today.toISOString().split("T")[0];
  if (date === "yesterday") {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }
  const match = date.match(/^(\d+)daysAgo$/i);
  if (match) {
    const d = new Date(today);
    d.setDate(d.getDate() - parseInt(match[1], 10));
    return d.toISOString().split("T")[0];
  }
  return date; // already YYYY-MM-DD
}

function allDatesInRange(startDate: string, endDate: string): string[] {
  const start = new Date(resolveGA4Date(startDate));
  const end = new Date(resolveGA4Date(endDate));
  const dates: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// Fills dates GA4 omits when there is no activity, inserting zeros.
// Works for both simple (date + metrics) and pivot (date + group dim + metrics) layouts.
function fillMissingDates(
  rows: Record<string, string>[],
  startDate: string,
  endDate: string
): Record<string, string>[] {
  if (!rows.length) return rows;

  const keys = Object.keys(rows[0]);
  if (!keys.includes("date")) return rows;

  const metricKeys = keys.filter((k) => k !== "date" && !isNaN(Number(rows[0][k])));
  const dimKeys    = keys.filter((k) => k !== "date" &&  isNaN(Number(rows[0][k])));
  const allDates   = allDatesInRange(startDate, endDate);

  if (dimKeys.length === 0) {
    // Simple case — one row per date
    const existingDates = new Set(rows.map((r) => normaliseGA4Date(r["date"])));
    const filled = [...rows];
    for (const date of allDates) {
      if (!existingDates.has(date)) {
        const empty: Record<string, string> = { date };
        for (const m of metricKeys) empty[m] = "0";
        filled.push(empty);
      }
    }
    return filled;
  }

  // Pivot case — one row per date × group combination
  const groupKey    = dimKeys[0];
  const groupValues = [...new Set(rows.map((r) => r[groupKey]))];
  const existing    = new Set(rows.map((r) => `${normaliseGA4Date(r["date"])}|${r[groupKey]}`));
  const filled      = [...rows];
  for (const date of allDates) {
    for (const gv of groupValues) {
      if (!existing.has(`${date}|${gv}`)) {
        const empty: Record<string, string> = { date, [groupKey]: gv };
        for (const m of metricKeys) empty[m] = "0";
        filled.push(empty);
      }
    }
  }
  return filled;
}

export function normaliseGA4Date(raw: string): string {
  if (raw.length === 8 && /^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw;
}

export function extractTableData(rows: Record<string, string>[]): TableData | undefined {
  if (!rows.length) return undefined;

  const keys = Object.keys(rows[0]);
  const dimensions = keys.filter((k) => k !== "date" && isNaN(Number(rows[0][k])));
  if (dimensions.length === 0) return undefined;

  const metrics = keys.filter((k) => !isNaN(Number(rows[0][k])));
  const columns = [...dimensions, ...metrics];

  const tableRows = rows.map((row) => {
    const out: Record<string, string | number> = {};
    for (const d of dimensions) out[d] = row[d];
    for (const m of metrics) out[m] = Number(row[m]);
    return out;
  });

  return { columns, rows: tableRows };
}

export function extractChartData(rows: Record<string, string>[]): ChartData | undefined {
  if (!rows.length) return undefined;

  const keys = Object.keys(rows[0]);
  if (!keys.includes("date")) return undefined;

  // Numeric columns (metrics) — everything except "date" that parses as a number
  const numericKeys = keys.filter((k) => k !== "date" && !isNaN(Number(rows[0][k])));
  if (numericKeys.length === 0) return undefined;

  // String dimension columns — non-date, non-numeric (e.g. sessionDefaultChannelGroup)
  const dimKeys = keys.filter((k) => k !== "date" && isNaN(Number(rows[0][k])));

  // ── Simple case: no group dimension — one series per numeric metric ──────────
  if (dimKeys.length === 0) {
    const points = rows
      .slice(0, MAX_CHART_POINTS)
      .map((row) => {
        const point: Record<string, string | number> = { date: normaliseGA4Date(row["date"]) };
        for (const m of numericKeys) point[m] = Number(row[m]);
        return point;
      })
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    return points.length > 0 ? { points, metrics: numericKeys } : undefined;
  }

  // ── Pivot case: group dimension present (e.g. channel, device, country) ──────
  // Use the first string dimension as the pivot key, first numeric as the value.
  const groupKey = dimKeys[0];
  const valueKey = numericKeys[0];

  // Collect all unique group values (sorted for deterministic legend order)
  const groupValues = [...new Set(rows.map((r) => r[groupKey]))].sort();

  // Accumulate values by date × group
  const byDate = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const date = normaliseGA4Date(row["date"]);
    if (!byDate.has(date)) byDate.set(date, new Map());
    byDate.get(date)!.set(row[groupKey], Number(row[valueKey]));
  }

  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, MAX_CHART_POINTS)
    .map(([date, groups]) => {
      const point: Record<string, string | number> = { date };
      for (const gv of groupValues) point[gv] = groups.get(gv) ?? 0;
      return point;
    });

  return points.length > 0 ? { points, metrics: groupValues } : undefined;
}

// Deterministic mapping from natural-language terms users write → GA4 apiNames.
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
      present.add(apiName);
    }
  }
  return extra.length > 0 ? [...llmMetrics, ...extra] : llmMetrics;
}

export interface GA4AgentTurnResult {
  summary: string;
  visual?: VisualData;
}

export async function runGA4AgentTurn(
  llmConfig: LLMConfig,
  ga4AccessToken: string,
  propertyId: string,
  question: string,
  writer?: StreamWriterFn
): Promise<GA4AgentTurnResult> {
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
    return { summary: result.text || "I couldn't generate an analytics response for that question." };
  }

  // Step 3: Execute the GA4 tool call
  const params = result.toolCall.arguments as {
    metrics: Array<{ name: string }>;
    dimensions?: Array<{ name: string }>;
    dateRanges?: Array<{ startDate: string; endDate: string }>;
    orderBys?: Array<{ metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }>;
    limit?: number;
    dimensionFilter?: unknown;
  };

  params.metrics = supplementMetrics(params.metrics, question);

  const MAX_CHART_DAYS = 20;
  const hasDateDim = params.dimensions?.some((d) => d.name === "date") ?? false;
  const maxRows = hasDateDim ? MAX_CHART_DAYS : MAX_ROWS_FOR_SUMMARY;
  const limit = Math.min(params.limit ?? (hasDateDim ? MAX_CHART_DAYS : 10), maxRows);

  const dateRange = params.dateRanges?.[0] ?? { startDate: "28daysAgo", endDate: "today" };

  if (writer) writeSseEvent(writer, { type: "progress", step: "querying" });
  const { table: rawTable, rows: rawRows } = await runGA4Report(ga4AccessToken, propertyId, {
    metrics: params.metrics,
    dimensions: params.dimensions,
    dateRanges: [dateRange],
    orderBys: params.orderBys,
    dimensionFilter: params.dimensionFilter,
    limit
  });

  // Fill dates GA4 omitted (zero-activity days) so charts show the full range.
  const rows = hasDateDim
    ? fillMissingDates(rawRows, dateRange.startDate, dateRange.endDate)
    : rawRows;

  // Step 4: Short-circuit for empty results — no LLM summarization needed.
  if (rows.length === 0) {
    return { summary: "No data found for this query in the selected date range. The property may have no recorded activity, or the metric and dimension combination may not apply." };
  }

  // Step 5: Detect whether this result warrants a chart or table.
  const chartData = extractChartData(rows);
  const tableData = chartData === undefined ? extractTableData(rows) : undefined;
  const isChartQuery = chartData !== undefined;
  const isTableQuery = tableData !== undefined;

  // Step 6: Send rows back to LLM for natural-language summarization
  const summarisationInstruction = isChartQuery
    ? "A line chart will be rendered automatically for this data. Respond with only a 1-2 sentence insight about the trend — do not list or narrate individual data points."
    : isTableQuery
      ? "A data table will be rendered for this result. Respond with only a 1-2 sentence insight about the data — do not list or narrate individual rows."
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

  if (writer) writeSseEvent(writer, { type: "progress", step: "summarizing" });
  const summary = writer
    ? await callLLMForSummaryStream(llmConfig, summaryMessages, writer)
    : await callLLMForSummary(llmConfig, summaryMessages);

  // Step 7: Build visual payload
  const visual: VisualData | undefined = chartData
    ? { type: "chart", data: chartData }
    : tableData
      ? { type: "table", data: tableData }
      : undefined;

  return { summary: summary || rawTable, visual };
}
