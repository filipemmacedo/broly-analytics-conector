import type { AuthConfig, ProviderFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

async function getAccessToken(authConfig: AuthConfig, providerFields: ProviderFields): Promise<string> {
  const fields = providerFields as { tenantId?: string; clientId?: string };
  const tenantId = fields.tenantId ?? "common";

  if (authConfig.authType === "oauth2") {
    return authConfig.accessToken;
  }

  if (authConfig.authType === "api-key") {
    // Treat API key as a bearer token for validation
    return authConfig.apiKey;
  }

  if (authConfig.authType === "token-endpoint") {
    // Exchange client credentials for a token
    const clientId = fields.clientId ?? "";
    const clientSecret = authConfig.token;
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://analysis.windows.net/powerbi/api/.default"
    });

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      { method: "POST", body }
    );

    if (!response.ok) {
      throw new Error(`Token endpoint returned ${response.status}`);
    }

    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("No access_token in response");
    return data.access_token;
  }

  throw new Error("Unsupported auth type for Power BI");
}

export async function testConnection(authConfig: AuthConfig, providerFields: ProviderFields): Promise<TestResult> {
  try {
    const token = await getAccessToken(authConfig, providerFields);

    const response = await fetch("https://api.powerbi.com/v1.0/myorg/groups", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `Power BI API returned ${response.status}: ${text.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Power BI connection test failed" };
  }
}
