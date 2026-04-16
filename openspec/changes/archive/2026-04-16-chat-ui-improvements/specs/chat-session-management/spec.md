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
- **AND** the most recent session (or a new session) is opened

#### Scenario: Page refresh preserves the active session
- **WHEN** the user is viewing `/chat/<id>` and refreshes the page
- **THEN** the same session is re-opened and displayed
- **AND** the full message history is restored

---

### Requirement: Root route redirects to the most recent chat session
The root path `/` SHALL redirect the user to the most recently updated chat session at `/chat/<id>`. If no sessions exist, the system SHALL create a new session and redirect to it.

#### Scenario: Root redirect with existing sessions
- **WHEN** the user navigates to `/`
- **AND** at least one chat session exists
- **THEN** the browser is redirected to `/chat/<most-recently-updated-id>`

#### Scenario: Root redirect with no sessions
- **WHEN** the user navigates to `/`
- **AND** no chat sessions exist
- **THEN** a new session is created
- **AND** the browser is redirected to `/chat/<new-session-id>`

---

### Requirement: Switching sessions updates the URL
The system SHALL update the browser URL to `/chat/[id]` whenever the active session changes via sidebar navigation or session creation.

#### Scenario: User opens a session from the sidebar
- **WHEN** the user clicks a chat entry in the sidebar
- **THEN** the URL changes to `/chat/<selected-id>` without a full page reload
- **AND** the selected session's messages are displayed

#### Scenario: User creates a new chat
- **WHEN** the user triggers "New Chat"
- **THEN** a new session is created
- **AND** the URL changes to `/chat/<new-id>`
- **AND** the empty state is displayed

---

### Requirement: Active session title is shown in the page header
The system SHALL display the active session's title in the top bar of the chat page so users can identify which session they are viewing.

#### Scenario: Header shows session title
- **WHEN** a chat session is active
- **THEN** the top bar displays the session's `title` field

#### Scenario: Header shows default title for new sessions
- **WHEN** the active session has the default title "New Chat"
- **THEN** the top bar displays "New Chat"
