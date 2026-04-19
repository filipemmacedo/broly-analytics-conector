## ADDED Requirements

### Requirement: System persists multiple named chat sessions
The system SHALL store each chat session as a separate JSON file under `data/chats/<id>.json`. A lightweight manifest at `data/chats/index.json` SHALL track `id`, `title`, `createdAt`, `updatedAt`, and `messageCount` for each session without loading full message arrays.

#### Scenario: First app load with no existing sessions
- **WHEN** the application loads and `data/chats/` contains no session files
- **THEN** the system does NOT automatically create a new session just because the homepage rendered
- **AND** the session index remains empty until the user explicitly creates or starts a chat

#### Scenario: Session file and index stay in sync
- **WHEN** a message is added to a session
- **THEN** the session's `<id>.json` is updated with the new message
- **AND** the index entry for that session updates `updatedAt` and `messageCount`

#### Scenario: Index reconciles with missing files on read
- **WHEN** `GET /api/chats` is called and an entry in `index.json` has no corresponding `<id>.json` file
- **THEN** the orphaned index entry is removed before the response is returned

---

### Requirement: Users can create a new chat session
The system SHALL expose `POST /api/chats` to create a new empty session. The new session SHALL be returned as a `ChatSummary` object.

#### Scenario: Create new chat
- **WHEN** `POST /api/chats` is called
- **THEN** a new session is created with a unique id, `title: "New Chat"`, and empty `messages` array
- **AND** the index is updated
- **AND** the response is `201` with the `ChatSummary`

---

### Requirement: Users can list all chat sessions
The system SHALL expose `GET /api/chats` returning an array of `ChatSummary` objects sorted by `updatedAt` descending (most recent first).

#### Scenario: List chats with multiple sessions
- **WHEN** `GET /api/chats` is called and three sessions exist
- **THEN** the response is a `200` with all three summaries sorted newest-first

#### Scenario: List chats when no sessions exist
- **WHEN** `GET /api/chats` is called and no sessions exist
- **THEN** the response is `200` with an empty array

---

### Requirement: Users can load a specific chat session
The system SHALL expose `GET /api/chats/[id]` returning the full `ChatSession` including all messages.

#### Scenario: Load existing session
- **WHEN** `GET /api/chats/<id>` is called with a valid session id
- **THEN** the response is `200` with the full `ChatSession` including `messages`

#### Scenario: Load non-existent session
- **WHEN** `GET /api/chats/<id>` is called with an id that does not exist
- **THEN** the response is `404`

---

### Requirement: Users can delete a chat session
The system SHALL expose `DELETE /api/chats/[id]` that permanently removes the session file and its index entry.

#### Scenario: Delete existing session
- **WHEN** `DELETE /api/chats/<id>` is called with a valid session id
- **THEN** the session file is removed from disk
- **AND** the index entry is removed
- **AND** the response is `204`

#### Scenario: Delete the active session
- **WHEN** the active session is deleted
- **THEN** the client switches to the most recently updated remaining session
- **AND** if no sessions remain, a new "New Chat" session is created and activated

#### Scenario: Delete non-existent session
- **WHEN** `DELETE /api/chats/<id>` is called with an id that does not exist
- **THEN** the response is `404`

---

### Requirement: Messages are sent within a session context
The system SHALL expose `POST /api/chats/[id]/messages` accepting `{ question: string }`. The question SHALL be processed through the orchestrator and the response appended to the session. The endpoint SHALL return a Server-Sent Events stream rather than a JSON payload. The client SHALL consume this stream, accumulating token deltas into a live assistant message until the `done` event arrives.

#### Scenario: Client adds optimistic streaming assistant message on stream open
- **WHEN** `sendQuestionToSession` is called
- **AND** the SSE stream opens successfully
- **THEN** the client immediately adds an assistant message with `status: "streaming"` and empty `content` to the local session state
- **AND** the `TypingIndicator` is shown until the first `text` delta event arrives

#### Scenario: Client appends token deltas to live assistant message
- **WHEN** the SSE stream emits `{"type":"text","delta":"<chunk>"}` events
- **THEN** each delta is appended to the `content` of the in-progress streaming assistant message
- **AND** the UI updates to display the growing text in real time

#### Scenario: Client commits final session on done event
- **WHEN** the SSE stream emits `{"type":"done","session":{...}}`
- **THEN** the client replaces the local optimistic session state with the authoritative session from the server
- **AND** the assistant message `status` changes from `"streaming"` to `"complete"`
- **AND** any `visual` (chart/table) attached to the message is rendered

#### Scenario: Client marks message as error on stream error event
- **WHEN** the SSE stream emits `{"type":"error","message":"<reason>"}`
- **OR** the stream closes unexpectedly before a `done` event
- **THEN** the in-progress assistant message is marked with `status: "error"`
- **AND** the error message text is shown in the bubble

#### Scenario: Abort stops the stream
- **WHEN** the user clicks the stop button while a stream is in progress
- **THEN** the `AbortController` cancels the fetch
- **AND** the streaming assistant message is left in its current partial state with `status: "error"` or removed

#### Scenario: Auto-title from first message
- **WHEN** the session has zero messages before the request
- **AND** `POST /api/chats/<id>/messages` is called
- **THEN** the session title is set to the first 40 characters of the user question (with "…" appended if truncated)
- **AND** the index entry is updated with the new title

#### Scenario: Send message to non-existent session
- **WHEN** `POST /api/chats/<id>/messages` is called with an id that does not exist
- **THEN** the response is `404`

---

### Requirement: Each chat session is accessible at a unique URL path
The system SHALL route each chat session to `/chat/[id]` where `[id]` is the session's unique identifier. Navigating to this URL SHALL load and display that specific session.

#### Scenario: Direct navigation to a valid session URL
- **WHEN** the user navigates to `/chat/<id>` with a valid session id
- **THEN** the chat page loads with that session as the active session
- **AND** the full message history for that session is displayed

#### Scenario: Navigation to an unknown session URL
- **WHEN** the user navigates to `/chat/<id>` with an id that does not exist
- **THEN** the system redirects to `/`
- **AND** the dashboard home is displayed

#### Scenario: Page refresh preserves the active session
- **WHEN** the user is viewing `/chat/<id>` and refreshes the page
- **THEN** the same session is re-opened and displayed
- **AND** the full message history is restored

---

### Requirement: Switching sessions updates the URL
The system SHALL update the browser URL to `/chat/[id]` whenever a concrete chat session becomes active through sidebar navigation or first-message creation from the dashboard home.

#### Scenario: User opens a session from the sidebar
- **WHEN** the user clicks a chat entry in the sidebar
- **THEN** the URL changes to `/chat/<selected-id>` without a full page reload
- **AND** the selected session's messages are displayed

#### Scenario: User starts a new chat from the dashboard home
- **WHEN** the user is on `/`
- **AND** submits the first message for a new conversation
- **THEN** a new session is created
- **AND** the URL changes to `/chat/<new-id>`
- **AND** the new conversation continues in that session route

---

### Requirement: Active session title is shown in the page header
The system SHALL display the active session's title in the top bar of the chat page so users can identify which session they are viewing.

#### Scenario: Header shows session title
- **WHEN** a chat session is active
- **THEN** the top bar displays the session's `title` field

#### Scenario: Header shows default title for new sessions
- **WHEN** the active session has the default title "New Chat"
- **THEN** the top bar displays "New Chat"

---

### Requirement: First-message transition from home does not flash the route loader
The system SHALL NOT display the chat route loading skeleton when the user navigates to `/chat/<id>` as a result of submitting the first message from the dashboard home, because a pending chat start is already available in sessionStorage at mount time.

#### Scenario: Navigate to new chat with pending start in sessionStorage
- **WHEN** the user submits the first message from `/`
- **AND** the browser navigates to `/chat/<new-id>`
- **AND** a matching pending chat start entry exists in `sessionStorage`
- **THEN** the chat route renders the optimistic user message immediately on first paint
- **AND** the `ChatRouteLoader` skeleton is never shown during this transition

#### Scenario: Navigate directly to a chat URL with no pending start
- **WHEN** the user navigates directly to `/chat/<id>` (e.g. by typing the URL or refreshing)
- **AND** there is no matching pending chat start entry in `sessionStorage`
- **THEN** the `ChatRouteLoader` skeleton is displayed until the session data is loaded
