## Context

Three UI surfaces display connection state with inconsistent semantics, colors, and persistence:

1. **Data Sources Panel** (`data-sources-panel.tsx`) — sidebar dot, 2 states only (green/grey), never reads `healthState`
2. **Integration Cards** (`ConnectionStatusBadge.tsx` + `IntegrationCard.tsx`) — text badge with 4 tones, but `expired` wrongly maps to red and `unknown` wrongly maps to green
3. **LLM Provider Card** (`LLMProviderCard.tsx`) — no status indicator; test result is ephemeral; `LLMSettings` type carries no `status` or `lastTestedAt`

The integration health system (`IntegrationStatus` × `HealthState`) is solid and well-typed. The LLM settings are persisted to a machine-local encrypted file (`data/llm-settings.enc.json`) via `llm-settings-store.ts`. The fix extends that same pattern.

## Goals / Non-Goals

**Goals:**
- Define a single four-signal vocabulary (grey/green/amber/red) with canonical labels and conditions used across all three surfaces
- Fix `ConnectionStatusBadge` tone mapping (`expired` → amber, `unknown` → amber)
- Add amber and red dot states to the Data Sources Panel, driven by `healthState`
- Add hover tooltips to panel dots
- Add persistent status badge to the LLM Provider Card, matching integration card pattern
- Extend `LLMSettings` / `PublicLLMSettings` types with `status` and `lastTestedAt`
- Extend `StoredLLMSettings` (store-internal type) with `status` and `lastTestedAt`
- Persist `status` + `lastTestedAt` after test; reset `status` to `"configured"` on save with new API key

**Non-Goals:**
- Adding health check polling or background refresh for integrations
- Changing how integration `status`/`healthState` are computed on the backend
- UI redesign beyond status indicators (layout, card structure, etc.)
- Adding LLM status to the sidebar Data Sources Panel (LLM is not a data source)

## Decisions

### D1: Single canonical state map — shared by all surfaces

Rather than per-surface ad-hoc logic, define the vocabulary once and derive from it everywhere.

```
Condition                                    Signal  Label
──────────────────────────────────────────── ─────── ─────────────────
null / status: unconfigured                  grey    Not set up
status: configured + healthState: healthy    green   Connected
status: expired                              amber   Needs reconnect
status: configured + healthState: degraded   amber   Degraded
status: configured + healthState: unknown    amber   Not verified
status: configured + healthState: unreachable  red   Connection error
status: error                                red     Connection error
```

The `ConnectionStatusBadge` `getTone` and `getLabel` functions are the canonical implementation of this map. The panel dot derives its CSS modifier from the same logic (via a helper or by duplicating the minimal mapping needed for the dot).

**Alternative considered:** separate mappings per surface — rejected because it re-introduces drift.

### D2: Panel dot tooltip — native HTML `title` attribute

The dot is a `<Link>` wrapping a `<span>`. Adding a `title` attribute to the link (or the dot span) gives a native browser tooltip with zero JS overhead.

Tooltip copy pattern: `"{Label} · click to configure"` — e.g. `"Needs reconnect · click to configure"`.

**Alternative considered:** custom CSS tooltip — adds complexity for a glance-level hint; native `title` is sufficient.

### D3: LLM status type — extend existing types, not a new type

Add `status: LLMStatus` and `lastTestedAt: string | null` to both `LLMSettings` and `PublicLLMSettings`. Add a new `LLMStatus` union type to `types/llm.ts`:

```ts
export type LLMStatus = "unconfigured" | "configured" | "ok" | "error";
```

`StoredLLMSettings` (internal to `llm-settings-store.ts`) gets the same two fields.

**Why not reuse `IntegrationStatus`?** LLM has a distinct lifecycle (`ok` instead of `healthy`, no OAuth expiry). Keeping types separate avoids coupling the LLM store to integration semantics.

### D4: LLM status persistence — same file, same store

`status` and `lastTestedAt` are written to `data/llm-settings.enc.json` alongside existing fields. No new file or store needed.

State transitions:
- `saveLLMSettings` with a **new** API key → write `status: "configured"`, `lastTestedAt: null`
- `saveLLMSettings` with the **masked sentinel** (key unchanged) → preserve existing `status` and `lastTestedAt`
- `updateLLMTestResult(success: boolean)` → write `status: "ok" | "error"`, `lastTestedAt: new Date().toISOString()`

A new exported function `updateLLMTestResult` in `llm-settings-store.ts` handles the test-result write so the test route stays clean.

### D5: LLM badge in the card header — reuse `ConnectionStatusBadge`

`ConnectionStatusBadge` takes `status: IntegrationStatus` and `healthState: HealthState`. Rather than wiring LLM types into that component, create a small adapter in `LLMProviderCard` that maps `LLMStatus` to the badge props:

```
LLMStatus    → IntegrationStatus   HealthState
──────────── → ─────────────────   ───────────
unconfigured → "unconfigured"       "unknown"
configured   → "configured"         "unknown"    (amber: Not verified)
ok           → "configured"         "healthy"    (green: Connected)
error        → "error"              "unknown"    (red: Connection error)
```

**Alternative considered:** new `LLMStatusBadge` component — rejected as unnecessary duplication when a simple adapter suffices.

## Risks / Trade-offs

- **Store schema migration** — existing `llm-settings.enc.json` files won't have `status`/`lastTestedAt`. `readStore` must treat missing fields as `status: "configured"` (not verified) and `lastTestedAt: null`. Since the file is local and not versioned, a silent default is appropriate.
- **`title` tooltip UX** — native tooltips have a delay and can't be styled. Acceptable for a glance-level hint; can be upgraded to a CSS tooltip later without changing the data model.
- **Amber for `unknown` may feel alarming** — a freshly saved integration with no health check will show "Not verified" in amber. This is intentional (user should test), but could surprise users. Mitigated by clear label text.

## Migration Plan

No data migrations needed. The store file addition is backwards-compatible (missing fields default gracefully). No API version changes — the GET `/api/settings/llm` response gains new fields, which existing clients ignore.

Deploy order: ship as a single PR. No feature flags needed.
