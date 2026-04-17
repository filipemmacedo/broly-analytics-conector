## ADDED Requirements

### Requirement: Only one analytics source active at a time
The system SHALL enforce that at most one analytics source (GA4 or BigQuery) is active at any time. An integration is considered "active" when it has valid OAuth tokens and is the designated source for LLM queries. This state SHALL be persisted across sessions.

#### Scenario: Both sources cannot be simultaneously active
- **WHEN** both GA4 and BigQuery integrations exist in the store
- **THEN** at most one SHALL have `isActive: true` at any given time

---

### Requirement: Connecting BigQuery deactivates GA4
When BigQuery OAuth completes successfully, the system SHALL set any active GA4 integration to inactive (`isActive: false`). The GA4 integration SHALL remain in the store with its credentials intact — it is deactivated, not deleted.

#### Scenario: BigQuery connect deactivates GA4
- **WHEN** BigQuery OAuth callback succeeds and a GA4 integration is currently active
- **THEN** the GA4 integration's `isActive` SHALL be set to `false` and BigQuery's `isActive` SHALL be set to `true`

#### Scenario: BigQuery connect with no active GA4
- **WHEN** BigQuery OAuth callback succeeds and no GA4 integration is active
- **THEN** BigQuery SHALL be set to `isActive: true` with no side effects on other integrations

---

### Requirement: Connecting GA4 deactivates BigQuery
When GA4 OAuth completes successfully, the system SHALL set any active BigQuery integration to inactive (`isActive: false`). The BigQuery integration SHALL remain in the store with its credentials intact.

#### Scenario: GA4 connect deactivates BigQuery
- **WHEN** GA4 OAuth callback succeeds and a BigQuery integration is currently active
- **THEN** the BigQuery integration's `isActive` SHALL be set to `false` and GA4's `isActive` SHALL be set to `true`

---

### Requirement: UI confirmation before switching active source
When the user initiates OAuth for a source while another source is already active, the UI SHALL display a confirmation dialog informing the user that the current source will be deactivated. The connect flow SHALL only proceed if the user confirms.

#### Scenario: User confirms source switch
- **WHEN** user clicks "Connect" on BigQuery while GA4 is active and confirms the dialog
- **THEN** the OAuth flow SHALL proceed and GA4 SHALL be deactivated on success

#### Scenario: User cancels source switch
- **WHEN** user clicks "Connect" on BigQuery while GA4 is active and dismisses the dialog
- **THEN** no OAuth flow SHALL be initiated and both integrations SHALL remain unchanged
