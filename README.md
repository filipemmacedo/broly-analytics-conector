# Broly Analytics Agent

Broly Analytics Agent is a Next.js proof of concept for a chat-first analytics workspace. The app lets a user connect analytics data sources, choose the active assets they want to query, and ask natural-language questions from a single dashboard.

The current product direction is centered on Google Analytics 4. GA4 questions are handled by an LLM-powered analytics agent that can inspect available GA4 metadata, call the GA4 Data API, and turn the returned report into a conversational answer.

## What The App Does

- Provides a dashboard with a chat composer, message history, and a collapsible data-source side panel.
- Stores chat sessions locally on disk so conversations survive page refreshes.
- Stores integration credentials locally with encrypted secret fields.
- Supports Google Analytics 4 OAuth connection, token refresh, property discovery, property selection, and Data API reporting.
- Supports LLM provider settings for Anthropic, OpenAI, Google, and Mistral.
- Shows Google Analytics as the active integration while BigQuery and Power BI remain hidden for later work.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Local JSON/file-backed persistence under `data/`
- Google Analytics Admin API for property discovery
- Google Analytics Data API for reports
- Provider-specific LLM APIs for natural-language planning and response generation

## Project Structure

```text
src/app
  Dashboard, settings pages, and API routes

src/components
  Dashboard UI, data source panel, chat history, and settings components

src/context
  Client-side integration and chat session state

src/lib
  Persistence, encryption, orchestration, provider logic, and GA4 report execution

src/types
  Shared TypeScript types for integrations and LLM settings
```

## Local Development

1. Install dependencies.

   ```bash
   npm install
   ```

2. Start the app.

   ```bash
   npm run dev
   ```

3. Open the dashboard.

   ```text
   http://localhost:3000
   ```

## Configure The LLM Provider

GA4 chat uses an LLM provider to translate a natural-language question into a GA4 Data API report request and summarize the returned data.

1. Open `http://localhost:3000/settings/llm`.
2. Choose a provider: Anthropic, OpenAI, Google, or Mistral.
3. Choose a model from the model dropdown.
4. Paste the provider API key.
5. Click **Save**.
6. Click **Test Connection** to confirm the API key works.

The API key is stored locally under `data/llm-settings.enc.json` with encrypted secret fields.

## Connect Google Analytics 4

The recommended GA4 path is Google OAuth 2.0. This lets the user sign in with Google, grants Broly read-only Analytics access, and allows the app to list properties that the signed-in Google account can access.

### 1. Prepare Google Cloud

1. Open the Google Cloud Console.
2. Select or create a Google Cloud project for this local Broly app.
3. Enable these APIs:
   - Google Analytics Admin API
   - Google Analytics Data API
4. Open **APIs & Services > OAuth consent screen**.
5. Configure the consent screen for your app.
6. Add yourself as a test user if the app is in testing mode.

### 2. Create OAuth Credentials

1. Open **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Choose **Web application**.
4. Add this authorized redirect URI for local development:

   ```text
   http://localhost:3000/api/connect/ga4/callback
   ```

5. If you deploy the app, add the deployed redirect URI too:

   ```text
   https://your-domain.example/api/connect/ga4/callback
   ```

6. Create the OAuth client.
7. Copy the **Client ID** and **Client Secret**.

### 3. Save The GA4 Credentials In Broly

1. Start Broly with `npm run dev`.
2. Open `http://localhost:3000/settings/integrations`.
3. Find **Google Analytics**.
4. Click **Set up**.
5. Keep **Credential type** set to **Google OAuth 2.0 (recommended)**.
6. Paste the Google OAuth **Client ID**.
7. Paste the Google OAuth **Client Secret**.
8. Click **Save connection**.

At this point Broly has the OAuth client details, but it does not yet have permission to access a Google account.

### 4. Connect With Google

1. On the Google Analytics integration card, click **Connect with Google**.
2. Choose the Google account that has access to your GA4 property.
3. Approve the requested read-only Google Analytics permission.
4. Google redirects back to:

   ```text
   /settings/integrations/google-analytics
   ```

5. Broly exchanges the OAuth code for access and refresh tokens, stores them encrypted, and marks the integration as configured.

The OAuth flow requests this scope:

```text
https://www.googleapis.com/auth/analytics.readonly
```

### 5. Select A GA4 Property

After Google connects successfully, the Google Analytics card shows a GA4 property selector.

1. Open the **GA4 Property** dropdown.
2. Choose the property you want the assistant to query.
3. Save the selected property if prompted.

Property IDs are stored in the `properties/123456789` format expected by the GA4 APIs.

The dashboard side panel also shows a compact GA4 property picker when Google Analytics is connected, so you can switch the active property without leaving the chat workspace.

### 6. Test The Connection

1. On the Google Analytics integration card, click **Test connection**.
2. A successful test means Broly can:
   - refresh or use the stored OAuth token,
   - read metadata for the selected GA4 property,
   - run a small GA4 Data API report.

If the test fails, check the troubleshooting section below.

### 7. Ask GA4 Questions

Return to the dashboard at `http://localhost:3000` and ask questions such as:

- `How many active users did we have in the last 7 days?`
- `Show sessions by country for the last 30 days.`
- `What were the top traffic sources last week?`
- `Compare purchase revenue this month to last month.`

The assistant fetches GA4 metadata for the selected property, asks the configured LLM to choose valid GA4 metrics and dimensions, runs the report, and summarizes the result in chat.

## GA4 Troubleshooting

### OAuth error: `not_configured`

The Google Analytics integration does not have a saved OAuth Client ID and Client Secret yet. Go back to **Settings > Integrations > Google Analytics**, click **Set up** or **Edit**, and save the OAuth credentials.

### OAuth error: `redirect_uri_mismatch`

The redirect URI in Google Cloud does not match the URL Broly is using. For local development, the authorized redirect URI must be exactly:

```text
http://localhost:3000/api/connect/ga4/callback
```

If you run on a different port or deploy to another domain, add that exact callback URL in the Google Cloud OAuth client settings.

### OAuth error: `access_denied`

The Google account rejected the consent prompt, or the account is not allowed by the OAuth consent screen test-user list. Add the account as a test user in Google Cloud or publish/configure the consent screen appropriately.

### No GA4 properties appear

Check that:

- the signed-in Google account has access to at least one GA4 property,
- the Google Analytics Admin API is enabled,
- the OAuth consent screen includes the account as a test user when in testing mode,
- the OAuth client was created in the same Google Cloud project where the APIs were enabled.

### Connection test fails after selecting a property

Check that:

- a property is selected,
- the selected property is a GA4 property, not a Universal Analytics property,
- the Google Analytics Data API is enabled,
- the Google account has permission to read the selected property,
- reconnecting Google Analytics refreshes the stored tokens if the saved connection is stale.

### Chat says no LLM provider is configured

Open `http://localhost:3000/settings/llm`, save an LLM provider, and test the connection. GA4 chat requires both a GA4 connection and an LLM provider.

## Data And Credential Storage

This is a local proof of concept. The app writes local state under the project `data/` directory:

- integration records and encrypted credentials,
- LLM settings and encrypted API key,
- chat sessions and chat index data.

Do not commit real `data/` files containing credentials or chat history.

## Current Limitations

- This is a POC, not a production-hardened deployment.
- Local file-backed persistence is not suitable for multi-user production use.
- Credentials are encrypted locally, but there is no external secret manager integration yet.
- GA4 reporting depends on the selected LLM choosing valid metrics and dimensions, although property metadata is provided to reduce invalid requests.
- Cross-source joins and reconciliation are not implemented.
- BigQuery and Power BI connector code exists, but both integrations are hidden from the UI until that connection work resumes.

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
```

`npm run typecheck` currently reports existing demo connection-status type errors in `src/lib/demo-data.ts` and `src/lib/store.ts`. Those are unrelated to the GA4 connection flow described above.
