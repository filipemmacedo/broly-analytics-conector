## Why

The current chat interface is a single, non-persistent conversation with minimal UX polish — no chat history, no Enter-to-send, no loading feedback, and a sidebar that only shows data sources. Users expect a ChatGPT/Claude-like experience where they can manage multiple conversations, see a history of past chats, and get clear visual feedback while the assistant is thinking.

## What Changes

- **Multi-chat session management**: Each conversation is a named session stored persistently. Users can create new chats, switch between past ones, and delete them.
- **Sidebar redesign**: Data sources panel moves to the top section; a scrollable chat history list occupies the bottom section with open/delete controls per entry.
- **Enter-to-send**: Pressing Enter in the composer submits the message (Shift+Enter inserts a newline).
- **Typing indicator**: A three-dot animated indicator appears in the chat while the assistant is processing.
- **Improved message bubbles**: User and assistant messages rendered with distinct bubble styles, smooth scroll-to-bottom on new messages.
- **Chat session API**: New REST endpoints to list, create, load, and delete chat sessions.

## Capabilities

### New Capabilities
- `chat-session-management`: Persistent multi-session chat — create, list, load, and delete named chat sessions. Each session stores its own message history.
- `chat-ui-experience`: Polished chat UI — ChatGPT-style message bubbles, Enter-to-send keyboard shortcut, animated typing/loading indicator, auto-scroll to latest message.
- `chat-history-sidebar`: Sidebar section below data sources showing the list of past chat sessions with open and delete actions, mirroring the ChatGPT left-panel pattern.

### Modified Capabilities
- `chat-integration-awareness`: Chat routing must be session-aware — queries are dispatched within the context of the active session rather than a single global state.

## Impact

- `src/components/dashboard.tsx` — major refactor of layout, sidebar, composer, and message list
- `src/app/api/chat/route.ts` — session-scoped chat endpoint
- New API routes: `GET/POST /api/chats`, `GET /api/chats/[id]`, `DELETE /api/chats/[id]`
- New components: `ChatSidebar`, `ChatSession`, `TypingIndicator`, `MessageBubble`
- `src/lib/types.ts` — add `ChatSession`, `ChatSummary` types
- `src/context/` — possibly a `ChatSessionContext` for active session state
- CSS: new styles for bubble layout, sidebar sections, dot animation
