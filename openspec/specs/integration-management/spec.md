## ADDED Requirements

### Requirement: Settings Integrations page exists
The system SHALL provide a dedicated Settings > Integrations page at `/settings/integrations` that lists all supported provider integrations and allows full CRUD management.

#### Scenario: Page renders with all providers listed
- **WHEN** the user navigates to `/settings/integrations`
- **THEN** the page displays one integration card per supported provider (Power BI, Google Analytics, BigQuery)
- **AND** each card shows the provider name, current status, and available actions

#### Scenario: GA4 card shows two-phase setup actions
- **WHEN** the user navigates to the Google Analytics integration card with no integration saved
- **THEN** the primary action button reads "Set up" (opens credential form)

#### Scenario: GA4 card shows Connect button after credentials saved
- **WHEN** a `google-analytics` integration exists with `authType: "oauth2-code-flow"` and a `clientId` but no `accessToken`
- **THEN** the primary action button reads "Connect with Google"

#### Scenario: GA4 card shows Reconnect button after successful OAuth
- **WHEN** a `google-analytics` integration exists with `authType: "oauth2-code-flow"` and a non-empty `accessToken`
- **THEN** the primary action button reads "Reconnect with Google"

---

### Requirement: User can create a new integration
The system SHALL allow the user to create a new integration by filling in provider-specific credential fields and saving.

#### Scenario: GA4 form collects Client ID and Client Secret
- **WHEN** the user opens the Google Analytics setup form
- **THEN** the form shows a "Client ID" text field and a "Client Secret" password field
- **AND** no raw access token input is shown for the `oauth2-code-flow` credential type

#### Scenario: Successful creation with API key auth
- **WHEN** the user fills in all required fields for an API key integration and clicks Save
- **THEN** the system persists the integration with encrypted credentials
- **AND** shows a success confirmation
- **AND** the card updates to reflect "Configured" status

#### Scenario: Validation error on missing required field
- **WHEN** the user submits a form with one or more required fields empty
- **THEN** the system displays inline validation errors for each missing field
- **AND** does not persist the integration

---

### Requirement: User can edit an existing integration
The system SHALL allow the user to edit an existing integration's display name and credentials.

#### Scenario: Credential fields show masked values
- **WHEN** the user opens the edit form for a configured integration
- **THEN** secret fields (API keys, tokens, service account JSON) display a masked placeholder (e.g., `••••••••`)
- **AND** the user must explicitly clear and re-enter a value to change it

#### Scenario: Partial edit — display name only
- **WHEN** the user changes only the display name and saves
- **THEN** the system updates the display name
- **AND** existing masked credentials remain unchanged

---

### Requirement: User can delete an integration
The system SHALL allow the user to permanently delete an integration and all associated credential data.

#### Scenario: Delete with confirmation
- **WHEN** the user clicks Delete on an integration card
- **THEN** the system shows a confirmation dialog before proceeding
- **AND** on confirmation, removes the integration from storage
- **AND** the card reverts to the empty/unconfigured state

#### Scenario: Delete cancellation
- **WHEN** the user clicks Delete but then cancels the confirmation
- **THEN** the integration is not deleted and remains unchanged

---

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

---

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

---

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

---

### Requirement: Power BI provider fields
The system SHALL require the following fields for a Power BI integration: display name, tenant ID, client ID, client secret (or API key), and workspace ID.

#### Scenario: Power BI form renders correct fields
- **WHEN** the user opens the Power BI integration form
- **THEN** fields for tenant ID, client ID, client secret, and workspace ID are visible and labeled clearly

---

### Requirement: Google Analytics provider fields
The system SHALL require the following fields for a Google Analytics integration: display name, property ID, and either service account JSON credentials or browser-entered OAuth app credentials (`clientId` and `clientSecret`) used for the authorization code flow.

#### Scenario: GA4 form renders correct fields
- **WHEN** the user opens the Google Analytics integration form
- **THEN** fields for property ID and credential input (service account JSON or OAuth app credentials) are visible

---

### Requirement: BigQuery provider fields
The system SHALL require the following fields for a BigQuery integration: display name, project ID, dataset, region, and either a service account JSON or an access token.

#### Scenario: BigQuery form renders correct fields
- **WHEN** the user opens the BigQuery integration form
- **THEN** fields for project ID, dataset, region, and credential input are visible and labeled clearly

---

### Requirement: Credentials are never returned in plaintext after save
The system SHALL mask all secret credential fields in API responses after the initial save operation.

#### Scenario: GET response masks secrets
- **WHEN** the frontend fetches an existing integration via the API
- **THEN** all secret fields (tokens, keys, JSON blobs) are replaced with a masked sentinel value
- **AND** the raw credential value is not present in the HTTP response body
