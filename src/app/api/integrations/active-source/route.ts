import { NextResponse } from "next/server";

import { getAllIntegrations, setActiveSource } from "@/lib/integration-store";
import type { IntegrationProvider } from "@/types/integration";

const VALID_PROVIDERS: IntegrationProvider[] = ["google-analytics", "bigquery"];

export async function POST(request: Request) {
  const body = (await request.json()) as { provider?: string };
  const provider = body.provider as IntegrationProvider | undefined;

  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const integration = getAllIntegrations().find((i) => i.provider === provider);
  if (!integration) {
    return NextResponse.json({ error: "Integration not configured" }, { status: 404 });
  }

  setActiveSource(provider);
  return NextResponse.json({ success: true });
}
