export type LLMProvider = "anthropic" | "openai" | "google" | "mistral";

export type LLMStatus = "unconfigured" | "configured" | "ok" | "error";

export interface LLMModel {
  id: string;
  displayName: string;
}

export interface LLMSettings {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  configuredAt: string;
  status: LLMStatus;
  lastTestedAt: string | null;
}

export interface PublicLLMSettings {
  provider: LLMProvider;
  model: string;
  apiKeyMasked: string;
  configuredAt: string;
  status: LLMStatus;
  lastTestedAt: string | null;
}
