const DEFAULT_SESSION_SECRET = "Broly-dev-secret-change-me";

export const appEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET ?? DEFAULT_SESSION_SECRET,
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? DEFAULT_SESSION_SECRET,
  powerBiClientId: process.env.POWERBI_CLIENT_ID ?? "",
  powerBiClientSecret: process.env.POWERBI_CLIENT_SECRET ?? "",
  powerBiTenantId: process.env.POWERBI_TENANT_ID ?? "common"
};

export function hasPowerBIOAuthConfig() {
  return Boolean(appEnv.powerBiClientId && appEnv.powerBiClientSecret);
}

export function getRedirectUri(origin: string, source: "bigquery" | "powerbi" | "ga4") {
  return `${origin}/api/connect/${source}/callback`;
}
