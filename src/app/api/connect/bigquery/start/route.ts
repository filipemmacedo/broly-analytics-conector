import { NextResponse } from "next/server";

import { buildBigQueryAuthUrl, connectBigQueryDemo } from "@/lib/connectors/bigquery";
import { ensureSession } from "@/lib/session";
import { mutateSession } from "@/lib/store";

export async function GET(request: Request) {
  const { session, sessionId } = await ensureSession();
  const origin = new URL(request.url).origin;
  const authUrl = buildBigQueryAuthUrl(origin, session);

  if (!authUrl) {
    await mutateSession(sessionId, (current) => connectBigQueryDemo(current));
    return NextResponse.redirect(new URL("/", request.url));
  }

  await mutateSession(sessionId, () => session);
  return NextResponse.redirect(authUrl);
}
