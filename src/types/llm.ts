export type LLMProvider = "anthropic" | "openai" | "google" | "mistral";

export interface LLMModel {
  id: string;
  displayName: string;
}

export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  configuredAt: string;
}

export interface PublicLLMSettings {
  provider: LLMProvider;
  model: string;
  apiKeyMasked: string;
  configuredAt: string;
}
