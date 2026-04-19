## ADDED Requirements

### Requirement: Messages API streams response via SSE
The `POST /api/chats/[id]/messages` endpoint SHALL return a `ReadableStream` response with `Content-Type: text/event-stream` instead of a JSON payload. Each SSE message SHALL be a JSON object on a single `data:` line followed by two newlines.

#### Scenario: Stream opens immediately on POST
- **WHEN** a valid `POST /api/chats/[id]/messages` request is received
- **THEN** the server responds immediately with `200 OK` and `Content-Type: text/event-stream`
- **AND** the stream stays open while the orchestrator processes the request

#### Scenario: Stream closes after done event
- **WHEN** the orchestrator finishes and emits a `done` event
- **THEN** the stream is closed by the server
- **AND** no further data is written

#### Scenario: Stream emits error event on failure
- **WHEN** the orchestrator or agent throws an unhandled error
- **THEN** the server emits `{"type":"error","message":"<reason>"}` before closing
- **AND** the client marks the in-progress assistant message with `status: "error"`

---

### Requirement: SSE wire format carries three event types
The stream SHALL emit events in the following shapes only:

- `{"type":"progress","step":"planning"|"querying"|"summarizing"}` — emitted at the start of each pipeline phase
- `{"type":"text","delta":"<token>"}` — emitted for each text chunk from the summary LLM call
- `{"type":"done","session":{...ChatSession...}}` — emitted once when the full session is ready

#### Scenario: Progress events fire at phase boundaries
- **WHEN** the orchestrator starts the query-planning LLM call
- **THEN** it emits `{"type":"progress","step":"planning"}`
- **WHEN** the orchestrator starts the data-fetch step
- **THEN** it emits `{"type":"progress","step":"querying"}`
- **WHEN** the orchestrator starts the summary LLM call
- **THEN** it emits `{"type":"progress","step":"summarizing"}`

#### Scenario: Text delta events carry incremental tokens
- **WHEN** the summary LLM call yields a text chunk
- **THEN** the server emits `{"type":"text","delta":"<chunk>"}` for each chunk
- **AND** chunks arrive in order matching the LLM's generation sequence

#### Scenario: Done event carries authoritative session
- **WHEN** all tokens have been emitted
- **THEN** the server emits `{"type":"done","session":{...}}` with the full persisted `ChatSession`
- **AND** the `session` object includes the complete assistant message with any `visual` (chart/table) attached

---

### Requirement: All four LLM providers stream the summary call
The system SHALL support streaming for the final summary LLM call across Anthropic, OpenAI-compatible, Google Gemini, and Mistral providers. The query-planning LLM call SHALL remain non-streaming for all providers.

#### Scenario: Anthropic streams summary via SSE events
- **WHEN** the configured provider is "anthropic" and the summary call begins
- **THEN** the agent uses `stream: true` and reads `content_block_delta` events from the Anthropic API
- **AND** each `delta.text` value is forwarded as a `{"type":"text","delta":"..."}` SSE event

#### Scenario: OpenAI-compatible provider streams summary
- **WHEN** the configured provider is "openai" or compatible
- **THEN** the agent uses `stream: true` and reads `choices[0].delta.content` from each SSE chunk
- **AND** each non-null content value is forwarded as a text delta event

#### Scenario: Gemini streams summary
- **WHEN** the configured provider is "google"
- **THEN** the agent calls the `streamGenerateContent` endpoint
- **AND** each `candidates[0].content.parts[0].text` chunk is forwarded as a text delta event

#### Scenario: Mistral streams summary
- **WHEN** the configured provider is "mistral"
- **THEN** the agent uses `stream: true` (OpenAI-compatible format)
- **AND** each `choices[0].delta.content` chunk is forwarded as a text delta event
