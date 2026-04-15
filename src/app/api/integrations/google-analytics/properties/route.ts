import { NextResponse } from "next/server";

import { getAllIntegrations } from "@/lib/integration-store";
import { listGA4Properties, listGA4PropertiesWithToken } from "@/lib/providers/ga4-admin";
import { getFreshAccessToken } from "@/lib/providers/google-analytics";

export async function GET() {
  const integrations = getAllIntegrations();
  const ga4 = integrations.find((i) => i.provider === "google-analytics");

  if (!ga4) {
    return NextResponse.json(
      { error: "No Google Analytics integration found" },
      { status: 404 }
    );
  }

  try {
    let properties;

    if (ga4.authConfig.authType === "service-account") {
      properties = await listGA4Properties(ga4.authConfig.serviceAccountJson);
    } else if (
      ga4.authConfig.authType === "oauth2" ||
      ga4.authConfig.authType === "oauth2-code-flow"
    ) {
      const token = await getFreshAccessToken(ga4.id);
      properties = await listGA4PropertiesWithToken(token);
    } else {
      return NextResponse.json(
        { error: "GA4 property listing requires service-account or OAuth2 credentials" },
        { status: 400 }
      );
    }

    return NextResponse.json(properties);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list GA4 properties";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
