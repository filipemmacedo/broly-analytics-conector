## Why

The app currently supports GA4 as the only LLM-powered analytics source. BigQuery holds GA4 export data (`ga4analytics` dataset) and enables richer SQL-based queries — but the existing BigQuery code is a draft that bypasses the integration-store and uses env vars, making it inconsistent and non-functional. This change replaces that draft with a clean, production-ready BigQuery connector that mirrors how GA4 is connected today.

## What Changes

- **REMOVE** draft BigQuery connector (`src/lib/connectors/bigquery.ts`, `src/lib/providers/bigquery.ts`, `src/app/api/connect/bigquery/*`) — replaced entirely
- **ADD** BigQuery OAuth flow via integration-store (same `oauth2-code-flow` pattern as GA4; different scope: `bigquery.readonly`)
- **ADD** BigQuery property selection via GA4 Admin API — user picks a property by display name, app stores the ID
- **ADD** LLM-powered BigQuery agent (`runBigQueryAgentTurn`) with a `runBigQueryQuery` SQL tool, mirroring the GA4 agent
- **ADD** Explicit mutual exclusion — connecting BigQuery disconnects GA4 and vice versa; only one source active at a time
- **MODIFY** Orchestrator to dispatch based on explicit `activeSource` (replaces implicit GA4-always-wins logic)
- **MODIFY** `BigQueryFields` type to include `projectId`, `propertyId`, `propertyName`
- **MODIFY** `env.ts` to remove BigQuery env vars (credentials move to integration-store)
- **ADD** README note: sync queries API has ~20s timeout and is unsuitable for large datasets — Jobs API migration needed before production scale

## Capabilities

### New Capabilities
- `bigquery-connector`: OAuth2 connect flow, property selection, SQL query execution via BigQuery sync API, LLM agent turn
- `source-mutual-exclusion`: Enforces that only one analytics source (GA4 or BigQuery) is active at a time; connecting one disconnects the other

### Modified Capabilities
- `orchestrator-routing`: Source dispatch logic changes from implicit GA4 priority to explicit `activeSource`-based routing

## Impact

- `src/lib/agents/bigquery-agent.ts` — new file
- `src/app/api/connect/bigquery/start/route.ts` — replaced
- `src/app/api/connect/bigquery/callback/route.ts` — replaced
- `src/app/api/integrations/bigquery/properties/route.ts` — new file
- `src/lib/orchestrator.ts` — modified dispatch logic
- `src/lib/env.ts` — BigQuery env vars removed
- `src/types/integration.ts` — `BigQueryFields` updated
- `README.md` — sync API limitation note added
- Settings UI — BigQuery integration form updated (projectId input + property dropdown)
- No new npm dependencies required
