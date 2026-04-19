## MODIFIED Requirements

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
