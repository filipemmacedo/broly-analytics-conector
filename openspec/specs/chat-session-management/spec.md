## ADDED Requirements

### Requirement: System persists multiple named chat sessions
The system SHALL store each chat session as a separate JSON file under `data/chats/<id>.json`. A lightweight manifest at `data/chats/index.json` SHALL track `id`, `title`, `createdAt`, `updatedAt`, and `messageCount` for each session without loading full message arrays.

#### Scenario: First app load with no existing sessions
- **WHEN** the application loads and `data/chats/` contains no session files
- **THEN** the system automatically creates a new session titled "New Chat"
- **AND** the new session is set as the active session
- **AND** the index is updated with the new session's summary

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
The system SHALL expose `POST /api/chats/[id]/messages` accepting `{ question: string }`. The question SHALL be processed through the existing orchestrator logic and the response appended to the session.

#### Scenario: Send message to existing session
- **WHEN** `POST /api/chats/<id>/messages` is called with a valid question
- **THEN** the user message is appended to the session
- **AND** the orchestrator processes the question using the session's message history
- **AND** the assistant reply is appended to the session
- **AND** the response is the updated `ChatSession`

#### Scenario: Auto-title from first message
- **WHEN** the session has zero messages before the request
- **AND** `POST /api/chats/<id>/messages` is called
- **THEN** the session title is set to the first 40 characters of the user question (with "…" appended if truncated)
- **AND** the index entry is updated with the new title

#### Scenario: Send message to non-existent session
- **WHEN** `POST /api/chats/<id>/messages` is called with an id that does not exist
- **THEN** the response is `404`
