## MODIFIED Requirements

### Requirement: Orchestrator attaches visual data to BigQuery messages
When the BigQuery agent returns a `visual` field, the orchestrator SHALL spread it onto the chat message, making it available for rendering in `MessageBubble`. The BigQuery message construction SHALL follow the same pattern as the GA4 path.

#### Scenario: BigQuery agent returns chart visual
- **WHEN** `runBigQueryAgentTurn` returns `{ summary: "...", visual: { type: "chart", data: ChartData } }`
- **THEN** the orchestrator pushes a chat message with `visual: { type: "chart", data: ChartData }`
- **AND** `MessageBubble` renders `MetricLineChart`

#### Scenario: BigQuery agent returns table visual
- **WHEN** `runBigQueryAgentTurn` returns `{ summary: "...", visual: { type: "table", data: TableData } }`
- **THEN** the orchestrator pushes a chat message with `visual: { type: "table", data: TableData }`
- **AND** `MessageBubble` renders `MetricTable`

#### Scenario: BigQuery agent returns no visual
- **WHEN** `runBigQueryAgentTurn` returns `{ summary: "..." }` with no `visual`
- **THEN** the orchestrator pushes a plain text chat message with no `visual` field
