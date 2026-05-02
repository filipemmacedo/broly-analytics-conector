import { NextResponse } from "next/server";

import { getAllIntegrations, updateIntegration } from "@/lib/integration-store";
import { listGA4PropertiesWithToken } from "@/lib/providers/ga4-admin";
import type { OAuth2CodeFlowAuthConfig } from "@/types/integration";

async function getFreshToken(integrationId: string, auth: OAuth2CodeFlowAuthConfig): Promise<string> {
  const BUFFER_MS = 5 * 60 * 1000;
  const isExpiredOrExpiringSoon = auth.expiresAt && auth.expiresAt - Date.now() < BUFFER_MS;

  if (!isExpiredOrExpiringSoon) return auth.accessToken!;

  if (!auth.refreshToken) throw new Error("No refresh token — reconnect with Google.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: auth.clientId,
      client_secret: auth.clientSecret,
      refresh_token: auth.refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${(await res.text()).slice(0, 200)}`);

  const payload = (await res.json()) as { access_token: string; expires_in?: number };
  const newExpiresAt = payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined;

  updateIntegration(integrationId, {
    authConfig: { ...auth, accessToken: payload.access_token, ...(newExpiresAt ? { expiresAt: newExpiresAt } : {}) }
  });

  return payload.access_token;
}

export async function GET() {
  const integration = getAllIntegrations().find((i) => i.provider === "bigquery");

  if (!integration) {
    return NextResponse.json(
      { error: "No BigQuery integration found" },
      { status: 404 }
    );
  }

  const authConfig = integration.authConfig as OAuth2CodeFlowAuthConfig | undefined;

  if (authConfig?.authType !== "oauth2-code-flow" || !authConfig.accessToken) {
    return NextResponse.json(
      { error: "BigQuery OAuth not completed — connect with Google first" },
      { status: 400 }
    );
  }

  try {
    const token = await getFreshToken(integration.id, authConfig);
    const properties = await listGA4PropertiesWithToken(token);
    return NextResponse.json(properties);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list GA4 properties";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
