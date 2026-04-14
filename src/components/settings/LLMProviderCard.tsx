"use client";

import { useEffect, useState } from "react";

import type { LLMModel, LLMProvider, PublicLLMSettings } from "@/types/llm";

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

  // Load existing config on mount
  useEffect(() => {
    void loadSettings();
  }, []);

  // Reload models whenever provider changes
  useEffect(() => {
    void loadModels(provider);
  }, [provider]);

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings/llm");
      if (res.ok) {
        const data = (await res.json()) as PublicLLMSettings | { provider: null };
        if (data.provider) {
          const settings = data as PublicLLMSettings;
          setProvider(settings.provider);
          setModel(settings.model);
          setApiKey(settings.apiKeyMasked);
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
        // Reset model selection only when provider changes explicitly (not on initial load)
        setModel((prev) => {
          const stillValid = data.models.some((m) => m.id === prev);
          return stillValid ? prev : (data.models[0]?.id ?? "");
        });
      }
    } catch {
      setModels([]);
    }
  }

  function handleProviderChange(p: LLMProvider) {
    setProvider(p);
    setModel(""); // will be reset by loadModels effect
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch("/api/settings/llm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey })
      });
      await loadSettings();
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
      if (data.ok) {
        setTestState("success");
        setTestMessage(`Connected — ${data.latencyMs ?? 0}ms`);
      } else {
        setTestState("error");
        setTestMessage(data.error ?? "Connection failed");
      }
    } catch {
      setTestState("error");
      setTestMessage("Connection test failed");
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
      </div>

      <div className="integration-form">
        <label className="form-field">
          <span>Provider</span>
          <select
            onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
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
