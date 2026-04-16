## ADDED Requirements

### Requirement: Integration entity has required base fields
Every integration record SHALL include: `id` (UUID), `provider`, `displayName`, `authType`, `authConfig`, `status`, `healthState`, `lastCheckedAt`, `createdAt`, and `updatedAt`.

#### Scenario: New integration is created with all base fields
- **WHEN** a new integration is saved
- **THEN** the stored record contains all required base fields
- **AND** `id` is a newly generated UUID
- **AND** `createdAt` and `updatedAt` are set to the current ISO timestamp

---

### Requirement: Integration supports typed auth configurations
The `authConfig` field SHALL be a discriminated union typed by `authType`, supporting: `api-key`, `oauth2`, `service-account`, `token-endpoint`, and `oauth2-code-flow`.

The `oauth2-code-flow` member SHALL carry:
- `clientId` (string, plain - public identifier, appears in OAuth URLs)
- `clientSecret` (string, secret - encrypted at rest)
- `accessToken` (optional string, secret - encrypted at rest, obtained after user authorization)
- `refreshToken` (optional string, secret - encrypted at rest)
- `expiresAt` (optional number - Unix ms timestamp of access token expiry)
- `scope` (optional string)

#### Scenario: API key auth config is stored correctly
- **WHEN** an integration with `authType: "api-key"` is saved
- **THEN** `authConfig` contains an `apiKey` field (encrypted at rest)

#### Scenario: Service account auth config is stored correctly
- **WHEN** an integration with `authType: "service-account"` is saved
- **THEN** `authConfig` contains a `serviceAccountJson` field (encrypted at rest)

#### Scenario: Token endpoint auth config is stored correctly
- **WHEN** an integration with `authType: "token-endpoint"` is saved
- **THEN** `authConfig` contains `token` and `endpoint` fields (token encrypted at rest)

#### Scenario: OAuth2 code flow app credentials are stored with partial encryption
- **WHEN** an integration with `authType: "oauth2-code-flow"` is saved with `clientId` and `clientSecret`
- **THEN** `clientSecret` is encrypted at rest
- **AND** `clientId` is stored in plain text
- **AND** `accessToken` and `refreshToken`, when present, are encrypted at rest

#### Scenario: OAuth2 code flow record is valid without access token
- **WHEN** an integration with `authType: "oauth2-code-flow"` is saved containing only `clientId` and `clientSecret`
- **THEN** the record is persisted successfully with `status: "configured"`
- **AND** `accessToken` is absent from the record

---

### Requirement: Integration status reflects configuration and health
The `status` field SHALL be one of: `configured`, `unconfigured`, `error`, `expired`.

#### Scenario: Status is set to configured after successful save
- **WHEN** an integration is saved with all required credential fields present
- **THEN** `status` is set to `configured`

#### Scenario: Status transitions to error after failed health check
- **WHEN** a health check or connection test fails for a configured integration
- **THEN** `status` is updated to `error`
- **AND** `healthState` is updated to `unreachable` or `degraded`

---

### Requirement: Credentials are encrypted at rest
All secret fields within `authConfig` SHALL be encrypted using AES-256-GCM with a server-side key before being persisted to storage.

Secret fields by `authType`:
- `api-key`: `apiKey`
- `oauth2`: `accessToken`, `refreshToken`
- `service-account`: `serviceAccountJson`
- `token-endpoint`: `token`
- `oauth2-code-flow`: `clientSecret`, `accessToken`, `refreshToken`

#### Scenario: Secret field is encrypted before write
- **WHEN** an integration with credential data is persisted
- **THEN** the raw credential value is not present in plain text in the storage file
- **AND** the encrypted value can be decrypted with the correct key to reproduce the original

#### Scenario: Masked sentinel is rejected on save
- **WHEN** the frontend submits a credential field containing the masked sentinel value (e.g., `••••••••`)
- **THEN** the server rejects or ignores that field and retains the existing encrypted value
