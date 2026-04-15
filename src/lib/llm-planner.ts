// LLM analytics agent — translates natural-language questions into GA4 Data API
// calls using tool/function calling, then summarizes results in natural language.
// Supports Anthropic, OpenAI, Google Gemini, and Mistral via raw fetch (no SDKs).

import { formatMetadataForPrompt, getGA4Metadata, runGA4Report } from "@/lib/connectors/ga4";
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
        description: "Date ranges. Use relative values like '7daysAgo', '30daysAgo', 'yesterday', 'today'",
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

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  const res = await fetch(
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

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
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
      const res = await fetch("https://api.anthropic.com/v1/messages", {
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
      const res = await fetch(endpoint, {
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
      const res = await fetch(
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
  const metadataSection = metadataBlock
    ? `\n\nWhen calling runGA4Report, ONLY use metric and dimension apiNames from this list:\n\n${metadataBlock}`
    : "";

  return `You are an analytics assistant with access to a Google Analytics 4 property.

For questions that require data (e.g. "how many sessions last week?", "top countries by revenue"):
- Use the runGA4Report tool to fetch real data from GA4
- Summarize the results in a concise, insightful natural-language response
- Default date range is last 28 days if not specified

For conceptual or definitional questions (e.g. "what is the difference between X and Y?", "explain metric Z", "how does GA4 calculate bounce rate?"):
- Answer directly from your knowledge without calling any tool${metadataSection}`;
}

export async function runGA4AgentTurn(
  llmConfig: LLMConfig,
  ga4AccessToken: string,
  propertyId: string,
  question: string
): Promise<string> {
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
    return result.text ?? "I couldn't generate an analytics response for that question.";
  }

  // Step 3: Execute the GA4 tool call
  const params = result.toolCall.arguments as {
    metrics: Array<{ name: string }>;
    dimensions?: Array<{ name: string }>;
    dateRanges?: Array<{ startDate: string; endDate: string }>;
    orderBys?: Array<{ metric?: { metricName: string }; dimension?: { dimensionName: string }; desc?: boolean }>;
    limit?: number;
  };

  // Enforce row cap
  const limit = Math.min(params.limit ?? 10, MAX_ROWS_FOR_SUMMARY);

  const rawTable = await runGA4Report(ga4AccessToken, propertyId, {
    metrics: params.metrics,
    dimensions: params.dimensions,
    dateRanges: params.dateRanges ?? [{ startDate: "28daysAgo", endDate: "today" }],
    orderBys: params.orderBys,
    limit
  });

  // Step 4: Send rows back to LLM for natural-language summarization
  const summaryMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
    {
      role: "assistant",
      content: `I fetched the following data from GA4:\n\n${rawTable}`
    },
    {
      role: "user",
      content:
        "Based on the data above, provide a concise, human-readable analytics insight that directly answers my question."
    }
  ];

  const summary = await callLLMForSummary(llmConfig, summaryMessages);
  return summary || rawTable;
}
