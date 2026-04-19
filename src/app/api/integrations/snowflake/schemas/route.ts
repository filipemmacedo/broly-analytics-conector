import { NextResponse } from "next/server";

import { getAllIntegrations } from "@/lib/integration-store";
import { runSnowflakeStatement } from "@/lib/providers/snowflake";
import type { ApiKeyAuthConfig, SnowflakeFields } from "@/types/integration";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const database = searchParams.get("database");

  if (!database) {
    return NextResponse.json({ error: "database query param is required" }, { status: 400 });
  }

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
    const res = await runSnowflakeStatement(
      auth.apiKey,
      fields.accountId,
      `SHOW SCHEMAS IN DATABASE "${database}"`
    );

    if (!res.ok) {
      const text = await res.text();
      let message = `Snowflake error ${res.status}`;
      try {
        const parsed = JSON.parse(text) as { message?: string };
        if (parsed.message) message = parsed.message;
      } catch { /* use default */ }
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = (await res.json()) as {
      data?: Array<Array<string>>;
    };

    // Snowflake SHOW commands: row[0] = created_on (timestamp), row[1] = name
    // Filter out system schemas that users should not query directly
    const SYSTEM_SCHEMAS = new Set(["INFORMATION_SCHEMA"]);
    const schemas = (data.data ?? [])
      .map((row) => row[1] ?? "")
      .filter((name) => Boolean(name) && !SYSTEM_SCHEMAS.has(name.toUpperCase()));
    return NextResponse.json({ schemas });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load schemas";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
