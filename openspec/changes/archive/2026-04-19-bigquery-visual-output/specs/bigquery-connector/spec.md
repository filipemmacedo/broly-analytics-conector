## MODIFIED Requirements

### Requirement: BigQuery LLM agent
The system SHALL provide an LLM-powered agent (`runBigQueryAgentTurn`) that translates natural-language questions into BigQuery SQL queries. The agent SHALL expose a `runBigQueryQuery` tool with a `sql` parameter. The system prompt SHALL inform the LLM of the active project, dataset (from `datasetId`), and GA4 property context, and instruct it to write standard SQL only (not GA4 Data API calls). The agent SHALL support all four LLM providers: Anthropic, OpenAI, Google Gemini, Mistral. The agent SHALL return `visual?: VisualData` alongside `summary`, populated from query results using `extractChartData` and `extractTableData`.

#### Scenario: Natural language question is answered via SQL with chart output
- **WHEN** user asks "show me sessions per day for the last 7 days"
- **THEN** the LLM writes a query aliasing `event_date AS date` and selecting a numeric metric
- **AND** the agent returns `{ summary: "<1-2 sentence trend>", visual: { type: "chart", data: ChartData } }`
- **AND** the chat message renders a `MetricLineChart`

#### Scenario: Natural language question is answered via SQL with table output
- **WHEN** user asks "top 5 countries by sessions last week"
- **THEN** the LLM writes a query with a non-date dimension (e.g. `country`) and a numeric metric
- **AND** the agent returns `{ summary: "<insight>", visual: { type: "table", data: TableData } }`
- **AND** the chat message renders a `MetricTable`

#### Scenario: LLM answers without a tool call
- **WHEN** user asks a conceptual question (e.g., "what is an event in GA4?")
- **THEN** the LLM responds directly; `visual` is `undefined`

#### Scenario: LLM context includes project, dataset, and property
- **WHEN** the agent is initialized
- **THEN** the system prompt SHALL include the GCP project ID, the configured `datasetId`, and the selected GA4 property name

---

### Requirement: BigQuery system prompt instructs date aliasing for chart rendering
The system prompt SHALL include an explicit rule: when the query includes a date-based column (`event_date`), the LLM SHALL alias it as `date` (e.g. `SELECT event_date AS date, ...`). This aliasing is required for the chart detection logic to identify time-series queries.

#### Scenario: Time-series query uses aliased date column
- **WHEN** user asks for metrics "by day" or "over time"
- **THEN** the generated SQL contains `event_date AS date`
- **AND** `extractChartData` detects the `date` column and returns `ChartData`

#### Scenario: Non-time-series query omits date alias
- **WHEN** user asks for a ranked or grouped result without a time dimension
- **THEN** the generated SQL does not include `event_date`
- **AND** `extractTableData` produces `TableData` or `visual` is `undefined`

---

### Requirement: BigQuery summarization prompt is shortened for chart queries
When the query result is detected as chart-eligible (contains a `date` column and at least one numeric metric), the summarization prompt sent to the LLM SHALL instruct it to produce only a 1–2 sentence trend insight and NOT narrate individual data points, since a chart will render them.

#### Scenario: Chart query produces short summary
- **WHEN** the BigQuery agent detects `isChartQuery` is true
- **THEN** the summarization prompt includes: "A line chart will be rendered automatically. Respond with only a 1–2 sentence insight about the trend — do not list individual data points."
- **AND** the LLM's response is concise

#### Scenario: Non-chart query produces standard summary
- **WHEN** the query result is a table or plain text
- **THEN** the standard summarization prompt is used (no chart instruction)
