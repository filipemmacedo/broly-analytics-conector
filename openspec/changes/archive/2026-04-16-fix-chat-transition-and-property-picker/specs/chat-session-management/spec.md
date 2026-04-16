## ADDED Requirements

### Requirement: First-message transition from home does not flash the route loader
The system SHALL NOT display the chat route loading skeleton when the user navigates to `/chat/<id>` as a result of submitting the first message from the dashboard home, because a pending chat start is already available in sessionStorage at mount time.

#### Scenario: Navigate to new chat with pending start in sessionStorage
- **WHEN** the user submits the first message from `/`
- **AND** the browser navigates to `/chat/<new-id>`
- **AND** a matching pending chat start entry exists in `sessionStorage`
- **THEN** the chat route renders the optimistic user message immediately on first paint
- **AND** the `ChatRouteLoader` skeleton is never shown during this transition

#### Scenario: Navigate directly to a chat URL with no pending start
- **WHEN** the user navigates directly to `/chat/<id>` (e.g. by typing the URL or refreshing)
- **AND** there is no matching pending chat start entry in `sessionStorage`
- **THEN** the `ChatRouteLoader` skeleton is displayed until the session data is loaded
