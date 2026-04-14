import { GoogleAuth } from "google-auth-library";

export interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

/**
 * Lists all GA4 properties accessible to the given service account credentials.
 * Mints a short-lived access token from the service account JSON, then calls
 * the GA4 Admin API to enumerate properties across all accounts.
 */
async function fetchProperties(token: string): Promise<GA4Property[]> {
  const response = await fetch(
    "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (response.status === 401 || response.status === 403) {
    const body = await response.text();
    let message = `Auth error (${response.status})`;
    try {
      const json = JSON.parse(body) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch { /* use default */ }
    throw new Error(message);
  }

  if (!response.ok) {
    const body = await response.text();
    let message = `Admin API error (${response.status})`;
    try {
      const json = JSON.parse(body) as { error?: { message?: string } };
      if (json.error?.message) message = json.error.message;
    } catch { /* use default */ }
    throw new Error(message);
  }

  const data = (await response.json()) as {
    accountSummaries?: Array<{
      account: string;
      displayName: string;
      propertySummaries?: Array<{ property: string; displayName: string }>;
    }>;
  };

  const results: GA4Property[] = [];
  for (const account of data.accountSummaries ?? []) {
    for (const prop of account.propertySummaries ?? []) {
      results.push({
        propertyId: prop.property,       // "properties/XXXXXXXXX"
        displayName: prop.displayName,
        accountName: account.displayName
      });
    }
  }
  return results;
}

/**
 * Lists GA4 properties using an OAuth2 access token.
 */
export async function listGA4PropertiesWithToken(accessToken: string): Promise<GA4Property[]> {
  return fetchProperties(accessToken);
}

/**
 * Lists GA4 properties using service account credentials (mints a JWT).
 */
export async function listGA4Properties(serviceAccountJson: string): Promise<GA4Property[]> {
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(serviceAccountJson) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid service account JSON");
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"]
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  if (!token) {
    throw new Error("Failed to obtain access token from service account credentials");
  }

  return fetchProperties(token);
}
