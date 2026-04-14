## Why

The current dashboard places connection setup and credential management inside the left-side Data Sources panel, mixing read/write responsibilities and creating setup friction at the heart of the user experience. Moving all connection management to a dedicated Settings > Integrations area separates concerns cleanly, makes the product scalable as new sources are added, and preserves the main dashboard as a distraction-free "Ask anything" interface.

## What Changes

- **BREAKING**: Remove all credential input forms, connect/disconnect buttons, and endpoint configuration from the left sidebar Data Sources panel
- Add a new **Settings > Integrations** page with full connection management for all providers
- Refactor the left sidebar to be read-only, displaying only source name, connection status, and health state
- Introduce a reusable `Integration` data model shared by frontend and backend
- Add backend API routes for saving, testing, and health-checking each provider integration
- Add server-side encryption/masking for stored credentials
- Wire the conversation/chat layer to only use healthy, active integrations; surface actionable errors when a required source is unavailable
- Add deep-link navigation from the sidebar source items to their corresponding Settings card

## Capabilities

### New Capabilities

- `integration-management`: Full CRUD for data source integrations — create, edit, delete, test, and view health/status for Power BI, Google Analytics (GA4), and BigQuery/DQuery connections, housed exclusively in Settings > Integrations
- `integration-status-sidebar`: Read-only left sidebar view showing per-source connection state (Connected/Not connected, Healthy/Error/Setup needed, last-checked timestamp) with deep-link to Settings
- `integration-data-model`: Shared integration entity model supporting multiple auth patterns (API key, OAuth 2.0, service account JSON, custom endpoint + token, tenant/workspace identifiers) with encrypted credential storage
- `integration-health-check`: Server-side health-check and connection-test endpoints for each provider, returning structured status that refreshes the sidebar state
- `chat-integration-awareness`: Conversation layer logic that detects which integrations are healthy, routes queries to the correct source, and responds with actionable guidance when a required source is not connected

### Modified Capabilities

- `data-sources-panel`: Existing sidebar panel behavior changes from interactive connection setup to read-only status display

## Impact

- `src/components/data-sources-panel.tsx` — strip all interactive/connection UI; replace with status-only view
- `src/components/dashboard.tsx` — remove any connection-management state or handlers passed to the sidebar
- New pages/routes: `src/app/settings/integrations/` (Settings > Integrations page)
- New components: `IntegrationCard`, `IntegrationForm`, `ConnectionStatusBadge`, `TestConnectionButton`
- New API routes (Next.js route handlers or similar): `POST /api/integrations`, `PUT /api/integrations/[id]`, `DELETE /api/integrations/[id]`, `POST /api/integrations/[id]/test`, `GET /api/integrations/status`
- New backend service layer: provider-specific adapters for Power BI, Google Analytics, BigQuery
- Credential storage: server-side encryption before persistence; credentials masked in API responses
- Global state/context: `IntegrationContext` or equivalent for sharing live status across sidebar and chat
- Navigation: sidebar items become links/buttons routing to `Settings > Integrations > [provider]`
