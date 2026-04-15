import { NextResponse } from "next/server";

import { getAllIntegrations, updateIntegration } from "@/lib/integration-store";
import type { GoogleAnalyticsFields } from "@/types/integration";

function findGA4() {
  return getAllIntegrations().find((i) => i.provider === "google-analytics") ?? null;
}

export async function GET() {
  const ga4 = findGA4();
  if (!ga4) {
    return NextResponse.json({ propertyId: null });
  }

  const fields = ga4.providerFields as GoogleAnalyticsFields;
  return NextResponse.json({ propertyId: fields.propertyId || null });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as { propertyId?: string };

  if (!body.propertyId || !/^properties\/\d+$/.test(body.propertyId)) {
    return NextResponse.json({ error: "Invalid propertyId format" }, { status: 400 });
  }

  const ga4 = findGA4();
  if (!ga4) {
    return NextResponse.json({ error: "No Google Analytics integration found" }, { status: 404 });
  }

  const currentFields = ga4.providerFields as GoogleAnalyticsFields;
  const updated = updateIntegration(ga4.id, {
    providerFields: { ...currentFields, propertyId: body.propertyId }
  });

  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ propertyId: body.propertyId });
}
