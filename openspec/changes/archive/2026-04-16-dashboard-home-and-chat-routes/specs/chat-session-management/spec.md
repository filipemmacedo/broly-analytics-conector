## MODIFIED Requirements

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

## ADDED Requirements

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
