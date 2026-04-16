## ADDED Requirements

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
