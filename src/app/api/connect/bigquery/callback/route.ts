import { NextResponse } from "next/server";

import { completeBigQueryOAuth } from "@/lib/connectors/bigquery";
import { ensureSession } from "@/lib/session";
import { mutateSession } from "@/lib/store";

export async function GET(request: Request) {
  const { sessionId } = await ensureSession();
  const url = new URL(request.url);

  await mutateSession(sessionId, (session) => completeBigQueryOAuth(session, url.searchParams, url.origin));

  return NextResponse.redirect(new URL("/", request.url));
}
