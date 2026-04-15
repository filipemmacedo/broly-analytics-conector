## 1. Types & Source Routing

- [x] 1.1 Add `"ga4"` to the `SourceId` union in `src/lib/types.ts`
- [x] 1.2 Add a `GA4Connection` type (or reuse the integration access token pattern) to `src/lib/types.ts` if needed for the session state
- [x] 1.3 Extend `PROVIDER_TO_SOURCE` map in `src/lib/orchestrator.ts` to include `"google-analytics" → "ga4"`
- [x] 1.4 Extend `getHealthySourceIds()` in `src/lib/orchestrator.ts` to recognize `"google-analytics"` integrations as a healthy `"ga4"` source

## 2. GA4 Data API Connector

- [x] 2.1 Create `src/lib/connectors/ga4.ts` with a `runGA4Report(accessToken, propertyId, reportParams)` function that POSTs to `https://analyticsdata.googleapis.com/v1beta/{propertyId}:runReport`
- [x] 2.2 Implement response row formatting: convert GA4 `dimensionHeaders` / `metricHeaders` / `rows` into a Markdown table string
- [x] 2.3 Handle empty result (zero rows) with a descriptive message
- [x] 2.4 Handle GA4 API error responses (non-200) by throwing an error with the API error message

## 3. LLM Tool-Calling Abstraction

- [x] 3.1 Create `src/lib/llm-planner.ts` with a `callLLMWithTools(config, messages, tools)` function that normalizes Anthropic, OpenAI, Gemini, and Mistral tool-calling APIs to a common interface returning `{ toolCall?: { name: string; arguments: unknown }; text?: string }`
- [x] 3.2 Implement Anthropic branch: use raw fetch, send `tools` array, parse `tool_use` content block from response
- [x] 3.3 Implement OpenAI branch: use raw fetch, send `tools` array, parse `tool_calls[0]` from response
- [x] 3.4 Implement Google Gemini branch: use raw fetch, send `tools` with `functionDeclarations`, parse `functionCall` from response
- [x] 3.5 Implement Mistral branch: use raw fetch, send `tools` array, parse `tool_calls[0]` from response

## 4. Analytics Agent Orchestration

- [x] 4.1 In `src/lib/llm-planner.ts`, implement `runGA4AgentTurn(llmConfig, ga4AccessToken, propertyId, question)` that: (a) sends question + `runGA4Report` tool definition to LLM, (b) if tool call received → executes GA4 connector, (c) sends rows back to LLM for summarization, (d) returns the final summary string
- [x] 4.2 Define the `runGA4Report` tool schema (JSON Schema for metrics array, dimensions array, dateRanges array, orderBys, limit) used in step 4.1
- [x] 4.3 Truncate GA4 rows to 20 rows maximum before sending to LLM for summarization
- [x] 4.4 Add system prompt for the analytics agent role (e.g. "You are an analytics assistant. Use the runGA4Report tool to answer the user's question with data from their GA4 property.")

## 5. Orchestrator Wiring

- [x] 5.1 Remove `void context` from `src/lib/orchestrator.ts` and destructure `llmConfig` and `ga4PropertyId` from context
- [x] 5.2 Add a GA4 dispatch branch: when source is `"ga4"` and `llmConfig` is non-null, call `runGA4AgentTurn` from `llm-planner.ts`
- [x] 5.3 Add a guard: when source is `"ga4"` and `llmConfig` is null, return a chat message "An LLM must be configured to query GA4. Go to Settings > LLM to set up a provider."
- [x] 5.4 Add a guard: when source is `"ga4"` and `ga4PropertyId` is null, return a chat message guiding user to select a GA4 property
- [x] 5.5 Add GA4 settings link to `PROVIDER_SETTINGS_LINKS` for the "not connected" error message

## 6. Access Token Retrieval

- [x] 6.1 In `src/app/api/chat/route.ts`, extend the existing integration lookup to also extract the GA4 OAuth access token from the integration's `authConfig` and pass it as part of context to `handleQuestion`
- [x] 6.2 Update the `ChatContext` interface in `src/lib/orchestrator.ts` to include `ga4AccessToken?: string | null`

## 7. Verification

- [x] 7.1 Configure a GA4 integration + LLM in the app settings, then ask "How many sessions did I have last week?" and verify a natural-language summary is returned
- [x] 7.2 Ask a question with no LLM configured and verify the guidance message appears
- [x] 7.3 Ask a question with no GA4 property selected and verify the guidance message appears
- [x] 7.4 Test with at least two different LLM providers (e.g. Anthropic + OpenAI) and verify both return valid summaries
- [x] 7.5 Ask a question that returns zero GA4 rows and verify a "no data found" message is shown

<!-- Manual verification required — run `npm run dev` and test in browser -->
