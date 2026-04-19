"use client";

import { useEffect, useState } from "react";

import { ConnectionStatusBadge } from "@/components/ui/ConnectionStatusBadge";
import type { HealthState, IntegrationStatus } from "@/types/integration";
import type { LLMModel, LLMProvider, LLMStatus, PublicLLMSettings } from "@/types/llm";

function llmStatusToProps(status: LLMStatus): { status: IntegrationStatus; healthState: HealthState } {
  switch (status) {
    case "ok":           return { status: "configured", healthState: "healthy" };
    case "error":        return { status: "error",      healthState: "unknown" };
    case "configured":   return { status: "configured", healthState: "unknown" };
    case "unconfigured": return { status: "unconfigured", healthState: "unknown" };
  }
}

const PROVIDERS: { id: LLMProvider; label: string }[] = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
  { id: "mistral", label: "Mistral" }
];

const MASKED_PREFIX = "••••••••";

type TestState = "idle" | "testing" | "success" | "error";

export function LLMProviderCard() {
  const [provider, setProvider] = useState<LLMProvider>("anthropic");
  const [model, setModel] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [models, setModels] = useState<LLMModel[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [llmStatus, setLlmStatus] = useState<LLMStatus>("unconfigured");
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);

  // Load existing config on mount
  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings/llm");
      if (res.ok) {
        const data = (await res.json()) as PublicLLMSettings | { provider: null };
        if (data.provider) {
          const settings = data as PublicLLMSettings;
          // Load models for the saved provider first, then set all state together
          // so there is no race between the initial models effect and this fetch.
          const modRes = await fetch(`/api/settings/llm/models?provider=${settings.provider}`);
          if (modRes.ok) {
            const modData = (await modRes.json()) as { models: LLMModel[] };
            setModels(modData.models);
          }
          setProvider(settings.provider);
          setModel(settings.model);
          setApiKey(settings.apiKeyMasked);
          setLlmStatus(settings.status ?? "configured");
          setLastTestedAt(settings.lastTestedAt ?? null);
        } else {
          // No saved config yet — load models for the default provider
          await loadModels("anthropic");
        }
      }
    } finally {
      setIsLoaded(true);
    }
  }

  async function loadModels(p: LLMProvider) {
    try {
      const res = await fetch(`/api/settings/llm/models?provider=${p}`);
      if (res.ok) {
        const data = (await res.json()) as { models: LLMModel[] };
        setModels(data.models);
        setModel(data.models[0]?.id ?? "");
      }
    } catch {
      setModels([]);
    }
  }

  async function handleProviderChange(p: LLMProvider) {
    setProvider(p);
    await loadModels(p);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey })
      });
      if (res.ok) {
        const saved = (await res.json()) as PublicLLMSettings;
        setLlmStatus(saved.status ?? "configured");
        setLastTestedAt(saved.lastTestedAt ?? null);
        setApiKey(saved.apiKeyMasked);
      } else {
        await loadSettings();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTest() {
    setTestState("testing");
    setTestMessage(null);
    try {
      const res = await fetch("/api/settings/llm/test", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; latencyMs?: number; error?: string };
      const now = new Date().toISOString();
      if (data.ok) {
        setTestState("success");
        setTestMessage(`Connected — ${data.latencyMs ?? 0}ms`);
        setLlmStatus("ok");
        setLastTestedAt(now);
      } else {
        setTestState("error");
        setTestMessage(data.error ?? "Connection failed");
        setLlmStatus("error");
        setLastTestedAt(now);
      }
    } catch {
      setTestState("error");
      setTestMessage("Connection test failed");
      setLlmStatus("error");
      setLastTestedAt(new Date().toISOString());
    }
    setTimeout(() => { setTestState("idle"); setTestMessage(null); }, 5000);
  }

  if (!isLoaded) {
    return <div className="integration-card"><p className="form-hint">Loading…</p></div>;
  }

  return (
    <div className="integration-card">
      <div className="integration-card-header">
        <div>
          <h3>LLM Provider</h3>
          <p className="integration-card-description">
            Choose the AI provider and model that powers Broly&apos;s assistant.
          </p>
        </div>
        <ConnectionStatusBadge
          healthState={llmStatusToProps(llmStatus).healthState}
          lastCheckedAt={lastTestedAt}
          status={llmStatusToProps(llmStatus).status}
        />
      </div>

      <div className="integration-form">
        <label className="form-field">
          <span>Provider</span>
          <select
            onChange={(e) => void handleProviderChange(e.target.value as LLMProvider)}
            value={provider}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>Model</span>
          <select
            disabled={models.length === 0}
            onChange={(e) => setModel(e.target.value)}
            value={model}
          >
            {models.length === 0 && <option value="">Loading…</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span>API Key</span>
          <input
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`${MASKED_PREFIX}…`}
            type="password"
            value={apiKey}
          />
          <span className="form-hint">Stored encrypted. Only the last 4 characters are shown.</span>
        </label>
      </div>

      {testMessage ? (
        <p className={`integration-test-result ${testState}`}>{testMessage}</p>
      ) : null}

      <div className="integration-card-actions">
        <button
          className="btn-primary"
          disabled={isSaving || !model}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          className="btn-secondary"
          disabled={testState === "testing"}
          onClick={handleTest}
          type="button"
        >
          {testState === "testing" ? "Testing…" : "Test Connection"}
        </button>
      </div>
    </div>
  );
}
