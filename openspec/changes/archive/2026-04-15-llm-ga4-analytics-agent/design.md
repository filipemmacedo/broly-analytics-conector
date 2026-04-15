## Context

The app has a working chat UI, LLM configuration (Anthropic/OpenAI/Gemini/Mistral), and a GA4 OAuth connection — but none of these are connected. The orchestrator (`src/lib/orchestrator.ts`) already receives `llmConfig` and `ga4PropertyId` on every request but immediately discards them (`void context`). The planner (`src/lib/planner.ts`) is purely rule-based keyword matching with no GA4 execution path. GA4 is auth-proven (token flow tested via `analyticsdata.googleapis.com/metadata`) but has no Data API query connector.

The change introduces an LLM agent loop that replaces the planner for GA4 questions: the LLM receives a tool definition for the GA4 Data API, generates structured report parameters from the user's natural-language question, the connector executes the report, and the LLM writes a natural-language insight from the rows.

## Goals / Non-Goals

**Goals:**
- Users can ask free-form analytics questions (e.g. "top countries by revenue last month") and receive LLM-written summaries backed by live GA4 data
- Works with all four configured LLM providers (Anthropic, OpenAI, Google Gemini, Mistral) using their native tool/function calling APIs
- GA4 is the primary (and currently only) active source in this flow
- No new npm packages required — GA4 Data API is called via `fetch`; all 4 LLM SDKs are already installed

**Non-Goals:**
- BigQuery and Power BI are not modified in this change
- Multi-turn agentic loops (the agent calls exactly one GA4 tool per user question)
- Real-time GA4 reporting endpoint (standard `runReport` only for now)
- Streaming LLM responses to the chat UI

## Decisions

### 1. Single-turn tool call (not agentic loop)

The LLM makes one tool call per question. The LLM's training data includes GA4's full metric/dimension vocabulary, so it can generate correct API parameters without first calling `getMetadata`. An agentic multi-turn loop would add retry complexity and latency without meaningful quality gain for the common analytics question set.

**Alternative considered:** Multi-turn loop where LLM first fetches available metrics then builds the query. Rejected: adds 1-2 extra LLM round-trips and an extra GA4 API call per question; the LLM already knows GA4's schema.

### 2. Tool calling abstraction per LLM provider

Each of the 4 providers has a different tool/function calling API shape. A thin `callLLMWithTools(provider, model, apiKey, messages, tools)` abstraction in `src/lib/llm-planner.ts` normalizes the 4 SDKs to a common interface: send messages + tool defs → receive tool call arguments OR text response.

**Alternative considered:** Use only Anthropic SDK as canonical path. Rejected: user requirement is all 4 providers.

### 3. GA4 connector follows existing connector pattern

`src/lib/connectors/ga4.ts` mirrors the shape of `bigquery.ts` and `powerbi.ts`: takes an access token + a plan, calls the GA4 Data API (`POST /{propertyId}:runReport`), returns `{ answer: string }`. The LLM-generated parameters become the GA4 report body. The raw rows are formatted into a Markdown table and sent back to the LLM for summarization.

**Alternative considered:** Return raw rows to the UI directly. Rejected: UX goal is natural-language insight, not raw data dumps.

### 4. Orchestrator keeps rule-based fallback

If `llmConfig` is null (LLM not configured), the orchestrator falls back to the existing rule-based planner for BigQuery/Power BI. The GA4 path requires an LLM — if neither LLM nor GA4 is configured, the orchestrator returns a clear guidance message to the user.

### 5. SourceId extended to include "ga4"

`src/lib/types.ts` adds `"ga4"` to the `SourceId` union. The orchestrator's health check is extended to recognize GA4 integrations as a valid healthy source when a GA4 property is selected.

## Risks / Trade-offs

- **Token cost per query** — every chat message that hits GA4 makes at least 2 LLM calls (plan + summarize). For high-volume usage this compounds. → Mitigation: acceptable for POC; can add caching later.
- **LLM generates bad GA4 params** — if the LLM hallucinates a metric name, the GA4 API returns a 400. → Mitigation: catch API errors and surface a clear message; the error is shown in chat.
- **OAuth token expiry** — GA4 access tokens expire after ~1 hour. → Mitigation: existing integration health check surfaces `expired` status; orchestrator returns a "reconnect" message in that case (existing pattern).
- **Provider tool-calling format differences** — Anthropic, OpenAI, Gemini, and Mistral all have slightly different tool-call schemas. → Mitigation: the `callLLMWithTools` abstraction isolates these differences in one place.

## Open Questions

- Should the GA4 result rows be sent back to the LLM for summarization, or should the LLM's tool-call response already include the summary request? (Recommended: two-step — execute tool, then ask LLM to summarize with the rows in context.)
- Should we expose the raw GA4 rows as a collapsible data table in the UI alongside the LLM summary, or text-only? (UI change, out of scope for this change but worth flagging.)
