import type { AuthConfig, ProviderFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

async function getAccessToken(authConfig: AuthConfig): Promise<string> {
  if (authConfig.authType === "oauth2") {
    return authConfig.accessToken;
  }

  if (authConfig.authType === "token-endpoint") {
    return authConfig.token;
  }

  if (authConfig.authType === "service-account") {
    // Validate JSON structure; full signing requires a JWT library.
    const sa = JSON.parse(authConfig.serviceAccountJson) as Record<string, unknown>;
    if (!sa["client_email"] || !sa["private_key"]) {
      throw new Error("Service account JSON is missing client_email or private_key");
    }
    throw new Error(
      "Service account token minting requires a JWT library. Please validate using an access token or install a signing dependency."
    );
  }

  throw new Error("Unsupported auth type for BigQuery");
}

export async function testConnection(authConfig: AuthConfig, providerFields: ProviderFields): Promise<TestResult> {
  const fields = providerFields as { projectId?: string; dataset?: string };
  const projectId = fields.projectId;
  const dataset = fields.dataset;

  if (!projectId || !dataset) {
    return { success: false, error: "Project ID and dataset are required for BigQuery" };
  }

  try {
    const token = await getAccessToken(authConfig);

    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${dataset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `BigQuery API returned ${response.status}: ${text.slice(0, 200)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "BigQuery connection test failed" };
  }
}
