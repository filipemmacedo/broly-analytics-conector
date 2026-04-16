## Context

The current implementation, introduced by `chat-ui-improvements`, made `/` a redirect-only route and moved the chat experience to `/chat/[id]`. That solved refresh/share problems for individual chats, but it also removed the dashboard landing page entirely and pushed route orchestration into page-level chat bootstrapping.

The requested behavior is different: `/` should remain the dashboard home, while `/chat/[id]` should remain the canonical route for a concrete chat session. To keep this change maintainable, the route layer needs a cleaner separation between:
- dashboard home state (no session selected yet),
- chat session state (a specific session id is active),
- shared dashboard presentation.

## Goals / Non-Goals

**Goals:**
- Render the dashboard landing experience at `/` without an automatic redirect.
- Keep each chat session addressable and refresh-safe at `/chat/[id]`.
- Support clean transitions from home into a chat route when the user opens an existing chat or starts a new conversation.
- Make the Broly brand and the sidebar plus action consistently return the workspace to `/` without eagerly creating a session.
- Refactor route/session wiring so presentation is shared and route logic stays thin.
- Avoid implicit session creation or implicit session selection just because the homepage loads.

**Non-Goals:**
- Redesign the dashboard UI or sidebar information architecture.
- Change chat storage APIs or the on-disk chat data model.
- Introduce nested workspace routes beyond `/` and `/chat/[id]`.
- Change the abort/generation behavior from the existing chat implementation.

## Decisions

### 1. Keep two explicit route states: dashboard home and chat session

**Decision**: `/` will render the dashboard home state, and `/chat/[id]` will render the same dashboard shell with a specific session selected.

**Rationale**: This preserves shareable chat URLs without sacrificing a stable homepage. It also makes the route model easy to understand: home is for entering the workspace, session routes are for working within a specific chat.

**Alternative considered**: Continue redirecting `/` and add a separate landing route such as `/dashboard`. Rejected because it introduces an unnecessary extra route and weakens the semantic meaning of the root homepage.

### 2. Separate shared dashboard presentation from route-specific orchestration

**Decision**: Extract a shared dashboard screen layer that renders the top bar, sidebar, composer, empty state, and message area. Route-level wrappers will provide either:
- a home-mode chat controller with no active session, or
- a session-mode chat controller seeded from `params.id`.

**Rationale**: This follows a cleaner architecture boundary:
- **route adapters** decide which mode is active,
- **session/application layer** manages chat loading and actions,
- **presentation layer** renders the dashboard UI.

This avoids duplicating the dashboard component while also preventing the root page from carrying session-specific redirect logic.

**Alternative considered**: Keep a single `Dashboard` component with more route conditionals inside it. Rejected because it would continue mixing route semantics, session boot logic, and presentation concerns in one place.

### 3. Make session bootstrapping explicit instead of implicit

**Decision**: `ChatSessionProvider` (or a thin replacement around it) will support an explicit home mode where:
- no session is loaded automatically on mount,
- no chat is created automatically on mount,
- an existing session is loaded only when the user selects one,
- a new session is created only when the user explicitly starts one.

Session mode will continue to require a concrete `chatId` and will load that session on mount.

**Rationale**: The current fallback behavior (`load first list entry if no initialChatId`) is useful for a redirect-driven app but incorrect for a true homepage. Explicit modes make the provider behavior predictable and easier to test.

**Alternative considered**: Keep implicit first-session loading and simply hide the route redirect. Rejected because `/` would still silently behave like “latest chat,” which is exactly the behavior the user wants to avoid.

### 4. Home affordances reset state; session routes appear only after real interaction

**Decision**: The Broly brand and the sidebar plus action will both navigate to `/` and put the workspace into a blank home-state draft without creating a session id. From that home state, the app will navigate to `/chat/[id]` only when a user action chooses an existing session or actually starts a new conversation:
- clicking the Broly brand from any chat route,
- clicking the sidebar plus/new-chat affordance,
- clicking an existing chat in the sidebar,
- submitting the first message from the home composer or template chips.

If the first action after returning home is “send message,” the system will create the session first, navigate to `/chat/[id]`, and then continue the message workflow in that session.

**Rationale**: This preserves the homepage as a non-session route, gives the user a predictable way to reset back to a fresh dashboard state, and still guarantees that every real chat interaction happens under a shareable session URL.

**Alternative considered**: Allow message sending on `/` without immediately navigating. Rejected because it would create an in-between state where a concrete session exists but the URL does not identify it.

### 5. Unknown chat ids return to dashboard home

**Decision**: Navigating to `/chat/[id]` with an unknown id will continue to redirect to `/`, but `/` will now show the dashboard home instead of redirecting onward to another session.

**Rationale**: This keeps the invalid-id fallback simple and user-friendly while aligning it with the new meaning of the homepage.

**Alternative considered**: Add a dedicated chat 404 screen. Deferred because the current requested behavior is to land on the dashboard homepage.

## Risks / Trade-offs

- **Session creation from home adds one extra transition** -> Mitigation: create the session as part of the initiating user action and navigate immediately so the experience still feels direct.
- **Refactoring shared dashboard structure may touch several files** -> Mitigation: keep the extraction shallow, favoring thin wrappers over broad UI rewrites.
- **The active `chat-ui-improvements` change currently assumes root redirect behavior** -> Mitigation: treat this change as the architectural follow-up that replaces only the routing/homepage portion while preserving the rest of the chat improvements.
- **Home mode introduces a new “no active session” state** -> Mitigation: make that state explicit in the session layer instead of encoding it through missing data or fallback list selection.

## Migration Plan

1. Extract a shared dashboard screen from the current route-bound chat page.
2. Replace the redirect-only root page with a home-mode dashboard route.
3. Update the session provider/controller to support explicit home mode and explicit session mode.
4. Route the Broly brand and sidebar plus action to `/` and reserve `/chat/[id]` creation for explicit session selection or first-message creation from home.
5. Verify invalid session ids return to `/` and no longer cascade into latest-chat redirects.

Rollback: restore the redirect-based root page and previous implicit session-loading behavior if the refactor introduces regressions.

## Open Questions

- Should the homepage top bar use a static title (for example, “Dashboard”) or the existing product brand treatment only?
- When a user submits the first message from `/`, should navigation happen before the optimistic user bubble appears, or should the optimistic message be carried across the route transition?
