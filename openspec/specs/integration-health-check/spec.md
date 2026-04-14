## ADDED Requirements

### Requirement: Connection test endpoint exists per integration
The system SHALL expose `POST /api/integrations/[id]/test` which performs a live server-side validation of the integration's credentials against the provider.

#### Scenario: Successful test returns health OK
- **WHEN** `POST /api/integrations/[id]/test` is called with valid credentials
- **THEN** the response includes `{ success: true, provider, testedAt }` with HTTP 200
- **AND** the integration's `healthState` is updated to `healthy` and `lastCheckedAt` is updated

#### Scenario: Failed test returns structured error
- **WHEN** `POST /api/integrations/[id]/test` is called and the provider rejects the credentials
- **THEN** the response includes `{ success: false, error: "<reason>" }` with HTTP 200 (not 5xx)
- **AND** the integration's `status` is updated to `error` and `healthState` to `unreachable`

#### Scenario: Test for unknown integration returns 404
- **WHEN** `POST /api/integrations/[unknown-id]/test` is called
- **THEN** the response returns HTTP 404

---

### Requirement: Bulk status endpoint returns all integration health states
The system SHALL expose `GET /api/integrations/status` which returns a lightweight status summary for all integrations without credential data.

#### Scenario: Status endpoint returns all providers
- **WHEN** `GET /api/integrations/status` is called
- **THEN** the response lists all known integrations with their `provider`, `status`, `healthState`, and `lastCheckedAt`
- **AND** no credential fields are included in the response

---

### Requirement: Power BI health check validates workspace access
The Power BI connection test SHALL verify that the configured credentials can successfully authenticate and list accessible workspaces.

#### Scenario: Power BI test calls workspace list API
- **WHEN** the Power BI integration test runs
- **THEN** the system makes a request to the Power BI API using the stored credentials
- **AND** a 200 response with workspace data is treated as a passing health check

---

### Requirement: Google Analytics health check validates property access
The Google Analytics connection test SHALL verify that the configured credentials can access the specified GA4 property.

#### Scenario: GA4 test calls property metadata API
- **WHEN** the Google Analytics integration test runs
- **THEN** the system queries the GA4 property metadata using the stored credentials
- **AND** a successful metadata response is treated as a passing health check

---

### Requirement: BigQuery health check validates dataset access
The BigQuery connection test SHALL verify that the configured credentials can access the specified project and dataset.

#### Scenario: BigQuery test queries dataset metadata
- **WHEN** the BigQuery integration test runs
- **THEN** the system queries the BigQuery dataset metadata using the stored credentials
- **AND** a successful metadata response is treated as a passing health check

---

### Requirement: Health state is refreshed at a minimum every 60 seconds on the client
The frontend SHALL re-fetch `GET /api/integrations/status` at least every 60 seconds while the sidebar is mounted, updating status badges without a page reload.

#### Scenario: Polling updates sidebar state
- **WHEN** 60 seconds pass while the sidebar is mounted
- **THEN** the client calls `GET /api/integrations/status`
- **AND** any changed `healthState` values are reflected in the sidebar status badges
