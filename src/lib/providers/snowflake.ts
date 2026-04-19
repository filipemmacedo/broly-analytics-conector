import type { ApiKeyAuthConfig, AuthConfig, ProviderFields, SnowflakeFields } from "@/types/integration";

type TestResult = { success: boolean; error?: string };

async function runSnowflakeStatement(
  token: string,
  accountId: string,
  statement: string,
  warehouse?: string,
  database?: string,
  schema?: string,
  timeout = 10
): Promise<Response> {
  const body: Record<string, unknown> = { statement, timeout };
  if (warehouse) body.warehouse = warehouse;
  if (database) body.database = database;   // Snowflake REST API accepts the raw name here
  if (schema) body.schema = schema;

  return fetch(
    `https://${accountId}.snowflakecomputing.com/api/v2/statements`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Snowflake-Authorization-Token-Type": "PROGRAMMATIC_ACCESS_TOKEN",
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body)
    }
  );
}

export async function testConnection(
  authConfig: AuthConfig,
  providerFields: ProviderFields
): Promise<TestResult> {
  const fields = providerFields as SnowflakeFields;
  const { accountId } = fields;

  if (!accountId?.trim()) {
    return { success: false, error: "Snowflake account identifier is required" };
  }

  const auth = authConfig as ApiKeyAuthConfig;
  const token = auth.apiKey;

  if (!token?.trim()) {
    return { success: false, error: "Snowflake PAT token is required" };
  }

  try {
    const response = await runSnowflakeStatement(
      token,
      accountId,
      "SELECT CURRENT_TIMESTAMP()",
      fields.warehouse,
      fields.database,
      fields.schema
    );

    if (response.ok) {
      return { success: true };
    }

    const text = await response.text();
    let message = `Snowflake API returned ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      if (parsed.message) message = parsed.message;
    } catch { /* use default */ }

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: "Invalid or expired PAT token. Please regenerate it in Snowflake." };
    }

    return { success: false, error: message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Snowflake connection test failed";
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND")) {
      return { success: false, error: `Could not reach account '${accountId}'. Check your account identifier (e.g. xy12345.us-east-1).` };
    }
    return { success: false, error: msg };
  }
}

export { runSnowflakeStatement };
