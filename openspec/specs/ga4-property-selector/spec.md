## ADDED Requirements

### Requirement: List accessible GA4 properties
The system SHALL fetch all GA4 properties accessible to the saved service-account credentials by calling the GA4 Admin API (`analyticsadmin.googleapis.com/v1beta/accounts/-/properties`) server-side. The response SHALL include, for each property, its `propertyId` (format: `properties/XXXXXXXXX`), `displayName`, and parent `accountName`.

#### Scenario: Credentials are valid and properties exist
- **WHEN** a GET request is made to `/api/v1/integrations/google_analytics/properties`
- **THEN** the server returns HTTP 200 with a JSON array of `{ propertyId, displayName, accountName }` objects

#### Scenario: No GA4 integration is configured
- **WHEN** a GET request is made to `/api/v1/integrations/google_analytics/properties` and no GA4 integration record exists
- **THEN** the server returns HTTP 404 with `{ error: "No Google Analytics integration found" }`

#### Scenario: Credentials are invalid or expired
- **WHEN** the GA4 Admin API returns an auth error for the stored credentials
- **THEN** the server returns HTTP 502 with `{ error: "<upstream error message>" }`

---

### Requirement: Select active GA4 property
The system SHALL allow the user to designate one GA4 property as the active property. The selected `propertyId` SHALL be persisted in the integration's `providerFields.propertyId` field.

#### Scenario: Valid property is submitted
- **WHEN** a PUT request is made to `/api/v1/integrations/google_analytics/properties/selected` with body `{ propertyId: "properties/123456789" }`
- **THEN** the server updates the integration record and returns HTTP 200 with `{ propertyId: "properties/123456789" }`

#### Scenario: propertyId format is invalid
- **WHEN** a PUT request is made with a `propertyId` that does not match `properties/\\d+`
- **THEN** the server returns HTTP 400 with `{ error: "Invalid propertyId format" }`

#### Scenario: No GA4 integration exists
- **WHEN** a PUT request is made to `/api/v1/integrations/google_analytics/properties/selected` and no GA4 integration record exists
- **THEN** the server returns HTTP 404

---

### Requirement: Retrieve active GA4 property
The system SHALL expose the currently active GA4 property via a GET endpoint.

#### Scenario: Property has been selected
- **WHEN** a GET request is made to `/api/v1/integrations/google_analytics/properties/selected`
- **THEN** the server returns HTTP 200 with `{ propertyId: "properties/XXXXXXXXX" }`

#### Scenario: No property has been selected yet
- **WHEN** a GET request is made to `/api/v1/integrations/google_analytics/properties/selected` and `providerFields.propertyId` is empty
- **THEN** the server returns HTTP 200 with `{ propertyId: null }`

---

### Requirement: Property selector UI in integration form
The system SHALL replace the manual GA4 Property ID text input with a two-step flow: after credentials are saved, a dropdown is rendered that lists properties fetched from the API, and the user selects one to save as the active property. While the properties are being fetched, the picker SHALL display a three-dot loading placeholder that occupies the same vertical space as the picker trigger, preventing any layout shift when the picker resolves.

#### Scenario: Credentials saved, properties loaded successfully
- **WHEN** the user saves GA4 credentials (service account or OAuth) and the properties API returns results
- **THEN** a dropdown appears listing `displayName (accountName)` for each property, with a "Save property" button

#### Scenario: Properties API call fails after credential save
- **WHEN** the properties API returns an error after credential save
- **THEN** a fallback manual input is shown with an error notice

#### Scenario: User selects a property and saves
- **WHEN** the user selects a property from the dropdown and clicks "Save property"
- **THEN** a PUT request is made to the selected endpoint and the integration card refreshes

#### Scenario: Properties are being fetched after the sidebar renders
- **WHEN** the sidebar renders the Google Analytics row with status "configured"
- **AND** the properties API request has not yet resolved
- **THEN** a three-dot loading placeholder is shown in place of the picker trigger
- **AND** no layout shift occurs when the picker trigger eventually replaces the placeholder

#### Scenario: Properties fetch resolves with an empty list
- **WHEN** the properties API returns an empty array
- **THEN** the placeholder is removed and no picker trigger is rendered

---

### Requirement: Active propertyId injected into chat requests
The system SHALL read the active GA4 `propertyId` from the stored integration and include it in the context passed to the chat orchestrator for every request when a GA4 integration is configured.

#### Scenario: GA4 integration is configured with an active property
- **WHEN** a chat message is submitted
- **THEN** the orchestrator context includes `ga4PropertyId: "properties/XXXXXXXXX"`

#### Scenario: No GA4 integration is configured
- **WHEN** a chat message is submitted and no GA4 integration exists
- **THEN** the orchestrator context includes `ga4PropertyId: null` and no GA4 query is attempted
