## 1. Route Structure

- [x] 1.1 Extract the shared dashboard shell from the current route-bound chat page so `/` and `/chat/[id]` can reuse the same presentation without duplicating layout logic.
- [x] 1.2 Replace the redirect-only implementation in `src/app/page.tsx` with a homepage route that renders the dashboard home state and does not auto-select or auto-create a chat session on load.
- [x] 1.3 Update the Broly brand link and the sidebar plus/new-chat affordance so both return the user to `/` without creating a chat session.
- [x] 1.4 Keep `src/app/chat/[id]/page.tsx` as the session-specific route wrapper that loads the requested chat id and returns unknown ids to `/`.

## 2. Session Application Layer

- [x] 2.1 Update `ChatSessionProvider` (or an extracted route-aware controller around it) to support an explicit home mode with no implicit session loading and an explicit session mode seeded from `chatId`.
- [x] 2.2 Replace eager new-chat creation from the sidebar plus action with a home-state reset flow that leaves the route at `/` until the user actually starts the conversation.
- [x] 2.3 Ensure `openChat` navigates to `/chat/[id]` consistently from both the homepage and an existing session route.
- [x] 2.4 Add the first-message flow from `/` so submitting the composer or a template creates a session, navigates to `/chat/[id]`, and continues the chat interaction inside that new session.

## 3. Homepage and Routing Verification

- [x] 3.1 Verify that `/` renders the dashboard home correctly whether chats already exist or not, and that no session becomes active until the user explicitly chooses or starts one.
- [x] 3.2 Verify that direct navigation and refresh at `/chat/[id]` still load the correct session and that invalid ids fall back to `/`.
- [x] 3.3 Verify that clicking Broly or the sidebar plus action always returns to `/` without creating a chat id.
- [x] 3.4 Verify route transitions end to end for: opening an existing chat and starting the first conversation from the homepage.
