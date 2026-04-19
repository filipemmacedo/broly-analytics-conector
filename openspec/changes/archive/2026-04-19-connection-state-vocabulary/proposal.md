## Why

Connection state across Data Sources panel, Integration cards, and LLM Provider card is inconsistent and misleading — expired BigQuery tokens show green, the LLM card has no status indicator at all, and amber (recoverable) states are conflated with red (broken) states. Users can't tell at a glance what needs their attention, leading to confusing query failures.

## What Changes

- **Data Sources Panel dot**: gains two new states — amber (needs attention) and red (error) — driven by `healthState` in addition to `status`. Each dot gets a hover tooltip with a plain-language description and "click to configure" prompt.
- **ConnectionStatusBadge**: corrects `expired` from red → amber ("Needs reconnect"), corrects `healthState: unknown` from green → amber ("Not verified"), adds "Connection error" label for red states.
- **Integration card**: adds inline explanation text when status is `expired` ("Your Google authorization has expired.").
- **LLM Provider Card**: gains a persistent status badge (same pattern as integration cards). Status and `lastTestedAt` are persisted to the machine store. Saving a new API key resets status to `configured` (not verified).
- **LLM types**: `LLMSettings` and `PublicLLMSettings` gain `status` and `lastTestedAt` fields.
- **LLM store**: persists and reads new `status` + `lastTestedAt` fields.

## Capabilities

### New Capabilities

- `connection-status-vocabulary`: Unified four-state color + label vocabulary (grey/green/amber/red) shared across data sources dot, integration badge, and LLM badge — with consistent label text and tooltip copy.

### Modified Capabilities

- `data-sources-panel`: dot indicator gains amber and red states driven by `healthState`; dots gain hover tooltips.
- `llm-provider-settings`: card gains persistent status badge; types and store gain `status` + `lastTestedAt`.
- `integration-management`: `ConnectionStatusBadge` tone/label mapping corrected; expired explanation text added to integration card.

## Impact

- `src/components/data-sources-panel.tsx` — dot rendering logic
- `src/components/ui/ConnectionStatusBadge.tsx` — tone + label mapping
- `src/components/settings/IntegrationCard.tsx` — expired explanation text
- `src/components/settings/LLMProviderCard.tsx` — status badge, test persistence
- `src/types/llm.ts` — `LLMSettings`, `PublicLLMSettings` type additions
- `src/lib/llm-settings-store.ts` — persist/read `status` + `lastTestedAt`
- `src/app/api/settings/llm/route.ts` — expose new fields in GET response
- `src/app/api/settings/llm/test/route.ts` — persist status + `lastTestedAt` after test
- CSS: new dot modifier classes (`source-dot--attention`, `source-dot--error`) and tooltip styles
