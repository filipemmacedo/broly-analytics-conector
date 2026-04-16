## MODIFIED Requirements

### Requirement: ChatMessage carries optional visual data (replaces chartData)
The `ChatMessage` type SHALL include an optional `visual` field typed as `VisualData` (discriminated union). The old `chartData?: ChartData` field is removed. Chart data is now carried as `visual: { type: 'chart', data: ChartData }`.

`ChartData` itself is unchanged:
```
ChartData = { points: Record<string, string | number>[]; metrics: string[] }
```

#### Scenario: Plain text message has no visual
- **WHEN** the assistant replies with a non-time-series answer
- **THEN** `message.visual` is undefined
- **AND** `MessageBubble` renders the message as plain text as before

#### Scenario: Time-series message includes visual of type chart
- **WHEN** the GA4 query returns rows with a `date` dimension and one or more numeric metrics
- **THEN** `message.visual` is set to `{ type: 'chart', data: { points, metrics } }`
- **AND** `message.content` contains a brief natural-language summary (≤2 sentences)

---

## REMOVED Requirements

### Requirement: Backward-compatible migration for persisted old-format chartData
**Reason**: This requirement is superseded. The migration concern is now generalised — see `visual-data-model` spec for the updated coerce-on-load behaviour covering both the old array format and the new `chartData` → `visual` rename.
**Migration**: The `chat-store.ts` coerce-on-load path handles both the legacy `ChartDataPoint[]` array format and the intermediate `chartData: ChartData` format, converting both to `visual: { type: 'chart', data: ChartData }`.
