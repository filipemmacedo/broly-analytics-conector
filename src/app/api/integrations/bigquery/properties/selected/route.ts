import { NextResponse } from "next/server";

import { getAllIntegrations, updateIntegration } from "@/lib/integration-store";
import type { BigQueryFields } from "@/types/integration";

export async function GET() {
  const integration = getAllIntegrations().find((i) => i.provider === "bigquery");
  if (!integration) {
    return NextResponse.json({ propertyId: null });
  }
  const fields = integration.providerFields as BigQueryFields;
  return NextResponse.json({ propertyId: fields.propertyId || null });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { propertyId?: string; propertyName?: string };
  const { propertyId, propertyName } = body;

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 });
  }

  const integration = getAllIntegrations().find((i) => i.provider === "bigquery");
  if (!integration) {
    return NextResponse.json({ error: "No BigQuery integration found" }, { status: 404 });
  }

  const updated = updateIntegration(integration.id, {
    providerFields: {
      ...integration.providerFields,
      propertyId,
      propertyName: propertyName ?? propertyId
    }
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
