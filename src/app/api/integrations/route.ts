import { NextResponse } from "next/server";

import { createIntegration, getAllIntegrations, toPublicIntegration } from "@/lib/integration-store";
import type { AuthConfig, IntegrationProvider } from "@/types/integration";

export async function GET() {
  const integrations = getAllIntegrations();
  return NextResponse.json(integrations.map(toPublicIntegration));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    provider?: IntegrationProvider;
    displayName?: string;
    authConfig?: AuthConfig;
    providerFields?: unknown;
  };

  if (!body.provider || !body.displayName || !body.authConfig || !body.providerFields) {
    return NextResponse.json(
      { error: "provider, displayName, authConfig, and providerFields are required" },
      { status: 400 }
    );
  }

  const integration = createIntegration({
    provider: body.provider,
    displayName: body.displayName,
    authConfig: body.authConfig,
    providerFields: body.providerFields as never
  });

  return NextResponse.json(toPublicIntegration(integration), { status: 201 });
}
