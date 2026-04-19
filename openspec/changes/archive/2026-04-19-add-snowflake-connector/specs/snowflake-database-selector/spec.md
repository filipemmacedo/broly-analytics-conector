## ADDED Requirements

### Requirement: Database selector appears after credentials are saved
The system SHALL display a `SnowflakeDatabaseSelector` component on the Snowflake integration card after credentials have been successfully saved (i.e. when an integration record exists with `authType: "api-key"`). This mirrors the `BigQueryPropertySelector` pattern.

#### Scenario: Selector visible after initial setup
- **WHEN** the user saves Snowflake credentials for the first time
- **THEN** the integration card re-renders and shows the database/schema/warehouse selector below the credential section

---

### Requirement: Selector loads available databases from the Snowflake account
The system SHALL call `GET /api/integrations/snowflake/databases` which executes `SHOW DATABASES` on the Snowflake account using the stored PAT token. The response SHALL return a list of database names the token's role has access to.

#### Scenario: Databases load successfully
- **WHEN** the selector mounts and the token is valid
- **THEN** a dropdown is populated with all accessible database names

#### Scenario: Empty list shown when role has no database access
- **WHEN** `SHOW DATABASES` returns an empty result
- **THEN** a message is shown telling the user their role may not have the USAGE privilege on any database

#### Scenario: Error shown when API call fails
- **WHEN** `GET /api/integrations/snowflake/databases` returns an error
- **THEN** an error message is displayed in the selector

---

### Requirement: Selector loads schemas and warehouses dynamically
The system SHALL:
- Load schemas via `SHOW SCHEMAS IN DATABASE <selected_db>` when a database is selected.
- Load warehouses via `SHOW WAREHOUSES` once on mount.
Schema and warehouse dropdowns SHALL be disabled until their respective data is loaded.

#### Scenario: Schemas load after database selection
- **WHEN** the user selects a database
- **THEN** the schema dropdown is populated with schemas available in that database

#### Scenario: Warehouses load on mount
- **WHEN** the selector mounts
- **THEN** the warehouse dropdown is populated with accessible warehouses

---

### Requirement: Selected database, schema, and warehouse are persisted
The system SHALL call `PUT /api/integrations/snowflake/databases/selected` with `{ database, schema, warehouse }` when the user makes a selection. These values SHALL be stored in the integration's `providerFields` (`database`, `schema`, `warehouse`).

#### Scenario: Selection is saved and confirmation shown
- **WHEN** the user selects a database, schema, and warehouse
- **THEN** the selection is saved and a "Saved" confirmation message is shown briefly

#### Scenario: Existing selection is pre-populated on return
- **WHEN** the user returns to the integrations page with a previously saved selection
- **THEN** the dropdowns show the previously selected database, schema, and warehouse
