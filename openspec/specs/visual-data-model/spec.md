## ADDED Requirements

### Requirement: VisualData discriminated union replaces chartData on ChatMessage
The `ChatMessage` type SHALL replace the `chartData?: ChartData` field with `visual?: VisualData` where:
```
VisualData =
  | { type: 'chart'; data: ChartData }
  | { type: 'table'; data: TableData }

TableData = {
  columns: string[]                        // dimensions first, metrics last
  rows: Record<string, string | number>[]
}
```
A message SHALL carry at most one visual. The discriminated union enforces this at the type level — no message can have both a chart and a table simultaneously.

#### Scenario: Assistant message with chart result
- **WHEN** the GA4 query returns rows with a `date` dimension and numeric metrics
- **THEN** `message.visual` is set to `{ type: 'chart', data: ChartData }`
- **AND** `message.chartData` is absent from the type

#### Scenario: Assistant message with table result
- **WHEN** the GA4 query returns rows with a non-date dimension and numeric metrics
- **THEN** `message.visual` is set to `{ type: 'table', data: TableData }`

#### Scenario: Plain text message carries no visual
- **WHEN** the assistant replies with a scalar or conceptual answer (no structured rows)
- **THEN** `message.visual` is undefined

---

### Requirement: TableData columns are ordered dimensions-first, metrics-last
The `TableData.columns` array SHALL list dimension columns (non-numeric, non-date) before metric columns (numeric). This ordering is enforced by `extractTableData` and is stable across calls for the same row shape.

#### Scenario: Single dimension, single metric
- **WHEN** GA4 rows contain `{ country: "United States", sessions: "1234" }`
- **THEN** `TableData.columns` is `["country", "sessions"]`

#### Scenario: Multiple dimensions and metrics
- **WHEN** GA4 rows contain `{ country: "US", deviceCategory: "mobile", sessions: "100", screenPageViews: "300" }`
- **THEN** `TableData.columns` lists `["country", "deviceCategory"]` before `["sessions", "screenPageViews"]`

---

### Requirement: Legacy persisted messages with chartData are migrated on load
When deserialising a `ChatMessage` from storage, the system SHALL coerce old-format messages: if a message has a `chartData` field but no `visual` field, it SHALL be transformed to `visual = { type: 'chart', data: chartData }`. This migration is transparent to all callers of `getChat`.

#### Scenario: Old message with chartData loads correctly
- **WHEN** a stored chat session contains a message with `chartData: { points: [...], metrics: [...] }` and no `visual` field
- **THEN** `getChat` returns the message with `visual: { type: 'chart', data: { points: [...], metrics: [...] } }`
- **AND** `message.chartData` is not present on the returned object

#### Scenario: New message with visual field is unchanged
- **WHEN** a stored chat session contains a message already using the `visual` field
- **THEN** `getChat` returns it unchanged — no double-migration occurs
