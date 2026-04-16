## Why

The current routing model redirects `/` straight into the most recent chat session, which makes the homepage impossible to use as a true dashboard landing experience and couples route resolution to chat persistence. We need a cleaner route architecture where the homepage shows the first dashboard screen while each chat session still keeps its own stable, shareable URL.

## What Changes

- Render the dashboard home experience at `/` instead of redirecting immediately to a chat session.
- Keep `/chat/[id]` as the canonical route for loading, refreshing, and sharing a specific chat session.
- Extract the shared dashboard screen structure from route-specific session bootstrapping so home and chat routes can reuse the same UI without duplicated logic.
- Make the Broly brand and the sidebar plus action return the user to `/` as a blank dashboard/home state rather than creating a chat immediately.
- Update session-opening flows so they navigate into `/chat/[id]` only when a concrete session exists, and create the session id only when the user actually starts the interaction.
- Preserve the existing invalid-session fallback by returning unknown chat ids back to `/`, which now acts as the dashboard home.

## Capabilities

### New Capabilities
- `dashboard-home-shell`: Defines the dashboard landing route, its initial non-session state, and the transition from home into a concrete chat route.

### Modified Capabilities
- `chat-session-management`: Changes root-route behavior so `/` is the dashboard home instead of an automatic redirect target, while keeping per-session routing at `/chat/[id]`.

## Impact

- **Routes**: `src/app/page.tsx`, `src/app/chat/[id]/page.tsx`, and any shared route-level dashboard wrappers.
- **State management**: `ChatSessionProvider` and related chat bootstrapping logic will need a clearer distinction between “no session selected yet” and “session route is active”.
- **UI structure**: `Dashboard` will likely be split into shared presentation and route-specific orchestration to keep responsibilities clean.
- **Navigation flows**: Broly brand navigation, sidebar plus behavior, sidebar session selection, invalid session fallback, and first-message flows may need route-aware updates.
