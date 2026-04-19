## MODIFIED Requirements

### Requirement: User can test a connection
The system SHALL allow the user to trigger a server-side connection test for any configured integration. After a test, the integration card SHALL reflect the updated `status` and `healthState` returned by the server.

#### Scenario: Successful connection test
- **WHEN** the user clicks "Test connection" for a configured integration
- **THEN** the system calls the provider's validation endpoint server-side
- **AND** displays a success message
- **AND** the status badge updates to reflect the current `status` and `healthState` from the server

#### Scenario: Failed connection test
- **WHEN** the server-side test returns an error (auth failure, network error, invalid credentials)
- **THEN** the system displays an actionable error message describing the failure reason
- **AND** updates the integration status to `error`

#### Scenario: Test on unconfigured integration is blocked
- **WHEN** the user attempts to test an integration that has no saved credentials
- **THEN** the test button is disabled or the system returns a validation error without calling the provider

## ADDED Requirements

### Requirement: Integration card status badge uses unified vocabulary
The `ConnectionStatusBadge` component SHALL apply the unified connection state vocabulary. The tone and label mappings SHALL be:

- `status: "unconfigured"` → tone-neutral, label "Not set up"
- `status: "expired"` → tone-warning (amber), label "Needs reconnect"
- `status: "error"` → tone-error (red), label "Connection error"
- `status: "configured"` + `healthState: "unreachable"` → tone-error (red), label "Connection error"
- `status: "configured"` + `healthState: "degraded"` → tone-warning (amber), label "Degraded"
- `status: "configured"` + `healthState: "unknown"` → tone-warning (amber), label "Not verified"
- `status: "configured"` + `healthState: "healthy"` → tone-connected (green), label "Connected"

#### Scenario: Expired badge renders amber, not red
- **WHEN** `ConnectionStatusBadge` receives `status: "expired"`
- **THEN** it renders with CSS class `tone-warning` (amber) and label text "Needs reconnect"
- **AND** it does NOT render with `tone-error` (red)

#### Scenario: Unknown healthState badge renders amber
- **WHEN** `ConnectionStatusBadge` receives `status: "configured"` and `healthState: "unknown"`
- **THEN** it renders with CSS class `tone-warning` (amber) and label text "Not verified"
- **AND** it does NOT render with `tone-connected` (green)

#### Scenario: Null integration renders grey Not set up badge
- **WHEN** the integration card renders with no integration (null)
- **THEN** the badge displays `tone-neutral` (grey) and label "Not set up"

### Requirement: Integration card shows explanation text when expired
When an integration has `status: "expired"`, the integration card SHALL display an inline explanation sentence below the badge: "Your Google authorization has expired." (for OAuth providers) to explain why reconnection is needed.

#### Scenario: Expired GA4 integration shows explanation
- **WHEN** a Google Analytics integration has `status: "expired"`
- **THEN** the card body shows the text "Your Google authorization has expired." below the status badge
- **AND** the primary action button reads "Reconnect with Google"

#### Scenario: Expired BigQuery integration shows explanation
- **WHEN** a BigQuery integration has `status: "expired"`
- **THEN** the card body shows the text "Your Google authorization has expired." below the status badge
- **AND** the primary action button reads "Reconnect with Google"
