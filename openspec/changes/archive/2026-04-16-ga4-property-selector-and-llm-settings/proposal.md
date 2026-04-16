## Why

Broly's conversational analytics layer currently has no way to pick which GA4 property to query, and the planner is hard-coded with rule-based logic instead of an LLM. These two gaps prevent Broly from being usable for real GA4 customers and from delivering natural-language analytics at scale.

## What Changes

- **GA4 Property Selector**: After saving GA4 service-account credentials, fetch accessible properties from the GA4 Admin API and render a dropdown in the integration form so the user selects the active property. The selected `propertyId` is stored in `providerFields` and injected into every chat/query request automatically.
- **New API routes for GA4 properties**: `GET /api/v1/integrations/google_analytics/properties`, `PUT /api/v1/integrations/google_analytics/properties/selected`, `GET /api/v1/integrations/google_analytics/properties/selected`.
- **LLM Provider Settings**: A new "LLM Provider" section on the Settings page lets users configure which provider (Anthropic, OpenAI, Google, Mistral) and model powers the assistant, supply an API key (stored encrypted), and validate it with a test-connection ping.
- **New API routes for LLM settings**: `GET /api/v1/settings/llm`, `PUT /api/v1/settings/llm`, `POST /api/v1/settings/llm/test`, `GET /api/v1/settings/llm/models`.
- **Chat injection**: Both the active GA4 `propertyId` and the configured LLM provider/model are injected into every chat request context.
- **Settings navigation**: Settings layout gains an "LLM Provider" nav entry alongside Integrations.

## Capabilities

### New Capabilities

- `ga4-property-selector`: Discover and select GA4 properties post-credential-save; store active `propertyId` in integration config; expose via three REST endpoints.
- `llm-provider-settings`: Configure LLM provider, model, and encrypted API key; validate with test call; expose provider and model lists; inject config into chat.

### Modified Capabilities

- *(none — existing Power BI and BigQuery integration flows are unchanged)*

## Impact

- **Files added**: `src/app/api/integrations/google_analytics/properties/route.ts`, `src/app/api/integrations/google_analytics/properties/selected/route.ts`, `src/app/api/settings/llm/route.ts`, `src/app/api/settings/llm/test/route.ts`, `src/app/api/settings/llm/models/route.ts`, `src/lib/providers/ga4-admin.ts`, `src/lib/llm-settings-store.ts`, `src/components/settings/LLMProviderCard.tsx`, `src/components/settings/GA4PropertySelector.tsx`.
- **Files modified**: `src/types/integration.ts` (extend `GoogleAnalyticsFields`), `src/components/settings/IntegrationForm.tsx` (add property-selector post-save step), `src/app/settings/layout.tsx` (add LLM nav link), `src/lib/orchestrator.ts` (inject GA4 property + LLM config into chat context), `src/lib/planner.ts` (wire LLM provider for natural-language planning).
- **Dependencies**: `google-auth-library` (for service-account JWT minting, already referenced but not installed), potential light LLM SDK additions per provider.
- **No breaking changes** to existing BigQuery or Power BI flows.
