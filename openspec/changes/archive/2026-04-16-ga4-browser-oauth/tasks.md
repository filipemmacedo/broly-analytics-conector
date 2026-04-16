## 1. Data Model — Add `oauth2-code-flow` auth type

- [x] 1.1 Add `OAuth2CodeFlowAuthConfig` type to `src/types/integration.ts` with fields: `authType: "oauth2-code-flow"`, `clientId: string`, `clientSecret: string`, `accessToken?: string`, `refreshToken?: string`, `expiresAt?: number`, `scope?: string`
- [x] 1.2 Add `"oauth2-code-flow"` to the `AuthType` union in `src/types/integration.ts`
- [x] 1.3 Add `OAuth2CodeFlowAuthConfig` to the `AuthConfig` discriminated union in `src/types/integration.ts`
- [x] 1.4 Add masked sentinel entry for `oauth2-code-flow` to `MaskedAuthConfig` in `src/types/integration.ts`

## 2. Integration Store — Encryption for new type

- [x] 2.1 Add `"oauth2-code-flow": ["clientSecret", "accessToken", "refreshToken"]` to `SECRET_FIELDS` in `src/lib/integration-store.ts`

## 3. Env cleanup — Remove GA4 env vars already added in a prior pass

> `src/lib/env.ts` was already modified in a prior pass and currently contains wrong GA4 entries that must be removed.

- [x] 3.1 Remove `ga4ClientId: process.env.GA4_OAUTH_CLIENT_ID ?? ""` and `ga4ClientSecret: process.env.GA4_OAUTH_CLIENT_SECRET ?? ""` from the `appEnv` object in `src/lib/env.ts` (already present — delete them)
- [x] 3.2 Remove the `hasGA4OAuthConfig()` function entirely from `src/lib/env.ts` (already present — delete it)
- [x] 3.3 Keep `"ga4"` in the `getRedirectUri` union — that is correct and must stay
- [x] 3.4 Remove `GA4_OAUTH_CLIENT_ID` and `GA4_OAUTH_CLIENT_SECRET` block from `.env.local.example` — **these lines currently contain real credential values that must not remain in the repo**

## 4. OAuth Routes — Rewrite to read from integration store (not env vars)

> Both route files already exist but use the wrong approach (env vars). They must be fully rewritten.

- [x] 4.1 Rewrite `src/app/api/connect/ga4/start/route.ts`:
  - Remove import of `appEnv` and `hasGA4OAuthConfig` from `@/lib/env`
  - Add import of `getAllIntegrations` from `@/lib/integration-store`
  - Look up the `google-analytics` integration; cast its `authConfig` to `OAuth2CodeFlowAuthConfig`
  - If no integration or `authConfig.authType !== "oauth2-code-flow"` or no `clientId` → redirect to `/settings/integrations/google-analytics?ga4_error=not_configured`
  - Build Google auth URL using `authConfig.clientId` (not `appEnv.ga4ClientId`)
  - Keep CSRF cookie logic unchanged
- [x] 4.2 Rewrite `src/app/api/connect/ga4/callback/route.ts`:
  - Remove import of `appEnv` and `hasGA4OAuthConfig` from `@/lib/env`
  - Add import of `getAllIntegrations` and `updateIntegration` from `@/lib/integration-store`
  - After CSRF validation, look up the `google-analytics` integration; read `clientId` and `clientSecret` from its `authConfig` (cast to `OAuth2CodeFlowAuthConfig`)
  - If missing → redirect with `ga4_error=not_configured`
  - Use `authConfig.clientId` and `authConfig.clientSecret` (not env vars) for the token exchange POST
  - On success: call `updateIntegration` with only the token fields (`accessToken`, `refreshToken`, `expiresAt`, `scope`) — do NOT overwrite `clientId` or `clientSecret`
  - Keep the `createIntegration` fallback path for the case where no existing record is found

## 5. Settings Form — Replace wrong GA4 fields with correct ones

> `src/components/settings/IntegrationForm.tsx` was partially modified in a prior pass. The `GoogleAnalyticsFields` component currently has a dropdown with value `"oauth2"` and renders a hint message. `buildAuthConfig` still emits `authType: "oauth2"`. All of this must be replaced.

- [x] 5.1 In `GoogleAnalyticsFields`: change the default credential type from `"oauth2"` to `"oauth2-code-flow"` (change `values.credentialType ?? "oauth2"` → `values.credentialType ?? "oauth2-code-flow"`)
- [x] 5.2 In `GoogleAnalyticsFields`: rename the dropdown option value from `"oauth2"` to `"oauth2-code-flow"` (label stays "Google OAuth 2.0 (recommended)")
- [x] 5.3 In `GoogleAnalyticsFields`: replace the hint message paragraph (currently shown for `credType === "oauth2"`) with a `Client ID` text input (placeholder: `441744xxx.apps.googleusercontent.com`) and a `Client Secret` password input (placeholder: `GOCSPX-...`) shown when `credType === "oauth2-code-flow"`
- [x] 5.4 In `buildAuthConfig`: for `google-analytics` + `oauth2-code-flow`, return `{ authType: "oauth2-code-flow", clientId: values.clientId ?? "", clientSecret: values.clientSecret ?? "" }` — remove the current fallback that returns `{ authType: "oauth2", accessToken: values.accessToken ?? "" }`
- [x] 5.5 In `validate`: for `google-analytics` + `oauth2-code-flow`, require `clientId` (non-empty) and require `clientSecret` (non-empty and not `MASKED_SENTINEL`) — remove the old `oauth2` / `accessToken` validation path
- [x] 5.6 In `seedValues`: for `oauth2-code-flow`, seed `credentialType: "oauth2-code-flow"`, `clientId` as plain text from `ac.clientId`, and `clientSecret` as `MASKED_SENTINEL`

## 6. Integration Card — Fix already-broken button logic

> `src/components/settings/IntegrationCard.tsx` was modified in a prior pass. The current logic shows "Connect with Google" when there is NO integration and "Reconnect with Google" when ANY integration exists — it never checks whether the integration actually has `oauth2-code-flow` credentials. This must be corrected.

- [x] 6.1 Replace the primary button block for `google-analytics` with proper three-way logic:
  - No integration → `"Set up"` (opens form via `setIsEditing(true)`)
  - Integration exists + `authConfig.authType === "oauth2-code-flow"` + `accessToken` is set → `"Reconnect with Google"` (calls `handleGoogleConnect`)
  - Integration exists + `authConfig.authType === "oauth2-code-flow"` + no `accessToken` → `"Connect with Google"` (calls `handleGoogleConnect`)
  - Integration exists with any other authType (e.g. `service-account`) → `"Edit"` (opens form)
  - Note: `PublicIntegration.authConfig` has masked secrets — check `authConfig.authType` and the presence of `accessToken` field (it will be `MASKED_SENTINEL` not empty when set)
- [x] 6.2 Keep the `handleGoogleConnect` function as-is (`window.location.href = "/api/connect/ga4/start"`)
- [x] 6.3 Keep the secondary "Edit" button for GA4 when integration exists (already present — verify it is retained)

## 7. Settings Page — Verify banner (already correct)

> `src/app/settings/integrations/[provider]/page.tsx` was already updated with banner logic in a prior pass and is correct. No code changes needed — just verify.

- [x] 7.1 Confirm the page reads `?ga4_connected=1` and `?ga4_error=<reason>` on mount, shows the success/error banner, and cleans the URL via `window.history.replaceState` — no changes needed if this is already in place
