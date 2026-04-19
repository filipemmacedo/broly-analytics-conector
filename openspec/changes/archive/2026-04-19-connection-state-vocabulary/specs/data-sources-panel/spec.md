## MODIFIED Requirements

### Requirement: Data Sources panel is read-only
The Data Sources panel (left sidebar) SHALL display only the connection status and health state of each provider. It SHALL NOT contain credential inputs, connect/disconnect buttons, endpoint configuration fields, or any form elements for connection management.

#### Scenario: Panel renders status-only rows
- **WHEN** the Data Sources panel is rendered in the main dashboard
- **THEN** each provider row shows: provider name, a colored status dot, and (when applicable) a property/database picker
- **AND** no `<input>`, `<textarea>`, credential-related `<button>`, or OAuth trigger elements are present

#### Scenario: Clicking a provider row navigates to Settings
- **WHEN** the user clicks any provider row in the sidebar
- **THEN** the application navigates to `/settings/integrations/[provider]`
- **AND** no modal or inline form opens within the sidebar itself

#### Scenario: Unconfigured provider shows grey dot
- **WHEN** a provider has no saved integration
- **THEN** the sidebar row shows a grey dot (`source-dot--idle`)
- **AND** no credential input is displayed

#### Scenario: Error state shown with red dot
- **WHEN** a provider integration has `status: "error"` or `healthState: "unreachable"`
- **THEN** the sidebar row shows a red dot (`source-dot--error`)
- **AND** no inline reconnect form is shown

## ADDED Requirements

### Requirement: Data Sources panel dot reflects full connection state
The panel dot SHALL apply the unified connection state vocabulary and render four distinct CSS states based on the combination of `status` and `healthState`.

Dot CSS class mapping:
- `source-dot--idle` → grey: null / unconfigured
- `source-dot--connected` → green: configured + healthy
- `source-dot--attention` → amber: expired, degraded, or unknown
- `source-dot--error` → red: unreachable or error status

#### Scenario: Expired integration renders amber dot
- **WHEN** an integration has `status: "expired"`
- **THEN** the panel dot renders with class `source-dot--attention` (amber)
- **AND** it does NOT render `source-dot--connected` (green)

#### Scenario: Healthy integration renders green dot
- **WHEN** an integration has `status: "configured"` and `healthState: "healthy"`
- **THEN** the panel dot renders with class `source-dot--connected` (green)

#### Scenario: Unknown healthState renders amber dot
- **WHEN** an integration has `status: "configured"` and `healthState: "unknown"`
- **THEN** the panel dot renders with class `source-dot--attention` (amber)

### Requirement: Data Sources panel dot shows tooltip on hover
The panel dot link SHALL include a `title` attribute that provides a plain-language description of the connection state and an invitation to configure.

Tooltip copy pattern: `"{Label} · click to configure"` using the unified vocabulary labels (e.g., `"Needs reconnect · click to configure"`, `"Connected · click to configure"`).

#### Scenario: Amber dot tooltip describes the attention state
- **WHEN** the user hovers over a panel dot in the amber (attention) state
- **THEN** a tooltip appears with text matching `"{label} · click to configure"` where `{label}` is the unified label for the current state (e.g., "Needs reconnect")

#### Scenario: Green dot tooltip confirms connection
- **WHEN** the user hovers over a panel dot in the green (connected) state
- **THEN** a tooltip appears with text `"Connected · click to configure"`

#### Scenario: Grey dot tooltip invites setup
- **WHEN** the user hovers over a panel dot in the grey (idle) state
- **THEN** a tooltip appears with text `"Not set up · click to configure"`
