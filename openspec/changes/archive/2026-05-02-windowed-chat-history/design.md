## Context

Chat history is already persisted to `data/chats/{id}.json` and loaded via `getChat(id)` in the messages route. The full `ChatSession.messages` array is assembled into a `tempSession` object and passed to `handleQuestion`. From there, it fans out to three agent functions — `runGA4AgentTurn`, `runBigQueryAgentTurn`, `runSnowflakeAgentTurn` — each of which builds its own internal `messages[]` array for the LLM call using only the current question. The history is available at the orchestrator level but never forwarded downstream.

Each agent supports four LLM providers (Anthropic, OpenAI, Gemini, Mistral), all receiving the same `messages[]` array. Any history injection happens once per agent, and all providers get it uniformly.

## Goals / Non-Goals

**Goals:**
- Pass the last 3 completed user+assistant turn pairs from the current chat to each agent call
- Enable follow-up queries ("now filter by mobile", "compare to last month")
- Keep the window size configurable as a named constant so it can be tuned without a refactor
- Zero behavior change when history is empty (first message in a session)

**Non-Goals:**
- Cross-session context (history from previous chat sessions)
- Summarization of older turns beyond the window
- Changing the storage format or API contract
- Dynamic token-aware window sizing (Phase 2 if needed)

## Decisions

### 1. Window size: 3 pairs (6 messages), as a constant

**Decision:** Use a constant `HISTORY_WINDOW = 3` in the orchestrator. Slice the last `HISTORY_WINDOW * 2` messages from `session.chat` before passing to agents, filtering to only `status: "complete"` messages.

**Why 3:** Covers the primary use case (refine last query, compare, drill down) without significant token overhead. A single GA4/BigQuery system prompt is ~800–1200 tokens; 3 prior turns add ~600–900 tokens — within safe margins for all supported models.

**Why a named constant:** Allows tuning (3→5, or dynamic) in one place without touching agent code.

**Alternatives considered:**
- Pass full history: unbounded token growth, risky for long sessions
- Pass only last 1 turn: too narrow, misses multi-step refinements
- Dynamic by token count: correct but complex; Phase 2 if needed

### 2. History parameter is optional (`ChatMessage[] | undefined`)

**Decision:** All three `runXxxAgentTurn` functions gain an optional `history?: ChatMessage[]` parameter. When undefined or empty, behavior is identical to today.

**Why optional:** Keeps the change additive and non-breaking. The orchestrator always passes it; future callers don't have to.

### 3. Inject history as real conversation turns, not system prompt text

**Decision:** Convert `ChatMessage[]` to the agent's internal `Message[]` format and prepend before the current user question — making prior turns actual `user`/`assistant` message objects.

**Why:** All four LLM providers handle multi-turn conversation natively. Real turns give stronger signal than injecting history as system prompt prose (Option D from exploration). The conversion is a simple map over `role` and `content`.

**Filtering:** Only inject messages with `role: "user" | "assistant"` and `status: "complete"`. Skip `"streaming"` and `"error"` status messages — they represent incomplete or failed turns.

**Visual data:** The `visual` field (charts/tables) is stripped — only `content` (the text summary) is passed. LLMs don't need the raw query result arrays for context.

### 4. Slice happens in the orchestrator, not in each agent

**Decision:** `handleQuestion` computes the history slice once and passes it to the agent. Agents are dumb recipients.

**Why:** Single place to change the window size, filtering logic, or summarization strategy. Agents stay focused on query execution.

## Risks / Trade-offs

- **Token budget:** 3 prior turns add ~600–900 tokens on average. For very verbose answers (large table summaries), a single turn could be 2K+ tokens. → Mitigation: filter `visual` data out of history content; monitor in practice; promote to dynamic sizing if needed.
- **Stale context:** If the user switches the active integration mid-session, prior turns may reference a different data source. → Mitigation: accepted risk for now; the LLM will see the current system prompt (new source) and can reconcile. A future improvement could annotate messages with their source.
- **Gemini role mapping:** Gemini uses `"model"` instead of `"assistant"`. The existing `callGemini` already handles this mapping — history injection must apply the same transform. → Mitigation: handled in the Gemini-specific branch of each agent.

## Migration Plan

No migration needed. The change is purely additive:
1. Deploy — existing sessions with no history behave identically
2. New messages in active sessions immediately benefit from context
3. Rollback: removing the history slice from `handleQuestion` restores previous behavior in one line
