import { getIntegrationById, updateIntegration } from "@/lib/integration-store";
import type { AuthConfig, OAuth2CodeFlowAuthConfig, ProviderFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

async function refreshAccessToken(
  integrationId: string,
  auth: OAuth2CodeFlowAuthConfig
): Promise<string> {
  if (!auth.refreshToken) {
    throw new Error("No refresh token available. Please reconnect BigQuery.");
  }

  const body = new URLSearchParams({
    client_id: auth.clientId,
    client_secret: auth.clientSecret,
    refresh_token: auth.refreshToken,
    grant_type: "refresh_token"
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text.slice(0, 200)}`);
  }

  const payload = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const newExpiresAt = payload.expires_in
    ? Date.now() + payload.expires_in * 1000
    : undefined;

  updateIntegration(integrationId, {
    authConfig: {
      ...auth,
      accessToken: payload.access_token,
      ...(newExpiresAt ? { expiresAt: newExpiresAt } : {})
    }
  });

  return payload.access_token;
}

export async function getFreshAccessToken(integrationId: string): Promise<string> {
  const integration = getIntegrationById(integrationId);
  if (!integration) throw new Error("BigQuery integration not found");

  const auth = integration.authConfig as OAuth2CodeFlowAuthConfig;

  if (!auth.accessToken) {
    throw new Error("OAuth flow not completed — click Connect with Google first");
  }

  const BUFFER_MS = 5 * 60 * 1000;
  const isExpiredOrExpiringSoon =
    auth.expiresAt && auth.expiresAt - Date.now() < BUFFER_MS;

  if (isExpiredOrExpiringSoon) {
    return refreshAccessToken(integrationId, auth);
  }

  return auth.accessToken;
}

export async function testConnection(
  authConfig: AuthConfig,
  providerFields: ProviderFields,
  integrationId?: string
): Promise<TestResult> {
  const fields = providerFields as { projectId?: string };
  const projectId = fields.projectId;

  if (!projectId) {
    return { success: false, error: "GCP Project ID is required for BigQuery" };
  }

  // Resolve access token — prefer stored token for oauth2-code-flow
  let accessToken: string | null = null;

  if (integrationId) {
    const integration = getIntegrationById(integrationId);
    const auth = integration?.authConfig as OAuth2CodeFlowAuthConfig | undefined;
    accessToken = auth?.accessToken ?? null;
  } else if (authConfig.authType === "oauth2-code-flow") {
    accessToken = (authConfig as OAuth2CodeFlowAuthConfig).accessToken ?? null;
  }

  if (!accessToken) {
    return { success: false, error: "BigQuery OAuth not completed — click Connect with Google first" };
  }

  try {
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/ga4analytics`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      let message = `BigQuery API returned ${response.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch { /* use default */ }
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "BigQuery connection test failed" };
  }
}
