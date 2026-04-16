## Why

Users requesting metrics over time currently receive only raw text or tabular data in the chat, making it hard to spot trends at a glance. Rendering an interactive line chart inline when a metric-by-days query is detected transforms the chat into a genuine analytics surface — without adding heavyweight infrastructure.

## What Changes

- Detect when the LLM response contains time-series metric data (days × values) and render a Recharts `LineChart` inline inside the chat bubble instead of (or alongside) plain text.
- Add `recharts` as a production dependency.
- Keep the chart rendering entirely client-side and lean: no extra API calls, no additional backend routes, minimal token overhead by structuring the LLM output as compact JSON rather than verbose prose.
- Token optimisation: introduce a structured JSON response envelope so the agent can emit chart data without wasting tokens on formatting narration.

## Capabilities

### New Capabilities
- `metric-line-chart`: Inline Recharts line chart rendered in the chat whenever the LLM returns time-series metric data; includes token-efficient JSON data contract between agent and UI.

### Modified Capabilities
- `llm-analytics-agent`: Agent prompt must be updated to emit a structured JSON block (`chartData`) when the user asks for a metric broken down by day, enabling the UI to detect and render a chart without extra round-trips.

## Impact

- **New dependency**: `recharts` (client-side only, tree-shakeable).
- **Chat UI components**: message bubble renderer needs to branch on response type (chart vs text).
- **LLM agent**: system prompt / output format updated to include an optional `chartData` field — compact array of `{ date, value }` objects — keeping the token footprint small.
- **No new API routes** required; chart data travels in the existing chat response payload.
