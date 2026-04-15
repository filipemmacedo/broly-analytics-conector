## Why

The chat interface currently uses a rigid rule-based keyword matcher that cannot handle free-form analytics questions, and GA4 is connected but never queried for data. By wiring the configured LLM into the chat pipeline and implementing a GA4 Data API connector, users can ask natural-language analytics questions and receive actionable insights generated directly from their Google Analytics property data.

## What Changes

- Replace the rule-based planner with an LLM-powered planner that translates user questions into structured GA4 Data API calls (tool calling / function calling pattern)
- Add a GA4 Data API connector (`src/lib/connectors/ga4.ts`) that executes report requests against `analyticsdata.googleapis.com`
- Update the orchestrator to route to the GA4 connector when GA4 is the active source and an LLM is configured
- Add GA4 as a routable `SourceId` alongside (but independently of) BigQuery and Power BI
- The LLM acts as an analytics agent: it picks the right metrics/dimensions/date ranges, calls the GA4 tool, and writes a natural-language summary of the results
- Support all four configured LLM providers: Anthropic, OpenAI, Google Gemini, Mistral

## Capabilities

### New Capabilities

- `ga4-data-query`: Execute GA4 Data API reports (standard, real-time) from structured parameters built by the LLM
- `llm-analytics-agent`: LLM-powered planner that translates natural-language questions into GA4 tool calls and summarizes results in natural language

### Modified Capabilities

- `chat-orchestration`: Orchestrator gains GA4 routing and LLM-agent dispatch path alongside existing BigQuery/Power BI rule-based paths

## Impact

- **New file**: `src/lib/connectors/ga4.ts` — GA4 Data API execution
- **New file**: `src/lib/llm-planner.ts` — LLM agent loop (tool calling for all 4 providers)
- **Modified**: `src/lib/orchestrator.ts` — wire `llmConfig` + `ga4PropertyId` context, add GA4 route
- **Modified**: `src/lib/types.ts` — add `"ga4"` to `SourceId` union
- **Modified**: `src/lib/planner.ts` — add fallback path or delegate to llm-planner when GA4 is active source
- **Dependencies**: No new npm packages required (all 4 LLM SDKs already present; GA4 Data API called via `fetch`)
- **Auth**: Uses existing OAuth access token stored in the GA4 integration record
