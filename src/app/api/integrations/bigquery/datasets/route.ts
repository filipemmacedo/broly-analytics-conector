import { NextResponse } from "next/server";

import { getAllIntegrations } from "@/lib/integration-store";
import { getFreshAccessToken } from "@/lib/providers/bigquery";
import type { BigQueryFields, OAuth2CodeFlowAuthConfig } from "@/types/integration";

export async function GET() {
  const integration = getAllIntegrations().find((i) => i.provider === "bigquery");

  if (!integration) {
    return NextResponse.json({ error: "No BigQuery integration found" }, { status: 404 });
  }

  const authConfig = integration.authConfig as OAuth2CodeFlowAuthConfig | undefined;
  if (authConfig?.authType !== "oauth2-code-flow" || !authConfig.accessToken) {
    return NextResponse.json(
      { error: "BigQuery OAuth not completed — connect with Google first" },
      { status: 400 }
    );
  }

  const fields = integration.providerFields as BigQueryFields;
  const projectId = fields?.projectId;

  if (!projectId) {
    return NextResponse.json({ error: "GCP Project ID is not configured" }, { status: 400 });
  }

  try {
    const accessToken = await getFreshAccessToken(integration.id);
    const res = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      let message = `BigQuery API returned ${res.status}`;
      try {
        const parsed = JSON.parse(text) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch { /* use default */ }
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data = (await res.json()) as {
      datasets?: Array<{ datasetReference: { datasetId: string } }>;
    };

    const datasets = (data.datasets ?? []).map((d) => ({
      datasetId: d.datasetReference.datasetId
    }));

    return NextResponse.json(datasets);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list datasets";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
