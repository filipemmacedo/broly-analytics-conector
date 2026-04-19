import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { appEnv } from "@/lib/env";
import type { LLMProvider, LLMSettings, LLMStatus, PublicLLMSettings } from "@/types/llm";

// ─── Encryption (same AES-256-GCM pattern as integration-store) ────────────

function getKey(): Buffer {
  return createHash("sha256").update(appEnv.dataEncryptionKey).digest();
}

type EncryptedField = { iv: string; tag: string; content: string };

function encryptString(plaintext: string): EncryptedField {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    content: encrypted.toString("base64")
  };
}

function decryptField(field: EncryptedField): string {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(field.iv, "base64"));
  decipher.setAuthTag(Buffer.from(field.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(field.content, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

// ─── Storage ────────────────────────────────────────────────────────────────

type StoredLLMSettings = {
  provider: LLMProvider;
  model: string;
  encryptedApiKey: EncryptedField;
  configuredAt: string;
  status?: LLMStatus;
  lastTestedAt?: string | null;
};

function getStorePath(): string {
  return join(process.cwd(), "data", "llm-settings.enc.json");
}

function ensureDataDir(): void {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readStore(): StoredLLMSettings | null {
  ensureDataDir();
  const path = getStorePath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as StoredLLMSettings;
  } catch {
    return null;
  }
}

function writeStore(record: StoredLLMSettings): void {
  ensureDataDir();
  writeFileSync(getStorePath(), JSON.stringify(record, null, 2), "utf-8");
}

// ─── Masking ────────────────────────────────────────────────────────────────

export const LLM_KEY_SENTINEL_PREFIX = "••••••••";

export function maskApiKey(key: string): string {
  if (key.length <= 4) return LLM_KEY_SENTINEL_PREFIX;
  return `${LLM_KEY_SENTINEL_PREFIX}${key.slice(-4)}`;
}

export function isMaskedLLMKey(value: string): boolean {
  return value.startsWith(LLM_KEY_SENTINEL_PREFIX);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function getLLMSettings(): LLMSettings | null {
  const stored = readStore();
  if (!stored) return null;
  return {
    provider: stored.provider,
    model: stored.model,
    apiKey: decryptField(stored.encryptedApiKey),
    configuredAt: stored.configuredAt,
    status: stored.status ?? "configured",
    lastTestedAt: stored.lastTestedAt ?? null
  };
}

export function getPublicLLMSettings(): PublicLLMSettings | null {
  const stored = readStore();
  if (!stored) return null;
  const rawKey = decryptField(stored.encryptedApiKey);
  return {
    provider: stored.provider,
    model: stored.model,
    apiKeyMasked: maskApiKey(rawKey),
    configuredAt: stored.configuredAt,
    status: stored.status ?? "configured",
    lastTestedAt: stored.lastTestedAt ?? null
  };
}

export function saveLLMSettings(data: {
  provider: LLMProvider;
  model: string;
  apiKey: string;
}): PublicLLMSettings {
  const existing = readStore();

  // If the incoming key is the masked sentinel, keep the existing encrypted key and status
  let encryptedApiKey: EncryptedField;
  let status: LLMStatus;
  let lastTestedAt: string | null;

  if (isMaskedLLMKey(data.apiKey) && existing) {
    encryptedApiKey = existing.encryptedApiKey;
    status = existing.status ?? "configured";
    lastTestedAt = existing.lastTestedAt ?? null;
  } else {
    encryptedApiKey = encryptString(data.apiKey);
    status = "configured";
    lastTestedAt = null;
  }

  const record: StoredLLMSettings = {
    provider: data.provider,
    model: data.model,
    encryptedApiKey,
    configuredAt: new Date().toISOString(),
    status,
    lastTestedAt
  };

  writeStore(record);

  const rawKey = decryptField(encryptedApiKey);
  return {
    provider: data.provider,
    model: data.model,
    apiKeyMasked: maskApiKey(rawKey),
    configuredAt: record.configuredAt,
    status,
    lastTestedAt
  };
}

export function updateLLMTestResult(success: boolean): void {
  const existing = readStore();
  if (!existing) return;
  writeStore({
    ...existing,
    status: success ? "ok" : "error",
    lastTestedAt: new Date().toISOString()
  });
}
