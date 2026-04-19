import { NextResponse } from "next/server";

import { getLLMSettings, updateLLMTestResult } from "@/lib/llm-settings-store";
import { pingLLM } from "@/lib/llm-ping";

export async function POST() {
  const settings = getLLMSettings();

  if (!settings) {
    return NextResponse.json({ error: "No LLM configuration found" }, { status: 400 });
  }

  const result = await pingLLM(settings.provider, settings.apiKey, settings.model);
  updateLLMTestResult(result.ok);
  return NextResponse.json(result);
}
