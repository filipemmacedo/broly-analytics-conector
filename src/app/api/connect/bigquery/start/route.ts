import { NextResponse } from "next/server";

import { buildBigQueryAuthUrl, markBigQueryConnectionUnavailable } from "@/lib/connectors/bigquery";
import { ensureSession } from "@/lib/session";
import { mutateSession } from "@/lib/store";

export async function GET(request: Request) {
  const { session, sessionId } = await ensureSession();
  const origin = new URL(request.url).origin;
  const authUrl = buildBigQueryAuthUrl(origin, session);

  if (!authUrl) {
    await mutateSession(sessionId, (current) =>
      markBigQueryConnectionUnavailable(current, "BigQuery OAuth is not configured yet.")
    );
    return NextResponse.redirect(new URL("/", request.url));
  }

  await mutateSession(sessionId, () => session);
  return NextResponse.redirect(authUrl);
}
