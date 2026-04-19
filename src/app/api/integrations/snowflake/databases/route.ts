import { NextResponse } from "next/server";

import { getAllIntegrations } from "@/lib/integration-store";
import { runSnowflakeStatement } from "@/lib/providers/snowflake";
import type { ApiKeyAuthConfig, SnowflakeFields } from "@/types/integration";

async function runShow(
  token: string,
  accountId: string,
  statement: string
): Promise<string[]> {
  const res = await runSnowflakeStatement(token, accountId, statement);

  if (!res.ok) {
    const text = await res.text();
    let message = `Snowflake error ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch { /* use default */ }
    throw new Error(message);
  }

  const data = (await res.json()) as {
    resultSetMetaData?: { rowType?: Array<{ name: string }> };
    data?: Array<Array<string>>;
  };

  // Use the column metadata to find the "name" column index.
  // Column layout differs across SHOW commands:
  //   SHOW DATABASES / SHOW SCHEMAS: row[0]=created_on, row[1]=name
  //   SHOW WAREHOUSES:               row[0]=name,       row[1]=state
  const rowType = data.resultSetMetaData?.rowType ?? [];
  const nameIdx = rowType.findIndex((col) => col.name.toLowerCase() === "name");
  const idx = nameIdx >= 0 ? nameIdx : 1; // fall back to row[1] for DATABASES/SCHEMAS

  const names = (data.data ?? []).map((row) => row[idx] ?? "").filter(Boolean);
  // Deduplicate in case the same name appears more than once
  return [...new Set(names)];
}

export async function GET() {
  const integration = getAllIntegrations().find((i) => i.provider === "snowflake");

  if (!integration) {
    return NextResponse.json({ error: "No Snowflake integration found" }, { status: 404 });
  }

  const auth = integration.authConfig as ApiKeyAuthConfig;
  const fields = integration.providerFields as SnowflakeFields;

  if (!auth.apiKey || !fields.accountId) {
    return NextResponse.json(
      { error: "Snowflake credentials incomplete — set up the integration first" },
      { status: 400 }
    );
  }

  try {
    const [databases, warehouses] = await Promise.all([
      runShow(auth.apiKey, fields.accountId, "SHOW DATABASES"),
      runShow(auth.apiKey, fields.accountId, "SHOW WAREHOUSES")
    ]);

    return NextResponse.json({ databases, warehouses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load Snowflake metadata";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
