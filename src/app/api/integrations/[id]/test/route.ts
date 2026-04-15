import { NextResponse } from "next/server";

import { getIntegrationById, updateIntegration } from "@/lib/integration-store";
import { getProviderAdapter } from "@/lib/providers";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  const integration = getIntegrationById(id);
  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  if (integration.status === "unconfigured") {
    return NextResponse.json({ error: "Integration is not configured" }, { status: 400 });
  }

  const adapter = getProviderAdapter(integration.provider);
  const testedAt = new Date().toISOString();

  try {
    const result = await adapter.testConnection(integration.authConfig, integration.providerFields, integration.id);

    updateIntegration(id, {
      healthState: result.success ? "healthy" : "unreachable",
      status: result.success ? "configured" : "error",
      lastCheckedAt: testedAt
    });

    return NextResponse.json({
      success: result.success,
      error: result.error,
      provider: integration.provider,
      testedAt
    });
  } catch (err) {
    updateIntegration(id, {
      healthState: "unreachable",
      status: "error",
      lastCheckedAt: testedAt
    });

    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : "Connection test failed",
      provider: integration.provider,
      testedAt
    });
  }
}
