## MODIFIED Requirements

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
