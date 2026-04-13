import { NextResponse } from "next/server";

import { deleteIntegration, getIntegrationById, toPublicIntegration, updateIntegration } from "@/lib/integration-store";
import type { AuthConfig } from "@/types/integration";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    displayName?: string;
    authConfig?: Partial<AuthConfig>;
    providerFields?: unknown;
  };

  const existing = getIntegrationById(id);
  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const updated = updateIntegration(id, {
    displayName: body.displayName,
    authConfig: body.authConfig,
    providerFields: body.providerFields as never
  });

  if (!updated) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(toPublicIntegration(updated));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const removed = deleteIntegration(id);
  if (!removed) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
