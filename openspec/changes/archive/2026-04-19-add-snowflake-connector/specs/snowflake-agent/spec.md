## ADDED Requirements

### Requirement: Orchestrator routes questions to the Snowflake agent when Snowflake is active
The system SHALL route chat questions to `runSnowflakeAgentTurn` when the active integration's provider is `"snowflake"`. The orchestrator SHALL pass the PAT token, account identifier, database, schema, and warehouse from the integration record to the agent.

#### Scenario: Question routed to Snowflake agent
- **WHEN** the active integration is Snowflake and the user asks a question
- **THEN** the question is answered using data from Snowflake and the response is tagged with source `"snowflake"`

#### Scenario: Error shown when database is not selected
- **WHEN** the Snowflake integration is active but no database has been selected in the selector
- **THEN** the orchestrator returns an error message guiding the user to complete setup in Settings > Integrations > Snowflake

#### Scenario: Error shown when PAT token is missing
- **WHEN** the Snowflake integration is active but credentials are incomplete
- **THEN** the orchestrator returns an error message guiding the user to set up credentials

---

### Requirement: Snowflake agent translates natural language to Snowflake SQL via tool-calling
The agent SHALL use function/tool-calling across all supported LLM providers (Anthropic, OpenAI, Google Gemini, Mistral) to produce a `runSnowflakeQuery` tool call containing a valid Snowflake SQL SELECT statement. The agent SHALL enforce read-only queries — only `SELECT` and `WITH` statements are permitted.

#### Scenario: LLM generates a valid SELECT query
- **WHEN** the user asks an analytical question (e.g. "top 10 customers by revenue last month")
- **THEN** the LLM calls `runSnowflakeQuery` with a `SELECT` statement using fully-qualified table names (`<database>.<schema>.<table>`)

#### Scenario: Blocked query is rejected before execution
- **WHEN** the LLM produces a query containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, or `CREATE`
- **THEN** the agent rejects the query with an error and does not execute it against Snowflake

---

### Requirement: Agent system prompt provides Snowflake-specific SQL context and dialect guidance
The system SHALL build a system prompt that includes:
- Active connection context: account identifier, database, schema, warehouse.
- Snowflake SQL dialect rules: fully-qualified references (`<db>.<schema>.<table>`), Snowflake date functions (`DATEADD`, `DATE_TRUNC`, `TO_DATE`, `CURRENT_DATE`), `LIMIT` requirement (max 20 rows).
- Chart and table rendering rules (same as BigQuery agent): alias date columns as `date`, include non-date dimensions for table rendering.
- Common Snowflake query patterns as examples.
- Instruction NOT to use BigQuery or standard SQL functions that differ in Snowflake.

#### Scenario: LLM uses correct date functions for Snowflake
- **WHEN** the user asks "sessions in the last 7 days"
- **THEN** the generated SQL uses `DATEADD(day, -7, CURRENT_DATE)` or equivalent Snowflake syntax, not `DATE_SUB`

#### Scenario: LLM uses fully-qualified table references
- **WHEN** the database is `ANALYTICS` and schema is `PUBLIC`
- **THEN** generated queries reference tables as `ANALYTICS.PUBLIC.<table>` not just `<table>`

---

### Requirement: Agent executes Snowflake SQL and returns results synchronously
The agent SHALL call the Snowflake SQL API v2 (`POST https://<account>.snowflakecomputing.com/api/v2/statements`) with the generated SQL. The request SHALL include `"timeout": 60` for synchronous execution. Results SHALL be returned as structured rows and columns.

#### Scenario: Query completes within timeout
- **WHEN** the query completes within 60 seconds
- **THEN** results are returned as structured rows and passed to the summarisation step

#### Scenario: Query times out
- **WHEN** the query exceeds 60 seconds
- **THEN** an error message is returned advising the user to narrow their query (e.g. add a date filter or reduce the row limit)

---

### Requirement: Agent renders charts and tables from query results
The agent SHALL apply the same chart and table extraction logic used in the BigQuery and GA4 agents (`extractChartData`, `extractTableData` from `ga4-agent.ts`). A line chart is rendered when results contain a `date` column; a table is rendered when results contain a non-date dimension column.

#### Scenario: Chart rendered for time-series queries
- **WHEN** the SQL aliases a date column as `date` and returns metric columns
- **THEN** the response includes a `visual` payload of type `"chart"`

#### Scenario: Table rendered for dimension breakdown queries
- **WHEN** the SQL returns a non-date string dimension and numeric metric columns
- **THEN** the response includes a `visual` payload of type `"table"`

---

### Requirement: Agent summarises query results in natural language
After executing the query, the agent SHALL call the LLM a second time (without tools) to produce a 1–3 sentence natural-language insight. When a chart or table will render, the summary SHALL be reduced to 1–2 sentences and SHALL NOT narrate individual data points.

#### Scenario: Summary generated after successful query
- **WHEN** the query returns data
- **THEN** the chat response contains a concise natural-language insight alongside any visual

#### Scenario: Empty result handled gracefully
- **WHEN** the query returns zero rows
- **THEN** the agent returns a message explaining no data was found for the given filters, without calling the LLM for summarisation
