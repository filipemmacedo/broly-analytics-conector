import { NextResponse } from "next/server";

import { getIntegrationStatusSummaries } from "@/lib/integration-store";

export async function GET() {
  return NextResponse.json(getIntegrationStatusSummaries());
}
