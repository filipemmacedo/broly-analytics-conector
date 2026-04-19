## Why

The BigQuery connector has two related bugs rooted in the same hardcoded assumption:

1. **Wrong dataset name.** The connector hardcodes `ga4analytics` as the BigQuery dataset everywhere — in the agent system prompt, tool schema, connection test, UI hint, and spec. The actual GA4 BigQuery export follows GCP's naming convention: `analytics_<numeric_property_id>` (e.g. `analytics_516611632`). This makes the connector non-functional for every real account.

2. **Dataset not derived from the selected GA4 property.** When the user selects a GA4 property via the Admin API (e.g. `properties/516611632`), the system already has the numeric property ID needed to construct the correct dataset name (`analytics_516611632`). Instead of making the user look this up manually, the system should auto-derive the `datasetId` from the selected property and pre-fill it, with the user confirming or overriding.

## What Changes

- Add a `datasetId` field to `BigQueryFields` type so the configured dataset is stored per-integration
- Auto-derive `datasetId` server-side when the user selects a GA4 property in the existing `BigQueryPropertySelector` dropdown: `PUT /api/integrations/bigquery/properties/selected` strips the `properties/` prefix from `propertyId` and saves `analytics_<numericId>` as `datasetId` in `providerFields` — no separate UI step required for the common case
- Add a read-only dataset ID display (with optional manual override) in the integration form for users whose export dataset name differs from the auto-derived value
- Replace all hardcoded `ga4analytics` references in `bigquery-agent.ts` (tool schema, system prompt, query patterns) with the configured `datasetId`
- Replace the hardcoded `ga4analytics` dataset lookup in `bigquery.ts` `testConnection` with a check using the configured `datasetId`
- Remove the misleading "Dataset is hardcoded to `ga4analytics`" hint from `IntegrationForm.tsx`
- Update `openspec/specs/bigquery-connector/spec.md` to reflect that the dataset is user-configured, not hardcoded

## Capabilities

### New Capabilities

- `bigquery-dataset-selector`: UI and API support for listing available BigQuery datasets from the user's GCP project and letting them select (or manually enter) the dataset that holds their GA4 export

### Modified Capabilities

- `bigquery-connector`: Requirements change — dataset is no longer hardcoded as `ga4analytics`; it is stored in `BigQueryFields.datasetId` and passed through to the agent and connection test

## Impact

- `src/types/integration.ts` — add `datasetId: string` to `BigQueryFields`
- `src/lib/agents/bigquery-agent.ts` — replace all `ga4analytics` literals with `datasetId` parameter
- `src/lib/providers/bigquery.ts` — fix `testConnection` to validate against the user-configured dataset (or list all datasets), not `ga4analytics`
- `src/components/settings/IntegrationForm.tsx` — add dataset ID input; remove hardcoded hint
- `src/app/api/integrations/bigquery/datasets/route.ts` — new endpoint to list BigQuery datasets for the connected project
- `openspec/specs/bigquery-connector/spec.md` — update requirements to reflect configurable dataset
