## 1. Type System

- [x] 1.1 Add `TableData` type to `src/lib/types.ts`: `{ columns: string[]; rows: Record<string, string | number>[] }`
- [x] 1.2 Add `VisualData` discriminated union to `src/lib/types.ts`: `{ type: 'chart'; data: ChartData } | { type: 'table'; data: TableData }`
- [x] 1.3 Replace `chartData?: ChartData` with `visual?: VisualData` on the `ChatMessage` interface in `src/lib/types.ts`

## 2. Migration

- [x] 2.1 In `src/lib/chat-store.ts`, add coerce-on-load: when deserialising a `ChatMessage`, if `chartData` is present and `visual` is absent, set `visual = { type: 'chart', data: chartData }` and remove `chartData`

## 3. Detection Logic

- [x] 3.1 Add `extractTableData(rows: Record<string, string>[])` pure function in `src/lib/llm-planner.ts` — returns `TableData` if rows have at least one non-date, non-numeric column; returns `undefined` otherwise
- [x] 3.2 Ensure columns in the returned `TableData` are ordered dimensions-first, metrics-last
- [x] 3.3 Ensure metric values are coerced from string to number in `TableData.rows`

## 4. Agent Turn Update

- [x] 4.0 Add `TABLE RENDERING RULE` section to `buildSystemPrompt` in `src/lib/llm-planner.ts`, mirroring the existing `CHART RENDERING RULE` format:
  - Explain that including a non-date dimension triggers automatic table rendering — the LLM should not narrate individual rows
  - Include positive examples: "top 5 countries by sessions" → `dimensions: [{ name: "country" }]`, "sessions by device category" → `dimensions: [{ name: "deviceCategory" }]`
  - Include a negative example distinguishing table from chart: "sessions by day" → use `date` dimension (chart), not `deviceCategory` (table)
- [x] 4.1 In `runGA4AgentTurn` (`src/lib/llm-planner.ts`), after calling `extractChartData`, call `extractTableData` only when `chartData` is undefined
- [x] 4.2 Add `isTableQuery` boolean and a new summarisation instruction branch: `"A data table will be rendered for this result. Respond with only a 1-2 sentence insight about the data — do not list or narrate individual rows."`
- [x] 4.3 Return `visual: { type: 'chart', data: chartData }` when chart is detected, `visual: { type: 'table', data: tableData }` when table is detected, and no visual field for scalar results

## 5. Orchestrator

- [x] 5.1 In `src/lib/orchestrator.ts`, update the GA4 path: spread `visual` (instead of `chartData`) onto the `ChatMessage` constructed from `runGA4AgentTurn` result

## 6. MetricTable Component

- [x] 6.1 Create `src/components/ui/MetricTable.tsx` with CSS class prefix `metric-table`
- [x] 6.2 Render `TableData.columns` as `<th>` headers; render `TableData.rows` as `<tr><td>` rows
- [x] 6.3 Left-align dimension columns, right-align metric columns (detect by whether the first row value is a number)
- [x] 6.4 Format metric values using `Intl.NumberFormat` (e.g. `1234567` → `"1,234,567"`)
- [x] 6.5 Return `null` when `TableData.rows` is empty

## 7. MessageBubble

- [x] 7.1 In `src/components/ui/MessageBubble.tsx`, import `MetricTable` via `next/dynamic` with `ssr: false`
- [x] 7.2 Replace the `message.chartData` conditional with a switch on `message.visual?.type`: `'chart'` → `<MetricLineChart data={message.visual.data} />`, `'table'` → `<MetricTable data={message.visual.data} />`

## 8. Verification

- [x] 8.1 Confirm TypeScript compiles with zero errors (`tsc --noEmit`)
- [x] 8.2 Verify no remaining references to `message.chartData` exist in the codebase
- [x] 8.3 Test a temporal GA4 query (e.g. "sessions by day last 7 days") — line chart renders
- [x] 8.4 Test a dimensional GA4 query (e.g. "top 5 countries by sessions") — table renders
- [x] 8.5 Test a scalar GA4 query (e.g. "total sessions last month") — plain text only
