## 1. Dependencies & Types

- [x] 1.1 Add `recharts` to `dependencies` in `package.json` and run `npm install recharts`
- [x] 1.2 Add `@types/recharts` or confirm recharts ships its own types (it does — no separate `@types` needed)
- [x] 1.3 Extend `ChatMessage` in `src/lib/types.ts` with `chartData?: ChartDataPoint[]` and export `ChartDataPoint = { date: string; value: number }`

## 2. Chart Component

- [x] 2.1 Create `src/components/ui/MetricLineChart.tsx` as a `"use client"` component accepting `{ data: ChartDataPoint[]; metricLabel?: string }` props
- [x] 2.2 Implement the Recharts `<LineChart>` inside `MetricLineChart` with `<XAxis dataKey="date" />`, `<YAxis />`, `<Tooltip />`, `<Line type="monotone" dataKey="value" />`
- [x] 2.3 Add a `normaliseGA4Date` utility function inside the component (or a shared util) that converts `"YYYYMMDD"` → `"YYYY-MM-DD"`

## 3. MessageBubble Integration

- [x] 3.1 In `src/components/ui/MessageBubble.tsx`, add a `next/dynamic` import for `MetricLineChart` with `{ ssr: false }`
- [x] 3.2 Render `<MetricLineChart data={message.chartData} />` below `message-bubble__content` when `message.chartData?.length > 0`

## 4. LLM System Prompt — Chart Trigger Instructions

- [x] 4.1 In `buildSystemPrompt` in `src/lib/llm-planner.ts`, add an explicit instruction: when the user asks for metrics **over time**, **by day/week**, **trends**, or **comparisons across dates**, the LLM MUST include `{ name: "date" }` in the `dimensions` array of the `runGA4Report` tool call — this is the signal the UI uses to render a chart
- [x] 4.2 Add examples to the system prompt to reinforce the rule (e.g. `"sessions per day last 30 days" → dimensions: [{ name: "date" }]`, `"top countries by sessions" → no date dimension`)

## 5. Refactor `runGA4AgentTurn` to Return Structured Output

- [x] 5.1 Change the return type of `runGA4AgentTurn` from `Promise<string>` to `Promise<{ summary: string; rows?: Record<string, string>[] }>` — `rows` carries the raw GA4 rows so the caller can build chart data without a second API call
- [x] 5.2 Before the summarisation step in `runGA4AgentTurn`, store the parsed GA4 rows array and include it in the return value
- [x] 5.3 Update all callers of `runGA4AgentTurn` in `src/lib/orchestrator.ts` to destructure `{ summary, rows }` instead of the plain string

## 6. Orchestrator — Chart Data Population

- [x] 6.1 Add a helper `extractChartData(rows: Record<string, string>[]): ChartDataPoint[] | undefined` in `src/lib/llm-planner.ts` — returns data when rows contain a `date` key and exactly one other numeric column, otherwise `undefined`
- [x] 6.2 Apply `normaliseGA4Date` to each `date` value inside `extractChartData`
- [x] 6.3 Cap the output of `extractChartData` at 365 points (slice chronologically)
- [x] 6.4 In `src/lib/orchestrator.ts`, after calling `runGA4AgentTurn`, set `assistantMessage.chartData = extractChartData(rows)` when `rows` is defined and chart data is detected

## 7. Token-Efficient Summarisation Prompt

- [x] 7.1 In `runGA4AgentTurn`, detect whether `extractChartData(rows)` returns data and, if so, replace the generic summarisation instruction with: `"A line chart will be rendered automatically for this data. Respond with only a 1-2 sentence insight about the trend — do not list or narrate individual data points."`
- [ ] 7.2 Verify token reduction manually on a sample time-series query (compare summary length before/after)

## 8. Verification

- [x] 8.1 Run `npm run typecheck` and confirm no TypeScript errors
- [x] 8.2 Start the dev server (`npm run dev`) and ask a day-by-day GA4 question (e.g. "sessions per day last 30 days") — confirm the LLM tool call includes `date` as a dimension AND a `LineChart` appears in the chat bubble
- [x] 8.3 Ask a trend-phrased question without "day" (e.g. "show me traffic trend this month") — confirm the LLM still includes `date` as a dimension and a chart renders
- [x] 8.4 Ask a non-time-series question (e.g. "top 5 countries by sessions") — confirm plain text rendering is unchanged and no chart appears
- [x] 8.5 Ask a multi-metric day question (e.g. "sessions and pageviews per day") — confirm no chart is rendered, text reply only
