import type { AuthConfig, ProviderFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

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

export async function testConnection(authConfig: AuthConfig, providerFields: ProviderFields): Promise<TestResult> {
  const fields = providerFields as { propertyId?: string };
  const propertyId = fields.propertyId;

  if (!propertyId) {
    return { success: false, error: "Property ID is required for Google Analytics" };
  }

  try {
    const token = await getAccessToken(authConfig);

    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}/metadata`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `GA4 API returned ${response.status}: ${text.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Google Analytics connection test failed" };
  }
}
