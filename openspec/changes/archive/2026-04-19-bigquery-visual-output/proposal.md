## Why

BigQuery chat responses return only a plain-text summary — the structured query results (columns and rows) are fetched but discarded before reaching the UI. GA4 already renders line charts and tables in chat using the same data shape. BigQuery should behave identically: if the query returns date-based rows, render a line chart; if it returns dimensional rows, render a table.

## What Changes

- `runBigQueryAgentTurn` returns `visual?: VisualData` alongside `summary`, using the existing `extractChartData` and `extractTableData` helpers from the GA4 path
- The orchestrator attaches `visual` to BigQuery chat messages the same way it already does for GA4
- The BigQuery system prompt gains chart and table rendering rules (same as GA4): instruct the LLM to always include a date column (`event_date`) for time-series questions, and keep summaries short when a chart will render
- `BigQueryAgentTurnResult` interface adds `visual?: VisualData`

## Capabilities

### New Capabilities

_(none — all infrastructure already exists)_

### Modified Capabilities

- `bigquery-connector`: Requirements change — agent turn now returns `visual?: VisualData`; system prompt gains chart/table rendering instructions
- `orchestrator-routing`: BigQuery message construction must attach `visual` when present, matching GA4 behaviour

## Impact

- `src/lib/agents/bigquery-agent.ts` — `BigQueryAgentTurnResult` adds `visual?`; `runBigQueryAgentTurn` calls `extractChartData` / `extractTableData` on query rows; system prompt gains rendering rules
- `src/lib/orchestrator.ts` — BigQuery path destructures `visual` and spreads it onto the chat message
- No new files, no API changes, no type changes outside the agent
