## Context

The application is a Next.js dashboard with a left sidebar (`data-sources-panel.tsx`), a main dashboard area (`dashboard.tsx`), and a chat/conversation layer. Currently, the sidebar handles both displaying data source status and managing connections — users connect, configure, and manage credentials directly inside the sidebar. This creates coupling between UX concerns (status visibility) and admin concerns (credential management), and makes the main dashboard feel heavy.

Three providers are in scope: Power BI (OAuth / API key + tenant), Google Analytics GA4 (OAuth or service account), and BigQuery/DQuery (service account or token + project/dataset). The app has no existing Settings page or integration data model. Credentials are not yet encrypted at rest.

## Goals / Non-Goals

**Goals:**
- Introduce a dedicated Settings > Integrations page as the sole location for creating, editing, deleting, testing, and viewing health of data source connections
- Refactor the sidebar into a read-only status panel with deep-links to Settings
- Define a reusable `Integration` entity model that supports multiple auth patterns
- Add server-side API routes for CRUD, connection testing, and health checks
- Encrypt/mask credentials before persistence; never return plaintext secrets after initial save
- Surface integration health in real-time to the sidebar and to the chat layer
- Enable the chat layer to detect which source to query and guide users to Settings when a source is missing

**Non-Goals:**
- Actual OAuth flow / OAuth provider registration (placeholder redirect stubs are acceptable for this phase)
- Multi-user / team-scoped integration sharing
- Audit logging for credential changes
- Real-time streaming health checks (polling is sufficient for this phase)
- Mobile-responsive Settings redesign

## Decisions

### 1. Integration storage: local encrypted JSON file vs. database

**Decision**: Store integrations in a server-side encrypted JSON file (`data/integrations.enc.json`) for this phase, keyed by a `DATA_ENCRYPTION_KEY` environment variable using AES-256-GCM.

**Rationale**: The app has no database layer yet. A flat encrypted file keeps dependencies minimal and is straightforward to migrate to a DB later. The encryption boundary is the server — credentials never leave unencrypted.

**Alternative considered**: SQLite via Prisma. Adds migration complexity without meaningful benefit at this stage.

---

### 2. Credential masking strategy

**Decision**: After a credential is saved, all subsequent API responses replace secret fields (API keys, tokens, service account JSON) with a sentinel value (`"••••••••"` or `{ masked: true }`). The frontend treats a masked value as "already set" and only sends the value back on explicit re-entry.

**Rationale**: Prevents credentials from leaking through browser network tabs, logs, or state serialization. Follows the same pattern used by Stripe, Vercel, and similar platforms.

**Alternative considered**: Never return credential fields at all. Rejected because the form UX becomes ambiguous — users can't tell if a field is set.

---

### 3. Integration data model — single table, typed auth config

**Decision**: One `Integration` type with a discriminated union `authConfig` keyed by `authType`:

```ts
type Integration = {
  id: string                        // uuid
  provider: 'powerbi' | 'google-analytics' | 'bigquery'
  displayName: string
  authType: 'api-key' | 'oauth2' | 'service-account' | 'token-endpoint'
  authConfig: AuthConfig            // discriminated union per authType
  status: 'configured' | 'unconfigured' | 'error' | 'expired'
  healthState: 'healthy' | 'degraded' | 'unreachable' | 'unknown'
  lastCheckedAt: string | null      // ISO timestamp
  createdAt: string
  updatedAt: string
}
```

**Rationale**: A single model with a discriminated union keeps the API surface small, is easy to extend with new providers, and maps cleanly to a settings card UI where different fields render based on `authType`.

---

### 4. Health check architecture — on-demand + scheduled polling

**Decision**: Health checks are triggered in two ways: (a) explicitly via `POST /api/integrations/[id]/test` from the Settings UI, and (b) passively via a lightweight polling mechanism on the client (every 60s) that calls `GET /api/integrations/status` to refresh sidebar state.

**Rationale**: On-demand tests give immediate feedback in the Settings form. Background polling keeps the sidebar accurate without requiring full page navigation. 60s interval avoids excessive API calls to third-party providers.

**Alternative considered**: Server-sent events or WebSockets for push-based updates. Overkill at this scale; polling is simpler and reliable.

---

### 5. Settings page routing

**Decision**: Add `src/app/settings/integrations/page.tsx` as the main integrations list, and `src/app/settings/integrations/[provider]/page.tsx` for per-provider configuration forms. Add a top-level `/settings` layout with navigation.

**Rationale**: Next.js App Router file-system routing keeps the structure predictable. Per-provider routes allow the sidebar to deep-link directly to the correct configuration card (e.g., `/settings/integrations/powerbi`).

---

### 6. Chat layer integration awareness

**Decision**: Add an `IntegrationContext` (React context) that provides the list of healthy integrations app-wide. The chat handler reads from this context before dispatching a query. If no healthy integration can serve the query, the assistant returns a structured "source unavailable" response with a link to Settings.

**Rationale**: Keeps the chat logic decoupled from direct API calls. The context is the single source of truth for integration state shared across sidebar and chat.

---

### 7. Sidebar deep-link behavior

**Decision**: Each source item in the sidebar renders as a `<Link href="/settings/integrations/[provider]">` component. The item is non-interactive (no modals, no forms) and only shows status indicators.

**Rationale**: Fulfills the product rule that the sidebar is informational only, while still providing a shortcut to the management page.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| File-based storage is not concurrent-safe under multi-process deploys | Acceptable for single-instance dev; document that a DB migration is needed before horizontal scaling |
| AES-256-GCM encryption key in env var — key rotation is manual | Document key rotation procedure; plan for a secrets manager in a future phase |
| OAuth flows require provider app registration (client ID, redirect URI) | Stub OAuth with a placeholder redirect; mark as "Coming soon" in the UI until credentials are registered |
| Health check polling may hit rate limits on provider APIs | Use cached status with TTL; only re-check if last check is older than 60s |
| Masking sentinel `"••••••••"` could be sent back as a real credential on form submit | Frontend must strip masked values before submitting; validate on server that masked sentinel is rejected |
| Migration: users who have existing connections set up in the sidebar will lose their config | One-time migration script reads old sidebar state and writes to the new integration store; sidebar is cleaned up after migration succeeds |

## Migration Plan

1. **Phase 1 — Parallel state**: Ship the new Settings > Integrations page and data model alongside the existing sidebar. Both work simultaneously. No data loss.
2. **Phase 2 — Migration script**: On first load of Settings > Integrations, detect any legacy connection state in localStorage or component state and offer to migrate it to the new store. Display a banner: "Your connections have been moved to Settings."
3. **Phase 3 — Sidebar cleanup**: Remove all interactive connection UI from the sidebar. Sidebar becomes read-only. The old connection code paths are deleted.
4. **Rollback**: If Phase 3 causes issues, revert the sidebar component to its previous version. The integration store remains intact — no data is lost on rollback.

## Open Questions

- **OAuth provider registration**: Which OAuth apps need to be registered (client ID/secret) for Power BI and Google Analytics? This blocks full OAuth flow implementation.
- **Encryption key management**: Should `DATA_ENCRYPTION_KEY` be provisioned via Vercel environment variables, or does the team have a secrets manager preference?
- **Health check frequency**: Is 60s polling acceptable, or does the sidebar need near-real-time status (requires SSE or WebSocket)?
- **Multi-account support**: Should a user be able to configure multiple Power BI workspaces or multiple GA4 properties simultaneously, or is one-per-provider sufficient for this phase?
