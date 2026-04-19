import { NextResponse } from "next/server";

import { getAllIntegrations, updateIntegration } from "@/lib/integration-store";
import type { SnowflakeFields } from "@/types/integration";

export async function GET() {
  const integration = getAllIntegrations().find((i) => i.provider === "snowflake");
  if (!integration) return NextResponse.json({ database: null, schema: null, warehouse: null });
  const fields = integration.providerFields as SnowflakeFields;
  return NextResponse.json({
    database: fields.database ?? null,
    schema: fields.schema ?? null,
    warehouse: fields.warehouse ?? null
  });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    database?: string;
    schema?: string;
    warehouse?: string;
  };

  const integration = getAllIntegrations().find((i) => i.provider === "snowflake");
  if (!integration) {
    return NextResponse.json({ error: "No Snowflake integration found" }, { status: 404 });
  }

  // Merge with existing fields — callers only send the fields they own
  const existing = integration.providerFields as SnowflakeFields;
  const merged: SnowflakeFields = {
    accountId: existing.accountId,
    database:  "database"  in body ? (body.database  ?? "") : (existing.database  ?? ""),
    schema:    "schema"    in body ? (body.schema    ?? "") : (existing.schema    ?? ""),
    warehouse: "warehouse" in body ? (body.warehouse ?? "") : (existing.warehouse ?? "")
  };

  const updated = updateIntegration(integration.id, {
    providerFields: merged
  });

  if (!updated) {
    return NextResponse.json({ error: "Failed to update integration" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
