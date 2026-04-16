## ADDED Requirements

### Requirement: User can enter GA4 OAuth app credentials in the browser
The system SHALL provide a form for the `google-analytics` provider that collects a Google OAuth 2.0 Client ID and Client Secret entered by the user - no environment variable configuration required.

#### Scenario: Form shows Client ID and Client Secret fields
- **WHEN** the user opens the GA4 integration setup form
- **THEN** the form displays a "Client ID" text input and a "Client Secret" password input
- **AND** no raw access token field is shown for the `oauth2-code-flow` credential type

#### Scenario: Saving app credentials without connecting
- **WHEN** the user fills in Client ID and Client Secret and clicks "Save connection"
- **THEN** the system persists the integration record with `authType: "oauth2-code-flow"`
- **AND** `clientSecret` is encrypted at rest
- **AND** `accessToken` and `refreshToken` are absent (not yet obtained)
- **AND** the integration card primary button changes to "Connect with Google"

---

### Requirement: Connect with Google button initiates the OAuth Authorization Code flow
The system SHALL display a "Connect with Google" button on the GA4 integration card once app credentials are saved, and navigating to it SHALL start a server-side OAuth 2.0 Authorization Code flow.

#### Scenario: Connect button is shown after credentials are saved
- **WHEN** a `google-analytics` integration exists with `authType: "oauth2-code-flow"` and a `clientId`
- **THEN** the integration card displays "Connect with Google" as the primary action button

#### Scenario: Connect button is absent when no credentials are saved
- **WHEN** no `google-analytics` integration exists
- **THEN** the primary action button reads "Set up" and opens the credential form

#### Scenario: Clicking Connect with Google starts the OAuth flow
- **WHEN** the user clicks "Connect with Google"
- **THEN** the browser navigates to `/api/connect/ga4/start`
- **AND** the server redirects the browser to Google's OAuth consent screen
- **AND** the consent screen requests the `analytics.readonly` scope
- **AND** a CSRF state value is stored in a short-lived `httpOnly` cookie

---

### Requirement: OAuth callback exchanges the authorization code for tokens
The system SHALL handle Google's OAuth callback at `/api/connect/ga4/callback`, validate the CSRF state, exchange the authorization code for tokens using the stored app credentials, and persist the resulting tokens.

#### Scenario: Successful authorization stores tokens
- **WHEN** Google redirects to `/api/connect/ga4/callback` with a valid `code` and matching `state`
- **THEN** the server reads `clientId` and `clientSecret` from the `google-analytics` integration record
- **AND** exchanges the code with Google's token endpoint (`https://oauth2.googleapis.com/token`)
- **AND** updates the integration record with the new `accessToken`, `refreshToken`, and `expiresAt`
- **AND** redirects the user to `/settings/integrations/google-analytics?ga4_connected=1`

#### Scenario: State mismatch is rejected
- **WHEN** the `state` parameter in the callback does not match the stored cookie value
- **THEN** the server does NOT exchange the code
- **AND** redirects to `/settings/integrations/google-analytics?ga4_error=state_mismatch`

#### Scenario: Google returns an error
- **WHEN** Google redirects with an `error` parameter (e.g., `access_denied`)
- **THEN** the server redirects to `/settings/integrations/google-analytics?ga4_error=<error>`
- **AND** no tokens are stored

#### Scenario: App credentials missing at callback time
- **WHEN** the callback is triggered but no `google-analytics` integration record with a `clientSecret` exists
- **THEN** the server redirects to `/settings/integrations/google-analytics?ga4_error=not_configured`

---

### Requirement: Settings page shows OAuth outcome feedback after redirect
The system SHALL detect `ga4_connected` or `ga4_error` query parameters on the GA4 settings page after an OAuth redirect and display appropriate feedback.

#### Scenario: Success banner on connected redirect
- **WHEN** the page loads with `?ga4_connected=1` in the URL
- **THEN** a success banner reading "Google Analytics connected successfully." is shown
- **AND** the query parameter is removed from the URL without a page reload

#### Scenario: Error banner on failed redirect
- **WHEN** the page loads with `?ga4_error=<reason>` in the URL
- **THEN** an error banner showing the reason is displayed
- **AND** the query parameter is removed from the URL without a page reload

---

### Requirement: Reconnect with Google refreshes tokens without re-entering credentials
After a successful OAuth flow, the integration card SHALL label the button "Reconnect with Google" to allow token refresh without requiring the user to re-enter their Client ID and Client Secret.

#### Scenario: Button label after first connect
- **WHEN** a `google-analytics` integration has `authType: "oauth2-code-flow"` and a non-empty `accessToken`
- **THEN** the primary action button reads "Reconnect with Google"

#### Scenario: Reconnect preserves existing client credentials
- **WHEN** the user clicks "Reconnect with Google" and completes the OAuth flow
- **THEN** `clientId` and `clientSecret` in the integration record are unchanged
- **AND** only `accessToken`, `refreshToken`, and `expiresAt` are updated
