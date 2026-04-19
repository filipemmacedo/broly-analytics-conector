## Context

The current messages API route (`POST /api/chats/[id]/messages`) awaits the full orchestrator execution — which includes two LLM calls and a live data fetch — before returning a JSON payload. The client is blocked the entire time showing only a `TypingIndicator`. The result appears as a single state transition with no progressive feedback.

The orchestrator executes three sequential phases per request:
1. **LLM Call #1** — query planning (structured tool call / JSON output)
2. **Data fetch** — GA4, BigQuery, or Snowflake API call
3. **LLM Call #2** — prose summary of results (free-form text)

Only phase 3 benefits from token-level streaming. Phases 1 and 2 are not streaming-friendly (structured JSON output and pure I/O respectively), but they benefit from progress labels that tell the user what is happening.

## Goals / Non-Goals

**Goals:**
- Stream prose summary tokens to the client as soon as LLM Call #2 begins generating
- Emit named progress events (`planning`, `querying`, `summarizing`) for phases 1 and 2
- Keep the `TypingIndicator` visible until the first text token arrives, then transition to live text
- Support all four LLM providers: Anthropic, OpenAI/compatible, Gemini, Mistral
- No new npm dependencies

**Non-Goals:**
- Streaming the query-planning LLM call (structured JSON — streaming adds no UX value)
- Streaming chart/table data (visuals are delivered in the `done` event after all tokens)
- WebSocket or long-polling (SSE is sufficient and simpler for one-way server push)
- Retry or reconnect logic for dropped streams (single request, short-lived)

## Decisions

### 1. SSE over chunked JSON / WebSocket

**Decision:** Use Server-Sent Events via a native `ReadableStream` response.

**Rationale:** The communication is strictly one-way (server → client) for a single request lifetime. SSE requires no handshake, works with `fetch` via `response.body` reader, and is trivially cancelled via `AbortController`. WebSockets would add unnecessary bidirectional complexity.

**Alternative considered:** NDJSON (newline-delimited JSON) — rejected because SSE's `data:` framing is slightly easier to parse and is the established convention for LLM streaming APIs.

### 2. Wire format: three event types

```
data: {"type":"progress","step":"planning"}\n\n
data: {"type":"progress","step":"querying"}\n\n
data: {"type":"text","delta":"The top "}\n\n
data: {"type":"text","delta":"5 sessions..."}\n\n
data: {"type":"done","session":{...ChatSession...}}\n\n
```

**Rationale:** A single `done` event carries the authoritative final session (including visuals). The client accumulates `text` deltas locally; the `done` event overwrites with the canonical state. This avoids complex partial-state reconciliation.

### 3. Stream only the summary LLM call; keep query-planning non-streaming

**Decision:** Each agent has two LLM calls. Only the second (summary) call switches to `stream: true`. The first (tool/query planning) stays as a regular `await res.json()`.

**Rationale:** The first call returns a structured tool call JSON — streaming tokens of JSON fragment-by-fragment is meaningless to the user and harder to parse. The `progress: planning` event covers user feedback for that phase.

### 4. Orchestrator accepts a `StreamWriter` parameter

**Decision:** `handleQuestion` gains an optional `writer: StreamWriterFn` parameter. If provided, it emits SSE-formatted strings. If absent (e.g., tests), it behaves as before.

```ts
type StreamWriterFn = (chunk: string) => void;
```

**Rationale:** Keeps the orchestrator testable without a live stream. Existing callers (if any) pass `undefined` and get the old JSON-response behaviour. The API route passes a writer bound to the `ReadableStream` controller.

### 5. Streaming call variants live alongside existing non-streaming calls

**Decision:** Each agent file gets a `callXxxStream` function (e.g., `callAnthropicStream`) that accepts the same `LLMConfig` + `messages` but yields string chunks via an `AsyncIterable<string>`.

**Rationale:** Keeps the non-streaming path untouched and independently testable. The `runXxxAgentTurn` function gains an optional `writer` parameter and branches internally:

```
if writer → use callXxxStream, pipe deltas
else      → use callXxx (existing), return text
```

### 6. Frontend: optimistic streaming message, committed on `done`

**Decision:** When the SSE stream opens, `sendQuestionToSession` immediately adds an assistant message with `status: "streaming"` and empty `content`. Each `text` delta appends to that message's content in React state. On `done`, the full `ChatSession` from the server replaces the local optimistic state.

**Rationale:** The client never needs to reconstruct visuals (charts/tables) from streamed tokens — they arrive in the `done` payload. This keeps the streaming path simple and avoids partial-render edge cases.

## Risks / Trade-offs

- **Stream truncation on error** → If the server throws mid-stream, the client receives an incomplete message. Mitigation: wrap the orchestrator in a try/catch that emits `{"type":"error","message":"..."}` before closing the stream, so the client can mark the message as errored.
- **Backpressure** → For very fast providers, many tiny `text` events flood React state updates. Mitigation: batch small deltas client-side (e.g., flush every 30ms or 20 chars) to avoid excessive re-renders.
- **Tool call phase appears silent** → The `planning` progress label only fires once; if LLM Call #1 is slow, the indicator stalls. This is acceptable for now — future work could add a timeout-based "still thinking…" fallback.
- **No streaming for Gemini tool-use responses** → Gemini's streaming API behaves differently when tools are active. The summary call (no tools) streams fine; only the planning call is affected, which stays non-streaming anyway.

## Migration Plan

1. Deploy new API route returning SSE — old JSON clients (none currently) would break, but there are no external consumers.
2. Deploy updated frontend simultaneously (same PR) to avoid the client receiving an SSE stream it can't parse.
3. Rollback: revert both files; the orchestrator's `writer` parameter is optional so server-side agents are unaffected.

## Open Questions

- **Delta batching threshold**: 30ms / 20 chars is a guess. Worth measuring with real providers to tune.
- **Progress label copy**: "planning", "querying", "summarizing" — confirm UX copy before implementing.
