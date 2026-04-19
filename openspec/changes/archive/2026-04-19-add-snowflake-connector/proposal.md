## Why

The connector suite currently covers Google Analytics, BigQuery, and Power BI but has no path for Snowflake users. Snowflake is a widely-used cloud data warehouse, and adding a connector lets users query their Snowflake data in natural language using the same chat interface already used for GA4 and BigQuery.

## What Changes

- Add `"snowflake"` as a new `IntegrationProvider` with its own auth config (`api-key` / PAT token) and `SnowflakeFields` (account identifier, database, schema, warehouse).
- Add a `SnowflakeDatabaseSelector` component that appears post-credentials-save, allowing users to pick a database, schema, and warehouse from live Snowflake metadata.
- Add two new API routes: `GET /api/integrations/snowflake/databases` (list databases/schemas/warehouses) and `PUT /api/integrations/snowflake/databases/selected` (persist selection).
- Add `src/lib/providers/snowflake.ts` with a `testConnection()` implementation using the Snowflake SQL API.
- Add `src/lib/agents/snowflake-agent.ts` that translates natural-language questions into Snowflake SQL via tool-calling, executes them via the Snowflake SQL API (sync, with 60 s timeout), and summarises results — including chart and table rendering.
- Extend the orchestrator to route questions to the Snowflake agent when Snowflake is the active integration.
- Extend `IntegrationForm`, `IntegrationCard`, and the provider registry to include Snowflake.

## Capabilities

### New Capabilities

- `snowflake-integration`: Credential storage, PAT token auth, and connection testing for Snowflake accounts.
- `snowflake-database-selector`: Post-auth UI selector for database, schema, and warehouse, matching the BigQuery property-selector pattern.
- `snowflake-agent`: Natural-language-to-SQL agent for Snowflake using tool-calling across all supported LLM providers, with chart/table visual rendering.

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **Types**: `src/types/integration.ts` (new provider, fields, auth type); `src/lib/types.ts` (SourceId union).
- **Providers**: new `src/lib/providers/snowflake.ts`; `src/lib/providers/index.ts` updated.
- **Agents**: new `src/lib/agents/snowflake-agent.ts`.
- **Orchestrator**: `src/lib/orchestrator.ts` gains a Snowflake path.
- **API routes**: two new routes under `src/app/api/integrations/snowflake/`.
- **UI**: `IntegrationForm.tsx`, `IntegrationCard.tsx` extended; new `SnowflakeDatabaseSelector.tsx`.
- **Dependencies**: no new npm packages — Snowflake SQL API is called via `fetch`.
