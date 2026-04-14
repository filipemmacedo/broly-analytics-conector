import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getRedirectUri } from "@/lib/env";
import { getAllIntegrations } from "@/lib/integration-store";
import type { OAuth2CodeFlowAuthConfig } from "@/types/integration";

export const GA4_OAUTH_STATE_COOKIE = "ga4_oauth_state";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const base = "/settings/integrations/google-analytics";

  const integration = getAllIntegrations().find((i) => i.provider === "google-analytics");
  const authConfig = integration?.authConfig as OAuth2CodeFlowAuthConfig | undefined;

  if (!authConfig || authConfig.authType !== "oauth2-code-flow" || !authConfig.clientId) {
    return NextResponse.redirect(
      new URL(`${base}?ga4_error=not_configured`, request.url)
    );
  }

  const state = randomUUID();

  const cookieStore = await cookies();
  cookieStore.set(GA4_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", authConfig.clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(origin, "ga4"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/analytics.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
