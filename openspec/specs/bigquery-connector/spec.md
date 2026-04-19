## ADDED Requirements

### Requirement: BigQuery OAuth configuration
The system SHALL allow users to configure BigQuery by entering their Google OAuth client credentials (`clientId`, `clientSecret`) and their GCP `projectId` in the integration settings UI. The integration SHALL be stored using `authType: oauth2-code-flow` in the integration-store, consistent with the GA4 integration pattern.

#### Scenario: User saves BigQuery credentials
- **WHEN** user enters `clientId`, `clientSecret`, and `projectId` and saves the BigQuery integration form
- **THEN** the integration is created in the store with `provider: bigquery`, `authType: oauth2-code-flow`, and the provided `providerFields`

#### Scenario: Missing required fields
- **WHEN** user submits the BigQuery form without `clientId`, `clientSecret`, or `projectId`
- **THEN** the form SHALL show a validation error and not save the integration

---

### Requirement: BigQuery browser-based OAuth authentication
The system SHALL initiate a Google OAuth2 browser flow for BigQuery when the user clicks "Connect". The OAuth authorization URL SHALL request both `https://www.googleapis.com/auth/bigquery.readonly` and `https://www.googleapis.com/auth/analytics.readonly` scopes. After successful authentication, the access token and refresh token SHALL be encrypted and stored in the integration record.

#### Scenario: Successful OAuth connect
- **WHEN** user clicks "Connect" on a configured BigQuery integration
- **THEN** the browser SHALL redirect to Google's OAuth consent screen requesting both scopes, and on approval the tokens SHALL be stored and the integration marked as connected

#### Scenario: OAuth error or denial
- **WHEN** the Google OAuth callback returns an error or the user denies consent
- **THEN** the integration status SHALL be set to `error` with a descriptive message

---

### Requirement: BigQuery property selection via GA4 Admin API
After successful OAuth, the system SHALL fetch the list of Google Analytics properties available to the authenticated user via `GET https://analyticsadmin.googleapis.com/v1beta/properties`. The user SHALL select a property by display name. The system SHALL store `propertyId` and `propertyName` in `BigQueryFields`.

#### Scenario: Property list loads after connect
- **WHEN** BigQuery OAuth completes successfully
- **THEN** the settings UI SHALL display a dropdown of available GA4 properties by display name

#### Scenario: User selects a property
- **WHEN** user selects a property from the dropdown and saves
- **THEN** `propertyId` and `propertyName` SHALL be persisted in the integration's `providerFields`

#### Scenario: No properties available
- **WHEN** the GA4 Admin API returns an empty list
- **THEN** the UI SHALL display a message indicating no GA4 properties were found for this account

---

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
The system SHALL provide an LLM-powered agent (`runBigQueryAgentTurn`) that translates natural-language questions into BigQuery SQL queries. The agent SHALL expose a `runBigQueryQuery` tool with a `sql` parameter. The system prompt SHALL inform the LLM of the active project, dataset (from `datasetId`), and GA4 property context, and instruct it to write standard SQL only (not GA4 Data API calls). The agent SHALL support all four LLM providers: Anthropic, OpenAI, Google Gemini, Mistral. The agent SHALL return `visual?: VisualData` alongside `summary`, populated by calling `extractChartData` and `extractTableData` on the query results.

#### Scenario: Natural language question is answered via SQL with chart output
- **WHEN** user asks "show me sessions per day for the last 7 days"
- **THEN** the LLM writes a query aliasing `event_date AS date` and selecting a numeric metric
- **AND** `runBigQueryAgentTurn` returns `{ summary: "<1-2 sentence trend>", visual: { type: "chart", data: ChartData } }`

#### Scenario: Natural language question is answered via SQL with table output
- **WHEN** user asks "top 5 countries by sessions last week"
- **THEN** the LLM writes a query with a non-date dimension and a numeric metric
- **AND** `runBigQueryAgentTurn` returns `{ summary: "<insight>", visual: { type: "table", data: TableData } }`

#### Scenario: LLM answers without a tool call
- **WHEN** user asks a conceptual question (e.g., "what is an event in GA4?")
- **THEN** the LLM SHALL respond directly; `visual` is `undefined`

#### Scenario: LLM context includes project, dataset, and property
- **WHEN** the agent is initialized
- **THEN** the system prompt SHALL include the GCP project ID, the configured `datasetId`, and the selected GA4 property name for context

---

### Requirement: BigQuery system prompt instructs date aliasing for chart rendering
The system prompt SHALL instruct the LLM to alias `event_date AS date` in every query that includes a date column. This is required for `extractChartData` to detect time-series queries.

#### Scenario: Time-series query uses aliased date column
- **WHEN** user asks for metrics "by day" or "over time"
- **THEN** the generated SQL contains `event_date AS date` and `extractChartData` returns `ChartData`

---

### Requirement: BigQuery summarization prompt shortened for chart queries
When `extractChartData` returns data, the summarization prompt SHALL instruct the LLM to produce only a 1–2 sentence trend insight and not narrate individual rows.

#### Scenario: Chart query produces short summary
- **WHEN** the BigQuery agent detects a chart-eligible result
- **THEN** the LLM receives: "A line chart will be rendered automatically. Respond with only a 1–2 sentence insight about the trend — do not list individual data points."

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
- **THEN** `testConnection` SHALL return `{ success: false, error: "Dataset ID is not configured. Select a GA4 property in Settings > Integrations > BigQuery." }`
