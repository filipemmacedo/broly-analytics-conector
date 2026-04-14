import { NextResponse } from "next/server";

import { getLLMSettings } from "@/lib/llm-settings-store";
import { pingLLM } from "@/lib/llm-ping";

export async function POST() {
  const settings = getLLMSettings();

  if (!settings) {
    return NextResponse.json({ error: "No LLM configuration found" }, { status: 400 });
  }

  const result = await pingLLM(settings.provider, settings.apiKey, settings.model);
  return NextResponse.json(result);
}
