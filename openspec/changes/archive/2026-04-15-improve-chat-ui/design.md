## Context

The app currently has a single, ephemeral chat session stored server-side (`SessionState`). The entire `chat` array lives inside one global session and is wiped/overwritten on each request. The sidebar only shows data sources. There is no persistence across page reloads, no ability to switch between conversations, and the composer has no keyboard shortcut or loading feedback.

The change introduces multi-session chat with a ChatGPT/Claude-like UX: a left sidebar with data sources at the top and a scrollable chat history list at the bottom, message bubbles for user and assistant turns, Enter-to-send, and an animated typing indicator.

Constraints: Next.js App Router, server-side JSON file store (no database), existing `SessionState` shape reused where possible.

## Goals / Non-Goals

**Goals:**
- Persist multiple named chat sessions server-side (JSON file store)
- Sidebar shows data sources (top) and chat history list (bottom) simultaneously
- Users can open, create, and delete chats from the sidebar
- Composer sends on Enter; Shift+Enter inserts newline
- Three-dot animated typing indicator while assistant is processing
- Message bubbles with distinct user/assistant styles and auto-scroll to latest message
- Existing chat routing logic (GA4, LLM tool calling, integration awareness) is unchanged

**Non-Goals:**
- Real-time streaming of assistant responses (still request/response)
- Chat search or filtering
- Chat renaming by the user (auto-title from first message is sufficient)
- Multi-user / auth (single-user local tool)
- Pagination of chat history

## Decisions

### 1. Chat sessions stored as separate JSON files, not one big file

**Decision**: Each chat session gets its own file at `data/chats/<id>.json`. A `data/chats/index.json` holds a lightweight manifest (id, title, createdAt, updatedAt, messageCount).

**Why**: The existing store pattern writes single JSON files. Splitting by session avoids loading all messages just to render the sidebar list, and makes deletes a simple file removal. Keeping an index avoids scanning the directory on every sidebar load.

**Alternative considered**: Single `data/chats.json` with all sessions. Rejected — grows unbounded, full read/write on every message.

---

### 2. New `ChatSession` type replaces single-session `SessionState.chat`

**Decision**: Introduce `ChatSession { id, title, createdAt, updatedAt, messages: ChatMessage[] }` and `ChatSummary { id, title, createdAt, updatedAt, messageCount }`. The existing `SessionState` retains connections/integrations state; the `activeChat` reference is managed separately.

**Why**: Keeps connection state (BigQuery, PowerBI, GA4 OAuth) decoupled from conversation history. A user can switch chats without re-fetching integration status.

**Alternative considered**: Embed `chatId` into `SessionState`. Rejected — the session is connection state; chat is a separate concern.

---

### 3. New REST API surface for chat session CRUD

**Decision**:
- `GET /api/chats` → `ChatSummary[]` (sidebar list)
- `POST /api/chats` → create session, return `ChatSummary`
- `GET /api/chats/[id]` → `ChatSession` (load full messages)
- `DELETE /api/chats/[id]` → 204
- `POST /api/chats/[id]/messages` → send message, return updated `ChatSession`

The existing `POST /api/chat` is deprecated in favour of the session-scoped endpoint.

**Why**: Clean REST surface. The session-scoped message endpoint (`/api/chats/[id]/messages`) makes the active session explicit server-side, avoiding the ambiguity of the current global session.

---

### 4. Active session state managed in `ChatSessionContext` (React context)

**Decision**: A `ChatSessionContext` holds `activeChatId`, `chats: ChatSummary[]`, and helpers (`openChat`, `createChat`, `deleteChat`). The Dashboard subscribes to this context.

**Why**: Sidebar and main panel both need the active session id and the list — context avoids prop drilling. Lifting state to a server component is unnecessary here (it is interactive UI state).

---

### 5. Auto-title from first user message (client-side truncation)

**Decision**: When a new chat sends its first message, the title is set to the first 40 characters of the user message + "…" if truncated. Title is set server-side at message-send time when `messageCount === 0`.

**Why**: Simple and instant — no extra LLM call needed. The user can identify past chats by their first question which is the natural mental model.

---

### 6. Typing indicator via optimistic UI state (no streaming)

**Decision**: When the user submits a message, the UI immediately appends the user bubble and shows a `<TypingIndicator>` (three animated dots) in the assistant position. The indicator is replaced with the actual reply once the API responds.

**Why**: The backend is still synchronous (no streaming). Optimistic rendering gives instant feedback without changing the API contract.

---

### 7. Enter-to-send on `<textarea>` via `onKeyDown` handler

**Decision**: `onKeyDown` checks for `Enter` without `shiftKey` → calls `form.requestSubmit()`. `Shift+Enter` falls through to default newline insertion.

**Why**: Standard chat UX pattern. The textarea remains (not `<input>`) so Shift+Enter line-breaks still work naturally.

## Risks / Trade-offs

- **File store concurrency** → The existing store already uses synchronous file writes per session. Multiple rapid messages to the same chat could race. Mitigation: same as current — single-user local tool, acceptable for now.
- **Index.json getting stale** → If a chat file is deleted outside the app the index won't self-heal. Mitigation: `GET /api/chats` reconciles index against actual files on read.
- **No message streaming** → Users will wait silently until the LLM responds (same as today). The typing indicator mitigates perceived latency but does not reduce actual latency. Mitigation: noted as a future enhancement; streaming would require Response API changes.
- **Context provider wrapping** → Adding `ChatSessionContext` at the app level means it wraps the settings pages unnecessarily. Mitigation: scope the provider to the `(dashboard)` layout segment only.

## Migration Plan

1. Deploy new API routes alongside the old `POST /api/chat` (keep it working during transition).
2. On first load, if no chats exist in `data/chats/`, auto-create a "New Chat" session and migrate any existing messages from the old `SessionState` into it.
3. Once dashboard is updated to use the new session endpoints, remove `POST /api/chat` and the `chat` array from `SessionState`.
4. No rollback complexity — the old session file is not deleted during migration, only ignored.

## Open Questions

- Should deleted chats be soft-deleted (archived) or hard-deleted (file removed)? **Current decision: hard-delete** (simpler, single-user tool). Revisit if undo is needed.
- Should the sidebar chat list show a preview of the last message or just the title? **Current decision: title + timestamp only** (keeps sidebar compact, avoids loading full sessions for the list).
