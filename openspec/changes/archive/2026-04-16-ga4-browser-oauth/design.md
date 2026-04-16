## Context

The integration store (`src/lib/integration-store.ts`) is the single source of truth for all external service credentials. It persists records to `data/integrations.enc.json` with AES-256-GCM encryption on secret fields. The `AuthConfig` discriminated union (`src/types/integration.ts`) models the credential shape per auth type, and `SECRET_FIELDS` in the store maps each `authType` to the field names that must be encrypted.

Currently `AuthConfig` has four members: `api-key`, `oauth2`, `service-account`, `token-endpoint`. GA4 has been using `oauth2`, which only stores a final access token — it has no concept of the app-level credentials (client ID, client secret) needed to drive an Authorization Code flow server-side.

The `/api/connect/ga4/start` and `/api/connect/ga4/callback` routes exist but read `clientId` and `clientSecret` from `appEnv` (env vars), which breaks the "all credentials in the UI" contract of the integration system.

## Goals / Non-Goals

**Goals:**
- Add `oauth2-code-flow` auth type carrying both app credentials and the resulting user tokens in one encrypted record.
- Rewrite GA4 start/callback routes to source all credentials from the integration store.
- Update the GA4 settings form to collect `clientId` + `clientSecret`, replacing the defunct raw-token field.
- Remove all GA4-specific env vars from `env.ts`.
- Ensure `clientSecret`, `accessToken`, and `refreshToken` are encrypted at rest; `clientId` is stored plain (it is public and appears in OAuth URLs).

**Non-Goals:**
- Automatic token refresh (out of scope; user can re-run Connect with Google).
- GA4 data querying / orchestrator integration (covered by a separate change).
- Changing the Power BI or BigQuery credential flows.
- Multi-account GA4 (one google-analytics integration per app instance).

## Decisions

### D1 — New auth type `oauth2-code-flow` rather than extending `oauth2`

**Decision:** Add a distinct `oauth2-code-flow` discriminated union member instead of adding optional fields to the existing `oauth2` type.

**Rationale:** The existing `oauth2` type is used by other providers (and potentially future ones) that supply a token directly — no client credentials needed. Mixing optional `clientId`/`clientSecret` into `oauth2` would make the type ambiguous and complicate validation. A dedicated type makes the two-phase setup (configure app credentials → authorize) explicit in the type system.

**Alternative considered:** Add `clientId?: string; clientSecret?: string` to `OAuth2AuthConfig`. Rejected because TypeScript narrowing becomes unreliable with optional fields, and the form/route logic would need null-checks everywhere.

### D2 — `clientId` is stored plain; `clientSecret`, `accessToken`, `refreshToken` are encrypted

**Decision:** `SECRET_FIELDS["oauth2-code-flow"] = ["clientSecret", "accessToken", "refreshToken"]`. `clientId` is not encrypted.

**Rationale:** `clientId` is a public identifier — it appears in the OAuth authorization URL that the browser navigates to, and in Google's own documentation examples. Encrypting it gains nothing and would require a decryption step just to build a URL. The three secret fields are sensitive: `clientSecret` authenticates the app to Google's token endpoint; `accessToken` and `refreshToken` grant access to user data.

### D3 — CSRF state stored in a short-lived `httpOnly` cookie

**Decision:** The `ga4_oauth_state` cookie (10-minute TTL, `httpOnly`, `sameSite: lax`) carries the CSRF state between the start and callback routes.

**Rationale:** The legacy BigQuery/Power BI connectors store CSRF state in the server-side session. The GA4 integration lives in the integration store, not the session store, so tying its CSRF state to the session would create an awkward cross-system dependency. A short-lived cookie is self-contained, secure (`httpOnly` prevents JS access), and consistent with standard OAuth PKCE/state patterns.

**Alternative considered:** Store state in the integration record itself (e.g., `pendingOauthState` field). Rejected because it would require a store write before the user has even consented, and a second write to clear it on callback.

### D4 — Upsert logic: update tokens on existing record, create on first connect

**Decision:** The callback checks `getAllIntegrations().find(i => i.provider === "google-analytics")`. If found, call `updateIntegration` for the token fields only (preserve `clientId`, `clientSecret`, `providerFields`). If not found, `createIntegration` with empty `providerFields.propertyId`.

**Rationale:** Preserves the user's app credentials (client ID/secret) and property ID across reconnects — they should not need to re-enter the Client Secret every time a token expires.

### D5 — Two-phase UI: "Set up credentials" then "Connect with Google"

**Decision:** `IntegrationCard` shows **"Set up"** (opens the form for client ID/secret entry) when no integration exists or when `authType !== "oauth2-code-flow"`. Once credentials are saved, the primary button becomes **"Connect with Google"** (navigates to `/api/connect/ga4/start`). After a successful OAuth callback, it becomes **"Reconnect with Google"**.

**Rationale:** Separating credential entry from authorization makes the flow legible: the form is a one-time configuration step; the OAuth button is what actually grants access. Combining them (e.g., a single button that both saves credentials and redirects) would make error handling much harder.

## Risks / Trade-offs

- **Token expiry with no auto-refresh** → Users must click "Reconnect with Google" when the access token expires (~1 hour). Mitigation: the integration card's error state and "Reconnect" labelling make this obvious. Auto-refresh is a follow-up.
- **Single google-analytics integration per app** → The upsert logic uses a `find` by provider, so a second GA4 integration would overwrite tokens. Mitigation: acceptable for now; multi-account is out of scope.
- **`clientSecret` stored server-side encrypted** → If `DATA_ENCRYPTION_KEY` is rotated without a migration, stored credentials become unreadable. Mitigation: existing risk that applies to all integrations; documented in `.env.local.example`.
- **`ga4_oauth_state` cookie survives tab close** → If a user abandons the OAuth flow, the state cookie lingers until the 10-minute TTL. Mitigation: the callback always deletes the cookie on entry regardless of outcome, so a stale cookie from a prior abandoned attempt will cause a `state_mismatch` error and a clear error message rather than a silent wrong-user auth.

## Migration Plan

1. Delete the `GA4_OAUTH_CLIENT_ID` and `GA4_OAUTH_CLIENT_SECRET` env vars from `.env.local` (if set).
2. Delete `data/integrations.enc.json` if it contains a `google-analytics` record with `authType: "oauth2"` — the old record is incompatible and will silently fail token exchange. (Or just delete and re-create via the new form.)
3. Deploy the updated code.
4. Go to Settings → Integrations → Google Analytics → "Set up" → enter Client ID + Client Secret → Save → "Connect with Google".
5. Rollback: revert code; old `oauth2` records in the store remain valid if re-deployed with the old form.

## Open Questions

- None blocking implementation. Token refresh scheduling can be addressed in a follow-up.
