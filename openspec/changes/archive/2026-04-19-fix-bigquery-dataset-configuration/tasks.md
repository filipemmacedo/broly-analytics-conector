## 1. Type and Data Model

- [x] 1.1 Add `datasetId?: string` to `BigQueryFields` in `src/types/integration.ts`

## 2. Auto-derive `datasetId` on Property Selection (Primary Flow)

The existing `BigQueryPropertySelector` dropdown in the side panel is already the place where the user picks their GA4 property. When a property is saved, the server should simultaneously derive and persist `datasetId` from `propertyId` — no separate UI step needed.

- [x] 2.1 Update `PUT /api/integrations/bigquery/properties/selected` (`src/app/api/integrations/bigquery/properties/selected/route.ts`) to compute `datasetId` from the incoming `propertyId`: strip `properties/` prefix and prepend `analytics_` (e.g. `properties/516611632` → `analytics_516611632`); include it in the `updateIntegration` call alongside `propertyId` and `propertyName`

## 3. Dataset Override (Fallback)

Optional override in the integration form for users whose export dataset name differs from the auto-derived value (e.g. renamed datasets).

- [x] 3.1 Add a read-only "Dataset ID" display field to the `BigQueryFields` component in `src/components/settings/IntegrationForm.tsx` showing the current `datasetId` (if set); allow manual override via text input
- [x] 3.2 Add `datasetId` to `buildProviderFields` for the `bigquery` provider so a manual override is saved when the form is submitted
- [x] 3.3 Remove the hardcoded "Dataset is hardcoded to `ga4analytics`" hint from the form

## 4. BigQuery Datasets API Route (for Override Dropdown)

Only needed to populate the override dropdown if the auto-derived value is wrong.

- [x] 4.1 Create `src/app/api/integrations/bigquery/datasets/route.ts` with a `GET` handler that calls `https://bigquery.googleapis.com/bigquery/v2/projects/{projectId}/datasets` with the stored access token, returning `{ datasetId }[]`
- [x] 4.2 Guard: HTTP 404 if no BigQuery integration; HTTP 400 if OAuth not completed

## 5. Connection Test

- [x] 5.1 Update `testConnection` in `src/lib/providers/bigquery.ts` — replace the hardcoded `datasets/ga4analytics` path with `datasets/{datasetId}` read from `providerFields`; return a clear error if `datasetId` is missing

## 6. BigQuery Agent

- [x] 6.1 Add `datasetId` parameter to `runBigQueryAgentTurn` in `src/lib/agents/bigquery-agent.ts`
- [x] 6.2 Replace all `ga4analytics` literals in the tool schema description with the dynamic `datasetId`
- [x] 6.3 Replace all `ga4analytics` literals in `buildSystemPrompt` and the COMMON PATTERNS block with the `datasetId` parameter
- [x] 6.4 Remove the "Dataset is hardcoded to `ga4analytics`" comment from the file header

## 7. Orchestrator

- [x] 7.1 Update the BigQuery path in `src/lib/orchestrator.ts` to read `fields.datasetId`; add a null guard that returns "BigQuery dataset is not configured. Select a GA4 property in Settings > Integrations > BigQuery." if missing
- [x] 7.2 Pass `datasetId` to `runBigQueryAgentTurn`

## 8. Spec Update

- [x] 8.1 Update `openspec/specs/bigquery-connector/spec.md` — apply the MODIFIED and REMOVED requirement blocks from the change delta spec
- [x] 8.2 Add `openspec/specs/bigquery-dataset-selector/spec.md` from the change spec as a new canonical spec
