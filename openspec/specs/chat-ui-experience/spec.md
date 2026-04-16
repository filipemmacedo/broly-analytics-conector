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

---

### Requirement: Composer textarea auto-resizes as content grows
The composer textarea SHALL grow vertically as the user types, following the content height up to a defined maximum. Once the maximum height is reached, the textarea SHALL scroll internally rather than continuing to grow.

#### Scenario: Single line initial state
- **WHEN** the composer has no text and has not been interacted with
- **THEN** the textarea displays at single-line height

#### Scenario: Content causes growth
- **WHEN** the user types text that exceeds the current textarea height
- **THEN** the textarea height increases to fit the content without a scrollbar

#### Scenario: Content exceeds maximum height
- **WHEN** the typed content would require a height greater than the defined maximum
- **THEN** the textarea height stops growing at the maximum
- **AND** a vertical scrollbar appears inside the textarea

#### Scenario: Content is cleared after submit
- **WHEN** the user submits a message
- **THEN** the textarea resets to its initial single-line height

---

### Requirement: Composer placeholder text is vertically centered in the single-line state
The placeholder text SHALL be vertically centered within the composer area when the textarea is in its default single-line state. Once the user begins typing or the textarea grows beyond a single line, vertical centering SHALL not be enforced.

#### Scenario: Placeholder centered before typing
- **WHEN** the composer textarea is empty and at single-line height
- **THEN** the placeholder text is vertically centered within the composer container

#### Scenario: Placeholder alignment shifts when content is present
- **WHEN** the textarea contains one or more lines of text
- **THEN** the textarea aligns to the top of the composer container (standard block alignment)

---

### Requirement: Stop button aborts in-flight LLM generation
The system SHALL display a Stop button in place of the Send button while the assistant is generating a response. Clicking Stop SHALL immediately cancel the in-flight request and re-enable the composer.

#### Scenario: Stop button appears during generation
- **WHEN** the user submits a message and the assistant has not yet responded
- **THEN** the Send button is replaced by a Stop button in the same position

#### Scenario: Stop button cancels the request
- **WHEN** the user clicks the Stop button during generation
- **THEN** the in-flight HTTP request is aborted
- **AND** the typing indicator is dismissed
- **AND** no assistant message is appended to the conversation
- **AND** the composer textarea is re-enabled immediately

#### Scenario: Send button returns after generation completes
- **WHEN** the assistant response is received and rendered
- **THEN** the Stop button is replaced by the Send button
- **AND** the Send button is enabled if the composer contains text
