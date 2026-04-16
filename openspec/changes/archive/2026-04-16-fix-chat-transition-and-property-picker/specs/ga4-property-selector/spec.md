## MODIFIED Requirements

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
