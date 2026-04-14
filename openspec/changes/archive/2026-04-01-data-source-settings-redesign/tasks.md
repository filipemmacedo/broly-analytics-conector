## 1. Integration Data Model & Storage

- [x] 1.1 Define the `Integration` TypeScript type with discriminated union `authConfig` (`api-key`, `oauth2`, `service-account`, `token-endpoint`) in `src/types/integration.ts`
- [x] 1.2 Implement AES-256-GCM encrypt/decrypt utilities in `src/lib/crypto.ts` using `DATA_ENCRYPTION_KEY` env var
- [x] 1.3 Create the integration store module `src/lib/integration-store.ts` with read/write to `data/integrations.enc.json` (create file if missing, encrypt secrets before write, decrypt on read)
- [x] 1.4 Add masked sentinel constant and `maskSecrets` / `isMarkedValue` helper functions to `src/lib/integration-store.ts`
- [x] 1.5 Add `DATA_ENCRYPTION_KEY` to `.env.local.example` with instructions

## 2. Backend API Routes

- [x] 2.1 Create `GET /api/integrations` route handler — returns all integrations with secrets masked
- [x] 2.2 Create `POST /api/integrations` route handler — validates required fields, encrypts secrets, saves new integration, returns masked record
- [x] 2.3 Create `PUT /api/integrations/[id]` route handler — validates, merges changes (ignoring masked sentinel values), re-encrypts, updates `updatedAt`
- [x] 2.4 Create `DELETE /api/integrations/[id]` route handler — removes integration from store
- [x] 2.5 Create `GET /api/integrations/status` route handler — returns lightweight status summary (no credential fields) for all integrations
- [x] 2.6 Create `POST /api/integrations/[id]/test` route handler — dispatches to provider-specific test adapter, updates `healthState` and `lastCheckedAt`, returns `{ success, error?, testedAt }`

## 3. Provider-Specific Test Adapters

- [x] 3.1 Create `src/lib/providers/powerbi.ts` — implement `testConnection(authConfig)` that calls the Power BI workspace list API and returns pass/fail with error reason
- [x] 3.2 Create `src/lib/providers/google-analytics.ts` — implement `testConnection(authConfig)` that queries GA4 property metadata and returns pass/fail
- [x] 3.3 Create `src/lib/providers/bigquery.ts` — implement `testConnection(authConfig)` that queries BigQuery dataset metadata and returns pass/fail
- [x] 3.4 Add provider adapter registry in `src/lib/providers/index.ts` that maps `provider` string to adapter

## 4. IntegrationContext & Polling

- [x] 4.1 Create `src/context/IntegrationContext.tsx` — React context that fetches `GET /api/integrations/status` on mount and re-fetches every 60s using `setInterval`
- [x] 4.2 Wrap the root layout (`src/app/layout.tsx`) with `IntegrationProvider` so context is available app-wide
- [x] 4.3 Export `useIntegrations()` hook from `IntegrationContext.tsx` for consuming components

## 5. Settings > Integrations Page

- [x] 5.1 Create Settings layout at `src/app/settings/layout.tsx` with left navigation (Integrations link)
- [x] 5.2 Create `src/app/settings/integrations/page.tsx` — renders one `IntegrationCard` per provider (Power BI, Google Analytics, BigQuery)
- [x] 5.3 Build `src/components/settings/IntegrationCard.tsx` — shows provider name, status badge, "Configure" / "Edit" button, and "Test connection" button
- [x] 5.4 Build `src/components/settings/IntegrationForm.tsx` — renders provider-specific fields based on `provider` prop; handles masked credential display; calls create/update API on submit
- [x] 5.5 Add Power BI field set to `IntegrationForm`: display name, tenant ID, client ID, client secret, workspace ID
- [x] 5.6 Add Google Analytics field set to `IntegrationForm`: display name, property ID, credential type selector (service account JSON or OAuth token), credential input
- [x] 5.7 Add BigQuery field set to `IntegrationForm`: display name, project ID, dataset, region, credential type selector (service account JSON or access token), credential input
- [x] 5.8 Implement inline validation in `IntegrationForm` — show per-field errors on submit if required fields are missing
- [x] 5.9 Implement delete confirmation dialog in `IntegrationCard` — show modal before calling DELETE API
- [x] 5.10 Implement "Test connection" button with loading/success/error feedback states in `IntegrationCard`
- [x] 5.11 Add empty state to `IntegrationCard` when provider is not configured (prompt to set up)
- [x] 5.12 Create per-provider routes `src/app/settings/integrations/[provider]/page.tsx` that render the `IntegrationForm` for the given provider

## 6. Sidebar Refactor

- [x] 6.1 Read current `src/components/data-sources-panel.tsx` and identify all interactive/connection management elements to remove
- [x] 6.2 Remove credential inputs, connect/disconnect buttons, endpoint config, and OAuth triggers from `data-sources-panel.tsx`
- [x] 6.3 Replace removed elements with read-only status rows — each row shows provider name, `ConnectionStatusBadge`, and last-checked label
- [x] 6.4 Build `src/components/ui/ConnectionStatusBadge.tsx` — renders a colored badge based on `status` and `healthState` values
- [x] 6.5 Wrap each sidebar source row in a Next.js `<Link href="/settings/integrations/[provider]">` for deep-link navigation
- [x] 6.6 Wire sidebar rows to read from `useIntegrations()` context instead of local component state
- [x] 6.7 Update `src/components/dashboard.tsx` — remove any connection-management props or state passed down to the sidebar

## 7. Chat Layer Integration Awareness

- [x] 7.1 In the chat/assistant handler, import `useIntegrations()` and read available healthy integrations before dispatching a query
- [x] 7.2 Add source-routing logic — map user query intent to required provider; check if that provider is healthy in `IntegrationContext`
- [x] 7.3 Add "source unavailable" response path — when a required provider is not healthy, return a structured message with the provider name and a link to `/settings/integrations/[provider]`

## 8. Migration

- [x] 8.1 On first render of Settings > Integrations, check for any legacy connection state in localStorage or component state
- [x] 8.2 If legacy state is found, display a migration banner offering to import it into the new integration store
- [x] 8.3 After successful migration (or dismissal), clear the legacy state
- [x] 8.4 Remove all legacy connection-setup code from the sidebar component after migration path is verified

## 9. Navigation & Routing

- [x] 9.1 Add a "Settings" link to the main app navigation (header or sidebar footer) pointing to `/settings/integrations`
- [x] 9.2 Add a redirect from `/settings` to `/settings/integrations` as the default settings landing page

## 10. Verification

- [x] 10.1 Verify sidebar renders no interactive connection elements in all three provider states (unconfigured, configured+healthy, error)
- [x] 10.2 Verify Settings > Integrations page: create, edit, delete, and test flows work for all three providers
- [x] 10.3 Verify credentials are masked in all API GET responses after save
- [x] 10.4 Verify masked sentinel is not re-saved when form is submitted without changing a credential field
- [x] 10.5 Verify `GET /api/integrations/status` response contains no secret fields
- [x] 10.6 Verify chat layer returns actionable "source unavailable" message with Settings link when a provider is not connected
- [x] 10.7 Verify sidebar polling updates status badges without a page reload
