import { NextResponse } from "next/server";

import { getPublicLLMSettings, saveLLMSettings } from "@/lib/llm-settings-store";
import type { LLMProvider } from "@/types/llm";

const VALID_PROVIDERS = new Set<LLMProvider>(["anthropic", "openai", "google", "mistral"]);

export async function GET() {
  const settings = getPublicLLMSettings();
  if (!settings) {
    return NextResponse.json({ provider: null, model: null, apiKeyMasked: null, configuredAt: null, status: null, lastTestedAt: null });
  }
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    provider?: string;
    model?: string;
    apiKey?: string;
  };

  if (!body.provider || !VALID_PROVIDERS.has(body.provider as LLMProvider)) {
    return NextResponse.json({ error: "provider is required and must be one of: anthropic, openai, google, mistral" }, { status: 400 });
  }

  if (!body.model?.trim()) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  const result = saveLLMSettings({
    provider: body.provider as LLMProvider,
    model: body.model,
    apiKey: body.apiKey ?? ""
  });

  return NextResponse.json(result);
}
