import { NextResponse } from "next/server";

import { completePowerBIOAuth } from "@/lib/connectors/powerbi";
import { ensureSession } from "@/lib/session";
import { mutateSession } from "@/lib/store";

export async function GET(request: Request) {
  const { sessionId } = await ensureSession();
  const url = new URL(request.url);

  await mutateSession(sessionId, (session) => completePowerBIOAuth(session, url.searchParams, url.origin));

  return NextResponse.redirect(new URL("/", request.url));
}
