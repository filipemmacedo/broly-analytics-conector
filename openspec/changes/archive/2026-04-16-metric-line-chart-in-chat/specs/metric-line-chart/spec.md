## ADDED Requirements

### Requirement: ChatMessage carries optional chart data
The `ChatMessage` type SHALL include an optional `chartData` field typed as `ChartData` where:
```
ChartData = { points: Record<string, string | number>[]; metrics: string[] }
```
`points` is an array of flat objects suitable for Recharts (keyed by metric name plus `"date"`). `metrics` is an ordered list of metric `apiName` strings identifying which keys in `points` are chart series. This field SHALL be omitted (undefined) for all non-chart messages and MUST NOT affect existing message rendering.

#### Scenario: Plain text message has no chartData
- **WHEN** the assistant replies with a non-time-series answer
- **THEN** `message.chartData` is undefined
- **AND** `MessageBubble` renders the message as plain text as before

#### Scenario: Time-series message includes chartData
- **WHEN** the GA4 query returns rows with a `date` dimension and one or more numeric metrics
- **THEN** `message.chartData` is populated with `{ points, metrics }`
- **AND** `message.content` contains a brief natural-language summary (≤2 sentences)

---

### Requirement: MessageBubble renders an inline multi-line LineChart when chartData is present
When `message.chartData.points` has one or more entries, `MessageBubble` SHALL render a Recharts `LineChart` below the text summary. The chart MUST be client-side only (loaded via `next/dynamic` with `ssr: false`). One `<Line>` is rendered per entry in `chartData.metrics`, each with a distinct preset colour. A `<Legend>` is shown only when there are two or more metrics.

#### Scenario: Single-metric chart renders one line
- **WHEN** `message.chartData.metrics` has exactly one entry
- **THEN** one line is rendered; no legend is shown

#### Scenario: Multi-metric chart renders one line per metric
- **WHEN** `message.chartData.metrics` has two or more entries (e.g. `["sessions", "screenPageViews"]`)
- **THEN** one coloured `<Line>` per metric is rendered
- **AND** a `<Legend>` is displayed to identify each series

#### Scenario: Chart is not rendered for empty or absent chartData
- **WHEN** `message.chartData` is undefined, or `message.chartData.points` is empty
- **THEN** no chart component is rendered inside the bubble

#### Scenario: Chart does not break SSR
- **WHEN** the page is server-rendered
- **THEN** the `MetricLineChart` component is not included in the server bundle
- **AND** hydration completes without errors

---

### Requirement: GA4 date strings are normalised and rows sorted chronologically before rendering
The GA4 Data API returns dates in `YYYYMMDD` format. The system SHALL convert them to `YYYY-MM-DD` before storing in `chartData.points`. Rows SHALL be sorted in ascending chronological order so the X-axis always runs earliest-to-latest regardless of GA4 API response order.

#### Scenario: GA4 date normalisation
- **WHEN** the GA4 API returns a date dimension value of `"20240415"`
- **THEN** the stored `points[n].date` is `"2024-04-15"`

#### Scenario: Rows sorted chronologically
- **WHEN** the GA4 API returns rows in arbitrary order
- **THEN** `chartData.points` is sorted ascending by `date`
- **AND** the line chart X-axis progresses from earliest to latest date

---

### Requirement: Chart data is capped at 365 points (hard limit)
To prevent performance degradation, the orchestrator SHALL limit `chartData.points` to a maximum of 365 entries. If the raw result exceeds this, the first 365 rows in chronological order are used.

#### Scenario: Large dataset is capped at 365
- **WHEN** the GA4 response contains more than 365 date rows
- **THEN** only the first 365 rows are stored in `chartData.points`

---

### Requirement: Testing-phase date-query cap of 20 days (MAX_CHART_DAYS)
During the testing phase, date-dimension GA4 queries SHALL be capped at `MAX_CHART_DAYS = 20` days. This constant is defined in `src/lib/llm-planner.ts` and applied to the `dateRanges` parameter before executing the GA4 Data API call. The cap is documented in `README.md` and can be raised once the feature is validated and pagination is in place.

#### Scenario: Date query respects MAX_CHART_DAYS
- **WHEN** the LLM requests a date-dimension query spanning more than 20 days
- **THEN** the effective date range is clamped so the result set does not exceed 20 rows
- **AND** the chart renders correctly for the capped range

---

### Requirement: Chart detection targets date-dimension queries with one or more numeric metrics
The orchestrator SHALL populate `chartData` when the GA4 result rows contain a `date` dimension AND at least one numeric metric column. Non-date queries remain text-only.

#### Scenario: Single metric with date dimension triggers chart
- **WHEN** GA4 rows contain `{ date: string; sessions: string }`
- **THEN** `chartData` is populated with `metrics: ["sessions"]` and one point per date

#### Scenario: Multi-metric with date dimension triggers multi-line chart
- **WHEN** GA4 rows contain `{ date: string; sessions: string; screenPageViews: string }`
- **THEN** `chartData` is populated with `metrics: ["sessions", "screenPageViews"]`
- **AND** both series appear as separate lines in `MetricLineChart`

#### Scenario: Non-date query stays text-only
- **WHEN** GA4 rows contain no `date` column
- **THEN** `chartData` is NOT populated
- **AND** the response is rendered as plain text

---

### Requirement: Backward-compatible migration for persisted old-format chartData
Sessions saved before the `ChartData` refactor may contain `chartData` as a plain `ChartDataPoint[]` array (`{ date, value }[]`). When loading a `ChatSession` from disk, the system SHALL transparently migrate old-format arrays to the new `ChartData` shape so previously saved charts continue to render correctly.

#### Scenario: Old-format array is migrated on load
- **WHEN** a chat session file contains `chartData: [{ date: "2024-04-15", value: 123 }]`
- **THEN** `getChat` returns the message with `chartData: { points: [{ date: "2024-04-15", value: 123 }], metrics: ["value"] }`
- **AND** the chart renders with a single line labelled "value"
