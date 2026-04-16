## 1. Dependencies & Types

- [x] 1.1 Install `google-auth-library` (`npm install google-auth-library`)
- [x] 1.2 Extend `GoogleAnalyticsFields` in `src/types/integration.ts` — `propertyId` is already present but document that it is now API-selected (no type change needed, verify format note)
- [x] 1.3 Add `LLMProvider`, `LLMModel`, and `LLMSettings` types to `src/types/llm.ts` (new file)

## 2. GA4 Admin API Helper

- [x] 2.1 Create `src/lib/providers/ga4-admin.ts` — export `listGA4Properties(serviceAccountJson: string): Promise<GA4Property[]>` using `google-auth-library` to mint a JWT and call `analyticsadmin.googleapis.com/v1beta/accounts/-/properties`
- [x] 2.2 Add error handling for auth failures (401/403) and empty property lists in `ga4-admin.ts`

## 3. GA4 Property API Routes

- [x] 3.1 Create `src/app/api/integrations/google_analytics/properties/route.ts` — `GET` handler: find GA4 integration, decrypt service account, call `listGA4Properties`, return array
- [x] 3.2 Create `src/app/api/integrations/google_analytics/properties/selected/route.ts` — `GET` handler: return `{ propertyId }` from integration's `providerFields`
- [x] 3.3 Add `PUT` handler to the selected route: validate `propertyId` format (`/^properties\/\d+$/`), call `updateIntegration`, return updated property

## 4. GA4 Property Selector UI

- [x] 4.1 Create `src/components/settings/GA4PropertySelector.tsx` — a dropdown component that fetches `/api/v1/integrations/google_analytics/properties`, shows `displayName (accountName)`, and emits the selected `propertyId`
- [x] 4.2 Modify `src/components/settings/IntegrationForm.tsx` — for `google-analytics` provider, remove the manual Property ID text input; after a successful credential save, render `GA4PropertySelector` instead
- [x] 4.3 Handle fallback in `GA4PropertySelector`: if the properties API fails, show an error notice and a plain text input for manual entry

## 5. LLM Settings Store

- [x] 5.1 Create `src/lib/llm-settings-store.ts` — file-backed store at `data/llm-settings.enc.json` using the same AES-256-GCM pattern as `integration-store.ts`; export `getLLMSettings()`, `saveLLMSettings(data)`, `maskApiKey(key)` (last 4 chars)
- [x] 5.2 Create `src/lib/llm-model-registry.ts` — static map of `provider → [{ id, displayName }]` for Anthropic, OpenAI, Google, Mistral

## 6. LLM Settings API Routes

- [x] 6.1 Create `src/app/api/settings/llm/route.ts` — `GET` returns masked config; `PUT` validates, encrypts key, persists, returns masked config
- [x] 6.2 Create `src/app/api/settings/llm/models/route.ts` — `GET` with optional `?provider=` param; returns models for that provider or full map
- [x] 6.3 Create `src/app/api/settings/llm/test/route.ts` — `POST` reads saved config, decrypts key, makes a 1-token completion call to the configured provider, returns `{ ok, latencyMs, error? }`
- [x] 6.4 Implement provider-specific ping logic in `src/lib/llm-ping.ts` — one function per provider (Anthropic, OpenAI, Google, Mistral) using `fetch` with minimal payloads; no heavy SDKs

## 7. LLM Provider Settings UI

- [x] 7.1 Create `src/app/settings/llm/page.tsx` — settings page for LLM Provider
- [x] 7.2 Create `src/components/settings/LLMProviderCard.tsx` — card with provider dropdown, model dropdown (dynamic), masked API key input, Test Connection button, Save button; match existing `.integration-card` CSS classes and dark-red button styles
- [x] 7.3 Add model dropdown re-population on provider change using the `/api/v1/settings/llm/models` endpoint
- [x] 7.4 Implement Test Connection inline result (spinner → `Connected — Xms` or error) with 5s auto-dismiss

## 8. Settings Navigation

- [x] 8.1 Add "LLM Provider" nav entry to `src/app/settings/layout.tsx` pointing to `/settings/llm`

## 9. Chat Injection

- [x] 9.1 Modify `src/app/api/chat/route.ts` — read active GA4 `propertyId` from the GA4 integration's `providerFields` and read `LLMSettings` from `llm-settings-store`; pass both as `chatContext` to `handleQuestion`
- [x] 9.2 Modify `src/lib/orchestrator.ts` — extend `handleQuestion` signature to accept optional `chatContext: { ga4PropertyId?: string | null; llmConfig?: LLMSettings | null }`; use `ga4PropertyId` when routing to GA4 source; expose `llmConfig` for future planner use
- [x] 9.3 Verify existing BigQuery and Power BI paths in `orchestrator.ts` are unaffected by the new context parameter

## 10. Verification

- [x] 10.1 Test GA4 properties endpoint end-to-end with a real service account (or mock JSON) — verify property list returns correctly
- [x] 10.2 Test property selection persists across page refresh
- [x] 10.3 Test LLM settings save, mask, and test-ping flow for at least one provider (Anthropic)
- [x] 10.4 Verify chat route still works for BigQuery and Power BI with the new context parameter in place
- [x] 10.5 Run `npm run build` and confirm no TypeScript errors (pre-existing demo-data errors excluded — not introduced by this change)
