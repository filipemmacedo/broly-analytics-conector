## MODIFIED Requirements

### Requirement: Data Sources panel is read-only
The Data Sources panel (left sidebar) SHALL display only the connection status and health state of each provider. It SHALL NOT contain credential inputs, connect/disconnect buttons, endpoint configuration fields, or any form elements for connection management.

#### Scenario: Panel renders status-only rows
- **WHEN** the Data Sources panel is rendered in the main dashboard
- **THEN** each provider row shows: provider name, connection status badge (Connected / Not connected), health indicator (Healthy / Error / Setup needed / Last checked X min ago)
- **AND** no `<input>`, `<textarea>`, credential-related `<button>`, or OAuth trigger elements are present

#### Scenario: Clicking a provider row navigates to Settings
- **WHEN** the user clicks any provider row in the sidebar
- **THEN** the application navigates to `/settings/integrations/[provider]`
- **AND** no modal or inline form opens within the sidebar itself

#### Scenario: Unconfigured provider shows Setup needed
- **WHEN** a provider has no saved integration
- **THEN** the sidebar row shows "Setup needed" or "Not connected"
- **AND** no credential input is displayed

#### Scenario: Error state shown with indicator
- **WHEN** a provider integration has `status: "error"` or `healthState: "unreachable"`
- **THEN** the sidebar row shows a visual error indicator (e.g., red dot, "Auth expired" label)
- **AND** no inline reconnect form is shown

## REMOVED Requirements

### Requirement: Data Sources panel accepts credential input
**Reason**: Connection management has been moved exclusively to Settings > Integrations. The sidebar is now a read-only status display.
**Migration**: Users who previously configured connections in the sidebar must reconfigure them in Settings > Integrations. A one-time migration banner guides them through the process.
