## Why

Currently, LLM responses appear all at once after a silent wait, creating an abrupt "pop" that feels unpolished. Users have no feedback during long queries, and the UX is notably worse than ChatGPT or Claude.ai. Adding streaming text output and pipeline status labels gives immediate feedback and makes the product feel alive.

## What Changes

- The messages API route switches from returning a JSON response to an SSE stream
- A new SSE wire format carries three event types: `progress` (pipeline stage labels), `text` (token deltas), and `done` (final session payload)
- The orchestrator emits progress events (`planning`, `querying`, `summarizing`) as it moves through stages
- The final LLM call in each agent (the summary step) switches to streaming mode; the query-planning call stays non-streaming
- All 4 LLM providers (Anthropic, OpenAI, Gemini, Mistral) get streaming variants for the summary call
- The frontend consumes the SSE stream, shows a `TypingIndicator` until first text arrives, then streams tokens into a live message bubble
- A blinking cursor is shown on the in-progress assistant message while tokens are arriving

## Capabilities

### New Capabilities
- `llm-response-streaming`: Token-by-token streaming of LLM summary text via SSE, with pipeline stage progress labels and a streaming cursor in the message bubble

### Modified Capabilities
- `llm-analytics-agent`: Agents now support a streaming summary call in addition to the existing non-streaming tool-use call
- `orchestrator-routing`: Orchestrator now accepts a stream writer and emits structured SSE events instead of returning a plain session object
- `chat-session-management`: `sendQuestionToSession` consumes an SSE stream and accumulates token deltas into a live assistant message
- `chat-ui-experience`: MessageBubble gains a `streaming` status with a blinking cursor; TypingIndicator is shown until first text token arrives

## Impact

- `src/app/api/chats/[id]/messages/route.ts` — returns `Response` with `ReadableStream` instead of `NextResponse.json`
- `src/lib/orchestrator.ts` — accepts `WritableStreamDefaultWriter`, emits SSE events
- `src/lib/agents/ga4-agent.ts`, `bigquery-agent.ts`, `snowflake-agent.ts` — streaming final LLM call per provider
- `src/context/ChatSessionContext.tsx` — SSE stream consumer, optimistic streaming message
- `src/components/ui/MessageBubble.tsx` — streaming cursor state
- No new npm dependencies required (native `ReadableStream` / `fetch` SSE)
