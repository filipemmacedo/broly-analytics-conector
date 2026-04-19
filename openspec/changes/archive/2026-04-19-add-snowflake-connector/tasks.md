## 1. Types & Constants

- [x] 1.1 Add `"snowflake"` to the `IntegrationProvider` union in `src/types/integration.ts`
- [x] 1.2 Add `SnowflakeFields` type `{ accountId: string; database?: string; schema?: string; warehouse?: string }` and add it to the `ProviderFields` union in `src/types/integration.ts`
- [x] 1.3 Add `"snowflake"` to the `SourceId` union in `src/lib/types.ts`

## 2. Provider Adapter

- [x] 2.1 Create `src/lib/providers/snowflake.ts` with `testConnection(authConfig, providerFields)` — calls `POST https://<accountId>.snowflakecomputing.com/api/v2/statements` with `SELECT CURRENT_TIMESTAMP()`, `timeout: 10`, and `Authorization: Bearer <token>` / `X-Snowflake-Authorization-Token-Type: KEYPAIR_JWT` headers; returns `{ success, error? }`
- [x] 2.2 Register Snowflake in `src/lib/providers/index.ts` — import `* as snowflake`, add `"snowflake": snowflake` to the registry `Record`

## 3. API Routes — Database Selector

- [x] 3.1 Create `src/app/api/integrations/snowflake/databases/route.ts` — `GET` handler that reads the active Snowflake integration, runs `SHOW DATABASES` via the SQL API, and returns `{ databases: string[] }`; also runs `SHOW WAREHOUSES` and returns `{ warehouses: string[] }`
- [x] 3.2 Create `src/app/api/integrations/snowflake/schemas/route.ts` — `GET` handler that accepts `?database=<name>`, runs `SHOW SCHEMAS IN DATABASE <name>`, and returns `{ schemas: string[] }`
- [x] 3.3 Create `src/app/api/integrations/snowflake/databases/selected/route.ts` — `PUT` handler that accepts `{ database, schema, warehouse }` and calls `updateIntegration` to save them to `providerFields`

## 4. Snowflake Agent

- [x] 4.1 Create `src/lib/agents/snowflake-agent.ts` — scaffold with the same structure as `bigquery-agent.ts`: `LLMConfig`, `ToolCall`, `LLMToolResult`, `Message` types; `fetchWithRetry`; all four LLM dispatcher functions (`callAnthropic`, `callOpenAI`, `callGemini`, `callMistral`); `callLLMWithTools`; `callLLMForSummary`
- [x] 4.2 Implement `buildRunSnowflakeQuerySchema(database, schema)` — tool schema that instructs the LLM to produce a `SELECT` or `WITH` query using fully-qualified `<database>.<schema>.<table>` references with a `LIMIT` clause (max 20 rows)
- [x] 4.3 Implement `buildSystemPrompt(accountId, database, schema, warehouse)` — include: active connection context; Snowflake SQL dialect rules (`DATEADD`, `DATE_TRUNC`, `TO_DATE`, `CURRENT_DATE` — not `DATE_SUB` or `CURRENT_DATE()`); chart rendering rule (alias date column as `date`); table rendering rule (non-date dimension); common Snowflake query patterns; instruction not to use BigQuery/standard SQL functions
- [x] 4.4 Implement `isSafeReadOnlyQuery(sql)` — block `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`
- [x] 4.5 Implement `executeSnowflakeQuery(token, accountId, database, schema, warehouse, sql)` — calls `POST https://<accountId>.snowflakecomputing.com/api/v2/statements` with `timeout: 60`; parses the synchronous response into `{ columns: string[], rows: Record<string, string|number|null>[] }`; throws on timeout or error response
- [x] 4.6 Implement `runSnowflakeAgentTurn(llmConfig, token, accountId, database, schema, warehouse, question)` — full two-step flow: tool call → execute SQL → `extractChartData` / `extractTableData` (imported from `ga4-agent`) → summarisation; returns `{ summary, visual? }`

## 5. Orchestrator

- [x] 5.1 Add Snowflake path to `src/lib/orchestrator.ts` — import `runSnowflakeAgentTurn`; add `if (activeIntegration.provider === "snowflake")` block after the BigQuery block; read `SnowflakeFields` from `providerFields`; validate that `database` is selected; call `runSnowflakeAgentTurn`; push result to session chat with `source: "snowflake"`

## 6. UI — Integration Form

- [x] 6.1 Add `SnowflakeFormFields` component to `src/components/settings/IntegrationForm.tsx` — fields: Account Identifier (required, placeholder `xy12345.us-east-1`), PAT Token (required, password type, masked sentinel on edit)
- [x] 6.2 Add `buildAuthConfig` case for `"snowflake"` — returns `{ authType: "api-key", apiKey: values.patToken }`
- [x] 6.3 Add `buildProviderFields` case for `"snowflake"` — returns `{ accountId: values.accountId }`
- [x] 6.4 Add `validate` case for `"snowflake"` — require `accountId` and `patToken` (or masked sentinel on edit)
- [x] 6.5 Add `seedValues` handling for `"snowflake"` — pre-fill `accountId` from `providerFields`; set `patToken` to masked sentinel if `authType === "api-key"`
- [x] 6.6 Wire `SnowflakeFormFields` into the form render — `{provider === "snowflake" ? <SnowflakeFormFields .../> : null}`

## 7. UI — Integration Card

- [x] 7.1 Add `"snowflake"` to `PROVIDER_LABELS` and `PROVIDER_DESCRIPTIONS` in `src/components/settings/IntegrationCard.tsx`
- [x] 7.2 Add `SnowflakeDatabaseSelector` render block — appears when `provider === "snowflake"` and `integration` exists; mirrors the BigQuery selector pattern (no token check needed — credentials are validated at save time)
- [x] 7.3 Confirm the default "Set up / Edit" button path handles Snowflake correctly (no special OAuth button needed)

## 8. UI — Database Selector Component

- [x] 8.1 Create `src/components/settings/SnowflakeDatabaseSelector.tsx` — on mount, calls `GET /api/integrations/snowflake/databases` to populate `databases` and `warehouses` dropdowns
- [x] 8.2 When the user selects a database, call `GET /api/integrations/snowflake/schemas?database=<name>` to populate the `schemas` dropdown
- [x] 8.3 When all three are selected, call `PUT /api/integrations/snowflake/databases/selected` with `{ database, schema, warehouse }`; show a brief "Saved" confirmation; call `onSelected()` to refresh the card
- [x] 8.4 Pre-populate all three dropdowns from `currentDatabase`, `currentSchema`, `currentWarehouse` props if already saved
- [x] 8.5 Handle error and empty states — show a message if `SHOW DATABASES` returns empty, with a hint about role privileges
