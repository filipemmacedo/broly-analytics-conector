## Context

The project is a Next.js analytics connector that lets users query data sources in natural language. It has a well-established connector pattern: credentials are stored via `IntegrationForm`, the provider is registered in `src/lib/providers/index.ts`, an agent translates NL questions into API calls, and the orchestrator routes chat messages to the right agent.

BigQuery and GA4 both use Google OAuth (code flow with redirect + token exchange). Snowflake with PAT is simpler: the token is pasted directly into the form, there is no redirect dance, and the connection is immediately testable.

Snowflake is accessed via the [Snowflake SQL API v2](https://docs.snowflake.com/en/developer-guide/sql-api/reference): `POST https://<account>.snowflakecomputing.com/api/v2/statements`. Authentication is `Authorization: Bearer <PAT>` with `X-Snowflake-Authorization-Token-Type: PROGRAMMATIC_ACCESS_TOKEN` (for PATs — not `KEYPAIR_JWT` which is for RSA key-pair auth and requires a real JWT with a `sub` claim).

**SHOW command column layout** — column order differs by object type. Use `resultSetMetaData.rowType` to find the column named `"name"` by index rather than hardcoding a position:
- `SHOW DATABASES` / `SHOW SCHEMAS`: `row[0]` = `created_on`, `row[1]` = name
- `SHOW WAREHOUSES`: `row[0]` = name, `row[1]` = state (STARTED / SUSPENDED)

Using a hardcoded `row[1]` for warehouses returns the state string, not the warehouse name.

## Goals / Non-Goals

**Goals:**
- Add Snowflake as a first-class integration: configure, test, select database/schema/warehouse, and query in natural language.
- Reuse all existing patterns: provider adapter, agent shape, orchestrator routing, chart/table rendering.
- Keep auth simple: PAT token pasted by the user, no OAuth redirect routes needed.
- The post-auth selector (database, schema, warehouse) mirrors `BigQueryPropertySelector`.

**Non-Goals:**
- Snowflake OAuth code flow (not needed for PAT).
- Support for multiple simultaneous Snowflake integrations (same as other providers).
- Schema introspection beyond the system metadata views (`SHOW DATABASES`, `SHOW SCHEMAS`, `SHOW WAREHOUSES`).
- Write operations (INSERT / UPDATE / DELETE / DDL) — read-only, same as BigQuery.

## Decisions

### D1: Auth type — reuse `"api-key"` for the PAT token

**Decision**: Use the existing `"api-key"` auth type. The PAT token is stored in `authConfig.apiKey`.

**Rationale**: A PAT is semantically equivalent to an API key — a static secret that is passed as a bearer header. Adding a new auth type (e.g. `"pat"`) would require changes to `MaskedAuthConfig`, the masking logic, and seed functions without any behavioural difference.

**Alternative considered**: New `"snowflake-pat"` auth type — rejected because it duplicates `"api-key"` in every respect and adds unnecessary spread.

---

### D2: No connect/callback routes

**Decision**: Snowflake has no `/api/connect/snowflake/start` or `/callback` routes.

**Rationale**: BigQuery and GA4 require OAuth redirects because Google controls the token issuance. PAT tokens are user-generated in the Snowflake UI and pasted into the form. The "Connect" button in `IntegrationCard` is replaced by the standard "Set up / Edit" flow — credentials are saved and immediately testable.

**Alternative considered**: Keep a dummy connect route for UI consistency — rejected, the UI already handles the `provider !== "google-analytics" && provider !== "bigquery"` case with an Edit button.

---

### D3: Post-auth selector shows database, schema, and warehouse

**Decision**: After credentials are saved, a `SnowflakeDatabaseSelector` component appears. It calls `GET /api/integrations/snowflake/databases` which runs `SHOW DATABASES`, `SHOW SCHEMAS IN DATABASE <db>`, and `SHOW WAREHOUSES` against the Snowflake account. The user selects all three; selection is saved to `providerFields`.

**Rationale**: Database is required for scoped queries. Schema narrows the LLM context to relevant tables. Warehouse is required for query execution — without it, queries fail if the user has no default warehouse set. Exposing all three in one selector keeps the form clean.

**Alternative considered**: Warehouse in the form — rejected in favour of grouping all data-scope settings in the selector, consistent with the BigQuery dataset pattern.

---

### D4: Snowflake SQL API with synchronous timeout

**Decision**: Use `POST /api/v2/statements` with `"timeout": 60` in the body. This causes Snowflake to wait up to 60 seconds and return results synchronously. No async polling is implemented.

**Rationale**: Mirrors BigQuery's sync queries API (`timeoutMs: 20000`). Sufficient for the analytical queries the LLM generates (COUNT, GROUP BY, LIMIT). Async polling adds complexity for no user-facing benefit at this stage.

**Known limitation**: Queries exceeding 60 seconds will fail. Long-running queries should be flagged in the system prompt (same pattern as BigQuery's "Known limitation" comment). Upgrade path: implement the statement handle polling loop (`GET /api/v2/statements/<handle>`) in a future iteration.

---

### D5: Agent follows BigQuery agent shape exactly

**Decision**: `snowflake-agent.ts` mirrors `bigquery-agent.ts` structure: `buildSystemPrompt`, `buildRunSnowflakeQuerySchema`, `executeSnowflakeQuery`, `callLLMWithTools`, `callLLMForSummary`, `runSnowflakeAgentTurn`. It imports `extractChartData` and `extractTableData` from `ga4-agent.ts` (same as BigQuery agent).

**Rationale**: Consistency with existing agents. Shared chart/table extraction avoids duplication.

---

### D6: Orchestrator system prompt instructs the LLM on Snowflake SQL dialect

**Decision**: The system prompt passed to the LLM via the orchestrator includes Snowflake-specific SQL guidance: fully-qualified table references (`<database>.<schema>.<table>`), Snowflake date functions (`DATEADD`, `DATE_TRUNC`, `TO_DATE`), `LIMIT` requirement, and read-only query guard (SELECT / WITH only). It also communicates the active database, schema, and warehouse so the LLM can construct valid queries without guessing.

**Rationale**: GA4 and BigQuery agents both include detailed system prompts with query patterns. Snowflake SQL has dialect differences (e.g. `DATEADD` vs `DATE_SUB`, `CURRENT_DATE()` vs `CURRENT_DATE`) that will cause silent query failures if the LLM defaults to generic SQL. Explicit dialect guidance in the prompt avoids this class of errors.

## Risks / Trade-offs

- **PAT token expiry**: Snowflake PATs do not auto-refresh. If the token expires, queries fail. The error message should guide the user to regenerate the token. No mitigation beyond clear error messaging at this stage.
- **`SHOW` commands require privileges**: `SHOW DATABASES`, `SHOW SCHEMAS`, `SHOW WAREHOUSES` return only objects the token's role has access to. If the role is highly restricted, the selector may show an empty list. Mitigation: show a helpful error message with a link to Snowflake docs on role grants.
- **60 s timeout is shared**: The synchronous timeout is server-side (Next.js route handler). If Snowflake takes close to 60 s, the Next.js route may also time out depending on deployment platform limits. Mitigation: document this in code comments; upgrade path is the async polling approach.
- **Account identifier format**: Snowflake uses several identifier formats (`xy12345`, `xy12345.us-east-1`, `orgname-accountname`). Incorrect format gives a DNS error, not a helpful API error. Mitigation: add a placeholder hint in the form field and validate the format before saving.
