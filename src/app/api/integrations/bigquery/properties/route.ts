import { NextResponse } from "next/server";

import { getAllIntegrations } from "@/lib/integration-store";
import { listGA4PropertiesWithToken } from "@/lib/providers/ga4-admin";
import type { OAuth2CodeFlowAuthConfig } from "@/types/integration";

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
    const properties = await listGA4PropertiesWithToken(authConfig.accessToken);
    return NextResponse.json(properties);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list GA4 properties";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
