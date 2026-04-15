## ADDED Requirements

### Requirement: Sidebar is divided into data sources section (top) and chat history section (bottom)
The left sidebar SHALL display the `DataSourcesPanel` in its upper section and a scrollable list of past chat sessions in its lower section. Both sections SHALL be visible simultaneously when the sidebar is open.

#### Scenario: Sidebar shows both sections when open
- **WHEN** the sidebar is open
- **THEN** the `DataSourcesPanel` is visible in the upper portion
- **AND** the chat history list is visible in the lower portion
- **AND** both sections are visible without one obscuring the other

#### Scenario: Sidebar collapsed hides both sections
- **WHEN** the sidebar is collapsed (toggle button clicked)
- **THEN** both the data sources panel and the chat history list are hidden
- **AND** only the toggle control remains visible

---

### Requirement: Chat history list shows all sessions sorted by recency
The chat history section SHALL display a list of `ChatSummary` items, sorted by `updatedAt` descending. Each item SHALL show the session title and a relative or absolute timestamp.

#### Scenario: Chat list renders sessions newest first
- **WHEN** three sessions exist with different `updatedAt` values
- **THEN** the list renders them newest-first
- **AND** each item shows the session title and a formatted timestamp

#### Scenario: Chat list shows "No chats yet" placeholder
- **WHEN** no chat sessions exist
- **THEN** a placeholder message ("No chats yet") is shown in the chat history section

---

### Requirement: Active chat is visually highlighted in the sidebar
The system SHALL apply a distinct visual style to the chat history item corresponding to the currently active session.

#### Scenario: Active session is highlighted
- **WHEN** a session is the active session
- **THEN** its list item has the `chat-item--active` style applied
- **AND** all other items do not have this style

---

### Requirement: User can open a past chat by clicking its sidebar item
Clicking a chat history item SHALL load the corresponding session and set it as the active chat in the main panel.

#### Scenario: Clicking a chat item loads it
- **WHEN** the user clicks a non-active chat history item
- **THEN** the system calls `GET /api/chats/<id>` to load the session
- **AND** the main panel displays the messages of the selected session
- **AND** the clicked item is marked as active

---

### Requirement: User can delete a chat from the sidebar
Each chat history item SHALL expose a delete control (e.g., a trash icon button). Clicking it SHALL permanently remove the session after a confirmation or directly (no undo).

#### Scenario: Delete button removes session
- **WHEN** the user clicks the delete button on a chat history item
- **THEN** `DELETE /api/chats/<id>` is called
- **AND** the item is removed from the sidebar list
- **AND** if it was the active session, the client activates the next most-recent session (or creates a new one if none remain)

#### Scenario: Delete button is visible on hover
- **WHEN** the user hovers over a chat history item
- **THEN** the delete icon button becomes visible
- **AND** when the cursor leaves, the icon is hidden (or kept subtle)

---

### Requirement: User can create a new chat from the sidebar
The sidebar chat history section SHALL include a "New Chat" button that creates a new empty session and makes it the active chat.

#### Scenario: New Chat button creates and activates session
- **WHEN** the user clicks the "New Chat" button
- **THEN** `POST /api/chats` is called
- **AND** the new session is added to the top of the sidebar list
- **AND** the new session becomes the active session
- **AND** the main panel shows the empty state for the new session
