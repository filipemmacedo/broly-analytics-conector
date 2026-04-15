import { NextRequest, NextResponse } from "next/server";

import { getModelsForProvider, LLM_MODELS } from "@/lib/llm-model-registry";
import type { LLMProvider } from "@/types/llm";

const VALID_PROVIDERS = new Set<LLMProvider>(["anthropic", "openai", "google", "mistral"]);

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider");

  if (!provider) {
    return NextResponse.json(LLM_MODELS);
  }

  if (!VALID_PROVIDERS.has(provider as LLMProvider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  return NextResponse.json({ models: getModelsForProvider(provider as LLMProvider) });
}
