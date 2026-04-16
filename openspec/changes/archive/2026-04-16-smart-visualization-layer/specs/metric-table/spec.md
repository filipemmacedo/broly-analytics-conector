## ADDED Requirements

### Requirement: extractTableData detects dimensional breakdown rows and returns TableData
The system SHALL expose a pure function `extractTableData(rows: Record<string, string>[])` in `src/lib/llm-planner.ts`. It SHALL return `TableData` when the rows represent a dimensional breakdown (at least one non-date, non-numeric column is present). It SHALL return `undefined` for scalar rows (all columns numeric) or empty input. It SHALL never be called when `extractChartData` already returned a value — chart takes priority over table.

#### Scenario: Rows with a string dimension return TableData
- **WHEN** rows contain `{ country: "United States", sessions: "1234" }`
- **THEN** `extractTableData` returns `{ columns: ["country", "sessions"], rows: [{ country: "United States", sessions: 1234 }] }`

#### Scenario: Rows with only numeric columns return undefined
- **WHEN** rows contain `{ sessions: "1234", screenPageViews: "5678" }` (no dimension)
- **THEN** `extractTableData` returns `undefined`

#### Scenario: Empty rows return undefined
- **WHEN** `rows` is an empty array
- **THEN** `extractTableData` returns `undefined`

#### Scenario: Date dimension rows are not treated as table (chart takes priority)
- **WHEN** rows contain a `date` column
- **THEN** `extractChartData` is called first and returns a value
- **AND** `extractTableData` is NOT called for that result

#### Scenario: Metric values are coerced to numbers in TableData rows
- **WHEN** GA4 returns a metric column value as the string `"4567"`
- **THEN** the corresponding `TableData.rows` entry stores it as the number `4567`

---

### Requirement: buildSystemPrompt includes a TABLE RENDERING RULE
The system prompt built by `buildSystemPrompt` in `src/lib/llm-planner.ts` SHALL include a `TABLE RENDERING RULE` section alongside the existing `CHART RENDERING RULE`. It SHALL instruct the LLM that:
- Including a non-date dimension in the tool call will cause the UI to automatically render a data table
- The LLM therefore MUST NOT narrate individual rows — only provide a 1-2 sentence insight
- Examples of queries that require a non-date dimension (and will render a table) and examples that require the `date` dimension (and will render a chart) SHALL be provided to prevent confusion

#### Scenario: LLM receives table rendering guidance in system prompt
- **WHEN** `buildSystemPrompt` is called
- **THEN** the returned string contains a `TABLE RENDERING RULE` section
- **AND** the section names at least two examples of dimensional (non-date) queries that will render as tables
- **AND** the section instructs the LLM not to narrate individual rows

#### Scenario: LLM does not confuse chart and table dimensions
- **WHEN** the user asks "top 5 countries by sessions"
- **THEN** the LLM includes `dimensions: [{ name: "country" }]` (not `date`) in the tool call
- **AND** the summary response is a brief insight, not a row-by-row list

#### Scenario: Chart rule and table rule do not conflict
- **WHEN** the user asks "sessions by day last 7 days"
- **THEN** the LLM includes `dimensions: [{ name: "date" }]` — the chart rule takes precedence
- **AND** no non-date dimension is included

---

### Requirement: runGA4AgentTurn populates visual for table results
When `extractTableData` returns a value, `runGA4AgentTurn` SHALL set `visual: { type: 'table', data: tableData }` on the result and use the table summarisation instruction for the LLM summary step.

#### Scenario: Table summarisation instruction is used for dimensional results
- **WHEN** GA4 returns dimensional breakdown rows (no date dimension)
- **THEN** the LLM summarisation prompt includes: "A data table will be rendered for this result. Respond with only a 1-2 sentence insight about the data — do not list or narrate individual rows."
- **AND** the assistant message content is a concise insight, not a row-by-row narration

#### Scenario: No visual is set for scalar results
- **WHEN** GA4 returns rows with only numeric columns and no dimensions
- **THEN** `visual` is undefined on the result
- **AND** the standard text summarisation instruction is used

---

### Requirement: MetricTable renders TableData as a styled inline table
The `MetricTable` component in `src/components/ui/MetricTable.tsx` SHALL render `TableData` as an HTML table with:
- One `<th>` per column from `TableData.columns`
- One `<tr>` per row from `TableData.rows`
- Dimension columns left-aligned
- Metric columns right-aligned
- Metric values formatted as locale-aware numbers (`Intl.NumberFormat`) — e.g. `1234567` → `"1,234,567"`
- CSS class prefix `metric-table` following the `metric-line-chart` convention
- Loaded via `next/dynamic` with `ssr: false` in `MessageBubble`

#### Scenario: Dimension values are left-aligned
- **WHEN** `TableData.columns` contains a dimension column (non-numeric)
- **THEN** the corresponding `<td>` cells have left-aligned text

#### Scenario: Metric values are right-aligned and formatted
- **WHEN** `TableData.columns` contains a metric column with value `1234567`
- **THEN** the corresponding `<td>` cell displays `"1,234,567"` right-aligned

#### Scenario: Empty table is not rendered
- **WHEN** `TableData.rows` is empty
- **THEN** `MetricTable` returns null and renders nothing

#### Scenario: Component does not break SSR
- **WHEN** the page is server-rendered
- **THEN** `MetricTable` is not included in the server bundle
- **AND** hydration completes without errors

---

### Requirement: MessageBubble renders MetricTable when visual.type is 'table'
`MessageBubble` SHALL render `<MetricTable data={message.visual.data} />` when `message.visual?.type === 'table'`. It SHALL render `<MetricLineChart data={message.visual.data} />` when `message.visual?.type === 'chart'`. No visual is rendered when `message.visual` is undefined.

#### Scenario: Table visual renders MetricTable
- **WHEN** `message.visual` is `{ type: 'table', data: TableData }`
- **THEN** `MessageBubble` renders `MetricTable` below the text content

#### Scenario: Chart visual renders MetricLineChart
- **WHEN** `message.visual` is `{ type: 'chart', data: ChartData }`
- **THEN** `MessageBubble` renders `MetricLineChart` below the text content

#### Scenario: No visual renders no chart or table
- **WHEN** `message.visual` is undefined
- **THEN** `MessageBubble` renders only the text content
