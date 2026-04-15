import { NextResponse } from "next/server";

import { handleQuestion } from "@/lib/orchestrator";
import { ensureSession } from "@/lib/session";
import { getLLMSettings } from "@/lib/llm-settings-store";
import { getAllIntegrations } from "@/lib/integration-store";
import { mutateSession, toPublicSessionState } from "@/lib/store";
import type { GoogleAnalyticsFields, OAuth2CodeFlowAuthConfig, OAuth2AuthConfig } from "@/types/integration";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: string };

  if (!body.question?.trim()) {
    return NextResponse.json("Question is required.", { status: 400 });
  }

  // Resolve GA4 active property, access token, and LLM config server-side for every request
  const integrations = getAllIntegrations();
  const ga4 = integrations.find((i) => i.provider === "google-analytics");
  const ga4Fields = ga4?.providerFields as GoogleAnalyticsFields | undefined;
  const ga4PropertyId = ga4Fields?.propertyId || null;

  // Extract GA4 access token from the stored auth config
  let ga4AccessToken: string | null = null;
  if (ga4?.authConfig) {
    const auth = ga4.authConfig;
    if (auth.authType === "oauth2") {
      ga4AccessToken = (auth as OAuth2AuthConfig).accessToken || null;
    } else if (auth.authType === "oauth2-code-flow") {
      ga4AccessToken = (auth as OAuth2CodeFlowAuthConfig).accessToken || null;
    }
  }

  const llmSettings = getLLMSettings();
  const llmConfig = llmSettings
    ? { provider: llmSettings.provider, model: llmSettings.model, apiKey: llmSettings.apiKey }
    : null;

  const { sessionId } = await ensureSession();
  const updated = await mutateSession(
    sessionId,
    async (session) =>
      handleQuestion(session, body.question!.trim(), {
        ga4PropertyId,
        ga4AccessToken,
        llmConfig
      })
  );

  return NextResponse.json(toPublicSessionState(updated));
}
