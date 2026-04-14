import type { LLMProvider } from "@/types/llm";

export interface PingResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

async function pingAnthropic(apiKey: string, model: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }]
      })
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      return { ok: false, latencyMs, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Request failed" };
  }
}

async function pingOpenAI(apiKey: string, model: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }]
      })
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      return { ok: false, latencyMs, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Request failed" };
  }
}

async function pingGoogle(apiKey: string, model: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hi" }] }],
          generationConfig: { maxOutputTokens: 1 }
        })
      }
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      return { ok: false, latencyMs, error: data.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Request failed" };
  }
}

async function pingMistral(apiKey: string, model: string): Promise<PingResult> {
  const start = Date.now();
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1,
        messages: [{ role: "user", content: "Hi" }]
      })
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      const data = (await res.json()) as { error?: { message?: string } };
      return { ok: false, latencyMs, error: (data.error as unknown as { message?: string })?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : "Request failed" };
  }
}

export async function pingLLM(provider: LLMProvider, apiKey: string, model: string): Promise<PingResult> {
  switch (provider) {
    case "anthropic": return pingAnthropic(apiKey, model);
    case "openai": return pingOpenAI(apiKey, model);
    case "google": return pingGoogle(apiKey, model);
    case "mistral": return pingMistral(apiKey, model);
  }
}
