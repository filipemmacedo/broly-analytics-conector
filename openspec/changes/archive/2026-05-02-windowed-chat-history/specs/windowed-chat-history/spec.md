## ADDED Requirements

### Requirement: Agents receive recent chat history as context
The system SHALL pass the last N completed user+assistant message pairs from the current chat session to the active analytics agent on each query. The window size SHALL be defined as a named constant (`HISTORY_WINDOW = 3`). When the session has fewer messages than the window allows, all available completed messages SHALL be included.

#### Scenario: Follow-up question uses prior context
- **WHEN** a user has already received an answer in the current session and submits a follow-up question (e.g., "now break that down by country")
- **THEN** the agent receives the prior user question and assistant answer as conversation history alongside the new question

#### Scenario: First message in a session
- **WHEN** a user sends the first message in a new chat session
- **THEN** no history is prepended and the agent behaves identically to the current baseline

#### Scenario: History excludes incomplete messages
- **WHEN** a prior turn has `status: "error"` or `status: "streaming"`
- **THEN** that message is NOT included in the history passed to the agent

#### Scenario: History excludes visual data payloads
- **WHEN** a prior assistant message contains a `visual` field (chart or table data)
- **THEN** only the text `content` of that message is passed as history — the `visual` payload is stripped

### Requirement: Window size is tunable without agent changes
The system SHALL define the history window size as a single constant in the orchestrator. Changing this constant SHALL be the only modification required to adjust context depth for all agents.

#### Scenario: Window size change is localized
- **WHEN** a developer changes the `HISTORY_WINDOW` constant value
- **THEN** all three agent types (GA4, BigQuery, Snowflake) automatically use the new window size with no other code changes

### Requirement: History injection is uniform across LLM providers
Each agent SHALL inject history as native conversation turns (user/assistant message objects) compatible with the target LLM provider's message format, rather than as system prompt text.

#### Scenario: Anthropic provider receives history as message turns
- **WHEN** the configured LLM provider is Anthropic
- **THEN** history messages are included in the `messages` array as `{role: "user"|"assistant", content: string}` objects before the current question

#### Scenario: Gemini provider maps assistant role correctly
- **WHEN** the configured LLM provider is Gemini
- **THEN** history messages with `role: "assistant"` are mapped to `role: "model"` in the Gemini contents array
