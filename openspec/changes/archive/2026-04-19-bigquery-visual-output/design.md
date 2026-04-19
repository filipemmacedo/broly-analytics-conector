## Context

The GA4 agent already has a complete visual pipeline: `extractChartData` / `extractTableData` analyse query rows and produce a `VisualData` discriminated union (`{ type: "chart" }` or `{ type: "table" }`). The orchestrator attaches this to the chat message; `MessageBubble` renders it automatically. BigQuery uses identical infrastructure but never wires up the final few steps — `runBigQueryAgentTurn` returns only `{ summary: string }` and the orchestrator never spreads a `visual` field onto the BigQuery message.

One non-obvious constraint: `extractChartData` detects time-series by looking for a column named exactly `"date"`. BigQuery GA4 exports store the date in `event_date`. Without aliasing, no chart will ever be detected.

## Goals / Non-Goals

**Goals:**
- BigQuery chat messages render `MetricLineChart` for time-series queries and `MetricTable` for dimensional queries — identical to GA4
- The system prompt instructs the LLM to alias `event_date AS date` in every query that includes a date column, so `extractChartData` can detect it
- The LLM receives a short-summary instruction when a chart will render (same as GA4)
- `BigQueryAgentTurnResult` adds `visual?: VisualData`

**Non-Goals:**
- New visualization types beyond chart and table
- Changes to `extractChartData`, `extractTableData`, or `MetricLineChart`/`MetricTable` components — they are reused as-is
- Changing the BigQuery SQL execution pipeline

## Decisions

### D1: Alias `event_date AS date` via the system prompt, not code

**Decision:** The system prompt gains an explicit rule: "When the query includes `event_date`, always alias it as `date` (e.g. `SELECT event_date AS date, ...`). This is required for chart rendering."

**Alternatives considered:**
- Post-process rows server-side to rename `event_date` → `date` before calling `extractChartData` → works but hides intent from the LLM; LLM may still omit `event_date` entirely.
- Create a BigQuery-specific `extractChartData` that checks `event_date` instead of `date` → forks shared logic, creates maintenance burden.

**Rationale:** Instructing the LLM is the correct layer. The LLM controls the SQL it writes; if it knows aliasing is required for rendering, it will do it consistently. Matches the GA4 approach where the system prompt instructs the LLM to include a `date` dimension for time-series.

---

### D2: Row type coercion before calling extract functions

**Decision:** BigQuery rows are typed `Record<string, string | number | null>[]`. The GA4 extract functions expect `Record<string, string>[]`. Before calling them, coerce rows by converting all values to strings (`String(v ?? "")`).

**Alternatives considered:**
- Widen the `extractChartData` / `extractTableData` signatures → touches shared code, broader blast radius.

**Rationale:** One-line coercion at the call site in `runBigQueryAgentTurn`. Zero shared-code changes.

---

### D3: Summarization prompt shortened for chart queries (mirror GA4)

**Decision:** After detecting `isChartQuery`, the summary prompt sent to the LLM changes to: "A line chart will be rendered automatically. Respond with only a 1–2 sentence trend insight — do not list individual data points." This matches the GA4 agent behaviour exactly.

**Rationale:** Without this, the LLM narrates all the rows in detail even though a chart is rendering them visually — redundant and verbose.

## Risks / Trade-offs

**[LLM forgets to alias `event_date`]** → `extractChartData` returns `undefined`, no chart renders, the response falls through to plain text. The response is still correct — just not visualised. Mitigation: explicit system prompt rule.

**[Null values in BigQuery rows]** → BigQuery may return `null` for missing metric values. The coercion `String(v ?? "")` produces `""`, which `isNaN(Number(""))` is `true` — so empty strings are treated as non-numeric dimensions. This could misclassify columns. Mitigation: use `v == null ? "0" : String(v)` for numeric-looking columns. Acceptable: rare edge case; the LLM is instructed to use `LIMIT` and specific columns.

## Migration Plan

1. Update `buildSystemPrompt` in `bigquery-agent.ts` to add `event_date AS date` aliasing rule and chart/table rendering instructions
2. Add `visual?: VisualData` to `BigQueryAgentTurnResult`
3. In `runBigQueryAgentTurn`: coerce rows, call `extractChartData` / `extractTableData`, adjust summary prompt for chart queries, return `visual`
4. In `orchestrator.ts`: destructure `visual`, spread onto BigQuery chat message

No data migrations. No breaking changes. Rollback: revert the two files.
