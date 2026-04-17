import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { appEnv } from "@/lib/env";
import { isMaskedValue, MASKED_SENTINEL } from "@/lib/integration-constants";
import type { AuthConfig, Integration, IntegrationProvider, IntegrationStatus, IntegrationStatusSummary, MaskedAuthConfig, PublicIntegration } from "@/types/integration";

export { MASKED_SENTINEL, isMaskedValue };

// Secret field names by authType
const SECRET_FIELDS: Record<string, string[]> = {
  "api-key": ["apiKey"],
  "oauth2": ["accessToken", "refreshToken"],
  "service-account": ["serviceAccountJson"],
  "token-endpoint": ["token"],
  "oauth2-code-flow": ["clientSecret", "accessToken", "refreshToken"]
};

// ─── Encryption ────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  return createHash("sha256").update(appEnv.dataEncryptionKey).digest();
}

type EncryptedField = { iv: string; tag: string; content: string };

function encryptString(plaintext: string): EncryptedField {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    content: encrypted.toString("base64")
  };
}

function decryptField(field: EncryptedField): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(field.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(field.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(field.content, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}

// ─── Encrypt / decrypt authConfig secrets ─────────────────────────────────

// Stored format: secret fields replaced with EncryptedField objects
type StoredAuthConfig = Record<string, unknown>;

function encryptAuthConfig(authConfig: AuthConfig): StoredAuthConfig {
  const fields = SECRET_FIELDS[authConfig.authType] ?? [];
  const stored: StoredAuthConfig = { ...authConfig } as StoredAuthConfig;
  for (const field of fields) {
    const value = stored[field];
    if (typeof value === "string" && value.length > 0) {
      stored[field] = encryptString(value);
    }
  }
  return stored;
}

function decryptAuthConfig(stored: StoredAuthConfig): AuthConfig {
  const authType = stored["authType"] as string;
  const fields = SECRET_FIELDS[authType] ?? [];
  const restored: StoredAuthConfig = { ...stored };
  for (const field of fields) {
    const value = restored[field];
    if (value && typeof value === "object" && "iv" in (value as object)) {
      restored[field] = decryptField(value as EncryptedField);
    }
  }
  return restored as unknown as AuthConfig;
}

export function maskAuthConfig(authConfig: AuthConfig): MaskedAuthConfig {
  const fields = SECRET_FIELDS[authConfig.authType] ?? [];
  const masked = { ...authConfig } as Record<string, unknown>;
  for (const field of fields) {
    if (masked[field]) {
      masked[field] = MASKED_SENTINEL;
    }
  }
  return masked as MaskedAuthConfig;
}

// Merge incoming authConfig with stored one, skipping masked sentinel values
export function mergeAuthConfig(existing: AuthConfig, incoming: Partial<AuthConfig>): AuthConfig {
  const fields = SECRET_FIELDS[existing.authType] ?? [];
  const merged = { ...existing } as Record<string, unknown>;
  const incomingRecord = incoming as Record<string, unknown>;
  for (const [key, value] of Object.entries(incomingRecord)) {
    if (fields.includes(key) && typeof value === "string" && isMaskedValue(value)) {
      // Keep existing encrypted value
      continue;
    }
    merged[key] = value;
  }
  return merged as unknown as AuthConfig;
}

// ─── Storage file ──────────────────────────────────────────────────────────

type StoredIntegration = Omit<Integration, "authConfig"> & { authConfig: StoredAuthConfig };

function getStorePath(): string {
  return join(process.cwd(), "data", "integrations.enc.json");
}

function ensureDataDir() {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readStore(): StoredIntegration[] {
  ensureDataDir();
  const path = getStorePath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as StoredIntegration[];
  } catch {
    return [];
  }
}

function writeStore(records: StoredIntegration[]): void {
  ensureDataDir();
  writeFileSync(getStorePath(), JSON.stringify(records, null, 2), "utf-8");
}

// ─── Public API ────────────────────────────────────────────────────────────

export function toPublicIntegration(integration: Integration): PublicIntegration {
  return {
    ...integration,
    authConfig: maskAuthConfig(integration.authConfig)
  };
}

export function getAllIntegrations(): Integration[] {
  const stored = readStore();
  return stored.map((record) => ({
    ...record,
    isActive: record.isActive ?? false,
    authConfig: decryptAuthConfig(record.authConfig)
  }));
}

export function getIntegrationById(id: string): Integration | null {
  return getAllIntegrations().find((i) => i.id === id) ?? null;
}

export function createIntegration(data: {
  provider: IntegrationProvider;
  displayName: string;
  authConfig: AuthConfig;
  providerFields: Integration["providerFields"];
  isActive?: boolean;
}): Integration {
  const now = new Date().toISOString();
  const integration: Integration = {
    id: randomUUID(),
    provider: data.provider,
    displayName: data.displayName,
    authType: data.authConfig.authType,
    authConfig: data.authConfig,
    providerFields: data.providerFields,
    status: "configured",
    healthState: "unknown",
    isActive: data.isActive ?? false,
    lastCheckedAt: null,
    createdAt: now,
    updatedAt: now
  };

  const stored = readStore();
  stored.push({
    ...integration,
    authConfig: encryptAuthConfig(integration.authConfig)
  });
  writeStore(stored);

  return integration;
}

export function updateIntegration(
  id: string,
  data: Partial<{
    displayName: string;
    authConfig: Partial<AuthConfig>;
    providerFields: Integration["providerFields"];
    status: IntegrationStatus;
    healthState: Integration["healthState"];
    isActive: boolean;
    lastCheckedAt: string | null;
  }>
): Integration | null {
  const stored = readStore();
  const index = stored.findIndex((r) => r.id === id);
  if (index === -1) return null;

  const existing = {
    ...stored[index],
    authConfig: decryptAuthConfig(stored[index].authConfig)
  } as Integration;

  const updated: Integration = {
    ...existing,
    ...data,
    authConfig: data.authConfig
      ? mergeAuthConfig(existing.authConfig, data.authConfig)
      : existing.authConfig,
    isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
    updatedAt: new Date().toISOString()
  };

  stored[index] = {
    ...updated,
    authConfig: encryptAuthConfig(updated.authConfig)
  };
  writeStore(stored);

  return updated;
}

export function deleteIntegration(id: string): boolean {
  const stored = readStore();
  const index = stored.findIndex((r) => r.id === id);
  if (index === -1) return false;
  stored.splice(index, 1);
  writeStore(stored);
  return true;
}

export function getIntegrationStatusSummaries(): IntegrationStatusSummary[] {
  const stored = readStore();
  return stored.map((r) => ({
    id: r.id,
    provider: r.provider,
    displayName: r.displayName,
    status: r.status,
    healthState: r.healthState,
    isActive: r.isActive ?? false,
    lastCheckedAt: r.lastCheckedAt
  }));
}

// Sets the given provider's integration as the active source and deactivates all others.
export function setActiveSource(provider: IntegrationProvider): void {
  const stored = readStore();
  for (const record of stored) {
    record.isActive = record.provider === provider;
  }
  writeStore(stored);
}

// Returns the integration currently marked as active, or null if none.
export function getActiveIntegration(): Integration | null {
  const all = getAllIntegrations();
  return all.find((i) => i.isActive) ?? null;
}
