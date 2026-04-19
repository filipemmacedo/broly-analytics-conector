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
When the user selects a GA4 property via the Admin API dropdown, the server SHALL automatically derive the BigQuery export dataset name by stripping the `properties/` prefix from the property ID and prepending `analytics_` (e.g. `properties/516611632` → `analytics_516611632`). This derived `datasetId` SHALL be persisted in `providerFields.datasetId` alongside `propertyId` and `propertyName` in the same write. The user MAY override the value manually in the integration form.

#### Scenario: Dataset derived and saved on property selection
- **WHEN** the user selects a GA4 property with ID `properties/516611632`
- **THEN** `datasetId` SHALL be saved as `analytics_516611632` in `providerFields`

#### Scenario: User overrides derived dataset
- **WHEN** the pre-derived `datasetId` does not match the user's actual export dataset
- **THEN** the user SHALL be able to manually edit the Dataset ID field in the integration form and save the override

---

### Requirement: Dataset ID display and override in BigQuery settings form
The system SHALL display a Dataset ID field in the BigQuery integration form. The field SHALL show the current `datasetId` (auto-derived from property selection) with a hint explaining it is set automatically. The user MAY override the value by typing a custom dataset name.

#### Scenario: Dataset ID shown after property selection
- **WHEN** the user has selected a GA4 property and the auto-derived `datasetId` is stored
- **THEN** the Dataset ID field SHALL display the derived value (e.g. `analytics_516611632`)

#### Scenario: Dataset ID stored on form save
- **WHEN** the user saves the BigQuery integration form with a manually entered `datasetId`
- **THEN** the manually entered value SHALL be persisted in `providerFields.datasetId`, overriding the auto-derived value

---

### Requirement: Dataset ID required for agent invocation
If `datasetId` is not set in `BigQueryFields`, the orchestrator SHALL NOT invoke the BigQuery agent. Instead it SHALL return a clear error message directing the user to complete dataset selection in Settings.

#### Scenario: Missing datasetId blocks query
- **WHEN** a user sends a chat message with BigQuery as the active source but `datasetId` is not configured
- **THEN** the assistant SHALL respond with: "BigQuery dataset is not configured. Select a GA4 property in Settings > Integrations > BigQuery."
