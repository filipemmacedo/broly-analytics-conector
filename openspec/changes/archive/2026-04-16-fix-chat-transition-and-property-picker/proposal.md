## Why

Two regressions were introduced by `dashboard-home-and-chat-routes`: the first-message flow briefly flashes the chat skeleton loader before the optimistic message appears, and the GA4 property picker pops into view after the sidebar has already rendered—pushing content down. Both are polish bugs that make the experience feel rough compared to the smooth transitions the routing refactor was intended to enable.

## What Changes

- Fix the `ChatSessionProvider` initialization so the `ChatRouteLoader` skeleton is never shown when navigating from the home composer to a new chat (a pending start already exists in sessionStorage at mount time).
- Fix the `GA4PropertyPicker` so it reserves its layout space with a three-dots placeholder while the properties are being fetched, instead of returning `null` and popping in later.

## Capabilities

### New Capabilities

<!-- None -->

### Modified Capabilities

- `chat-session-management`: The first-message transition from `/` to `/chat/[id]` SHALL not show the route loading skeleton when a pending chat start is present at mount time.
- `ga4-property-selector`: The property picker UI in the sidebar SHALL show a loading placeholder (three dots) while fetching properties instead of being absent.

## Impact

- **`src/context/ChatSessionContext.tsx`**: `isSessionLoading` initial state needs a lazy initializer that reads sessionStorage for a pending start.
- **`src/components/data-sources-panel.tsx`**: `GA4PropertyPicker` needs a `isLoading` state that renders a placeholder instead of `null`.
- **CSS (`src/app/globals.css`)**: May need a small rule for the three-dot loading placeholder inside the picker.
- No API changes, no route changes, no spec-level requirement additions beyond the two deltas listed above.
