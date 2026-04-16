## Context

The GA4 query pipeline in `llm-planner.ts` already produces `rows: Record<string, string>[]` from the GA4 Data API. `extractChartData` inspects row shape to detect temporal data (presence of a `date` key) and returns a typed `ChartData` struct. `MessageBubble` then conditionally renders `MetricLineChart` when `message.chartData` is populated.

Non-temporal queries (e.g. breakdown by country, device, source) currently fall through to a verbose LLM text summary. The data shape for these queries contains at least one dimension column (non-numeric, non-date string like `"United States"` or `"mobile"`) alongside metric columns. This is the canonical table shape.

The current `ChatMessage.chartData?: ChartData` field is a flat optional — nothing in the type system prevents both `chartData` and a future `tableData` from being set simultaneously. The discriminated union pattern closes this.

BigQuery and Power BI connectors are currently disconnected and disabled. Their orchestrator paths produce plain-text responses only and are not touched by this change.

## Goals / Non-Goals

**Goals:**
- Replace `ChatMessage.chartData` with `visual?: VisualData` (discriminated union)
- Add `TableData` type and `extractTableData()` detection function
- Add `MetricTable` component following existing design language
- Extend `runGA4AgentTurn` to populate `visual` for both chart and table results
- Migrate persisted messages with old `chartData` field on load (non-breaking for users)

**Non-Goals:**
- BigQuery and Power BI visual rendering
- Bar charts, scorecards, or any other visual type beyond line chart and table
- Pagination or virtual scrolling for large tables (capped at existing `MAX_ROWS_FOR_SUMMARY = 20`)
- Mixed-dimension queries (e.g. date + country simultaneously)

## Decisions

### Decision 1: Discriminated union `VisualData` over parallel optional fields

**Chosen**: `visual?: VisualData` as a single discriminated union field.

**Alternatives considered**:
- `chartData?: ChartData` + `tableData?: TableData` as separate fields — simpler migration but no type-level exclusivity. A message could accidentally have both set. `MessageBubble` would need priority logic instead of a clean switch.

**Rationale**: The discriminated union enforces that exactly one visual type is present. `MessageBubble` becomes a `switch (visual.type)` with no ambiguity. New visual types slot in as additional variants without touching existing branches.

---

### Decision 2: Detection logic stays in `llm-planner.ts` as a pure function

**Chosen**: `extractTableData(rows)` as a pure function alongside `extractChartData(rows)` in `llm-planner.ts`.

**Rationale**: `extractChartData` already establishes this pattern — it inspects row shape and returns a typed struct or `undefined`. `extractTableData` follows the same contract. Both functions are unit-testable in isolation. The orchestrator just calls both and uses whichever returns a value.

**Detection rule**: a row is a dimensional breakdown if it has at least one column that is non-numeric AND not `"date"`. Numeric detection mirrors `extractChartData`: `!isNaN(Number(rows[0][k]))`.

**Column ordering**: dimensions (non-numeric, non-date) come first, metrics (numeric) come last. This matches the natural reading order of analytics tables.

---

### Decision 3: Coerce-on-load migration in `chat-store.ts`

**Chosen**: When deserialising a stored `ChatMessage`, if `chartData` is present and `visual` is absent, set `visual = { type: 'chart', data: chartData }`.

**Alternatives considered**:
- Accept that old charts break (simpler, but bad UX for anyone mid-conversation)
- Write a one-off migration script (overkill for a dev tool)

**Rationale**: One-liner coercion in `getChat` is invisible to callers. Old charts keep rendering. The old `chartData` field is removed from the type definition so new code never writes it; the coercion only triggers when reading legacy data.

---

### Decision 4: Summarisation instruction for table queries

When `isTableQuery` is true, the LLM summarisation step is instructed with:
> "A data table will be rendered for this result. Respond with only a 1-2 sentence insight about the data — do not list or narrate individual rows."

This mirrors the existing `isChartQuery` instruction and prevents verbose row-by-row narration when a table already communicates the data.

---

### Decision 5: `MetricTable` styling follows `MetricLineChart` conventions

CSS class prefix `metric-table` (matches `metric-line-chart`). Numbers formatted with `Intl.NumberFormat` — no external dependency. Dimensions left-aligned, metrics right-aligned. Loaded via `next/dynamic` with `ssr: false` to match `MetricLineChart` and avoid hydration issues.

## Risks / Trade-offs

- **Breaking change to `ChatMessage.chatData`**: Any code outside the identified file list that reads `message.chartData` directly will silently break (TypeScript will catch it at compile time). → Mitigation: TypeScript compiler enforces the rename; verify zero `chartData` references remain after the change.

- **Detection heuristic**: The "non-numeric = dimension" rule can mis-classify a string metric as a dimension (e.g. a percentage returned as `"45.2%"` rather than `45.2`). GA4 API always returns clean numeric strings for metrics, so this is not a practical risk for the current scope. → Mitigation: If this becomes an issue, the detection can be extended with an explicit allowlist of known GA4 metric names.

- **20-row cap inherited from `MAX_ROWS_FOR_SUMMARY`**: Tables are capped at 20 rows (the same limit as the text summary path). This is acceptable for insights but may feel limiting for exploratory queries. → Mitigation: Cap is documented and can be raised independently when needed.

## Migration Plan

1. Update `src/lib/types.ts` — add `TableData`, `VisualData`, update `ChatMessage`
2. Update `src/lib/chat-store.ts` — add coerce-on-load for legacy `chartData`
3. Update `src/lib/llm-planner.ts` — add `extractTableData`, update `runGA4AgentTurn`
4. Update `src/lib/orchestrator.ts` — write `visual` on assistant messages
5. Create `src/components/ui/MetricTable.tsx`
6. Update `src/components/ui/MessageBubble.tsx` — switch on `visual.type`

TypeScript will flag any missed `chartData` references at compile time. No database migration or deployment coordination required — the chat store is a local JSON file.

**Rollback**: Revert the six files. Old `chartData` field resumes working immediately since no schema migration was applied to stored files.

## Open Questions

- Should `MetricTable` support sorting by column on click? (Out of scope for now, but natural follow-on)
- Should scalar results (no dimensions, single aggregate metric) get a "scorecard" visual type? (Deferred — plain text is fine for now)
