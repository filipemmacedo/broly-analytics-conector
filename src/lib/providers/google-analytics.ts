import { getIntegrationById, updateIntegration } from "@/lib/integration-store";
import type { AuthConfig, OAuth2CodeFlowAuthConfig, ProviderFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

// Refresh a Google OAuth2 access token using the stored refresh token.
// Updates the integration store with the new token and returns it.
async function refreshAccessToken(
  integrationId: string,
  auth: OAuth2CodeFlowAuthConfig
): Promise<string> {
  if (!auth.refreshToken) {
    throw new Error("No refresh token available. Please reconnect Google Analytics.");
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

// Returns a valid (non-expired) access token, refreshing automatically if needed.
export async function getFreshAccessToken(integrationId: string): Promise<string> {
  const integration = getIntegrationById(integrationId);
  if (!integration) throw new Error("Google Analytics integration not found");

  const auth = integration.authConfig;

  if (auth.authType === "oauth2") {
    return auth.accessToken;
  }

  if (auth.authType === "oauth2-code-flow") {
    if (!auth.accessToken) {
      throw new Error("OAuth flow not completed — click Connect with Google first");
    }

    // Refresh proactively if token expires within the next 5 minutes
    const BUFFER_MS = 5 * 60 * 1000;
    const isExpiredOrExpiringSoon =
      auth.expiresAt && auth.expiresAt - Date.now() < BUFFER_MS;

    if (isExpiredOrExpiringSoon) {
      return refreshAccessToken(integrationId, auth);
    }

    return auth.accessToken;
  }

  throw new Error("Unsupported auth type for Google Analytics");
}

async function getAccessToken(authConfig: AuthConfig): Promise<string> {
  if (authConfig.authType === "oauth2") {
    return authConfig.accessToken;
  }

  if (authConfig.authType === "oauth2-code-flow") {
    if (!authConfig.accessToken) {
      throw new Error("OAuth flow not completed — click Connect with Google first");
    }
    return authConfig.accessToken;
  }

  if (authConfig.authType === "service-account") {
    // Service account JSON contains credentials needed to mint a JWT
    // For now, parse and verify the JSON is valid; full JWT minting requires
    // a JWT library which is not yet installed.
    const sa = JSON.parse(authConfig.serviceAccountJson) as Record<string, unknown>;
    if (!sa["client_email"] || !sa["private_key"]) {
      throw new Error("Service account JSON is missing client_email or private_key");
    }
    // Return a placeholder — actual OAuth2 token minting from service account
    // requires signing a JWT. The test will verify JSON structure only.
    throw new Error(
      "Service account token minting requires a JWT library. Please validate using OAuth or install a signing dependency."
    );
  }

  throw new Error("Unsupported auth type for Google Analytics");
}

export async function testConnection(
  authConfig: AuthConfig,
  providerFields: ProviderFields,
  integrationId?: string
): Promise<TestResult> {
  const fields = providerFields as { propertyId?: string };
  const propertyId = fields.propertyId;

  if (!propertyId) {
    return { success: false, error: "Property ID is required for Google Analytics" };
  }

  try {
    // Use getFreshAccessToken when integrationId is provided so expired tokens
    // are automatically refreshed. Fall back to the raw token for legacy callers.
    const token = integrationId
      ? await getFreshAccessToken(integrationId)
      : await getAccessToken(authConfig);

    // Step 1: verify the token and property are valid via metadata
    const metaRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}/metadata`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!metaRes.ok) {
      const text = await metaRes.text();
      let message = `GA4 API error ${metaRes.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch { /* use default */ }
      return { success: false, error: message };
    }

    // Step 2: run a minimal report (sessions, last 1 day) to confirm data access
    const reportRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          metrics: [{ name: "sessions" }],
          dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
          limit: 1
        })
      }
    );

    if (!reportRes.ok) {
      const text = await reportRes.text();
      let message = `GA4 report access error ${reportRes.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch { /* use default */ }
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Google Analytics connection test failed" };
  }
}
