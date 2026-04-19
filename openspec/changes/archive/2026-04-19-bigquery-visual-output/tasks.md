## 1. Agent Return Type

- [x] 1.1 Add `visual?: VisualData` to `BigQueryAgentTurnResult` in `src/lib/agents/bigquery-agent.ts` and import `VisualData` from `@/lib/types`

## 2. System Prompt — Date Aliasing and Rendering Rules

- [x] 2.1 Add to `buildSystemPrompt` in `bigquery-agent.ts`: a `CHART RENDERING RULE` instructing the LLM to alias `event_date AS date` whenever including a date column (required for chart detection)
- [x] 2.2 Add `CHART RENDERING RULE` and `TABLE RENDERING RULE` to the system prompt matching the GA4 agent's wording: brief 1–2 sentence trend insight when a chart renders; no narration of individual rows

## 3. Visual Extraction in `runBigQueryAgentTurn`

- [x] 3.1 After `executeBigQueryQuery` returns `{ columns, rows }`, coerce BigQuery rows (`Record<string, string | number | null>[]`) to `Record<string, string>[]` by converting each value via `String(v ?? "0")` for numeric-looking keys and `String(v ?? "")` for others — or simply `String(v ?? "")` for all
- [x] 3.2 Import `extractChartData` and `extractTableData` from `@/lib/agents/ga4-agent` and call them on the coerced rows: `const chartData = extractChartData(coercedRows); const tableData = chartData ? undefined : extractTableData(coercedRows);`
- [x] 3.3 Build `const visual: VisualData | undefined = chartData ? { type: "chart", data: chartData } : tableData ? { type: "table", data: tableData } : undefined;`
- [x] 3.4 Update the summarization prompt: when `chartData` is defined, use the short chart-aware prompt ("A line chart will be rendered automatically. Respond with only a 1–2 sentence insight about the trend — do not list individual data points."); otherwise use the standard prompt
- [x] 3.5 Return `{ summary: summary || rawTable, visual }` from `runBigQueryAgentTurn`

## 4. Orchestrator

- [x] 4.1 In `src/lib/orchestrator.ts`, update the BigQuery agent call to destructure `visual`: `const { summary, visual } = await runBigQueryAgentTurn(...);`
- [x] 4.2 Spread `visual` onto the chat message: `...(visual ? { visual } : {})` — matching the existing GA4 message construction pattern

## 5. Spec Updates

- [x] 5.1 Update `openspec/specs/bigquery-connector/spec.md` — apply the MODIFIED requirements from the change delta spec (agent return type, date aliasing rule, summarization prompt rule)
- [x] 5.2 Update `openspec/specs/orchestrator-routing/spec.md` — apply the MODIFIED requirement for BigQuery visual attachment
