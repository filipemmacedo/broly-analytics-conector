## MODIFIED Requirements

### Requirement: LLM writes a natural-language summary of GA4 report results
After receiving the GA4 Data API rows, the system SHALL send those rows back to the LLM and ask it to produce a concise, human-readable analytics insight as the final chat reply. When the result set is detected as chart-eligible (contains a `date` dimension and at least one numeric metric), the system SHALL instruct the LLM to produce only a brief 1–2 sentence trend insight (not a table narration), since a chart will be rendered separately. This keeps output token usage minimal for time-series queries. When a `StreamWriterFn` is provided, the summary call SHALL use the provider's streaming API and forward each text delta to the writer; when no writer is provided, the summary call SHALL use the existing non-streaming path and return full text.

#### Scenario: LLM summarizes non-chart report rows (non-streaming)
- **WHEN** the GA4 Data API returns rows for a user question without a `date` dimension
- **AND** no `StreamWriterFn` is provided
- **THEN** the system sends the rows (formatted as a table) to the LLM with a standard summarization prompt
- **AND** the LLM's summary text is stored as the assistant chat message

#### Scenario: LLM produces short summary for chart queries (non-streaming)
- **WHEN** the GA4 Data API returns rows containing a `date` dimension and one or more numeric metrics
- **AND** no `StreamWriterFn` is provided
- **THEN** the summarization prompt instructs the LLM: "A line chart will be rendered automatically for this data. Respond with only a 1-2 sentence insight about the trend — do not list or narrate individual data points."
- **AND** the LLM's short summary is stored in `message.content`

#### Scenario: Summary LLM call streams tokens when writer is provided
- **WHEN** a `StreamWriterFn` is provided to `runGA4AgentTurn`
- **THEN** the final summary LLM call uses the provider's streaming API
- **AND** each text chunk is forwarded to the writer as `{"type":"text","delta":"<chunk>"}`
- **AND** the accumulated full text is used as `message.content` in the returned result

#### Scenario: Report rows are too large
- **WHEN** the GA4 report returns more than 20 rows
- **THEN** the system truncates to the top 20 rows before sending to the LLM for summarization
- **AND** the summary notes that results were truncated
