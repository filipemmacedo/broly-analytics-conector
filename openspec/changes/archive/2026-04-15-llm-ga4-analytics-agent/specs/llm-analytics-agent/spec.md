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
After receiving the GA4 Data API rows, the system SHALL send those rows back to the LLM and ask it to produce a concise, human-readable analytics insight as the final chat reply.

#### Scenario: LLM summarizes report rows
- **WHEN** the GA4 Data API returns rows for a user question
- **THEN** the system sends the rows (formatted as a table) to the LLM with a summarization prompt
- **AND** the LLM's summary text is stored as the assistant chat message

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
