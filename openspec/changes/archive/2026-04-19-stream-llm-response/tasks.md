## 1. Shared Types & Stream Writer

- [x] 1.1 Add `StreamWriterFn` type and `SseEvent` union type (`progress` | `text` | `done` | `error`) to `src/lib/types.ts`
- [x] 1.2 Add a `writeSseEvent(writer: StreamWriterFn, event: SseEvent): void` helper in `src/lib/utils.ts` that serializes to `data: {...}\n\n`

## 2. Streaming Summary Call — GA4 Agent

- [x] 2.1 Add `callAnthropicStream` in `src/lib/agents/ga4-agent.ts` that calls Anthropic with `stream: true` and yields `content_block_delta.delta.text` chunks via an `AsyncIterable<string>`
- [x] 2.2 Add `callOpenAIStream` in `src/lib/agents/ga4-agent.ts` that reads the OpenAI SSE response body and yields `choices[0].delta.content` chunks
- [x] 2.3 Add `callGeminiStream` in `src/lib/agents/ga4-agent.ts` using `streamGenerateContent` and yielding `candidates[0].content.parts[0].text` chunks
- [x] 2.4 Add `callMistralStream` in `src/lib/agents/ga4-agent.ts` (mirrors OpenAI stream format)
- [x] 2.5 Update `runGA4AgentTurn` to accept optional `writer?: StreamWriterFn`; when present, use the appropriate streaming call for the summary step and forward each chunk as a `text` delta event

## 3. Streaming Summary Call — BigQuery Agent

- [x] 3.1 Add `callAnthropicStream`, `callOpenAIStream`, `callGeminiStream`, `callMistralStream` in `src/lib/agents/bigquery-agent.ts` (same pattern as GA4)
- [x] 3.2 Update `runBigQueryAgentTurn` to accept optional `writer?: StreamWriterFn` and use streaming summary call when provided

## 4. Streaming Summary Call — Snowflake Agent

- [x] 4.1 Add `callAnthropicStream`, `callOpenAIStream`, `callGeminiStream`, `callMistralStream` in `src/lib/agents/snowflake-agent.ts`
- [x] 4.2 Update `runSnowflakeAgentTurn` to accept optional `writer?: StreamWriterFn` and use streaming summary call when provided

## 5. Orchestrator SSE Emission

- [x] 5.1 Update `handleQuestion` in `src/lib/orchestrator.ts` to accept optional `writer?: StreamWriterFn`
- [x] 5.2 Emit `{"type":"progress","step":"planning"}` before each agent's query-planning LLM call
- [x] 5.3 Emit `{"type":"progress","step":"querying"}` before the data fetch step in each provider path
- [x] 5.4 Emit `{"type":"progress","step":"summarizing"}` before the summary LLM call in each provider path
- [x] 5.5 Pass `writer` through to each `runXxxAgentTurn` call so token deltas flow up

## 6. API Route — Switch to SSE

- [x] 6.1 Rewrite `src/app/api/chats/[id]/messages/route.ts` to return a `new Response(ReadableStream, { headers: { "Content-Type": "text/event-stream", ... } })`
- [x] 6.2 Inside the stream controller, call `handleQuestion` with a writer bound to `controller.enqueue`
- [x] 6.3 On orchestrator success, call `saveChat`, then emit `{"type":"done","session":{...}}` and close the stream
- [x] 6.4 Wrap in try/catch: on error emit `{"type":"error","message":"..."}` then close

## 7. Frontend — SSE Stream Consumer

- [x] 7.1 In `src/context/ChatSessionContext.tsx`, replace the `readJson` call in `sendQuestionToSession` with a raw `fetch` that reads `response.body` as a `ReadableStream`
- [x] 7.2 Immediately after stream opens, add an optimistic assistant message with `status: "streaming"` and `content: ""`
- [x] 7.3 Parse each SSE `data:` line as JSON; on `text` delta append to the streaming message's `content` in React state
- [x] 7.4 On `progress` event, store the current step label in a local state variable for display
- [x] 7.5 On `done` event, replace the optimistic session with the authoritative `session` from the payload and clear streaming state
- [x] 7.6 On `error` event or stream close without `done`, mark the streaming message as `status: "error"`
- [x] 7.7 Ensure `AbortController` cancellation stops the stream reader and cleans up state

## 8. UI — Streaming Cursor & Progress Labels

- [x] 8.1 In `src/components/ui/MessageBubble.tsx`, add a CSS blinking cursor pseudo-element or `|` character rendered when `message.status === "streaming"`
- [x] 8.2 In `src/components/dashboard.tsx` (or a new `StreamingStatusLabel` component), render the current progress step label ("Planning query…" / "Running query…" / "Generating summary…") when `isTyping` is true and no streaming text has arrived yet
- [x] 8.3 Hide the `TypingIndicator` once the first text delta arrives (transition from indicator → live text)
- [x] 8.4 Add CSS for the blinking cursor animation in `src/app/globals.css`

## 9. Smoke Test

- [x] 9.1 Manually test end-to-end with GA4: submit a question and verify progress labels appear in sequence, text streams in word-by-word, and the chart renders on completion
- [x] 9.2 Verify the Stop button cancels the stream mid-generation and leaves a partial message
- [x] 9.3 Verify error path: disconnect network mid-stream and confirm the message shows an error state
