## MODIFIED Requirements

### Requirement: Question routing based on active source
The orchestrator SHALL route incoming questions to the correct LLM agent based on the `isActive` flag of the configured integrations. The orchestrator SHALL read the active integration from the store, extract its access token and `providerFields`, and dispatch to the appropriate agent. The orchestrator SHALL accept an optional `StreamWriterFn` parameter; when provided, it SHALL emit structured SSE progress events at each pipeline phase boundary and forward text delta events from the summary LLM call. When no writer is provided, the orchestrator SHALL behave as before (return a plain `SessionState`).

#### Scenario: Question routed to GA4 agent when GA4 is active
- **WHEN** a user submits a question and a GA4 integration has `isActive: true`
- **THEN** the orchestrator SHALL call `runGA4AgentTurn` with the GA4 access token, property ID, and the `StreamWriterFn` if present

#### Scenario: Question routed to BigQuery agent when BigQuery is active
- **WHEN** a user submits a question and a BigQuery integration has `isActive: true`
- **THEN** the orchestrator SHALL call `runBigQueryAgentTurn` with the BigQuery access token, projectId, datasetId, propertyName, and the `StreamWriterFn` if present
- **AND** the orchestrator SHALL destructure `{ summary, visual }` from the result and spread `visual` onto the chat message when present

#### Scenario: Orchestrator emits progress events when writer is provided
- **WHEN** a `StreamWriterFn` is provided
- **THEN** the orchestrator emits `{"type":"progress","step":"planning"}` before the query-planning LLM call
- **AND** emits `{"type":"progress","step":"querying"}` before the data fetch
- **AND** emits `{"type":"progress","step":"summarizing"}` before the summary LLM call

#### Scenario: No active source
- **WHEN** a user submits a question and no integration has `isActive: true`
- **THEN** the orchestrator SHALL return a message directing the user to connect an analytics source in Settings

#### Scenario: LLM not configured
- **WHEN** a user submits a question and a source is active but no LLM provider is configured
- **THEN** the orchestrator SHALL return a message directing the user to configure an LLM in Settings > LLM
