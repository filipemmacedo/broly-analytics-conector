## ADDED Requirements

### Requirement: Snowflake appears as a configurable integration provider
The system SHALL expose Snowflake as a selectable provider in the integrations settings page, alongside Power BI, Google Analytics, and BigQuery.

#### Scenario: Snowflake card visible on integrations page
- **WHEN** the user visits Settings > Integrations
- **THEN** a Snowflake card is displayed with a description and a "Set up" button

---

### Requirement: User can save Snowflake credentials via the integration form
The system SHALL allow the user to configure a Snowflake integration by providing a display name, account identifier, and PAT token. The PAT token SHALL be stored encrypted at rest and masked (sentinel value) in all API responses.

#### Scenario: Form saves credentials successfully
- **WHEN** the user fills in a display name, a valid account identifier, and a PAT token and submits the form
- **THEN** the integration is created with `authType: "api-key"`, the token stored in `authConfig.apiKey`, and the account identifier stored in `providerFields.accountId`

#### Scenario: Form validation rejects missing required fields
- **WHEN** the user submits the form with an empty account identifier or empty PAT token
- **THEN** inline validation errors are shown and the form is not submitted

#### Scenario: Existing token is masked on edit
- **WHEN** the user opens the edit form for an already-configured Snowflake integration
- **THEN** the PAT token field shows the masked sentinel (`••••••••`) and the account identifier is pre-filled

---

### Requirement: Snowflake connection can be tested
The system SHALL provide a "Test connection" action for Snowflake integrations. The test SHALL execute `SELECT CURRENT_TIMESTAMP()` via the Snowflake SQL API using the stored PAT token and account identifier, and return success or a descriptive error.

#### Scenario: Test succeeds with valid credentials
- **WHEN** the user clicks "Test connection" and the PAT token is valid
- **THEN** the integration status updates to `configured` / `healthy` and a success message is shown

#### Scenario: Test fails with an invalid or expired token
- **WHEN** the user clicks "Test connection" and the token is invalid or expired
- **THEN** an error message is shown prompting the user to regenerate the PAT token in Snowflake

#### Scenario: Test fails with a wrong account identifier
- **WHEN** the user clicks "Test connection" and the account identifier is incorrect
- **THEN** an error message is shown indicating the account could not be reached

---

### Requirement: Snowflake integration can be deleted
The system SHALL allow the user to delete a Snowflake integration, which removes all stored credentials.

#### Scenario: Delete removes the integration
- **WHEN** the user confirms deletion of the Snowflake integration
- **THEN** the integration is removed and the card returns to "Not configured" state
