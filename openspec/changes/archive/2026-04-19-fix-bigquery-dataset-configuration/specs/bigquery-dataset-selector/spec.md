## ADDED Requirements

### Requirement: BigQuery dataset listing
The system SHALL expose a `GET /api/integrations/bigquery/datasets` endpoint that calls the BigQuery Datasets API (`GET https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/datasets`) using the stored OAuth access token and returns the list of dataset IDs for the configured GCP project.

#### Scenario: Datasets listed successfully
- **WHEN** the BigQuery integration is configured and OAuth is complete
- **THEN** `GET /api/integrations/bigquery/datasets` SHALL return an array of `{ datasetId: string }` objects representing all datasets in the project

#### Scenario: OAuth not complete
- **WHEN** the BigQuery integration exists but the access token is missing
- **THEN** `GET /api/integrations/bigquery/datasets` SHALL return HTTP 400 with an error message prompting the user to connect with Google first

#### Scenario: No BigQuery integration found
- **WHEN** no BigQuery integration exists in the store
- **THEN** `GET /api/integrations/bigquery/datasets` SHALL return HTTP 404

---

### Requirement: Dataset ID auto-derivation from selected GA4 property
After the user selects a GA4 property via the Admin API, the system SHALL automatically derive the expected BigQuery export dataset name by stripping the `properties/` prefix from the property ID and prepending `analytics_` (e.g. `properties/516611632` → `analytics_516611632`). This derived value SHALL be pre-filled in the `datasetId` field. The user MAY confirm, change, or override the pre-filled value.

#### Scenario: Dataset derived from property selection
- **WHEN** the user selects a GA4 property with ID `properties/516611632` in the BigQuery settings
- **THEN** the dataset ID field SHALL be pre-filled with `analytics_516611632`

#### Scenario: User overrides derived dataset
- **WHEN** the pre-filled `datasetId` does not match the user's actual export dataset
- **THEN** the user SHALL be able to clear the field and select a different dataset from the dropdown or type one manually

---

### Requirement: Dataset selection in BigQuery settings form
The system SHALL display a dataset selector in the BigQuery settings form after OAuth is complete. The selector SHALL fetch the available datasets from `/api/integrations/bigquery/datasets` and populate a dropdown. The field SHALL be pre-filled using the auto-derived value from the selected GA4 property (see requirement above). If no property is selected yet, and exactly one dataset matching `analytics_*` is found in the project, it SHALL be pre-selected. The user MAY also type a dataset ID manually.

#### Scenario: Dataset dropdown loads after connect
- **WHEN** the BigQuery OAuth has completed and the user opens the settings form
- **THEN** the form SHALL display a dataset dropdown populated with the project's available datasets

#### Scenario: Auto-select single analytics dataset
- **WHEN** exactly one dataset starting with `analytics_` is present in the project
- **THEN** that dataset SHALL be pre-selected in the dropdown, but the user can still change it

#### Scenario: Multiple datasets available
- **WHEN** multiple datasets are present
- **THEN** the dropdown SHALL show all datasets and require the user to explicitly select one

#### Scenario: Dataset ID stored on save
- **WHEN** the user selects a dataset and saves the BigQuery integration
- **THEN** the `datasetId` SHALL be persisted in `providerFields.datasetId`

---

### Requirement: Dataset ID required for agent invocation
If `datasetId` is not set in `BigQueryFields`, the orchestrator SHALL NOT invoke the BigQuery agent. Instead it SHALL return a clear error message directing the user to complete dataset selection in Settings.

#### Scenario: Missing datasetId blocks query
- **WHEN** a user sends a chat message with BigQuery as the active source but `datasetId` is not configured
- **THEN** the assistant SHALL respond with an actionable error: "BigQuery dataset is not configured. Go to Settings > Integrations > BigQuery and select your dataset."
