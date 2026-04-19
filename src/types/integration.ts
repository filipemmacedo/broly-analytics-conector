export type IntegrationProvider = "powerbi" | "google-analytics" | "bigquery";

export type AuthType = "api-key" | "oauth2" | "service-account" | "token-endpoint" | "oauth2-code-flow";

export type IntegrationStatus = "configured" | "unconfigured" | "error" | "expired";

export type HealthState = "healthy" | "degraded" | "unreachable" | "unknown";

// Discriminated union auth configs — secrets are stored encrypted at rest
export type ApiKeyAuthConfig = {
  authType: "api-key";
  apiKey: string;
};

export type OAuth2AuthConfig = {
  authType: "oauth2";
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
};

export type ServiceAccountAuthConfig = {
  authType: "service-account";
  serviceAccountJson: string;
};

export type TokenEndpointAuthConfig = {
  authType: "token-endpoint";
  token: string;
  endpoint: string;
};

export type OAuth2CodeFlowAuthConfig = {
  authType: "oauth2-code-flow";
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
};

export type AuthConfig =
  | ApiKeyAuthConfig
  | OAuth2AuthConfig
  | ServiceAccountAuthConfig
  | TokenEndpointAuthConfig
  | OAuth2CodeFlowAuthConfig;

// Provider-specific extra fields stored alongside authConfig
export type PowerBIFields = {
  tenantId: string;
  clientId: string;
  workspaceId?: string;
};

export type GoogleAnalyticsFields = {
  propertyId: string;
};

export type BigQueryFields = {
  projectId: string;
  propertyId: string;
  propertyName: string;
  datasetId?: string;
};

export type ProviderFields = PowerBIFields | GoogleAnalyticsFields | BigQueryFields;

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  authType: AuthType;
  authConfig: AuthConfig;
  providerFields: ProviderFields;
  status: IntegrationStatus;
  healthState: HealthState;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Safe public view — secrets replaced with masked sentinel
export type MaskedAuthConfig =
  | { authType: "api-key"; apiKey: string }
  | { authType: "oauth2"; accessToken: string; refreshToken?: string; expiresAt?: number; scope?: string }
  | { authType: "service-account"; serviceAccountJson: string }
  | { authType: "token-endpoint"; token: string; endpoint: string }
  | { authType: "oauth2-code-flow"; clientId: string; clientSecret: string; accessToken?: string; refreshToken?: string; expiresAt?: number; scope?: string };

export interface PublicIntegration {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  authType: AuthType;
  authConfig: MaskedAuthConfig;
  providerFields: ProviderFields;
  status: IntegrationStatus;
  healthState: HealthState;
  isActive: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationStatusSummary {
  id: string;
  provider: IntegrationProvider;
  displayName: string;
  status: IntegrationStatus;
  healthState: HealthState;
  isActive: boolean;
  lastCheckedAt: string | null;
}
