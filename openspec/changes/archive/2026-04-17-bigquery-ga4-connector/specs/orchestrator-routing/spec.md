## MODIFIED Requirements

### Requirement: Question routing based on active source
The orchestrator SHALL route incoming questions to the correct LLM agent based on the `isActive` flag of the configured integrations, rather than implicit priority (GA4 no longer automatically wins). The orchestrator SHALL read the active integration from the store, extract its access token and `providerFields`, and dispatch to the appropriate agent.

#### Scenario: Question routed to GA4 agent when GA4 is active
- **WHEN** a user submits a question and a GA4 integration has `isActive: true`
- **THEN** the orchestrator SHALL call `runGA4AgentTurn` with the GA4 access token and property ID

#### Scenario: Question routed to BigQuery agent when BigQuery is active
- **WHEN** a user submits a question and a BigQuery integration has `isActive: true`
- **THEN** the orchestrator SHALL call `runBigQueryAgentTurn` with the BigQuery access token, projectId, and propertyName

#### Scenario: No active source
- **WHEN** a user submits a question and no integration has `isActive: true`
- **THEN** the orchestrator SHALL return a message directing the user to connect an analytics source in Settings

#### Scenario: LLM not configured
- **WHEN** a user submits a question and a source is active but no LLM provider is configured
- **THEN** the orchestrator SHALL return a message directing the user to configure an LLM in Settings > LLM
