## Why

GA4 is the only integration whose OAuth client credentials live in environment variables rather than the browser UI, making it impossible to connect without server-side config changes. Every other integration (Power BI, BigQuery) lets users enter and store credentials entirely through the settings UI — GA4 must follow the same pattern so it is self-serve and deployable without env changes.

## What Changes

- **BREAKING** — Remove `GA4_OAUTH_CLIENT_ID` and `GA4_OAUTH_CLIENT_SECRET` env vars; GA4 no longer reads from `appEnv`.
- Add a new `oauth2-code-flow` auth type to the integration data model that stores `clientId`, `clientSecret`, and the resulting `accessToken` / `refreshToken` together in one encrypted record.
- The GA4 setup form gains `Client ID` and `Client Secret` fields (matching the Google Cloud Console values); the raw access-token field is removed.
- A **Connect with Google** button replaces the current "Set up" primary action for GA4 once app credentials are saved; clicking it initiates the server-side Authorization Code flow.
- `/api/connect/ga4/start` and `/api/connect/ga4/callback` are rewritten to read app credentials from the integration store instead of env vars.
- The integration store's encryption layer is extended to protect `clientSecret`, `accessToken`, and `refreshToken` for the new auth type.

## Capabilities

### New Capabilities

- `ga4-oauth-code-flow`: End-to-end Google OAuth 2.0 Authorization Code flow for GA4, driven entirely from credentials stored in the integration store — no env vars required.

### Modified Capabilities

- `integration-data-model`: The `AuthConfig` discriminated union gains a new member (`oauth2-code-flow`), and the encryption layer must protect its secret fields.
- `integration-management`: The GA4 settings form and card are updated to reflect the two-phase setup (enter app credentials → connect with Google).

## Impact

- **`src/types/integration.ts`** — new `OAuth2CodeFlowAuthConfig` type and union member
- **`src/lib/integration-store.ts`** — `SECRET_FIELDS` extended for `oauth2-code-flow`
- **`src/lib/env.ts`** — `ga4ClientId`, `ga4ClientSecret`, `hasGA4OAuthConfig` removed
- **`src/app/api/connect/ga4/start/route.ts`** — reads `clientId` from integration store
- **`src/app/api/connect/ga4/callback/route.ts`** — reads `clientId` + `clientSecret` from integration store
- **`src/components/settings/IntegrationForm.tsx`** — GA4 form shows app-credential fields
- **`src/components/settings/IntegrationCard.tsx`** — conditional Connect / Set up button logic
- **No new npm dependencies**
