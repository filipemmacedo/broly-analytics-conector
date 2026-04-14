import type { LLMModel, LLMProvider } from "@/types/llm";

export const LLM_MODELS: Record<LLMProvider, LLMModel[]> = {
  anthropic: [
    { id: "claude-opus-4-6", displayName: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", displayName: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", displayName: "Claude Haiku 4.5" }
  ],
  openai: [
    { id: "gpt-4o", displayName: "GPT-4o" },
    { id: "gpt-4o-mini", displayName: "GPT-4o Mini" },
    { id: "o3-mini", displayName: "o3 Mini" }
  ],
  google: [
    { id: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
    { id: "gemini-2.0-pro", displayName: "Gemini 2.0 Pro" },
    { id: "gemini-1.5-flash", displayName: "Gemini 1.5 Flash" }
  ],
  mistral: [
    { id: "mistral-large-latest", displayName: "Mistral Large" },
    { id: "mistral-small-latest", displayName: "Mistral Small" },
    { id: "open-mixtral-8x22b", displayName: "Mixtral 8x22B" }
  ]
};

export function getModelsForProvider(provider: LLMProvider): LLMModel[] {
  return LLM_MODELS[provider] ?? [];
}
