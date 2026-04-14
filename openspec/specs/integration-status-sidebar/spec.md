## ADDED Requirements

### Requirement: Sidebar shows read-only integration status
The Data Sources sidebar panel SHALL display each provider as a read-only status row, showing source name, connection state, and health indicator only.

#### Scenario: Configured and healthy source
- **WHEN** an integration is configured and the last health check passed
- **THEN** the sidebar row shows the provider name, a "Connected" badge, and a "Healthy" or "Last checked X min ago" label
- **AND** no credential input, connect button, or form element is rendered

#### Scenario: Unconfigured source
- **WHEN** no integration has been saved for a provider
- **THEN** the sidebar row shows the provider name and a "Not connected" or "Setup needed" badge
- **AND** no credential input or connect button is rendered in the sidebar

#### Scenario: Integration in error state
- **WHEN** an integration's last health check failed or credentials are expired
- **THEN** the sidebar row shows an error indicator (e.g., red dot or "Auth expired" label)
- **AND** no inline fix or re-authentication flow is triggered from the sidebar

---

### Requirement: Sidebar source items deep-link to Settings
Each sidebar source row SHALL be clickable and navigate the user to the corresponding Settings > Integrations provider page.

#### Scenario: Click on a configured source
- **WHEN** the user clicks a source row in the sidebar
- **THEN** the application navigates to `/settings/integrations/[provider]`

#### Scenario: Click on an unconfigured source
- **WHEN** the user clicks a source row that shows "Setup needed"
- **THEN** the application navigates to `/settings/integrations/[provider]` for configuration

---

### Requirement: Sidebar status refreshes periodically
The sidebar SHALL poll for integration health status at a regular interval so it reflects the current state without a page reload.

#### Scenario: Status updates after polling interval
- **WHEN** 60 seconds have elapsed since the last status fetch
- **THEN** the sidebar automatically re-fetches `GET /api/integrations/status`
- **AND** updates the status badges for each provider without a full page reload

---

### Requirement: No connection management UI in sidebar
The sidebar Data Sources panel SHALL NOT contain any form inputs, API key fields, endpoint configuration, connect/disconnect action buttons, or OAuth flows.

#### Scenario: Sidebar renders no interactive connection elements
- **WHEN** the sidebar panel is rendered
- **THEN** there are no `<input>`, `<textarea>`, credential-related `<button>`, or modal triggers for connection setup
- **AND** the only interactive element per row is the deep-link navigation to Settings
