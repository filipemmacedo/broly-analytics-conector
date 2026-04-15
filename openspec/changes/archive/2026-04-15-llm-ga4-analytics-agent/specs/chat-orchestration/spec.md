## MODIFIED Requirements

### Requirement: Chat layer reads integration context before dispatching queries
The conversation/assistant layer SHALL access the current list of healthy integrations before executing a data query. When the active source is GA4 and an LLM is configured, the orchestrator SHALL dispatch to the LLM analytics agent path instead of the rule-based planner.

#### Scenario: Query dispatched to healthy GA4 source with LLM configured
- **WHEN** the user asks a question
- **AND** the active source is GA4 (a healthy `google-analytics` integration exists with a selected property)
- **AND** `llmConfig` is non-null
- **THEN** the orchestrator dispatches to the LLM analytics agent (`llm-planner.ts`)
- **AND** returns the LLM-generated insight as the assistant reply

#### Scenario: Query dispatched to healthy BigQuery or Power BI source
- **WHEN** the user asks a question that maps to a connected and healthy BigQuery or Power BI source
- **THEN** the orchestrator dispatches the query to that provider's rule-based connector
- **AND** returns a response with the data (existing behavior, unchanged)

#### Scenario: Query mapped to source with no healthy integration
- **WHEN** the user asks a question requiring a data source that has no configured or healthy integration
- **THEN** the assistant does NOT attempt to call that provider's API
- **AND** responds with a message indicating the source is unavailable
- **AND** includes a link or instruction directing the user to Settings > Integrations to configure the source

---

### Requirement: Assistant provides actionable guidance when a source is missing
When a required source is not connected, the assistant response SHALL include a clear, actionable message with a navigation link to the relevant Settings configuration page.

#### Scenario: User asks about GA4 data with no GA4 integration
- **WHEN** no healthy GA4 integration exists
- **AND** the user asks a question that would require GA4 data
- **THEN** the assistant responds with a message such as: "Google Analytics is not connected. You can set it up in Settings > Integrations."
- **AND** the response includes a link to `/settings/integrations/google-analytics`

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

## ADDED Requirements

### Requirement: GA4 is a valid routable SourceId
The `SourceId` type SHALL include `"ga4"` as a valid value. The orchestrator SHALL recognize GA4 integrations as a healthy source when a `google-analytics` integration is configured and a property is selected.

#### Scenario: GA4 recognized as healthy source
- **WHEN** a `google-analytics` integration with status `"configured"` and health `"healthy"` or `"unknown"` exists
- **AND** a GA4 property ID is present
- **THEN** the orchestrator treats `"ga4"` as a healthy source and routes accordingly
