## Context

The BigQuery GA4 connector was built with `ga4analytics` hardcoded as the dataset name throughout the stack — the agent tool schema, system prompt, connection test, UI hint, and spec all assume this name. In practice, the GA4 BigQuery export creates a dataset named `analytics_<property_id>` (e.g. `analytics_516611632`), making the connector non-functional for every real account.

The fix is minimal: add `datasetId` to `BigQueryFields`, wire it through from the UI to the agent, and remove all hardcoded `ga4analytics` references. No architectural changes — this is a configuration value threading through existing code.

## Goals / Non-Goals

**Goals:**
- `BigQueryFields` stores the user's actual dataset ID
- The BigQuery agent uses `datasetId` from `providerFields` for all SQL patterns and system prompt context
- The connection test validates the configured dataset exists rather than checking a hardcoded one
- The settings UI has a Dataset ID input (with an optional auto-populate from BigQuery datasets API)
- All `ga4analytics` literals are removed from runtime code and the spec

**Non-Goals:**
- Multi-dataset querying — one dataset per integration remains the model
- Automatic discovery with no user confirmation — the user must acknowledge which dataset to use
- Changing the overall integration store shape, OAuth flow, or orchestrator routing

## Decisions

### D1: `datasetId` stored in `BigQueryFields` (not a new auth field)

**Decision:** Add `datasetId: string` to the existing `BigQueryFields` type alongside `projectId`, `propertyId`, and `propertyName`. The dataset is a provider-level configuration detail, not an auth credential.

**Alternatives considered:**
- Derive `datasetId` from `propertyId` at runtime (e.g., `analytics_${numericPropertyId}`) → fragile; the numeric property ID is not always the same as the export dataset suffix; the user may have renamed or customized the dataset.
- Separate store entry → unnecessary; `providerFields` is the right place.

**Rationale:** Consistent with how `projectId` and `propertyId` are stored. Simple, one field.

---

### D2: Optional dataset auto-listing via BigQuery Datasets API

**Decision:** Add a new API route `GET /api/integrations/bigquery/datasets` that calls `https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/datasets` with the stored access token and returns the list of dataset IDs. The UI uses this to populate a dropdown for selection. If the API call fails or returns nothing, the user can still type the dataset ID manually.

**Alternatives considered:**
- Manual text input only → works but poor UX; user may not know exact dataset ID.
- Auto-select the first dataset that starts with `analytics_` → too opinionated; user may have multiple GA4 exports.

**Rationale:** The user can clearly see and select from their actual datasets (as shown in the BigQuery console screenshot). The API call uses the already-stored access token — no new auth needed. Fallback to manual entry makes it robust.

---

### D3: Connection test checks dataset existence, not hardcoded name

**Decision:** Change `testConnection` in `bigquery.ts` to call `GET /projects/{projectId}/datasets/{datasetId}` using the `datasetId` from `providerFields`. If `datasetId` is not yet configured, the test returns a clear error prompting the user to complete setup.

**Alternatives considered:**
- Test against the datasets list endpoint instead → more complex parsing; single dataset GET is simpler and more targeted.

**Rationale:** Direct and minimal change. Same HTTP call, just parameterized.

---

### D4: No changes to the agent's function signature

**Decision:** `runBigQueryAgentTurn` already receives `projectId` and `propertyName`. Add `datasetId` as a new parameter. The orchestrator reads `fields.datasetId` and passes it through.

**Rationale:** Minimal blast radius. No interface changes outside the agent and orchestrator call site.

## Risks / Trade-offs

**[User hasn't set datasetId yet]** → Orchestrator and connection test must guard against missing `datasetId` and surface a clear actionable error ("Go to Settings > BigQuery and select your dataset"). The `BigQueryFields` type adds `datasetId` as required but existing stored integrations may lack it until re-saved.

**[Existing stored integrations have no `datasetId`]** → Treat missing `datasetId` as optional at the type level (`datasetId?: string`) and add a null check at the orchestrator call site. User will be prompted to open settings and re-save to populate it.

**[Dataset name drift]** → If the user's GA4 export dataset is renamed in GCP, they'll need to update the integration. Documented in UI as a configuration value, not auto-synced. Acceptable for this use case.

## Migration Plan

1. Add `datasetId?: string` to `BigQueryFields` in `src/types/integration.ts`
2. Add `GET /api/integrations/bigquery/datasets` route
3. Update `BigQueryFields` component in `IntegrationForm.tsx` to add dataset selector
4. Update `buildProviderFields` to include `datasetId`
5. Update `testConnection` in `bigquery.ts` to use configurable `datasetId`
6. Update `runBigQueryAgentTurn` signature to accept `datasetId`; replace all `ga4analytics` literals in agent
7. Update orchestrator to pass `datasetId` (with null guard)
8. Update `openspec/specs/bigquery-connector/spec.md` to remove hardcoded dataset requirement

No data migrations. No OAuth flow changes. Rollback: revert the 4 source files. Existing integrations without `datasetId` will prompt the user to re-save — no data loss.

## Open Questions

- Should the dataset dropdown auto-select the dataset if exactly one `analytics_*` dataset is found? (Recommendation: yes — pre-select but let user confirm before saving.)
