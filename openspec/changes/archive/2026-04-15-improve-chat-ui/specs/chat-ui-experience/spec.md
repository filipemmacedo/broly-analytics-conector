## ADDED Requirements

### Requirement: Message composer sends on Enter key
The composer textarea SHALL submit the current message when the user presses Enter (without modifier keys). Pressing Shift+Enter SHALL insert a newline without submitting.

#### Scenario: Enter submits non-empty message
- **WHEN** the textarea contains non-whitespace text
- **AND** the user presses Enter without Shift
- **THEN** the form is submitted with the current message
- **AND** the textarea is cleared

#### Scenario: Enter does not submit empty message
- **WHEN** the textarea is empty or contains only whitespace
- **AND** the user presses Enter
- **THEN** no submission occurs

#### Scenario: Shift+Enter inserts newline
- **WHEN** the user presses Shift+Enter
- **THEN** a newline is inserted into the textarea
- **AND** the form is NOT submitted

---

### Requirement: Animated typing indicator while assistant is processing
The system SHALL display a three-dot animated loading indicator in the assistant message position immediately after the user submits a message. The indicator SHALL remain visible until the assistant response is received and rendered.

#### Scenario: Typing indicator appears on submit
- **WHEN** the user submits a message
- **THEN** the user's message bubble is immediately displayed
- **AND** a `<TypingIndicator>` component with three animated dots appears below it in the assistant position
- **AND** the composer is disabled while the response is pending

#### Scenario: Typing indicator replaced by response
- **WHEN** the assistant response is received
- **THEN** the `<TypingIndicator>` is removed
- **AND** the assistant message bubble is rendered in its place
- **AND** the composer is re-enabled

---

### Requirement: User and assistant messages rendered as distinct bubbles
The system SHALL render user messages with a distinct right-aligned or highlighted style and assistant messages with a left-aligned or neutral style, clearly distinguishing the two roles.

#### Scenario: User message bubble
- **WHEN** a message with `role: "user"` is rendered
- **THEN** it appears with the `message-bubble--user` visual style
- **AND** is visually distinct from assistant messages

#### Scenario: Assistant message bubble
- **WHEN** a message with `role: "assistant"` is rendered
- **THEN** it appears with the `message-bubble--assistant` visual style

#### Scenario: Error state bubble
- **WHEN** a message with `status: "error"` is rendered
- **THEN** it appears with an error indicator (e.g., red border or icon)

---

### Requirement: Chat auto-scrolls to the latest message
The chat message list SHALL automatically scroll to the bottom whenever a new message is added (user or assistant).

#### Scenario: New message triggers scroll
- **WHEN** a new message is appended to the message list
- **THEN** the viewport scrolls to show the new message without user intervention

#### Scenario: No scroll when chat is empty
- **WHEN** the chat has no messages (empty state is shown)
- **THEN** no scroll behavior is triggered

---

### Requirement: Empty state is shown for new chats
When the active chat session has no messages, the system SHALL display a welcome/empty state with prompt templates to help the user get started.

#### Scenario: Empty chat shows empty state
- **WHEN** the active chat session has zero messages
- **THEN** the empty state UI is displayed with prompt template chips

#### Scenario: Clicking a template chip populates the composer
- **WHEN** the user clicks a template chip in the empty state
- **THEN** the chip's text is inserted into the composer textarea
- **AND** focus is moved to the textarea
