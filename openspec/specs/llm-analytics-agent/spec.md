## ADDED Requirements

### Requirement: LLM translates natural-language question into GA4 report parameters via tool calling
The system SHALL send the user's question to the configured LLM along with a tool definition for `runGA4Report`. The LLM MUST respond with a tool call containing structured GA4 report parameters (metrics, dimensions, dateRanges, orderBys, limit). The system SHALL execute the tool call and return the results to the LLM.

#### Scenario: LLM generates valid GA4 tool call
- **WHEN** the user asks an analytics question (e.g. "What were my top 5 countries by sessions last month?")
- **THEN** the LLM receives the question and the `runGA4Report` tool definition
- **AND** responds with a tool call containing valid GA4 metric/dimension names and date ranges
- **AND** the system executes the GA4 Data API call with those parameters

#### Scenario: LLM responds with text instead of tool call
- **WHEN** the LLM determines the question cannot be answered with a GA4 report (e.g. a general question)
- **THEN** the LLM's text response is used directly as the chat reply without calling the GA4 API

---

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

---

### Requirement: LLM provider abstraction supports Anthropic, OpenAI, Gemini, and Mistral
The system SHALL support all four configured LLM providers for tool calling. The `callLLMWithTools` function SHALL normalize provider-specific tool-calling APIs to a common interface.

#### Scenario: Anthropic provider tool call
- **WHEN** provider is "anthropic"
- **THEN** the system uses the Anthropic SDK with `tools` array and `tool_use` content block format

#### Scenario: OpenAI provider tool call
- **WHEN** provider is "openai"
- **THEN** the system uses the OpenAI SDK with `tools` array and `tool_calls` response format

#### Scenario: Google Gemini provider tool call
- **WHEN** provider is "google"
- **THEN** the system uses the Google Generative AI SDK with `tools` / `functionDeclarations` format

#### Scenario: Mistral provider tool call
- **WHEN** provider is "mistral"
- **THEN** the system uses the Mistral SDK with `tools` array and `tool_calls` response format

---

### Requirement: LLM not configured results in clear error message
If no LLM is configured when a GA4 question is asked, the system SHALL return a chat message guiding the user to configure an LLM provider.

#### Scenario: No LLM configured
- **WHEN** the user asks a question and `llmConfig` is null
- **AND** the active source is GA4
- **THEN** the assistant responds: "An LLM must be configured to query GA4. Go to Settings > LLM to set up a provider."

---

### Requirement: LLM system prompt instructs the model to include `date` dimension for time-series questions
The system prompt sent to the LLM SHALL explicitly instruct it to include `{ name: "date" }` in the `dimensions` array of `runGA4Report` whenever the user's question asks for metrics **over time**, **by day**, **by week**, **as a trend**, or **across a date range**. This instruction is the mechanism that makes chart rendering reliable — without it, the LLM may answer time-series questions without a `date` dimension and no chart will appear.

#### Scenario: User asks for metrics by day
- **WHEN** the user asks "show me sessions per day for the last 30 days"
- **THEN** the LLM tool call includes `dimensions: [{ name: "date" }]`
- **AND** the orchestrator receives rows with a `date` key and can populate `chartData`

#### Scenario: User asks for a trend without saying "by day"
- **WHEN** the user asks "what's my traffic trend this month?"
- **THEN** the LLM tool call includes `dimensions: [{ name: "date" }]` because "trend" signals a time-series request
- **AND** a chart is rendered in the chat bubble

#### Scenario: User asks a non-time-series question
- **WHEN** the user asks "top 5 countries by sessions last month"
- **THEN** the LLM tool call does NOT include `date` in dimensions
- **AND** no chart is rendered; the response is plain text

---

### Requirement: LLM system prompt includes metric name translation table
The system prompt SHALL include an explicit mapping from common user-facing terms to GA4 `apiName` values (e.g. "pageviews" → `screenPageViews`, "users" → `activeUsers`). This reduces LLM metric-name errors that would result in invalid GA4 API requests.

#### Scenario: User uses common term for a metric
- **WHEN** the user asks "show me pageviews by day"
- **THEN** the LLM tool call uses `metrics: [{ name: "screenPageViews" }]` (not `pageViews` or `views`)

---

### Requirement: `supplementMetrics` deterministically adds missing metrics from the user's question
When the LLM omits a metric the user explicitly mentioned, the server SHALL add it back programmatically. A `USER_TERM_TO_GA4_METRIC` lookup table maps user vocabulary to GA4 `apiName` values. Before the GA4 Data API call, the system SHALL scan the user's original question against this table and append any matched metrics the LLM did not include.

#### Scenario: LLM drops a requested metric
- **WHEN** the user asks "sessions and pageviews by day" but the LLM only requests `sessions`
- **THEN** `supplementMetrics` detects "pageviews" in the question, looks up `screenPageViews`, and adds it to the metrics array
- **AND** the GA4 API call includes both `sessions` and `screenPageViews`
- **AND** the chart renders with two lines

#### Scenario: All requested metrics are present
- **WHEN** the LLM correctly includes all user-mentioned metrics
- **THEN** `supplementMetrics` adds nothing and the metrics array is unchanged

---

### Requirement: `runGA4AgentTurn` returns structured output including raw rows
`runGA4AgentTurn` SHALL return `{ summary: string; rows?: Record<string, string>[] }` instead of a plain string. The `rows` field SHALL contain the parsed GA4 API rows before summarisation so the orchestrator can inspect them for chart detection without an additional API call.

#### Scenario: Time-series query returns rows alongside summary
- **WHEN** the LLM calls `runGA4Report` and the GA4 API returns rows
- **THEN** `runGA4AgentTurn` resolves with both the LLM summary string and the raw rows array

#### Scenario: Direct LLM answer (no tool call) returns no rows
- **WHEN** the LLM answers without calling `runGA4Report`
- **THEN** `runGA4AgentTurn` resolves with `{ summary: "<llm text>", rows: undefined }`
- **AND** no chart is rendered
