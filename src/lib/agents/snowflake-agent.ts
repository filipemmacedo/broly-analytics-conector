// Snowflake analytics agent — translates natural-language questions into Snowflake SQL
// using tool/function calling, then summarizes results in natural language.
// Supports Anthropic, OpenAI, Google Gemini, and Mistral via raw fetch (no SDKs).
// Uses the Snowflake SQL API v2 (synchronous mode, 60s timeout).
//
// ⚠ Known limitation: sync mode has a 60s timeout. For long-running queries,
// the upgrade path is async polling via GET /api/v2/statements/<handle>.

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

// ─── Identifier quoting ───────────────────────────────────────────────────────

// Quote a Snowflake identifier when necessary.
// Snowflake INFORMATION_SCHEMA stores unquoted identifiers as UPPERCASE and
// quoted (case-sensitive) identifiers in their original case.
// Rules:
//   ALL_UPPER (or digits/$ only) → no quotes needed (Snowflake is case-insensitive for these)
//   lowercase / mixed-case       → must double-quote (was created with quotes, case-sensitive)
//   starts with digit            → must double-quote (otherwise parsed as a number literal)
//   contains non-word chars      → must double-quote
function qi(name: string): string {
  if (!name) return name;
  const needsQuotes =
    /^\d/.test(name) ||                   // starts with digit
    /[^A-Za-z0-9_$]/.test(name) ||        // special characters
    name !== name.toUpperCase();           // lowercase / mixed-case → case-sensitive identifier
  return needsQuotes ? `"${name.replace(/"/g, '""')}"` : name;
}

function qualifiedPrefix(database: string, schema: string): string {
  return schema ? `${qi(database)}.${qi(schema)}` : qi(database);
}

// ─── Schema introspection ─────────────────────────────────────────────────────

// System schemas that contain only Snowflake metadata — skip when listing user tables
const SYSTEM_SCHEMAS = new Set(["INFORMATION_SCHEMA"]);

async function runShowStatement(
  token: string,
  accountId: string,
  statement: string
): Promise<{ rowType: Array<{ name: string }>; rows: Array<Array<string>> }> {
  const res = await fetch(
    `https://${accountId}.snowflakecomputing.com/api/v2/statements`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({ statement, timeout: 30 }),
      cache: "no-store"
    }
  );

  if (!res.ok) {
    const text = await res.text();
    let msg = `Snowflake error (HTTP ${res.status})`;
    try { const j = JSON.parse(text) as { message?: string }; if (j.message) msg = j.message; } catch { /* raw */ }
    throw new Error(msg);
  }

  const data = (await res.json()) as {
    resultSetMetaData?: { rowType?: Array<{ name: string }> };
    data?: Array<Array<string>>;
  };
  return {
    rowType: data.resultSetMetaData?.rowType ?? [],
    rows: data.data ?? []
  };
}

function colIdx(rowType: Array<{ name: string }>, colName: string): number {
  const idx = rowType.findIndex((c) => c.name.toLowerCase() === colName.toLowerCase());
  return idx >= 0 ? idx : -1;
}

async function getSnowflakeSchemaMetadata(
  token: string,
  accountId: string,
  database: string,
  warehouse: string
): Promise<string> {
  try {
    // Step 1: Get table list via SHOW TERSE TABLES (metadata cache, no warehouse required)
    const { rowType, rows } = await runShowStatement(
      token,
      accountId,
      `SHOW TERSE TABLES IN DATABASE ${qi(database)}`
    );

    if (!rows.length) {
      return `__METADATA_ERROR__: No tables found in database ${database}. Make sure your PAT role has USAGE privilege on the database and its schemas.`;
    }

    const nameIdx   = colIdx(rowType, "name");
    const schemaIdx = colIdx(rowType, "schema_name");
    const dbIdx     = colIdx(rowType, "database_name");

    if (nameIdx < 0) {
      return `__METADATA_ERROR__: Unexpected SHOW TERSE TABLES response format.`;
    }

    // Collect unique user tables (skip system schemas)
    const tableRefs: Array<{ rawDb: string; rawSchema: string; rawTable: string }> = [];
    for (const row of rows) {
      const rawTable  = row[nameIdx]  ?? "";
      const rawSchema = schemaIdx >= 0 ? (row[schemaIdx] ?? "") : "";
      const rawDb     = dbIdx >= 0    ? (row[dbIdx]     ?? "") : database;
      if (!rawTable || SYSTEM_SCHEMAS.has(rawSchema.toUpperCase())) continue;
      tableRefs.push({ rawDb, rawSchema, rawTable });
    }

    if (!tableRefs.length) return "";

    // Step 2: Get column details from INFORMATION_SCHEMA.COLUMNS (requires SELECT privilege)
    // Now that the user has granted privileges, this should work.
    let colsByTable: Map<string, string[]> | null = null;
    try {
      const colRes = await runShowStatement(
        token,
        accountId,
        `SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
         FROM ${qi(database)}.INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA NOT ILIKE 'INFORMATION_SCHEMA'
         ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
         LIMIT 2000`
      );
      if (colRes.rows.length) {
        colsByTable = new Map();
        for (const row of colRes.rows) {
          const schema = row[0] ?? "";
          const table  = row[1] ?? "";
          const col    = row[2] ?? "";
          const dtype  = row[3] ?? "";
          const key = `${schema}.${table}`;
          if (!colsByTable.has(key)) colsByTable.set(key, []);
          colsByTable.get(key)!.push(`${col} (${dtype})`);
        }
      }
    } catch {
      // Column introspection failed — fall back to table names only
    }

    // Build the metadata block
    const lines: string[] = ["Available tables and columns (use EXACTLY these identifiers in SQL):"];
    for (const { rawDb, rawSchema, rawTable } of tableRefs) {
      const qualifiedTable = `${qi(rawDb)}.${qi(rawSchema)}.${qi(rawTable)}`;
      const cols = colsByTable?.get(`${rawSchema}.${rawTable}`);
      if (cols?.length) {
        lines.push(`  ${qualifiedTable}: ${cols.join(", ")}`);
      } else {
        lines.push(`  ${qualifiedTable}`);
      }
    }
    return lines.join("\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `__METADATA_ERROR__: ${msg}`;
  }
}

// ─── Tool schema ──────────────────────────────────────────────────────────────

const RUN_SNOWFLAKE_QUERY_TOOL_NAME = "runSnowflakeQuery";

function buildRunSnowflakeQuerySchema(database: string) {
  return {
    name: RUN_SNOWFLAKE_QUERY_TOOL_NAME,
    description:
      "Execute a read-only Snowflake SQL query. " +
      "Use this to answer analytics questions with real data from Snowflake. " +
      "Always use fully-qualified table references (database.schema.table) and include a LIMIT clause.",
    parameters: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description:
            `A read-only SQL query (SELECT or WITH only). ` +
            `Always reference tables as ${qi(database)}.<schema>.<table> using the exact identifiers from the SCHEMA section. ` +
            "Copy identifiers verbatim — lowercase names must be double-quoted (e.g. \"customers\"), UPPERCASE names need no quotes. " +
            "Always include LIMIT (max 20 rows). " +
            "Never use INSERT, UPDATE, DELETE, MERGE, DROP, ALTER, TRUNCATE, or CREATE. " +
            "Use Snowflake SQL syntax — not BigQuery or standard SQL."
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
  const readOnlyStarters = ["SELECT", "WITH", "SHOW", "DESCRIBE", "DESC", "EXPLAIN"];
  return (
    readOnlyStarters.some((kw) => normalized.startsWith(kw)) &&
    !blocked.some((kw) => new RegExp(`\\b${kw}\\b`).test(normalized))
  );
}

// ─── Snowflake SQL API execution ──────────────────────────────────────────────

async function executeSnowflakeQuery(
  token: string,
  accountId: string,
  database: string,
  schema: string,
  warehouse: string,
  sql: string
): Promise<{ columns: string[]; rows: Record<string, string | number | null>[] }> {
  if (!isSafeReadOnlyQuery(sql)) {
    throw new Error("Blocked: only read-only SELECT or WITH queries are allowed.");
  }

  const body: Record<string, unknown> = {
    statement: sql,
    timeout: 60,
    database: qi(database),
    schema: schema ? qi(schema) : undefined,
    warehouse: warehouse || undefined
  };

  const response = await fetch(
    `https://${accountId}.snowflakecomputing.com/api/v2/statements`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text();
    let message = `Snowflake error ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      if (parsed.message) message = parsed.message;
    } catch { /* use raw text */ }

    if (response.status === 408 || message.toLowerCase().includes("timeout")) {
      throw new Error(
        "Query timed out (60s limit). Try narrowing your query — add a date filter or reduce the row limit."
      );
    }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    resultSetMetaData?: { rowType?: Array<{ name: string; type: string }> };
    data?: Array<Array<string | null>>;
    statementStatusUrl?: string;
    message?: string;
  };

  // If async (shouldn't happen with timeout:60 on small results, but guard it)
  if (data.statementStatusUrl && !data.data) {
    throw new Error(
      "Query is still running (async). Try a more specific query with a tighter date range or smaller LIMIT."
    );
  }

  const columns = (data.resultSetMetaData?.rowType ?? []).map((f) => f.name);
  const rows = (data.data ?? []).map((row) =>
    Object.fromEntries(
      columns.map((col, i) => {
        const val = row[i];
        const numVal = val !== null && val !== "" ? Number(val) : NaN;
        return [col, !isNaN(numVal) ? numVal : val];
      })
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

function buildSystemPrompt(
  accountId: string,
  database: string,
  warehouse: string,
  schemaMetadata: string
): string {
  const today = new Date().toISOString().split("T")[0];
  const dbRef = qi(database);

  const isMetadataError = schemaMetadata.startsWith("__METADATA_ERROR__:");
  const metadataError = isMetadataError ? schemaMetadata.replace("__METADATA_ERROR__: ", "") : null;

  const metadataSection = isMetadataError
    ? `\nSCHEMA METADATA ERROR:\n- Could not load table metadata: ${metadataError}\n- Do NOT guess or invent table names. Tell the user the exact error above.\n- Do NOT call the runSnowflakeQuery tool.\n`
    : schemaMetadata
      ? `\nSCHEMA — only use tables and columns from this list:\n${schemaMetadata}\n\nSCHEMA EXPLORATION RULE:\n- If the user asks "what data is here?", "what tables exist?", "what columns do you have?", or similar — answer DIRECTLY from the SCHEMA section above without calling the tool.\n`
      : `\nNO SCHEMA METADATA AVAILABLE:\n- Could not load table metadata for database ${database}.\n- Do NOT guess or invent table names from your training data.\n- Tell the user: "I could not load the schema for this database. Check your Snowflake credentials and that your role has USAGE privilege on the database and its schemas."\n- Do NOT call the runSnowflakeQuery tool.\n`;

  return `You are an analytics assistant with access to a Snowflake data warehouse.
Today's date is ${today}.

ACTIVE CONNECTION:
  Account:   ${accountId}
  Database:  ${database}
  Warehouse: ${warehouse || "(using account default)"}
${metadataSection}
QUERYING:
- Use the runSnowflakeQuery tool to fetch data from Snowflake
- Always reference tables using the full path from the SCHEMA section: ${dbRef}.<schema>.<table>
- Always include a LIMIT clause (max 20 rows)
- Only SELECT and WITH statements are permitted

IDENTIFIER QUOTING RULE — CRITICAL:
- Copy identifiers EXACTLY as shown in the SCHEMA section — do not change casing.
- UPPERCASE identifiers (e.g. CUSTOMERS, PUBLIC) need no quotes — Snowflake is case-insensitive for these.
- lowercase/mixed-case identifiers (e.g. customers, mySchema) MUST be wrapped in double-quotes: "customers".
- Snowflake treats unquoted identifiers as uppercase, so \`customers\` → CUSTOMERS and the table won't be found.
- If any identifier starts with a digit, it also requires double-quotes.

SNOWFLAKE SQL DIALECT — use these, not BigQuery or standard SQL equivalents:
  Date arithmetic:    DATEADD(day, -7, CURRENT_DATE)          ← not DATE_SUB
  Date truncation:    DATE_TRUNC('month', my_date_col)
  Current date:       CURRENT_DATE  or  CURRENT_DATE()        ← both work in Snowflake
  Current timestamp:  CURRENT_TIMESTAMP()
  String to date:     TO_DATE('2024-01-01', 'YYYY-MM-DD')
  Date formatting:    TO_CHAR(my_date_col, 'YYYY-MM-DD')
  Last N days filter: WHERE my_date_col >= DATEADD(day, -N, CURRENT_DATE)

DATE GROUPING RULE — CRITICAL:
- Date columns are often stored as TIMESTAMP. Grouping by a raw TIMESTAMP produces one row per unique timestamp (i.e. the same calendar day repeated many times with count=1).
- ALWAYS convert to a date string before grouping:
    SELECT TO_CHAR(order_date, 'YYYY-MM-DD') AS date, COUNT(*) AS total
    FROM ...
    WHERE order_date >= DATEADD(day, -5, CURRENT_DATE)
    GROUP BY TO_CHAR(order_date, 'YYYY-MM-DD')   ← group by the expression, not the raw column
    ORDER BY date DESC
    LIMIT 20
- Never write GROUP BY raw_timestamp_col when the intent is to aggregate by day.
- Always repeat the TO_CHAR expression in GROUP BY (or use the positional alias GROUP BY 1).

DO NOT use:
  - DATE_SUB (BigQuery/MySQL syntax)
  - FORMAT_DATE (BigQuery syntax)
  - PARSE_DATE (BigQuery syntax)
  - Backtick identifiers — use double-quoted identifiers when quoting is needed
  - GROUP BY on a raw TIMESTAMP/DATE column when aggregating by day

HARD RULES — never break these:
  - ONLY reference tables listed in the SCHEMA section above. No exceptions.
  - NEVER invent table names (e.g. DATE_DIM, FACT_SALES, DIM_CUSTOMER) from your training data.
  - NEVER query tables from other databases (e.g. SNOWFLAKE_SAMPLE_DATA). Only use database: ${dbRef}.
  - If the SCHEMA section does not contain a table needed to answer the question, say so — do not guess.

CHART RENDERING RULE:
- When the query returns a date/time column, ALWAYS alias it as \`date\`: SELECT TO_CHAR(date_col, 'YYYY-MM-DD') AS date, ...
- This alias is REQUIRED — without it, no chart will render.
- Include a date alias whenever the user asks about trends, by day, over time, or across a date range.

TABLE RENDERING RULE:
- A table will render automatically when the result has a non-date string dimension (e.g. country, channel, category).
- When a chart or table will render, keep your summary to 1–2 sentences. Do NOT narrate individual rows or data points.

For conceptual questions (what is Snowflake, how does X work, etc.), answer from your knowledge without calling any tool.
For schema exploration questions (what tables/columns exist), answer from the SCHEMA section above without calling any tool.
If column names are not listed for a table, run SELECT * FROM <table> LIMIT 1 first to discover them before answering the user's question.`;
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

async function callAnthropic(
  config: LLMConfig,
  messages: Message[],
  schema: ReturnType<typeof buildRunSnowflakeQuerySchema>
): Promise<LLMToolResult> {
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
    if (block.type === "tool_use" && block.name === RUN_SNOWFLAKE_QUERY_TOOL_NAME) {
      return { toolCall: { name: block.name, arguments: block.input } };
    }
  }
  const textBlock = data.content.find((b) => b.type === "text");
  return { text: textBlock?.type === "text" ? textBlock.text : "" };
}

async function callOpenAI(
  config: LLMConfig,
  messages: Message[],
  schema: ReturnType<typeof buildRunSnowflakeQuerySchema>
): Promise<LLMToolResult> {
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

async function callGemini(
  config: LLMConfig,
  messages: Message[],
  schema: ReturnType<typeof buildRunSnowflakeQuerySchema>
): Promise<LLMToolResult> {
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
    if ("functionCall" in part && part.functionCall.name === RUN_SNOWFLAKE_QUERY_TOOL_NAME) {
      return { toolCall: { name: part.functionCall.name, arguments: part.functionCall.args } };
    }
  }
  const textPart = parts.find((p): p is { text: string } => "text" in p);
  return { text: textPart?.text ?? "" };
}

async function callMistral(
  config: LLMConfig,
  messages: Message[],
  schema: ReturnType<typeof buildRunSnowflakeQuerySchema>
): Promise<LLMToolResult> {
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

async function callLLMWithTools(
  config: LLMConfig,
  messages: Message[],
  schema: ReturnType<typeof buildRunSnowflakeQuerySchema>
): Promise<LLMToolResult> {
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

export interface SnowflakeAgentTurnResult {
  summary: string;
  visual?: VisualData;
}

export async function runSnowflakeAgentTurn(
  llmConfig: LLMConfig,
  token: string,
  accountId: string,
  database: string,
  warehouse: string,
  question: string,
  writer?: StreamWriterFn
): Promise<SnowflakeAgentTurnResult> {
  const querySchema = buildRunSnowflakeQuerySchema(database);

  // Fetch live schema metadata for ALL schemas in the database — LLM picks the right one
  const schemaMetadata = await getSnowflakeSchemaMetadata(token, accountId, database, warehouse);

  const systemPrompt = buildSystemPrompt(accountId, database, warehouse, schemaMetadata);

  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question }
  ];

  // Step 1: Ask LLM — it either calls the tool or answers directly
  const result = await callLLMWithTools(llmConfig, messages, querySchema);

  if (!result.toolCall) {
    return { summary: result.text || "I couldn't generate a response for that question." };
  }

  // Step 2: Execute the SQL
  if (writer) writeSseEvent(writer, { type: "progress", step: "querying" });
  const { sql } = result.toolCall.arguments as { sql: string };
  let columns: string[];
  let rows: Record<string, string | number | null>[];
  try {
    ({ columns, rows } = await executeSnowflakeQuery(token, accountId, database, "", warehouse, sql));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface Snowflake / network errors as readable agent responses
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return { summary: `Could not reach your Snowflake account (${accountId}). Check that your account identifier is correct and your network allows outbound HTTPS to *.snowflakecomputing.com.` };
    }
    return { summary: `Snowflake error: ${msg}` };
  }

  if (rows.length === 0) {
    // Let the LLM retry with a broader query rather than giving up.
    // The data may be from a fixed historical period (e.g. sample data from 2020).
    const retryMessages: Message[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
      {
        role: "assistant",
        content: `I ran this query:\n\n${sql}\n\nIt returned 0 rows. The data may be from a different time period than today. I should first check what date range the data covers, then re-answer the question using the actual date range in the data.`
      },
      {
        role: "user",
        content: "The query returned no rows — likely because the date filter references today but the data is historical. First run a query to find the MIN and MAX date in the relevant table, then use that range to answer the original question."
      }
    ];

    const retryResult = await callLLMWithTools(llmConfig, retryMessages, querySchema);
    if (!retryResult.toolCall) {
      return { summary: retryResult.text || "No data found. The table may be empty or the filters may not match the data." };
    }

    const { sql: retrySql } = retryResult.toolCall.arguments as { sql: string };
    try {
      ({ columns, rows } = await executeSnowflakeQuery(token, accountId, database, "", warehouse, retrySql));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { summary: `Snowflake error on retry: ${msg}` };
    }

    if (rows.length === 0) {
      return { summary: "No data found even after broadening the query. The table appears to be empty." };
    }
  }

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

  // Step 4: Summarize
  const summaryInstruction = chartData
    ? "A line chart will be rendered automatically for this data. Respond with only a 1–2 sentence insight about the trend — do not list individual data points."
    : tableData
      ? "A data table will be rendered for this result. Respond with only a 1–2 sentence insight about the data — do not list or narrate individual rows."
      : "Based on the data above, provide a concise, human-readable insight that directly answers my question. Keep it to 1–3 sentences.";

  const summaryMessages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: question },
    { role: "assistant", content: `I queried Snowflake and got:\n\n${rawTable}` },
    { role: "user", content: summaryInstruction }
  ];

  if (writer) writeSseEvent(writer, { type: "progress", step: "summarizing" });
  const summary = writer
    ? await callLLMForSummaryStream(llmConfig, summaryMessages, writer)
    : await callLLMForSummary(llmConfig, summaryMessages);
  return { summary: summary || rawTable, visual };
}
