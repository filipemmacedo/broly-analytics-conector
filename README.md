# Broly Analytics Agent

Broly is a Next.js proof of concept for connecting BigQuery and Power BI to a chat-first analytics experience. Users can connect each source, pick active assets, ask analytics questions, and inspect the evidence behind every answer.

## What is implemented

- Next.js App Router website with a dashboard-style analytics workspace
- Local session handling with cookie-based session IDs
- File-backed persistence for connection state and chat history
- BigQuery connector with delegated OAuth routes, metadata discovery, read-only query guardrails, and demo mode
- Power BI connector with delegated OAuth routes, metadata discovery, dataset querying, and demo mode
- Chat orchestration that routes questions to one source at a time
- Evidence panel showing source labels, execution context, and generated SQL or DAX

## Supported question types

The MVP question planner is intentionally narrow. It works best for revenue or sales summaries, orders or users summaries, top country style questions, and inventory questions such as available tables, datasets, workspaces, reports, or semantic models.

When the question is ambiguous and both sources are connected, the app asks the user to choose the source instead of guessing.

## Local development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Start the app with `npm run dev`
4. Open `http://localhost:3000`

## Important limitations

- This is a POC, not a production-hardened deployment.
- The planner does not use an LLM yet, so question understanding is rule-based.
- BigQuery live querying is read-only and intentionally guarded.
- The app does not perform cross-source joins or reconciliation.
- Power BI live querying is limited to dataset-backed DAX queries.
- Validation against real tenant credentials still needs to be completed.
