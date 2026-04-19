## ADDED Requirements

### Requirement: LLM connection status type
The system SHALL define an `LLMStatus` union type in `types/llm.ts` with values: `"unconfigured" | "configured" | "ok" | "error"`. `LLMSettings` and `PublicLLMSettings` SHALL include `status: LLMStatus` and `lastTestedAt: string | null`.

#### Scenario: LLMSettings includes status fields
- **WHEN** `getLLMSettings()` is called and a config file exists
- **THEN** the returned object includes `status` (one of the four `LLMStatus` values) and `lastTestedAt` (ISO string or null)

#### Scenario: Missing fields in store file default gracefully
- **WHEN** an existing `llm-settings.enc.json` file has no `status` or `lastTestedAt` fields
- **THEN** `getLLMSettings()` returns `status: "configured"` and `lastTestedAt: null` without throwing

### Requirement: LLM status persisted on save
The system SHALL persist LLM connection status as part of the settings store. When saving with a new API key, `status` SHALL be reset to `"configured"` and `lastTestedAt` SHALL be set to `null`. When saving with the masked sentinel (key unchanged), the existing `status` and `lastTestedAt` SHALL be preserved.

#### Scenario: Saving with a new API key resets status
- **WHEN** `saveLLMSettings` is called with an API key that is not the masked sentinel
- **THEN** the stored `status` is set to `"configured"` and `lastTestedAt` is set to `null`

#### Scenario: Saving with masked sentinel preserves status
- **WHEN** `saveLLMSettings` is called with the masked sentinel as `apiKey`
- **THEN** the stored `status` and `lastTestedAt` are unchanged from their previous values

### Requirement: LLM test result persisted
The system SHALL persist the result of an LLM connection test to the store via `updateLLMTestResult`. On success, `status` SHALL be set to `"ok"` and `lastTestedAt` to the current ISO timestamp. On failure, `status` SHALL be set to `"error"` and `lastTestedAt` to the current ISO timestamp.

#### Scenario: Successful test persists ok status
- **WHEN** a POST to `/api/settings/llm/test` succeeds
- **THEN** `updateLLMTestResult(true)` is called, writing `status: "ok"` and `lastTestedAt: <now>` to the store
- **AND** subsequent GET to `/api/settings/llm` returns `status: "ok"` and the `lastTestedAt` timestamp

#### Scenario: Failed test persists error status
- **WHEN** a POST to `/api/settings/llm/test` fails (provider rejects key)
- **THEN** `updateLLMTestResult(false)` is called, writing `status: "error"` and `lastTestedAt: <now>` to the store

### Requirement: LLM GET endpoint exposes status fields
The `/api/settings/llm` GET endpoint SHALL include `status` and `lastTestedAt` in its response body when a config exists.

#### Scenario: LLM config has been saved
- **WHEN** a GET request is made to `/api/settings/llm`
- **THEN** the server returns HTTP 200 with `{ provider, model, apiKeyMasked, configuredAt, status, lastTestedAt }`

#### Scenario: No LLM config has been saved
- **WHEN** a GET request is made to `/api/settings/llm` and no config file exists
- **THEN** the server returns HTTP 200 with `{ provider: null, model: null, apiKeyMasked: null, configuredAt: null, status: null, lastTestedAt: null }`

## MODIFIED Requirements

### Requirement: LLM Provider Settings UI
The system SHALL render an "LLM Provider" card on the Settings page with: a persistent status badge in the card header, provider dropdown, model dropdown (populated for the selected provider), masked API key input, "Test Connection" button, and "Save" button. The UI SHALL match the existing dark-red card-based style.

The status badge SHALL apply the unified connection state vocabulary, mapping `LLMStatus` to the badge's tone and label:
- `unconfigured` → grey, "Not set up"
- `configured` → amber, "Not verified"
- `ok` → green, "Connected" (with `lastTestedAt` shown as relative time)
- `error` → red, "Connection error" (with `lastTestedAt` shown as relative time)

#### Scenario: User selects a different provider
- **WHEN** the user changes the provider dropdown
- **THEN** the model dropdown is repopulated with models for the new provider and the previously selected model is cleared

#### Scenario: User saves new configuration
- **WHEN** the user fills in provider, model, and API key and clicks Save
- **THEN** a PUT request is made to `/api/settings/llm` and the card refreshes to show the masked key and an amber "Not verified" badge

#### Scenario: User tests the connection successfully
- **WHEN** the user clicks "Test Connection" and the test succeeds
- **THEN** a POST request is made to `/api/settings/llm/test`, the result is persisted, and the status badge updates to green "Connected" with a "just now" timestamp

#### Scenario: User tests the connection and it fails
- **WHEN** the user clicks "Test Connection" and the provider rejects the key
- **THEN** the status badge updates to red "Connection error" with a "just now" timestamp

#### Scenario: Card loads with previously tested config
- **WHEN** the settings card loads and a config with `status: "ok"` and a `lastTestedAt` timestamp exists
- **THEN** the status badge displays green "Connected" with the relative time since last tested

#### Scenario: API key field shows masked value when config exists
- **WHEN** the settings card loads and a key has been saved
- **THEN** the API key input displays only the last 4 characters preceded by masking characters
