## Context

The chat UI is served from a single route (`/`). Session state lives entirely in `ChatSessionContext` (in-memory React state): on page refresh or back-navigation the context is torn down and the last chat list entry is re-opened, not the session the user was actually viewing. There is no URL that identifies a session.

The composer textarea has a `resizeComposerInput` helper that adjusts height on input, but the placeholder text does not stay vertically centered in the initial single-line state, and there is no affordance to cancel an in-flight LLM request — the user must wait for the full response.

## Goals / Non-Goals

**Goals:**
- Route each chat session to `/chat/[id]` so the URL uniquely identifies the session; refreshing or sharing the link re-opens the same chat.
- Redirect the root `/` to the most-recently-updated session (or create a new one if none exist).
- Display the active session ID (short label or full ID) in the top bar.
- Add a Stop button that immediately aborts the in-flight LLM request when the assistant is generating.
- Make the composer textarea auto-resize vertically as content grows, following Claude's input behavior (single-line by default, grows to a max height, then scrolls).
- Keep the placeholder text centered vertically in the initial single-line state.

**Non-Goals:**
- Streaming responses (the LLM call is still awaited in full; only the HTTP request is abortable).
- Renaming or editing chat titles manually.
- Any changes to the backend API routes.

## Decisions

### 1. URL-based session routing via Next.js dynamic route

**Decision**: Add `src/app/chat/[id]/page.tsx` as the chat page. Wrap it in `ChatSessionProvider`. The root `page.tsx` becomes a redirect-only page that fetches the chat list and pushes to `/chat/<mostRecentId>` (or creates a new session and redirects to it).

**Rationale**: Next.js App Router dynamic segments are the idiomatic way to encode entity IDs in the URL. Moving the chat page under `/chat/[id]` requires minimal structural change — the `ChatSessionProvider` simply reads `params.id` instead of defaulting to the first list entry.

**Alternative considered**: Keep the single route and use a query parameter (`/?chatId=...`). Rejected because query params are less canonical, don't participate in Next.js layouts as cleanly, and are easily stripped by back-navigation or sharing.

### 2. Session ID source of truth: URL param → context

**Decision**: `ChatSessionProvider` accepts an optional `initialChatId` prop. When provided (from the dynamic route segment), it loads that session on mount instead of the most-recently-updated one. If the ID is not found (404), it redirects to `/`.

**Rationale**: Keeps the context reusable (the sidebar still works) while allowing the URL to drive which session is active. The `activeChatId` state in context is still the canonical in-memory id, but it is seeded from the URL on every mount.

### 3. Abort in-flight LLM requests with AbortController

**Decision**: `sendMessage` in `ChatSessionContext` creates an `AbortController` and stores its reference in a `useRef`. The fetch call to `POST /api/chats/[id]/messages` is passed the controller's signal. A new `abortMessage()` function calls `controller.abort()`. Context exposes both `isGenerating` (true while the request is in flight) and `abortMessage`.

**Rationale**: `AbortController` is the browser-native mechanism for cancelling fetch requests. No new dependencies required. When aborted, the optimistic user message stays visible but no assistant message is appended; `isTyping` is set to false and the composer re-enables immediately.

**Alternative considered**: A separate streaming implementation that would allow partial responses. Deferred — this change only makes the existing blocking call cancellable.

### 4. Composer textarea: centered placeholder + auto-resize

**Decision**: Wrap the textarea in a flex container with `align-items: center`. The textarea itself is `resize: none; overflow: hidden` and starts at a single-line height. A `data-has-content` attribute (toggled by the `onInput` handler) switches the wrapper to `align-items: flex-start` once the user has typed. `resizeComposerInput` (already exists) handles height growth. Max height remains as currently set; overflow switches to `auto` above it.

**Rationale**: Pure CSS + the existing JS resize helper — no new library needed. The `data-has-content` attribute is a clean way to drive the CSS state machine without React re-renders on every keystroke.

**Alternative considered**: Using a `contenteditable` div instead of `<textarea>`. Rejected — it introduces significant complexity (paste handling, cursor management, serialization) for no user-visible benefit given the current scope.

### 5. Stop button replaces Send button during generation

**Decision**: The send button area conditionally renders a Stop button (square icon, same size/position) when `isGenerating` is true. Clicking it calls `abortMessage()`. The Stop button is always enabled while generating; the Send button is disabled when the textarea is empty.

**Rationale**: Claude's own UI uses this pattern — a single action slot that switches between Send and Stop. It avoids layout shift (same position, same size) and is immediately discoverable.

## Risks / Trade-offs

- **Abort leaves partial state**: When the user aborts, the optimistic user message is visible but no assistant reply follows. The session on disk does not include the optimistic message (it was never persisted). On refresh, the aborted message will not appear. This is acceptable and matches typical chat UIs, but may surprise users. → Mitigation: could persist the user message immediately before sending; deferred as out of scope.
- **Root redirect flicker**: The root page briefly renders before redirecting. → Mitigation: use `redirect()` from `next/navigation` server-side so the redirect happens before any HTML is painted.
- **ID in the header**: The chat ID is a UUID and is not user-friendly to display verbatim. → Mitigation: display the session `title` (already tracked in state) in the header instead, and show the ID only as a URL/metadata concern.

## Migration Plan

1. Add dynamic route `src/app/chat/[id]/page.tsx` with `ChatSessionProvider` seeded from the URL param.
2. Update root `src/app/page.tsx` to redirect to the latest session (server-side `redirect`).
3. Update `ChatSessionContext` to accept `initialChatId`, expose `isGenerating` / `abortMessage`, and wire `AbortController` into `sendMessage`.
4. Update the composer CSS and `onInput` handler for centering + auto-resize.
5. Update the send button to toggle Stop when `isGenerating`.
6. Update the top bar to display session title from context.

Rollback: revert the route change; the context changes are additive and backwards-compatible.

## Open Questions

- Should navigating to `/chat/<unknown-id>` show a "not found" UI or silently redirect to `/`? (Current decision: redirect to `/`.)
- Should the session ID appear anywhere in the UI beyond the URL? (Current decision: no; the title suffices.)
