export type SourceId = "bigquery" | "powerbi";
export type ConnectionStatus = "disconnected" | "connected" | "error";

export interface ColumnMetadata {
  name: string;
  type: string;
}

export interface BigQueryTable {
  id: string;
  description?: string;
  columns: ColumnMetadata[];
}

export interface BigQueryDataset {
  id: string;
  location?: string;
  tables: BigQueryTable[];
}

export interface BigQueryProject {
  id: string;
  datasets: BigQueryDataset[];
}

export interface BigQueryMetadata {
  projects: BigQueryProject[];
}

export interface PowerBIReport {
  id: string;
  name: string;
  embedUrl?: string;
}

export interface PowerBIDataset {
  id: string;
  name: string;
  tables: ColumnMetadata[];
}

export interface PowerBIWorkspace {
  id: string;
  name: string;
  datasets: PowerBIDataset[];
  reports: PowerBIReport[];
}

export interface PowerBIMetadata {
  workspaces: PowerBIWorkspace[];
}

export interface EncryptedTokenSet {
  iv: string;
  tag: string;
  content: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}

export interface BigQuerySelection {
  projectId?: string;
  datasetId?: string;
  tableId?: string;
}

export interface PowerBISelection {
  workspaceId?: string;
  datasetId?: string;
  reportId?: string;
}

export interface BigQueryConnection {
  status: ConnectionStatus;
  mode: "live" | null;
  selected: BigQuerySelection;
  metadata: BigQueryMetadata;
  access?: EncryptedTokenSet;
  oauthState?: string;
  error?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
}

export interface PowerBIConnection {
  status: ConnectionStatus;
  mode: "live" | null;
  selected: PowerBISelection;
  metadata: PowerBIMetadata;
  access?: EncryptedTokenSet;
  oauthState?: string;
  error?: string;
  connectedAt?: string;
  lastSyncedAt?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  source?: SourceId;
  status?: "complete" | "error";
}

export interface SessionState {
  id: string;
  createdAt: string;
  activeSource: SourceId | null;
  chat: ChatMessage[];
  connections: {
    bigquery: BigQueryConnection;
    powerbi: PowerBIConnection;
  };
}

export interface PublicSessionState {
  id: string;
  createdAt: string;
  activeSource: SourceId | null;
  chat: ChatMessage[];
  connections: {
    bigquery: Omit<BigQueryConnection, "access" | "oauthState">;
    powerbi: Omit<PowerBIConnection, "access" | "oauthState">;
  };
}

export interface PlannedExecution {
  source: SourceId;
  clarification?: string;
  question: string;
  queryText: string;
  intent: string;
}

export interface ExecutionResult {
  answer: string;
  preview: Record<string, string | number>[];
}
