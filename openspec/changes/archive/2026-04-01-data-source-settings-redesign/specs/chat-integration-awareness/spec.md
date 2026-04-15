## ADDED Requirements

### Requirement: Chat layer reads integration context before dispatching queries
The conversation/assistant layer SHALL access the current list of healthy integrations before executing a data query, using an `IntegrationContext` that is kept up-to-date by the polling mechanism.

#### Scenario: Query dispatched to healthy source
- **WHEN** the user asks a question that maps to a connected and healthy data source
- **THEN** the assistant dispatches the query to that provider's adapter
- **AND** returns a response with the data

#### Scenario: Query mapped to source with no healthy integration
- **WHEN** the user asks a question requiring a data source that has no configured or healthy integration
- **THEN** the assistant does NOT attempt to call that provider's API
- **AND** responds with a message indicating the source is unavailable
- **AND** includes a link or instruction directing the user to Settings > Integrations to configure the source

---

### Requirement: Assistant provides actionable guidance when a source is missing
When a required source is not connected, the assistant response SHALL include a clear, actionable message with a navigation link to the relevant Settings configuration page.

#### Scenario: User asks about Power BI data with no Power BI integration
- **WHEN** no healthy Power BI integration exists
- **AND** the user asks a question that would require Power BI data
- **THEN** the assistant responds with a message such as: "Power BI is not connected. You can set it up in Settings > Integrations."
- **AND** the response includes a link to `/settings/integrations/powerbi`

---

### Requirement: IntegrationContext is available app-wide
The system SHALL provide an `IntegrationContext` React context that exposes the list of integrations with their current health state to any component in the application.

#### Scenario: IntegrationContext is initialized on app load
- **WHEN** the application first loads
- **THEN** `IntegrationContext` fetches `GET /api/integrations/status`
- **AND** makes the result available to all child components including the sidebar and the chat handler

#### Scenario: IntegrationContext updates after polling
- **WHEN** the polling interval fires and `GET /api/integrations/status` returns updated data
- **THEN** `IntegrationContext` updates its state
- **AND** all consumers (sidebar, chat layer) re-render with the new integration states
