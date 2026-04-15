import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getRedirectUri } from "@/lib/env";
import { createIntegration, getAllIntegrations, updateIntegration } from "@/lib/integration-store";
import type { OAuth2CodeFlowAuthConfig } from "@/types/integration";

import { GA4_OAUTH_STATE_COOKIE } from "../start/route";

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number; scope?: string }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
    scope: payload.scope
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(GA4_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GA4_OAUTH_STATE_COOKIE);

  const base = "/settings/integrations/google-analytics";

  if (error) {
    return NextResponse.redirect(new URL(`${base}?ga4_error=${encodeURIComponent(error)}`, request.url));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL(`${base}?ga4_error=state_mismatch`, request.url));
  }

  const existing = getAllIntegrations().find((i) => i.provider === "google-analytics");
  const authConfig = existing?.authConfig as OAuth2CodeFlowAuthConfig | undefined;

  if (!authConfig || authConfig.authType !== "oauth2-code-flow" || !authConfig.clientId || !authConfig.clientSecret) {
    return NextResponse.redirect(new URL(`${base}?ga4_error=not_configured`, request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(
      code,
      authConfig.clientId,
      authConfig.clientSecret,
      getRedirectUri(url.origin, "ga4")
    );

    if (existing) {
      updateIntegration(existing.id, {
        authConfig: {
          authType: "oauth2-code-flow",
          clientId: authConfig.clientId,
          clientSecret: authConfig.clientSecret,
          accessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
          ...(tokens.scope ? { scope: tokens.scope } : {})
        },
        status: "configured"
      });
    } else {
      createIntegration({
        provider: "google-analytics",
        displayName: "Google Analytics 4",
        authConfig: {
          authType: "oauth2-code-flow",
          clientId: authConfig.clientId,
          clientSecret: authConfig.clientSecret,
          accessToken: tokens.accessToken,
          ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
          ...(tokens.expiresAt ? { expiresAt: tokens.expiresAt } : {}),
          ...(tokens.scope ? { scope: tokens.scope } : {})
        },
        providerFields: { propertyId: "" }
      });
    }

    return NextResponse.redirect(new URL(`${base}?ga4_connected=1`, request.url));
  } catch (err) {
    const message = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(new URL(`${base}?ga4_error=${encodeURIComponent(message)}`, request.url));
  }
}
