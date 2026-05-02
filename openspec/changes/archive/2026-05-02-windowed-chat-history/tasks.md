## 1. Orchestrator — slice and forward history

- [x] 1.1 Add `HISTORY_WINDOW = 3` constant at the top of `src/lib/orchestrator.ts`
- [x] 1.2 Write a `sliceHistory(messages: ChatMessage[]): ChatMessage[]` helper that filters to `status: "complete"` messages and returns the last `HISTORY_WINDOW * 2` entries
- [x] 1.3 In `handleQuestion`, call `sliceHistory(session.chat)` before dispatching to each agent branch and assign the result to a `history` variable
- [x] 1.4 Pass `history` to `runGA4AgentTurn`, `runBigQueryAgentTurn`, and `runSnowflakeAgentTurn` calls

## 2. GA4 agent — accept and inject history

- [x] 2.1 Add optional `history?: ChatMessage[]` parameter to `runGA4AgentTurn` signature in `src/lib/agents/ga4-agent.ts`
- [x] 2.2 Write a `toAgentMessages(history: ChatMessage[]): Message[]` converter that maps `role` and `content`, strips `visual` data, and returns `Message[]`
- [x] 2.3 In the function that builds the `messages[]` array for the LLM call, prepend the converted history messages before the current user question
- [x] 2.4 Ensure the Gemini provider branch maps `assistant` → `model` for history messages (same mapping already applied to non-history messages)

## 3. BigQuery agent — accept and inject history

- [x] 3.1 Add optional `history?: ChatMessage[]` parameter to `runBigQueryAgentTurn` signature in `src/lib/agents/bigquery-agent.ts`
- [x] 3.2 Reuse or duplicate the `toAgentMessages` converter and prepend history to the messages array
- [x] 3.3 Verify Gemini role mapping is applied to history messages in the BigQuery Gemini branch

## 4. Snowflake agent — accept and inject history

- [x] 4.1 Add optional `history?: ChatMessage[]` parameter to `runSnowflakeAgentTurn` signature in `src/lib/agents/snowflake-agent.ts`
- [x] 4.2 Prepend converted history to the messages array, applying provider-specific role mappings as needed

## 5. Verification

- [x] 5.1 Start the dev server and open an existing chat session
- [x] 5.2 Send a question, then send a follow-up that references the prior answer (e.g., "now break that down by country") — confirm the agent uses prior context
- [x] 5.3 Start a new chat and send a first message — confirm behavior is unchanged (no errors, no empty history artifacts)
- [x] 5.4 Send a message that fails (e.g., disconnect the integration) — confirm the error message is excluded from the next turn's history
