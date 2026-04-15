## ADDED Requirements

### Requirement: GA4 standard report execution
The system SHALL execute GA4 Data API standard reports by calling `POST https://analyticsdata.googleapis.com/v1beta/{propertyId}:runReport` with structured parameters including metrics, dimensions, date ranges, filters, order-by, and row limits.

#### Scenario: Successful report execution
- **WHEN** the GA4 connector receives a valid access token, property ID, and report parameters
- **THEN** it calls the GA4 Data API `runReport` endpoint
- **AND** returns the response rows formatted as a Markdown table string

#### Scenario: GA4 API returns an error
- **WHEN** the GA4 Data API returns a non-200 status (e.g., invalid metric name, expired token)
- **THEN** the connector throws an error with the GA4 API error message
- **AND** the orchestrator catches it and adds an error message to the chat

#### Scenario: Empty report result
- **WHEN** the GA4 Data API returns zero rows (no data for the requested dimensions/date range)
- **THEN** the connector returns a message indicating no data was found for the requested period

---

### Requirement: GA4 access token sourced from stored integration
The system SHALL retrieve the GA4 OAuth access token from the stored `google-analytics` integration record, not from a separate input, when executing a report.

#### Scenario: Token available in integration record
- **WHEN** a `google-analytics` integration exists with a valid OAuth access token
- **THEN** the GA4 connector uses that token for the Authorization header

#### Scenario: No GA4 integration configured
- **WHEN** no `google-analytics` integration record exists or the token is absent
- **THEN** the orchestrator returns a chat message instructing the user to connect GA4 in Settings > Integrations
