## Context

The chat interface renders all assistant replies as plain text via `MessageBubble`. When a user asks for a metric broken down by day (e.g. "show me sessions per day for the last 30 days"), the LLM today returns a verbose prose/table answer that is hard to read and wastes tokens describing numbers that a chart communicates instantly.

`ChatMessage` carries a `content: string` and a handful of metadata fields; there is no typed slot for structured data. The orchestrator calls `runGA4AgentTurn` and stores the raw LLM string reply as `content`. Token costs are already a concern — the app exposes LLM provider/model settings explicitly.

## Goals / Non-Goals

**Goals:**
- Render an interactive Recharts `LineChart` inline inside the assistant bubble when time-series data is returned.
- Minimise token overhead: chart data must travel as a compact JSON structure, not narrated prose.
- Zero new API routes; chart data is embedded in the existing `ChatMessage` payload.
- Keep the change isolated to: `ChatMessage` type, `MessageBubble` component, and the orchestrator/planner output layer.

**Non-Goals:**
- Supporting bar, pie, or other chart types in this change.
- Streaming / progressive chart rendering.
- Persisting chart images or exporting them.
- Changing how non-GA4 sources (BigQuery, PowerBI) format their replies — those are plain text for now.

## Decisions

### 1. Extend `ChatMessage` with an optional `chartData` field (not a new message type)

`ChatMessage` gets `chartData?: ChartDataPoint[]` where `ChartDataPoint = { date: string; value: number }`.

**Why**: avoids a discriminated union change that would cascade through every consumer of `ChatMessage`. A single optional field is backwards-compatible and serialises directly into the existing JSON persistence layer (`chat-store`). Consumers that don't know about `chartData` simply ignore it.

**Alternative considered**: a `type: "text" | "chart"` discriminated union. Rejected — too much surface area for a single chart type; the optional field achieves the same result with less churn.

### 2. Chart data is assembled in the orchestrator from GA4 query results, NOT by asking the LLM to emit JSON

When `runGA4AgentTurn` returns data that the GA4 query runner has already fetched (rows of `{ date, value }`), the orchestrator maps those rows directly into `chartData`. The LLM is only asked to produce a 1–2 sentence natural-language summary (`content`) — not to format or narrate the numbers.

**Why**: eliminates the biggest token risk. Asking the LLM to JSON-encode 30 data points costs ~200 extra output tokens per query. By extracting chart data from the structured GA4 API response (which we already have), the LLM only needs to say "Here are sessions per day over the last 30 days." (≈10 tokens). This is the key token-efficiency decision.

**Alternative considered**: embedding a `<chart>…</chart>` XML block in the LLM output and parsing it. Rejected — fragile, adds output tokens, and parsing errors degrade UX.

### 3. Detection logic: presence of `chartData` drives rendering, not message content parsing

`MessageBubble` checks `message.chartData?.length > 0` to decide whether to render a chart. No regex or intent-detection on the text string.

**Why**: deterministic, zero-cost, and never produces false positives.

### 4. Recharts is added as a client-only dependency; chart component is `"use client"`

The new `MetricLineChart` component lives in `src/components/ui/MetricLineChart.tsx` and is marked `"use client"`. It is only imported inside `MessageBubble` with a dynamic import (`next/dynamic`) so it is never included in the server bundle.

**Why**: Recharts is ~150 kB; keeping it out of the server bundle respects Next.js best practices and avoids SSR hydration issues with SVG.

### 5. Chart data time-series detection: look for GA4 responses that include `date` as a dimension

The orchestrator checks whether the GA4 response rows contain a `date` field (ISO `YYYYMMDD` format from the GA4 Data API). If yes, and if there is exactly one numeric metric alongside it, `chartData` is populated. Otherwise the message stays text-only.

## Risks / Trade-offs

- **GA4 date format** (`20240415`) must be normalised to `YYYY-MM-DD` for Recharts' X-axis tick formatter. → Mitigation: utility function `normaliseGA4Date` in the chart component.
- **Multiple metrics in one query** (e.g. sessions + pageviews by day) — current design only supports a single `value` field. → Mitigation: pick the first numeric metric column and note in the summary which metric is charted. Multi-series support is a follow-up.
- **Large datasets** (e.g. 365 days) render fine in Recharts but can slow initial paint. → Mitigation: cap at 365 points in the orchestrator; GA4 queries rarely exceed 90 days anyway.
- **Token increase for the natural-language summary**: minimal (single sentence). The LLM already produces a text reply; we're replacing a verbose table description with a short sentence.

## Migration Plan

1. Add `recharts` dependency (`npm install recharts`).
2. Extend `ChatMessage` type with optional `chartData` field.
3. Add `normaliseGA4Date` utility and `MetricLineChart` component.
4. Update `MessageBubble` to conditionally render `MetricLineChart`.
5. Update the orchestrator to populate `chartData` from GA4 rows when date + single metric are present.
6. Update the LLM system prompt hint to instruct the model to give a brief summary when chart data is present (saves tokens vs. full table narration).
7. No data migration needed — old persisted messages without `chartData` render as plain text unchanged.
