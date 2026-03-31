import { NextResponse } from "next/server";

import { buildPowerBIAuthUrl, markPowerBIConnectionUnavailable } from "@/lib/connectors/powerbi";
import { ensureSession } from "@/lib/session";
import { mutateSession } from "@/lib/store";

export async function GET(request: Request) {
  const { session, sessionId } = await ensureSession();
  const origin = new URL(request.url).origin;
  const authUrl = buildPowerBIAuthUrl(origin, session);

  if (!authUrl) {
    await mutateSession(sessionId, (current) =>
      markPowerBIConnectionUnavailable(current, "Power BI OAuth is not configured yet.")
    );
    return NextResponse.redirect(new URL("/", request.url));
  }

  await mutateSession(sessionId, () => session);
  return NextResponse.redirect(authUrl);
}
