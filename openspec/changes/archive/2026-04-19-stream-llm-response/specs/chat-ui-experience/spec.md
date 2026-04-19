## MODIFIED Requirements

### Requirement: Animated typing indicator while assistant is processing
The system SHALL display a three-dot animated loading indicator in the assistant message position immediately after the user submits a message. The indicator SHALL remain visible until the first text token arrives from the SSE stream, at which point it is replaced by the live streaming message bubble.

#### Scenario: Typing indicator appears on submit
- **WHEN** the user submits a message
- **THEN** the user's message bubble is immediately displayed
- **AND** a `<TypingIndicator>` component with three animated dots appears below it in the assistant position
- **AND** the composer is disabled while the response is pending

#### Scenario: Typing indicator replaced by streaming text on first token
- **WHEN** the first `{"type":"text","delta":"..."}` SSE event arrives
- **THEN** the `<TypingIndicator>` is removed
- **AND** a streaming assistant message bubble appears with the first token's text
- **AND** subsequent tokens are appended to the bubble in real time

#### Scenario: Typing indicator replaced by response (non-streaming fallback)
- **WHEN** the assistant response is received in full (no streaming)
- **THEN** the `<TypingIndicator>` is removed
- **AND** the assistant message bubble is rendered in its place
- **AND** the composer is re-enabled

## ADDED Requirements

### Requirement: Streaming assistant message shows blinking cursor
While an assistant message has `status: "streaming"`, the message bubble SHALL render a blinking text cursor character at the end of the accumulated content to signal that the LLM is still generating.

#### Scenario: Cursor visible during streaming
- **WHEN** an assistant message has `status: "streaming"`
- **THEN** a blinking `|` cursor (or CSS-animated pseudo-element) is appended after the last character of the message content

#### Scenario: Cursor removed on completion
- **WHEN** the message `status` changes from `"streaming"` to `"complete"`
- **THEN** the blinking cursor is no longer rendered

---

### Requirement: Progress step label shown during pipeline phases
While an assistant message has `status: "streaming"` and no text delta has arrived yet, the system SHALL display the current pipeline phase label below the TypingIndicator or inside the nascent message bubble.

#### Scenario: Planning label shown during query-planning phase
- **WHEN** the SSE stream emits `{"type":"progress","step":"planning"}`
- **AND** no text delta has arrived yet
- **THEN** the label "Planning query…" is displayed in the assistant message area

#### Scenario: Querying label shown during data-fetch phase
- **WHEN** the SSE stream emits `{"type":"progress","step":"querying"}`
- **AND** no text delta has arrived yet
- **THEN** the label "Running query…" is displayed

#### Scenario: Summarizing label shown during summary phase
- **WHEN** the SSE stream emits `{"type":"progress","step":"summarizing"}`
- **AND** no text delta has arrived yet
- **THEN** the label "Generating summary…" is displayed

#### Scenario: Labels hidden once text starts streaming
- **WHEN** the first `text` delta arrives
- **THEN** the progress label is no longer shown
- **AND** only the streaming message content is displayed
