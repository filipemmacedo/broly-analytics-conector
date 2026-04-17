## 1. Cleanup Draft BigQuery Code

- [x] 1.1 Delete `src/lib/connectors/bigquery.ts`
- [x] 1.2 Delete `src/lib/providers/bigquery.ts`
- [x] 1.3 Delete `src/app/api/connect/bigquery/start/route.ts`
- [x] 1.4 Delete `src/app/api/connect/bigquery/callback/route.ts`
- [x] 1.5 Remove BigQuery env vars from `src/lib/env.ts` (`bigQueryClientId`, `bigQueryClientSecret`, `bigQueryProjectIds`, `bigQueryMaxBytesBilled`, `hasBigQueryOAuthConfig`)
- [x] 1.6 Remove BigQuery env vars from `.env.local.example`

## 2. Data Model Updates

- [x] 2.1 Update `BigQueryFields` in `src/types/integration.ts` to `{ projectId: string; propertyId: string; propertyName: string }`
- [x] 2.2 Add `isActive: boolean` field to the `Integration` interface in `src/types/integration.ts`
- [x] 2.3 Update `integration-store.ts` to persist and read `isActive`; add `setActiveSource(provider)` helper that sets the given provider's integration to `isActive: true` and all others to `isActive: false`
- [x] 2.4 Add `getActiveIntegration()` helper to `integration-store.ts` that returns the integration with `isActive: true` (or `null`)

## 3. BigQuery OAuth Routes

- [x] 3.1 Create `src/app/api/connect/bigquery/start/route.ts` — reads BigQuery integration from store, builds Google OAuth URL with scopes `bigquery.readonly` + `analytics.readonly`, stores OAuth state in cookie (mirrors GA4 start route)
- [x] 3.2 Create `src/app/api/connect/bigquery/callback/route.ts` — exchanges code for tokens, encrypts and stores tokens in the BigQuery integration record, calls `setActiveSource("bigquery")` to deactivate GA4, redirects to settings page

## 4. BigQuery Property Selection API

- [x] 4.1 Create `src/app/api/integrations/bigquery/properties/route.ts` — reads BigQuery integration access token, calls `GET https://analyticsadmin.googleapis.com/v1beta/properties`, returns `[{ id, displayName }]` (mirrors `src/app/api/integrations/google-analytics/properties/route.ts`)

## 5. BigQuery LLM Agent

- [x] 5.1 Create `src/lib/agents/bigquery-agent.ts` with `runBigQueryAgentTurn(llmConfig, accessToken, projectId, propertyName, question)` function
- [x] 5.2 Define `runBigQueryQuery` tool schema with a `sql` parameter (SELECT/WITH only)
- [x] 5.3 Implement system prompt builder: informs LLM of active project, dataset (`ga4analytics`), property name, instructs SQL-only queries against `projectId.ga4analytics.events_*`
- [x] 5.4 Implement read-only query validator (blocks INSERT, UPDATE, DELETE, MERGE, DROP, ALTER, TRUNCATE, CREATE)
- [x] 5.5 Implement `executeBigQueryQuery(accessToken, projectId, sql)` using sync queries API (`POST /projects/{id}/queries`, `useLegacySql: false`, `timeoutMs: 20000`, `maxResults: 20`)
- [x] 5.6 Implement LLM dispatch for all four providers (Anthropic, OpenAI, Gemini, Mistral) — reuse `callLLMWithTools` pattern from `llm-planner.ts`
- [x] 5.7 Implement result summarization step (send rows back to LLM for natural-language summary)

## 6. Orchestrator Update

- [x] 6.1 Refactor `src/lib/orchestrator.ts` to read active integration via `getActiveIntegration()` instead of checking `healthySources.has("ga4")`
- [x] 6.2 Add dispatch branch: if `activeIntegration.provider === "bigquery"` → call `runBigQueryAgentTurn` with token and providerFields
- [x] 6.3 Add dispatch branch: if `activeIntegration.provider === "google-analytics"` → call `runGA4AgentTurn` (existing logic, unchanged behavior)
- [x] 6.4 Add "no active source" message when `getActiveIntegration()` returns null

## 7. GA4 OAuth Callback Update

- [x] 7.1 Update `src/app/api/connect/ga4/callback/route.ts` to call `setActiveSource("google-analytics")` after successful OAuth, deactivating any active BigQuery integration

## 8. Settings UI

- [x] 8.1 Update BigQuery integration form to include `projectId` text input (required), `clientId` input, `clientSecret` input
- [x] 8.2 Add property selection dropdown to BigQuery settings page (fetches from `/api/integrations/bigquery/properties`, mirrors `GA4PropertySelector` component)
- [x] 8.3 Add confirmation dialog when user initiates OAuth for a source while another source is already active ("This will deactivate your current [GA4/BigQuery] connection. Continue?")
- [x] 8.4 Display active source badge in the integrations list (e.g., "Active" indicator on the currently active integration card)

## 9. README Update

- [x] 9.1 Add a "BigQuery Connector — Known Limitations" section noting: sync queries API has a 20s timeout and is unsuitable for large datasets; migrate to the BigQuery Jobs API (`POST /projects/{id}/jobs`) when queries exceed this limit
