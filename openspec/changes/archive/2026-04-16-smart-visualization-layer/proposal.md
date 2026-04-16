## Why

GA4 query results that break down data by a dimension (e.g. "top countries by sessions", "sessions by device") currently return as a wall of text. A data table is the natural, readable format for this shape of data, and the architecture already has the right primitives to detect and render it cleanly.

## What Changes

- **BREAKING** Remove `chatData?: ChartData` from `ChatMessage` — replaced by `visual?: VisualData`
- Add `VisualData` discriminated union type: `{ type: 'chart'; data: ChartData } | { type: 'table'; data: TableData }`
- Add `TableData` type: ordered columns (dimensions first, metrics last) + typed rows
- Add `extractTableData()` pure function in `llm-planner.ts` — detects dimensional breakdown rows (non-date, non-numeric dimension column present)
- Add `MetricTable` React component — renders `TableData` with dimension-left / metric-right alignment and number formatting
- Update `runGA4AgentTurn` to populate `visual` instead of `chartData`, with a new summarisation branch for table queries
- Update `MessageBubble` to switch on `visual.type` rather than checking `chartData`
- Add coerce-on-load migration in `chat-store.ts` for persisted messages that still carry the old `chartData` field

**Scope**: GA4 path only. BigQuery and Power BI connectors are out of scope (currently disconnected and disabled).

## Capabilities

### New Capabilities
- `visual-data-model`: Discriminated union `VisualData` replaces the `chartData` field on `ChatMessage`. Covers the new `TableData` type and the updated `ChatMessage` contract.
- `metric-table`: Detection logic for dimensional breakdown data and the `MetricTable` rendering component.

### Modified Capabilities
- `metric-line-chart`: The `ChatMessage.chartData` field is removed (**BREAKING**). Charts now attach via `visual: { type: 'chart', data: ChartData }`. Existing behaviour is preserved; only the field name and nesting changes. Persisted messages with the old field are migrated on load.

## Impact

- `src/lib/types.ts` — type changes to `ChatMessage`, new `TableData`, new `VisualData`
- `src/lib/llm-planner.ts` — new `extractTableData`, updated `runGA4AgentTurn`
- `src/lib/orchestrator.ts` — write `visual` instead of `chartData` on assistant messages
- `src/lib/chat-store.ts` — coerce-on-load: old `chartData` → `visual: { type: 'chart', data: chartData }`
- `src/components/ui/MetricTable.tsx` — new component
- `src/components/ui/MessageBubble.tsx` — switch on `visual.type`
- No new dependencies; Recharts already in use for the chart path
