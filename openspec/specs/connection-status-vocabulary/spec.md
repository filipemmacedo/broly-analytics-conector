### Requirement: Unified connection state vocabulary
The system SHALL define and apply a single four-signal state vocabulary across all connection surfaces (Data Sources panel dots, Integration card badges, LLM Provider card badge). The mapping from system state to visual signal and label text SHALL be canonical and consistent.

The state map SHALL be:

| Condition | Signal | CSS tone | Label |
|---|---|---|---|
| null / `status: unconfigured` | grey | `tone-neutral` | Not set up |
| `status: configured` + `healthState: healthy` | green | `tone-connected` | Connected |
| `status: expired` | amber | `tone-warning` | Needs reconnect |
| `status: configured` + `healthState: degraded` | amber | `tone-warning` | Degraded |
| `status: configured` + `healthState: unknown` | amber | `tone-warning` | Not verified |
| `status: configured` + `healthState: unreachable` | red | `tone-error` | Connection error |
| `status: error` | red | `tone-error` | Connection error |

#### Scenario: Expired status renders amber
- **WHEN** an integration has `status: "expired"`
- **THEN** the connection indicator renders with `tone-warning` (amber) and label "Needs reconnect"
- **AND** it does NOT render with `tone-error` (red)

#### Scenario: Unknown healthState renders amber
- **WHEN** an integration has `status: "configured"` and `healthState: "unknown"`
- **THEN** the connection indicator renders with `tone-warning` (amber) and label "Not verified"
- **AND** it does NOT render with `tone-connected` (green)

#### Scenario: Healthy renders green
- **WHEN** an integration has `status: "configured"` and `healthState: "healthy"`
- **THEN** the connection indicator renders with `tone-connected` (green) and label "Connected"

#### Scenario: Unreachable renders red
- **WHEN** an integration has `status: "configured"` and `healthState: "unreachable"`
- **THEN** the connection indicator renders with `tone-error` (red) and label "Connection error"

#### Scenario: Null integration renders grey
- **WHEN** no integration record exists for a provider
- **THEN** the connection indicator renders with `tone-neutral` (grey) and label "Not set up"
