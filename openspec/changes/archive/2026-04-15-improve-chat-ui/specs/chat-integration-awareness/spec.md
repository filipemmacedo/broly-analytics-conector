## MODIFIED Requirements

### Requirement: Chat layer reads integration context before dispatching queries
The conversation/assistant layer SHALL access the current list of healthy integrations before executing a data query. When the active source is GA4 and an LLM is configured, the orchestrator SHALL dispatch to the LLM analytics agent path instead of the rule-based planner. Queries SHALL be dispatched within the context of the active chat session identified by its session id; the orchestrator SHALL use the session's message history when constructing LLM context.

#### Scenario: Query dispatched to healthy GA4 source with LLM configured
- **WHEN** the user asks a question in an active chat session
- **AND** the active source is GA4 (a healthy `google-analytics` integration exists with a selected property)
- **AND** `llmConfig` is non-null
- **THEN** the orchestrator dispatches to the LLM analytics agent (`llm-planner.ts`)
- **AND** returns the LLM-generated insight as the assistant reply stored in the active session

#### Scenario: Query dispatched to healthy BigQuery or Power BI source
- **WHEN** the user asks a question that maps to a connected and healthy BigQuery or Power BI source
- **THEN** the orchestrator dispatches the query to that provider's rule-based connector
- **AND** returns a response with the data stored in the active session (existing behavior, unchanged)

#### Scenario: Query mapped to source with no healthy integration
- **WHEN** the user asks a question requiring a data source that has no configured or healthy integration
- **THEN** the assistant does NOT attempt to call that provider's API
- **AND** responds with a message indicating the source is unavailable stored in the active session
- **AND** includes a link or instruction directing the user to Settings > Integrations to configure the source

---

### Requirement: Assistant provides actionable guidance when a source is missing
When a required source is not connected, the assistant response SHALL include a clear, actionable message with a navigation link to the relevant Settings configuration page. The message SHALL be stored as an assistant turn in the active chat session.

#### Scenario: User asks about GA4 data with no GA4 integration
- **WHEN** no healthy GA4 integration exists
- **AND** the user asks a question that would require GA4 data
- **THEN** the assistant responds with a message such as: "Google Analytics is not connected. You can set it up in Settings > Integrations."
- **AND** the response includes a link to `/settings/integrations/google-analytics`
- **AND** the message is stored in the active chat session

#### Scenario: User asks about Power BI data with no Power BI integration
- **WHEN** no healthy Power BI integration exists
- **AND** the user asks a question that would require Power BI data
- **THEN** the assistant responds with a message such as: "Power BI is not connected. You can set it up in Settings > Integrations."
- **AND** the response includes a link to `/settings/integrations/powerbi`
- **AND** the message is stored in the active chat session
