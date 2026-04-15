## 1. Data Types & Store Foundation

- [x] 1.1 Add `ChatSession`, `ChatSummary` types to `src/lib/types.ts`
- [x] 1.2 Create `src/lib/chat-store.ts` with functions: `listChats`, `createChat`, `getChat`, `deleteChat`, `appendMessage`, `setTitle`
- [x] 1.3 Implement `data/chats/index.json` manifest read/write helpers inside `chat-store.ts`
- [x] 1.4 Implement index reconciliation (remove orphaned entries) in `listChats`

## 2. Chat Session API Routes

- [x] 2.1 Create `src/app/api/chats/route.ts` — `GET` returns `ChatSummary[]`, `POST` creates new session
- [x] 2.2 Create `src/app/api/chats/[id]/route.ts` — `GET` returns full `ChatSession`, `DELETE` removes session
- [x] 2.3 Create `src/app/api/chats/[id]/messages/route.ts` — `POST` sends message via orchestrator, appends user + assistant turns, auto-titles on first message
- [x] 2.4 Update `POST /api/chats/[id]/messages` to pass session message history to `handleQuestion` for LLM context
- [x] 2.5 Add auto-create fallback in `GET /api/chats` — if no sessions exist, create and return a default "New Chat" session

## 3. Chat Session Context

- [x] 3.1 Create `src/context/ChatSessionContext.tsx` with state: `activeChatId`, `chats: ChatSummary[]`, `activeSession: ChatSession | null`
- [x] 3.2 Implement `openChat(id)`, `createChat()`, `deleteChat(id)` helpers in the context that call the API routes
- [x] 3.3 Implement `sendMessage(question)` helper that calls `POST /api/chats/[activeChatId]/messages` and updates `activeSession`
- [x] 3.4 Add optimistic user message append and typing indicator state (`isTyping`) to `sendMessage`
- [x] 3.5 Wrap the dashboard layout with `ChatSessionProvider` (scope to dashboard, not settings pages)

## 4. Typing Indicator Component

- [x] 4.1 Create `src/components/ui/TypingIndicator.tsx` with three animated dots
- [x] 4.2 Add CSS keyframe animation for the dot pulse/bounce in `globals.css`

## 5. Message Bubble Component

- [x] 5.1 Create `src/components/ui/MessageBubble.tsx` accepting `message: ChatMessage` prop
- [x] 5.2 Apply `message-bubble--user` style for user role and `message-bubble--assistant` for assistant role
- [x] 5.3 Apply error indicator style when `message.status === "error"`
- [x] 5.4 Add CSS for bubble styles in `globals.css` (distinct backgrounds, alignment)

## 6. Chat History Sidebar

- [x] 6.1 Create `src/components/ChatHistorySidebar.tsx` rendering the list of `ChatSummary` items from context
- [x] 6.2 Render items sorted newest-first with title and formatted timestamp
- [x] 6.3 Highlight the active session item with `chat-item--active` class
- [x] 6.4 Implement click-to-open: call `openChat(id)` on item click
- [x] 6.5 Add delete button (trash icon) per item, visible on hover, calling `deleteChat(id)` on click
- [x] 6.6 Add "New Chat" button at the top of the history section calling `createChat()`
- [x] 6.7 Show "No chats yet" placeholder when the chat list is empty
- [x] 6.8 Add CSS for sidebar history section: scrollable list, hover states, active style, delete button visibility

## 7. Dashboard Layout Refactor

- [x] 7.1 Refactor `src/components/dashboard.tsx` to split sidebar into two sections: `DataSourcesPanel` (top) + `ChatHistorySidebar` (bottom)
- [x] 7.2 Replace the inline message list with `<MessageBubble>` components
- [x] 7.3 Render `<TypingIndicator>` when `isTyping` is true (from context)
- [x] 7.4 Wire composer `onSubmit` to `sendMessage` from `ChatSessionContext`
- [x] 7.5 Add `onKeyDown` handler to composer textarea: Enter (no Shift) calls `form.requestSubmit()`, Shift+Enter is default
- [x] 7.6 Disable composer submit button and textarea while `isTyping` is true
- [x] 7.7 Implement auto-scroll to bottom of message list using a `useEffect` + `ref` on the last message

## 8. CSS & Visual Polish

- [x] 8.1 Add sidebar section layout styles: top section (`data-sources-section`) and bottom section (`chat-history-section`) using flexbox column with the history section taking remaining height
- [x] 8.2 Ensure sidebar sections collapse/show correctly with the existing sidebar toggle behavior
- [x] 8.3 Verify message bubble layout is readable at narrow sidebar widths (no overflow)

## 9. Cleanup & Migration

- [x] 9.1 Deprecate `POST /api/chat` (old single-session endpoint) — replace its handler body with a redirect or 410 Gone
- [x] 9.2 Remove `chat` array from `SessionState` and `PublicSessionState` types (moved to `ChatSession`)
- [x] 9.3 Update `mutateSession` / `toPublicSessionState` if needed to reflect removed `chat` field
