## 1. Types & Store — LLM Status

- [x] 1.1 Add `LLMStatus` union type to `src/types/llm.ts`: `"unconfigured" | "configured" | "ok" | "error"`
- [x] 1.2 Add `status: LLMStatus` and `lastTestedAt: string | null` fields to `LLMSettings` and `PublicLLMSettings` interfaces in `src/types/llm.ts`
- [x] 1.3 Add `status` and `lastTestedAt` fields to `StoredLLMSettings` internal type in `src/lib/llm-settings-store.ts`
- [x] 1.4 Update `readStore` / `getLLMSettings` / `getPublicLLMSettings` to default missing `status` to `"configured"` and `lastTestedAt` to `null` for backwards-compat with existing store files
- [x] 1.5 Update `saveLLMSettings` to write `status: "configured"` and `lastTestedAt: null` when a new (non-sentinel) API key is provided; preserve existing values when saving with the masked sentinel
- [x] 1.6 Add `updateLLMTestResult(success: boolean): void` export to `src/lib/llm-settings-store.ts` that writes `status: "ok" | "error"` and `lastTestedAt: new Date().toISOString()`

## 2. API — LLM Routes

- [x] 2.1 Update `GET /api/settings/llm` (`src/app/api/settings/llm/route.ts`) to include `status` and `lastTestedAt` in response body
- [x] 2.2 Update `POST /api/settings/llm/test` (`src/app/api/settings/llm/test/route.ts`) to call `updateLLMTestResult(result.ok)` after the ping, so status is persisted

## 3. ConnectionStatusBadge — Unified Vocabulary

- [x] 3.1 Update `getLabel` in `src/components/ui/ConnectionStatusBadge.tsx` to use canonical labels: "Not set up" (unconfigured/null), "Needs reconnect" (expired), "Not verified" (unknown), "Degraded" (degraded), "Connected" (healthy), "Connection error" (unreachable/error)
- [x] 3.2 Update `getTone` in `src/components/ui/ConnectionStatusBadge.tsx` so `expired` maps to `"warning"` (amber) instead of `"error"` (red), and `healthState: "unknown"` maps to `"warning"` instead of `"connected"`

## 4. Integration Card — Expired Explanation Text

- [x] 4.1 Add conditional explanation text in `src/components/settings/IntegrationCard.tsx`: when `integration.status === "expired"` and provider is `"google-analytics"` or `"bigquery"`, render an inline `<p>` with "Your Google authorization has expired." below the badge

## 5. Data Sources Panel — Dot States & Tooltips

- [x] 5.1 Add a `getDotState` helper in `src/components/data-sources-panel.tsx` that maps `{ status, healthState }` (from `IntegrationStatusSummary`) to one of four values: `"idle"`, `"connected"`, `"attention"`, `"error"` — following the unified vocabulary
- [x] 5.2 Add a `getDotTooltip` helper that maps the dot state to tooltip copy: `"{label} · click to configure"` using the canonical label names
- [x] 5.3 Update the `SourceRow` dot render (line 247) to use `getDotState`, replacing the binary `isConfigured` check with the four-state CSS class (`source-dot--idle`, `source-dot--connected`, `source-dot--attention`, `source-dot--error`)
- [x] 5.4 Update the unconfigured provider dot render (line 315) to use the same helper for consistency
- [x] 5.5 Add `title={getDotTooltip(dotState)}` to the dot `<Link>` element in `SourceRow` and the unconfigured provider row

## 6. CSS — New Dot States

- [x] 6.1 Add CSS rules for `.source-dot--attention` (amber, matching `tone-warning` color) and `.source-dot--error` (red, matching `tone-error` color) to the stylesheet alongside existing dot styles

## 7. LLM Provider Card — Status Badge

- [x] 7.1 Update `LLMProviderCard` to fetch `status` and `lastTestedAt` from the GET `/api/settings/llm` response and store them in component state
- [x] 7.2 Add an `llmStatusToProps` adapter in `src/components/settings/LLMProviderCard.tsx` that maps `LLMStatus` → `{ status: IntegrationStatus, healthState: HealthState }` for use with `ConnectionStatusBadge`
- [x] 7.3 Import and render `ConnectionStatusBadge` in the `LLMProviderCard` header alongside the title, using the mapped props and `lastTestedAt`
- [x] 7.4 After a successful or failed test, update local `status` and `lastTestedAt` state in `LLMProviderCard` so the badge reflects the new result immediately (without requiring a page reload)
- [x] 7.5 After saving with a new API key, reset local `status` state to `"configured"` and `lastTestedAt` to `null` so the badge shows amber "Not verified"
