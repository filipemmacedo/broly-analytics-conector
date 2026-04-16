## Why

The chat input lacks polish and resilience: the textarea doesn't grow with user input, the placeholder misaligns once typing begins, there's no way to abort a slow or incorrect LLM response, and navigating away from the chat page loses the session entirely. These gaps degrade the experience and make the chat feel unfinished compared to modern AI chat UIs.

## What Changes

- **Auto-resizing composer textarea** — the input grows vertically as the user types (up to a max height), matching Claude's chat input behavior.
- **Centered placeholder text** — the placeholder remains visually centered (both horizontally and vertically) in the initial single-line state, shifting to top-aligned as content grows.
- **Stop / abort button** — a stop button replaces (or augments) the send button while the LLM is generating or thinking, allowing the user to immediately cancel the in-flight request.
- **URL-based session routing** — each chat session is accessed at `/chat/[id]`; navigating to the route loads that session, refreshing the page re-opens the same session, and new sessions redirect to their ID in the URL.
- **Session ID displayed in header** — the active chat ID (or a derived short label) is shown in the top bar so users can identify and share sessions.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `chat-ui-experience`: Requirements for auto-resizing textarea, centered placeholder, and stop/abort button during generation are being added.
- `chat-session-management`: Requirements for URL-path-based session routing (`/chat/[id]`) and session persistence on page refresh are being added.

## Impact

- **Components**: Chat composer textarea component, send button area, chat page layout/routing.
- **Routing**: A new dynamic route `/chat/[id]` (or equivalent) is needed; the existing chat page route changes.
- **API**: No new endpoints required; existing `GET /api/chats/[id]` is used to rehydrate on refresh. Streaming/abort may require `AbortController` wiring on the client.
- **State management**: Active session ID must be derived from the URL rather than held only in React state.
