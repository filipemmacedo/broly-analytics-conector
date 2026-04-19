## MODIFIED Requirements

### Requirement: BigQuery SQL query execution
The system SHALL execute SQL queries against BigQuery using the synchronous queries API (`POST /projects/{projectId}/queries`) with `useLegacySql: false` and a `timeoutMs` of 20000. Queries SHALL be validated as read-only (must start with SELECT or WITH; must not contain INSERT, UPDATE, DELETE, MERGE, DROP, ALTER, TRUNCATE, or CREATE). The dataset SHALL be read from the integration's `providerFields.datasetId` field — it is NOT hardcoded.

#### Scenario: Valid SELECT query executes
- **WHEN** the LLM agent issues a valid SELECT query against `projectId.<datasetId>.events_*`
- **THEN** the system SHALL execute it via the sync API and return rows to the agent

#### Scenario: Write query is blocked
- **WHEN** a query contains INSERT, UPDATE, DELETE, or other write operations
- **THEN** the system SHALL reject it with an error before sending to BigQuery

#### Scenario: Query timeout
- **WHEN** a query exceeds 20 seconds
- **THEN** the system SHALL return an error message indicating the query timed out, and the user SHALL be informed this is a known limitation for large datasets

---

### Requirement: BigQuery LLM agent
The system SHALL provide an LLM-powered agent (`runBigQueryAgentTurn`) that translates natural-language questions into BigQuery SQL queries. The agent SHALL expose a `runBigQueryQuery` tool with a `sql` parameter. The system prompt SHALL inform the LLM of the active project, dataset (from `datasetId`), and GA4 property context, and instruct it to write standard SQL only (not GA4 Data API calls). The agent SHALL support all four LLM providers: Anthropic, OpenAI, Google Gemini, Mistral.

#### Scenario: Natural language question is answered via SQL
- **WHEN** user asks "how many events happened last week?"
- **THEN** the LLM SHALL call `runBigQueryQuery` with an appropriate SELECT from `projectId.<datasetId>.events_*`, and the result SHALL be summarized in natural language

#### Scenario: LLM answers without a tool call
- **WHEN** user asks a conceptual question (e.g., "what is an event in GA4?")
- **THEN** the LLM SHALL respond directly without calling `runBigQueryQuery`

#### Scenario: LLM context includes project, dataset, and property
- **WHEN** the agent is initialized
- **THEN** the system prompt SHALL include the GCP project ID, the configured `datasetId`, and the selected GA4 property name for context

---

### Requirement: BigQuery connection test
The system SHALL test the BigQuery connection by calling `GET https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/datasets/{datasetId}` using the current access token. The `datasetId` SHALL be read from `providerFields.datasetId` — it is NOT hardcoded.

#### Scenario: Successful connection test
- **WHEN** the access token is valid and the configured dataset exists in the project
- **THEN** `testConnection` SHALL return `{ success: true }`

#### Scenario: Dataset not found
- **WHEN** the access token is valid but the configured dataset does not exist
- **THEN** `testConnection` SHALL return `{ success: false, error: "<BigQuery API error message>" }`

#### Scenario: Dataset ID not configured
- **WHEN** `providerFields.datasetId` is missing or empty
- **THEN** `testConnection` SHALL return `{ success: false, error: "Dataset ID is required. Select your BigQuery dataset in settings." }`

## REMOVED Requirements

### Requirement: Hardcoded ga4analytics dataset
**Reason:** The GA4 BigQuery export dataset name is not always `ga4analytics`. The standard GCP export naming is `analytics_<property_id>` (e.g. `analytics_516611632`). Hardcoding `ga4analytics` makes the connector non-functional for all standard GCP accounts.
**Migration:** Replace `ga4analytics` with `providerFields.datasetId` throughout the stack. Existing integrations must re-save in Settings to populate `datasetId`.
