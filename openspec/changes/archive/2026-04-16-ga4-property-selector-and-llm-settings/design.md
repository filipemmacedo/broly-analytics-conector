## Context

Broly is a Next.js App Router app with file-backed JSON persistence (`data/integrations.enc.json`). Secrets are encrypted at rest with AES-256-GCM via `integration-store.ts`. The GA4 integration currently stores a `propertyId` field that the user types in manually, and the google-analytics provider stub can only validate JSON structure — it cannot mint a JWT from a service account. The chat planner is rule-based with no LLM call.

Two independent cross-cutting changes are bundled here:
1. **GA4 property selector** — requires calling the GA4 Admin API server-side after credentials are saved, and storing the chosen property alongside the integration.
2. **LLM provider settings** — requires a new settings store, encrypted API key storage, provider/model registry, and test-ping endpoint; the chosen config must be injected into every chat request.

## Goals / Non-Goals

**Goals:**
- Let users pick an active GA4 property from a dropdown (populated live from the Admin API) instead of typing an ID.
- Store the selected `propertyId` in `providerFields` so it flows into chat queries automatically.
- Let users configure provider, model, and API key for the LLM that will power Broly's assistant.
- Keep API keys encrypted at rest; never return raw keys from any endpoint (mask to last 4 chars).
- Wire the chosen LLM config into the chat orchestrator so it can be used when the planner calls the LLM.
- Match the existing dark-red card-based UI style.

**Non-Goals:**
- Actually rewriting the planner to call the LLM (that is a separate change; we only make the LLM config *available* to the orchestrator).
- OAuth2 flow for GA4 (service-account-based JWT minting is the primary path).
- Multi-property selection or property-group analytics.
- User-facing model fine-tuning or custom model uploads.
- Production hardening (rate limiting, multi-tenant isolation) — this remains a POC.

## Decisions

### 1. GA4 Admin API call happens server-side only

**Decision**: The `/api/v1/integrations/google_analytics/properties` endpoint calls the GA4 Admin API from the Next.js server route, not from the browser.

**Rationale**: Service account credentials must never be exposed to the client. The server already holds the decrypted `serviceAccountJson`; it mints a short-lived access token using `google-auth-library` and calls `analyticsadmin.googleapis.com`.

**Alternative considered**: Have the client exchange credentials for a token. Rejected — exposes secret material.

### 2. Install `google-auth-library` for JWT minting

**Decision**: Add `google-auth-library` as a production dependency.

**Rationale**: The existing provider stub already references JWT minting as a TODO and throws "requires a JWT library". `google-auth-library` is the canonical Google-maintained package; it handles key parsing, JWT signing, and token caching.

**Alternative considered**: Roll a custom JWT signer with Node's built-in `crypto`. Rejected — error-prone and unmaintained.

### 3. Selected GA4 property stored in `providerFields.propertyId`

**Decision**: Reuse the existing `GoogleAnalyticsFields.propertyId` field rather than adding a new field.

**Rationale**: The field already exists in `types/integration.ts`. Changing it from user-typed to API-selected is backwards compatible — the field format (`properties/XXXXXXXXX`) is the same.

**Impact**: `IntegrationForm` no longer shows a manual property ID text input for GA4; it shows a dropdown populated after credentials are saved.

### 4. LLM settings stored in a separate file-backed store

**Decision**: Create `src/lib/llm-settings-store.ts` with its own `data/llm-settings.enc.json` file (separate from `integrations.enc.json`).

**Rationale**: LLM settings are not an "integration" in the data-source sense — they configure the assistant engine. Keeping them separate avoids polluting the integration list and makes the settings page simpler.

### 5. LLM API key masked to last 4 chars in GET responses

**Decision**: `GET /api/v1/settings/llm` returns `{ ..., apiKeyMasked: "••••••••<last4>" }` and never the raw key.

**Rationale**: Consistent with existing `MASKED_SENTINEL` pattern in `integration-store.ts`. The PUT endpoint accepts the masked value as a no-op (keeps existing key), identical to how `mergeAuthConfig` works.

### 6. Model list is static per provider, not fetched from upstream APIs

**Decision**: `GET /api/v1/settings/llm/models` returns a hard-coded list of models per provider from a registry in `src/lib/llm-model-registry.ts`.

**Rationale**: Provider model APIs require authentication and have different schemas. A static list is sufficient for the POC and avoids a round-trip. The list can be updated as a code change.

### 7. Test-ping endpoint calls the provider's cheapest available model

**Decision**: `POST /api/v1/settings/llm/test` sends a minimal completion ("Say hi") using the *configured* model with a 1-token max response.

**Rationale**: Tests the actual key and model combination. Latency is measured end-to-end.

### 8. GA4 property and LLM config injected as context headers in chat route

**Decision**: `src/app/api/chat/route.ts` reads the active GA4 integration's `propertyId` and the current LLM config and passes them to `handleQuestion` via an expanded context parameter.

**Rationale**: The orchestrator and planner are the natural injection points. No global state; everything flows through the request.

## Risks / Trade-offs

- **`google-auth-library` adds ~2 MB to bundle** → Acceptable for a server-only import (never bundled to client via `"use server"` boundary).
- **Static model list goes stale** → Mitigated by keeping the registry in one file (`llm-model-registry.ts`) that is easy to update.
- **GA4 Admin API quota** → Property list is fetched on-demand (user opens the dropdown), not polled. No caching needed for POC.
- **File-backed stores are not concurrent-safe** → Inherited limitation of the existing architecture. No change here.
- **LLM test-ping incurs real API cost** → Minimal (1-token response), user-initiated only.

## Migration Plan

1. Run `npm install google-auth-library`.
2. Deploy new API routes (additive, no existing routes changed).
3. Existing GA4 integrations with a manually-typed `propertyId` continue to work — the field format is unchanged. Users can re-save to use the new dropdown.
4. Rollback: remove new route files and revert `IntegrationForm.tsx`/`orchestrator.ts` changes. The `llm-settings.enc.json` file can be deleted safely.

## Open Questions

- Should the GA4 property list be cached per-session or per-integration to reduce Admin API calls? (Defer — not needed for POC.)
- Should the LLM config apply globally or per-chat session? (Global for now; per-session can be added later.)
