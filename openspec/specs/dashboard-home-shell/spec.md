## ADDED Requirements

### Requirement: Root route renders the dashboard home without redirecting
The system SHALL render the dashboard home experience at `/` and SHALL NOT automatically redirect to an existing chat session when the homepage loads.

#### Scenario: Homepage loads when chats already exist
- **WHEN** the user navigates to `/`
- **AND** one or more chat sessions already exist
- **THEN** the dashboard home is rendered
- **AND** the browser remains at `/`
- **AND** no chat session is implicitly activated in the main workspace

#### Scenario: Homepage loads when no chats exist
- **WHEN** the user navigates to `/`
- **AND** no chat sessions exist
- **THEN** the dashboard home is rendered
- **AND** the browser remains at `/`
- **AND** no new chat session is created automatically

---

### Requirement: Dashboard home allows explicit entry into a chat session
From the dashboard home, the system SHALL navigate to `/chat/[id]` only when the user explicitly opens an existing chat session or starts a new conversation.

#### Scenario: User opens an existing chat from home
- **WHEN** the user is on `/`
- **AND** clicks an existing chat session from the sidebar or chat list
- **THEN** the browser navigates to `/chat/<selected-id>`
- **AND** that session is loaded as the active chat

---

### Requirement: Home affordances return the user to the dashboard root without creating a session
The system SHALL treat the Broly brand and the sidebar plus/new-chat action as navigation back to the dashboard home, and SHALL NOT create a chat session until the user starts the interaction.

#### Scenario: User clicks Broly while viewing an existing chat
- **WHEN** the user is on `/chat/<id>`
- **AND** clicks the Broly brand
- **THEN** the browser navigates to `/`
- **AND** the dashboard home is rendered
- **AND** no new chat session is created

#### Scenario: User clicks the plus action while viewing an existing chat
- **WHEN** the user is on `/chat/<id>`
- **AND** clicks the sidebar plus/new-chat action
- **THEN** the browser navigates to `/`
- **AND** the dashboard home is rendered
- **AND** no new chat session is created

#### Scenario: User clicks the plus action while already on home
- **WHEN** the user is on `/`
- **AND** clicks the sidebar plus/new-chat action
- **THEN** the browser remains at `/`
- **AND** the dashboard stays in the blank home-state draft
- **AND** no new chat session is created

---

### Requirement: First chat input from home creates a routed session
If the user starts a conversation from the dashboard home, the system SHALL create a session first and then continue the interaction under `/chat/[id]`.

#### Scenario: User submits a message from the home composer
- **WHEN** the user is on `/`
- **AND** submits a non-empty message through the composer
- **THEN** a new chat session is created
- **AND** the browser navigates to `/chat/<new-id>`
- **AND** the submitted message is processed within that new session

#### Scenario: User starts from a template on the home dashboard
- **WHEN** the user is on `/`
- **AND** chooses a template and submits it as the first message
- **THEN** a new chat session is created
- **AND** the browser navigates to `/chat/<new-id>`
- **AND** the template text is processed within that new session
