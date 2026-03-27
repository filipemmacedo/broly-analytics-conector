const DEFAULT_SESSION_SECRET = "Broly-dev-secret-change-me";

function toList(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const appEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET ?? DEFAULT_SESSION_SECRET,
  bigQueryClientId: process.env.BIGQUERY_OAUTH_CLIENT_ID ?? "",
  bigQueryClientSecret: process.env.BIGQUERY_OAUTH_CLIENT_SECRET ?? "",
  bigQueryProjectIds: toList(process.env.BIGQUERY_PROJECT_IDS),
  bigQueryMaxBytesBilled: process.env.BIGQUERY_MAX_BYTES_BILLED ?? "1000000000",
  powerBiClientId: process.env.POWERBI_CLIENT_ID ?? "",
  powerBiClientSecret: process.env.POWERBI_CLIENT_SECRET ?? "",
  powerBiTenantId: process.env.POWERBI_TENANT_ID ?? "common"
};

export function hasBigQueryOAuthConfig() {
  return Boolean(
    appEnv.bigQueryClientId &&
      appEnv.bigQueryClientSecret &&
      appEnv.bigQueryProjectIds.length > 0
  );
}

export function hasPowerBIOAuthConfig() {
  return Boolean(appEnv.powerBiClientId && appEnv.powerBiClientSecret);
}

export function getRedirectUri(origin: string, source: "bigquery" | "powerbi") {
  return `${origin}/api/connect/${source}/callback`;
}
