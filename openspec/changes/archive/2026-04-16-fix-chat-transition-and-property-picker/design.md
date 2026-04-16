## Context

`dashboard-home-and-chat-routes` introduced a pending-chat-start mechanism: when the user sends the first message from `/`, a new session is created, the pending message is written to `sessionStorage`, and the browser navigates to `/chat/<id>`. The new `ChatSessionProvider` (session mode) is then expected to pick up the pending start, show the optimistic message, and stream the LLM response — skipping the skeleton loader entirely.

The current bug is that `isSessionLoading` is initialised as `mode === "session"` unconditionally in `useState`. React processes that synchronous initial value before the `useEffect` that reads sessionStorage runs, so the `ChatRouteLoader` skeleton renders for one frame (enough for it to be visible as a flash) even when a pending start is already in storage.

For the GA4 property picker, `GA4PropertyPicker` returns `null` while its `properties` array is empty. Because the integration-status fetch and the properties fetch are independent, the sidebar renders the Google Analytics row first (status "configured"), and then the property picker pops in after its own async fetch resolves, displacing all content below it.

## Goals / Non-Goals

**Goals:**
- Eliminate the `ChatRouteLoader` flash when navigating from the home composer to a new chat.
- Reserve stable layout space for the GA4 property picker while it is fetching, using a three-dot loading indicator.

**Non-Goals:**
- Change the pending-chat-start mechanism or the sessionStorage schema.
- Change the GA4 properties API or the shape of the picker data.
- Redesign the sidebar or data sources panel layout.
- Handle error states in the property picker beyond the current silent-ignore behaviour.

## Decisions

### 1. Lazy-initialise `isSessionLoading` from sessionStorage

**Decision**: Replace the `useState(mode === "session")` call with a lazy initialiser that synchronously checks sessionStorage for a pending start matching `initialChatId`. If one exists, start with `isSessionLoading = false`; otherwise start with `true` as before.

```ts
const [isSessionLoading, setIsSessionLoading] = useState(() => {
  if (mode !== "session" || !initialChatId) return false;
  if (typeof window !== "undefined" && readPendingChatStart(initialChatId)) return false;
  return true;
});
```

**Rationale**: The lazy initialiser runs synchronously at component mount time, before the first render. Since the `ChatSessionProvider` is a "use client" component it is only ever executed in the browser, so `typeof window !== "undefined"` is always true in practice but is kept for correctness. This single change is sufficient — no extra state, no extra effects.

**Alternative considered**: Carry a route-level query param (e.g. `?pending=1`) to signal the pending start, avoiding sessionStorage in the initialiser. Rejected because it leaks implementation detail into the URL and requires more touch points.

**Alternative considered**: Wrap the route transition in a React `startTransition` / `Suspense` boundary to mask the flash. Rejected because it adds complexity and doesn't address the root cause (the initial state being wrong).

### 2. Add a `isLoading` state to `GA4PropertyPicker` with a three-dot placeholder

**Decision**: Introduce an `isLoading: boolean` state (initialised to `true`) inside `GA4PropertyPicker`. The `useEffect` fetch sets it to `false` in a `finally` block. When `isLoading` is true, render a small three-dot placeholder element that occupies the same vertical space as the picker trigger, instead of returning `null`.

**Rationale**: Reserving layout space prevents the content-push jank. A three-dot indicator is the lightest possible affordance and is already used elsewhere in the loading vocabulary of the sidebar.

**Alternative considered**: Hoist the loading state into `SourceRow` or `DataSourcesPanel` and conditionally render a skeleton for the whole row while GA4 properties are fetching. Rejected because it creates unnecessary coupling between the source row and the picker's internal async lifecycle.

**Alternative considered**: Return a zero-height invisible placeholder. Rejected because the height would still change from 0 to the picker height when loaded, causing the same shift.

## Risks / Trade-offs

- **SSR hydration mismatch for `isSessionLoading`**: The lazy initialiser reads sessionStorage, which is unavailable on the server. Since `ChatSessionProvider` is a "use client" component, Next.js does render it on the server for the initial HTML — on the server, `typeof window === "undefined"` so the lazy initialiser falls back to `true`, matching the old server-rendered state. The client then hydrates with potentially `false`. This could cause a React hydration mismatch warning. **Mitigation**: Wrap the sessionStorage read in `typeof window !== "undefined"` guard (already in the decision above), and accept that the first paint on the client will be correct even if the server-rendered HTML shows the loader state — the flash is currently happening anyway, so this is no regression.
- **Three-dot placeholder height must match picker trigger height**: If CSS ever changes the picker trigger height, the placeholder must be updated to match. **Mitigation**: Use the same CSS class or a shared height token so both elements stay in sync.

## Migration Plan

1. Update `ChatSessionContext.tsx` — change the `isSessionLoading` initialiser (one line change).
2. Update `data-sources-panel.tsx` — add `isLoading` state, update the return logic, add placeholder element.
3. Add/update CSS in `globals.css` for the three-dot placeholder if needed.
4. Manual smoke test: send first message from `/`, verify no loader flash; verify GA4 picker shows three dots while loading.

Rollback: revert the two files. No data migrations or API changes involved.
