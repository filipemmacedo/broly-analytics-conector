## 1. Fix First-Message Route Transition Flash

- [x] 1.1 In `src/context/ChatSessionContext.tsx`, replace the `useState(mode === "session")` initialiser for `isSessionLoading` with a lazy initialiser that calls `readPendingChatStart(initialChatId)` synchronously and returns `false` when a pending start is found, so the `ChatRouteLoader` is never shown on the first render for that path.
- [x] 1.2 Verify that navigating directly to `/chat/<id>` (no pending start) still shows the `ChatRouteLoader` until the session loads.
- [x] 1.3 Verify that refreshing the page on `/chat/<id>` (no pending start) also shows the loader correctly.

## 2. Fix GA4 Property Picker Layout Shift

- [x] 2.1 Add an `isLoading` boolean state (initialised to `true`) to `GA4PropertyPicker` in `src/components/data-sources-panel.tsx`.
- [x] 2.2 Set `isLoading` to `false` in the `finally` block of the properties fetch `useEffect`, so it is cleared whether the fetch succeeds or fails.
- [x] 2.3 When `isLoading` is `true`, render a three-dot placeholder element (e.g. `<div className="ga4-picker-loading">···</div>`) instead of returning `null`, so the layout space is reserved.
- [x] 2.4 Add a CSS rule in `src/app/globals.css` for `.ga4-picker-loading` that matches the minimum height of the `.ga4-picker-trigger` and applies a muted colour to the dots.
- [x] 2.5 Verify that the sidebar does not shift when the GA4 property picker resolves from loading to the actual trigger.
