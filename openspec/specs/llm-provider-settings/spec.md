## ADDED Requirements

### Requirement: Retrieve current LLM configuration
The system SHALL expose the current LLM provider settings via a GET endpoint. The API key SHALL never be returned in plain text; only the last 4 characters SHALL be visible.

#### Scenario: LLM config has been saved
- **WHEN** a GET request is made to `/api/v1/settings/llm`
- **THEN** the server returns HTTP 200 with `{ provider, model, apiKeyMasked, configuredAt }`

#### Scenario: No LLM config has been saved
- **WHEN** a GET request is made to `/api/v1/settings/llm` and no config file exists
- **THEN** the server returns HTTP 200 with `{ provider: null, model: null, apiKeyMasked: null, configuredAt: null }`

---

### Requirement: Save LLM provider configuration
The system SHALL accept provider, model, and API key via a PUT endpoint. The API key SHALL be encrypted with AES-256-GCM before being written to disk. If the submitted API key is the masked sentinel value, the existing key SHALL be kept unchanged.

#### Scenario: New configuration is submitted
- **WHEN** a PUT request is made to `/api/v1/settings/llm` with `{ provider, model, apiKey }`
- **THEN** the server encrypts the API key, persists the config, and returns HTTP 200 with the masked config object

#### Scenario: provider or model is missing
- **WHEN** a PUT request is made without `provider` or without `model`
- **THEN** the server returns HTTP 400 with `{ error: "provider and model are required" }`

#### Scenario: Masked sentinel is submitted as apiKey
- **WHEN** a PUT request is made with `apiKey` equal to the masked sentinel
- **THEN** the server keeps the existing encrypted key unchanged

---

### Requirement: List available models per provider
The system SHALL return a static list of supported models for a given provider.

#### Scenario: Valid provider queried
- **WHEN** a GET request is made to `/api/v1/settings/llm/models?provider=anthropic`
- **THEN** the server returns HTTP 200 with `{ models: [{ id, displayName }] }`

#### Scenario: Unknown provider queried
- **WHEN** a GET request is made with an unsupported `provider` value
- **THEN** the server returns HTTP 400 with `{ error: "Unknown provider" }`

#### Scenario: No provider query param
- **WHEN** a GET request is made to `/api/v1/settings/llm/models` without a `provider` param
- **THEN** the server returns HTTP 200 with the full provider-to-models map

---

### Requirement: Test LLM connection
The system SHALL allow the user to validate a configured API key by sending a minimal completion request to the provider. The endpoint SHALL return success status and latency.

#### Scenario: Valid key and model, provider responds
- **WHEN** a POST request is made to `/api/v1/settings/llm/test`
- **THEN** the server calls the configured provider with a 1-token completion and returns `{ ok: true, latencyMs: <number> }`

#### Scenario: Provider returns auth error
- **WHEN** the provider rejects the API key
- **THEN** the server returns HTTP 200 with `{ ok: false, latencyMs: <number>, error: "<message>" }`

#### Scenario: No LLM config saved yet
- **WHEN** a POST request is made to `/api/v1/settings/llm/test` and no config exists
- **THEN** the server returns HTTP 400 with `{ error: "No LLM configuration found" }`

---

### Requirement: LLM Provider Settings UI
The system SHALL render an "LLM Provider" card on the Settings page with: provider dropdown, model dropdown (populated for the selected provider), masked API key input, "Test Connection" button, and "Save" button. The UI SHALL match the existing dark-red card-based style.

#### Scenario: User selects a different provider
- **WHEN** the user changes the provider dropdown
- **THEN** the model dropdown is repopulated with models for the new provider and the previously selected model is cleared

#### Scenario: User saves new configuration
- **WHEN** the user fills in provider, model, and API key and clicks Save
- **THEN** a PUT request is made to `/api/v1/settings/llm` and the card refreshes to show the masked key

#### Scenario: User tests the connection
- **WHEN** the user clicks "Test Connection" and the config has been saved
- **THEN** a POST request is made to `/api/v1/settings/llm/test`, a spinner is shown while pending, and the result (`Connected - Xms` or error message) is displayed inline

#### Scenario: API key field shows masked value when config exists
- **WHEN** the settings card loads and a key has been saved
- **THEN** the API key input displays only the last 4 characters preceded by masking characters

---

### Requirement: LLM config injected into chat context
The system SHALL read the saved LLM provider, model, and decrypted API key from the settings store and make them available to the chat orchestrator on every request.

#### Scenario: LLM config is saved
- **WHEN** a chat message is submitted
- **THEN** the orchestrator receives `llmConfig: { provider, model, apiKey }` in its context

#### Scenario: No LLM config is saved
- **WHEN** a chat message is submitted and no LLM config file exists
- **THEN** the orchestrator receives `llmConfig: null` and falls back to rule-based planning

---

### Requirement: Settings navigation includes LLM Provider
The Settings layout SHALL include "LLM Provider" as a navigation entry alongside "Integrations".

#### Scenario: User visits Settings
- **WHEN** the user navigates to `/settings`
- **THEN** the sidebar/nav shows both "Integrations" and "LLM Provider" links

#### Scenario: User navigates to LLM Provider page
- **WHEN** the user clicks "LLM Provider" in the settings nav
- **THEN** they are taken to `/settings/llm` which renders the LLM Provider card
