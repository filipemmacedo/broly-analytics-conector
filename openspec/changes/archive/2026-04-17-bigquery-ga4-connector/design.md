## Context

The app has two analytics integration patterns:

1. **GA4 (new pattern)** — credentials stored in `integration-store` (`integrations.enc.json`), `oauth2-code-flow` authType, LLM-powered agent in `llm-planner.ts`, OAuth state via cookie.
2. **BigQuery (draft pattern)** — credentials in env vars (`BIGQUERY_OAUTH_CLIENT_ID`, `BIGQUERY_PROJECT_IDS`), connection state in session, rule-based planner, no LLM agent.

The draft BigQuery code is non-functional and architecturally inconsistent. The goal is to replace it entirely, making BigQuery follow the same integration-store pattern as GA4.

The orchestrator currently dispatches to GA4 implicitly (GA4 wins whenever it's connected), with BigQuery only reachable when GA4 is absent. This needs to become explicit and bidirectional.

## Goals / Non-Goals

**Goals:**
- BigQuery OAuth follows the same `oauth2-code-flow` pattern as GA4 (user enters client credentials in settings UI, authenticates via browser)
- User selects a GA4 property by display name; app resolves and stores the ID
- LLM agent for BigQuery mirrors `llm-planner.ts`: receives a `runBigQueryQuery` SQL tool, writes SELECT queries against `projectId.ga4analytics.events_*`
- Connecting BigQuery disconnects GA4 (and vice versa) — enforced at connect time
- Orchestrator dispatches based on explicit `activeSource` field from the active integration

**Non-Goals:**
- BigQuery Jobs API (async, polling) — out of scope; sync queries API is sufficient for current query sizes
- Multi-dataset support — dataset is hardcoded as `ga4analytics`
- Service account auth for BigQuery
- Querying non-GA4 BigQuery datasets

## Decisions

### D1: BigQuery moves entirely to integration-store (same as GA4)

**Decision:** BigQuery credentials (`clientId`, `clientSecret`) are stored in integration-store with `authType: oauth2-code-flow`. The `projectId`, `propertyId`, and `propertyName` are stored in `providerFields`. OAuth tokens are encrypted at rest alongside the integration record.

**Alternatives considered:**
- Keep env vars for BigQuery client credentials → inconsistent with GA4 pattern, can't support multiple BigQuery configs, not user-configurable from UI.
- Hybrid (env vars for app credentials, integration-store for tokens) → adds two code paths, more confusion.

**Rationale:** Integration-store is already the right place. GA4 uses it. One pattern to maintain.

---

### D2: Property selection via GA4 Admin API, not manual entry

**Decision:** After OAuth, the app calls `GET https://analyticsadmin.googleapis.com/v1beta/properties` using the BigQuery access token (same Google account, same token scope covers Admin API listing). The user picks a property by display name from a dropdown. `propertyId` and `propertyName` are stored in `BigQueryFields`.

**Alternatives considered:**
- User types property ID manually → error-prone, bad UX, no validation.
- Separate OAuth step for Admin API → unnecessary complexity, same token works.

**Rationale:** Mirrors the GA4 property selector UX exactly. The Admin API call is the same one already used in `src/app/api/integrations/google-analytics/properties/route.ts`.

**Note:** `propertyId` is used for LLM context and display only. The actual SQL uses `projectId.ga4analytics.events_*` (wildcard across all date-partitioned tables). The property scoping happens at dataset-export time in GCP, not in the query.

---

### D3: Sync queries API, not Jobs API

**Decision:** Use `POST /projects/{id}/queries` with `{ query, useLegacySql: false, timeoutMs: 20000, maxResults: 20 }`. One HTTP call, rows returned directly.

**Alternatives considered:**
- Jobs API (`POST /projects/{id}/jobs` with `configuration.query` body) → async, requires polling, 3+ HTTP calls, complex error handling. The body format seen in early exploration matched this API.

**Rationale:** LLM-generated queries are always `SELECT ... LIMIT N` — results are small and fast. Sync API is sufficient. **Known limitation**: queries exceeding 20s timeout will fail. Documented in README. Jobs API migration is the correct fix when moving to larger datasets.

---

### D4: Mutual exclusion enforced at connect-callback time

**Decision:** When BigQuery OAuth callback succeeds, the app calls a helper `deactivateOtherSources("bigquery")` that sets any active GA4 integration's `status` to `"configured"` (not expired, not deleted — just no longer the active source). A new `activeSource` field in the integration record (or derived from a singleton "active source" store entry) tracks which one is live. Same logic runs when GA4 connects.

**Alternatives considered:**
- UI-only enforcement (disable connect button when other source is active) → doesn't prevent API manipulation, brittle.
- Delete the other integration on connect → destructive, user loses their credentials.
- `activeSource` flag in session only → doesn't persist across sessions.

**Rationale:** Soft deactivation (status change, not deletion) is reversible and safe. The LLM system prompt is built from the active integration only, so the LLM naturally only knows about one source.

---

### D5: New `bigquery-agent.ts` mirrors `llm-planner.ts` structure

**Decision:** Create `src/lib/agents/bigquery-agent.ts` with `runBigQueryAgentTurn(llmConfig, accessToken, projectId, propertyId, question)`. It defines a `runBigQueryQuery` tool with a `sql` parameter. The system prompt tells the LLM: active source is BigQuery, project is `X`, dataset is `ga4analytics`, property context is `Y`, write standard SQL only.

**Rationale:** The GA4 agent pattern is proven and works across all four LLM providers (Anthropic, OpenAI, Gemini, Mistral). Reusing the same structure (tool schema → LLM call → execute → summarize) keeps both agents consistent and maintainable.

---

### D6: Orchestrator becomes source-explicit

**Decision:** Replace the `if (healthySources.has("ga4") || ga4PropertyId)` implicit priority check with a lookup of the active integration by `activeSource`. The orchestrator reads which integration is active, extracts its access token and providerFields, and routes to the correct agent.

```
activeSource = getActiveSource()  // reads integration-store
if activeSource === "ga4"        → runGA4AgentTurn(...)
if activeSource === "bigquery"   → runBigQueryAgentTurn(...)
if none                          → "No source connected" message
```

## Risks / Trade-offs

**[Sync API timeout]** → Queries > 20s will fail with a timeout error. Mitigation: LLM system prompt instructs it to always add `LIMIT` clauses. README documents the limitation. Long-term fix: Jobs API.

**[BigQuery scope covers more than GA4 data]** → `bigquery.readonly` grants read access to all datasets the user's account can see, not just `ga4analytics`. Mitigation: the LLM is instructed to only query `projectId.ga4analytics.events_*`. The connector enforces read-only (SELECT/WITH only) via query safety check.

**[Property ID used for context only]** → If the user's BQ export dataset name differs from `ga4analytics`, queries will fail. Mitigation: document the assumption that BQ export uses the default dataset name. Future: make dataset name configurable.

**[Token scope for Admin API]** → The BigQuery OAuth scope (`bigquery.readonly`) does not include `analytics.readonly`. The Admin API listing (`/v1beta/properties`) requires `analytics.readonly`. Mitigation: **request both scopes** in the BigQuery OAuth authorization URL: `bigquery.readonly analytics.readonly`. This ensures the property dropdown works with the same token.

## Migration Plan

1. Remove / replace draft BigQuery files (delete old connector, provider, routes)
2. Add `bigquery-agent.ts`
3. Update `BigQueryFields` type + integration-store handling
4. Add new OAuth routes (start + callback)
5. Add properties listing route
6. Update orchestrator dispatch
7. Update settings UI (BigQuery form: projectId input + property dropdown)
8. Remove BigQuery env vars from `env.ts` and `.env.local.example`
9. Add README limitation note

No database migrations. No breaking API changes for external consumers (all internal). Rollback: revert files; old session-based BigQuery was non-functional anyway.

## Open Questions

- Should the `activeSource` state live as a special integration record flag, or as a separate singleton entry in the store? (Recommendation: add an `isActive: boolean` field to the integration record — simpler, no new storage shape.)
- Should we show a warning in the UI when the user tries to connect a second source while one is already active, giving them a chance to cancel? (Recommendation: yes — one confirmation dialog before deactivating the current source.)
