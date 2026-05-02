## Why

Each agent call currently receives only the current question — prior messages in the chat session are stored but never passed to the LLM. Users can't ask follow-up questions like "now filter by mobile" or "compare to last month" because the model has no memory of what was just answered.

## What Changes

- Add an optional `history` parameter (`ChatMessage[]`) to `runGA4AgentTurn`, `runBigQueryAgentTurn`, and `runSnowflakeAgentTurn`
- In `handleQuestion` (orchestrator), slice the last 3 completed user+assistant message pairs from `session.chat` and pass them to the active agent
- Each agent converts the `ChatMessage[]` slice into its internal `Message[]` format and prepends them before the current question
- History injection is additive — agents that receive no history behave exactly as before

## Capabilities

### New Capabilities

- `windowed-chat-history`: LLM agents receive the last N turns of the current chat session as context, enabling follow-up and refinement queries within a session

### Modified Capabilities

<!-- No existing spec-level behavior changes — this is purely additive -->

## Impact

- `src/lib/orchestrator.ts` — slice history, pass to agent calls
- `src/lib/agents/ga4-agent.ts` — accept and prepend history to messages array
- `src/lib/agents/bigquery-agent.ts` — same
- `src/lib/agents/snowflake-agent.ts` — same
- No API contract changes, no schema changes, no new dependencies
