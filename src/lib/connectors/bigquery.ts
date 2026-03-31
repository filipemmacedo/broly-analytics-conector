import { randomUUID } from "node:crypto";

import { decryptTokenSet, encryptTokenSet } from "@/lib/crypto";
import { appEnv, getRedirectUri, hasBigQueryOAuthConfig } from "@/lib/env";
import { createEmptyBigQueryConnection } from "@/lib/store";
import type {
  BigQueryConnection,
  BigQueryDataset,
  BigQueryProject,
  ExecutionResult,
  PlannedExecution,
  SessionState,
  TokenSet
} from "@/lib/types";

function isSafeReadOnlyQuery(query: string) {
  const normalized = query.trim().toUpperCase();
  const blocked = ["INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "ALTER", "TRUNCATE", "CREATE"];
  return (normalized.startsWith("SELECT") || normalized.startsWith("WITH")) && !blocked.some((keyword) => normalized.includes(keyword));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "BigQuery request failed");
  }
  return (await response.json()) as T;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    code,
    client_id: appEnv.bigQueryClientId,
    client_secret: appEnv.bigQueryClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? Date.now() + payload.expires_in * 1000 : undefined,
    scope: payload.scope
  };
}

async function listTables(accessToken: string, projectId: string, datasetId: string) {
  const tablePayload = await fetchJson<{
    tables?: Array<{ tableReference: { tableId: string }; friendlyName?: string }>;
  }>(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets/${datasetId}/tables`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  return (tablePayload.tables ?? []).map((table) => ({
    id: table.tableReference.tableId,
    description: table.friendlyName,
    columns: []
  }));
}

async function discoverMetadata(accessToken: string) {
  const projects: BigQueryProject[] = [];

  for (const projectId of appEnv.bigQueryProjectIds) {
    const datasetPayload = await fetchJson<{
      datasets?: Array<{ datasetReference: { datasetId: string }; location?: string }>;
    }>(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/datasets`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });

    const datasets: BigQueryDataset[] = [];
    for (const dataset of datasetPayload.datasets ?? []) {
      const tables = await listTables(accessToken, projectId, dataset.datasetReference.datasetId);
      datasets.push({
        id: dataset.datasetReference.datasetId,
        location: dataset.location,
        tables
      });
    }

    projects.push({ id: projectId, datasets });
  }

  return { projects };
}

function createLiveConnection(tokenSet: TokenSet, metadata: Awaited<ReturnType<typeof discoverMetadata>>): BigQueryConnection {
  return {
    status: "connected",
    mode: "live",
    selected: {
      projectId: metadata.projects[0]?.id,
      datasetId: metadata.projects[0]?.datasets[0]?.id,
      tableId: metadata.projects[0]?.datasets[0]?.tables[0]?.id
    },
    metadata,
    access: encryptTokenSet(tokenSet),
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };
}

export function markBigQueryConnectionUnavailable(session: SessionState, message: string) {
  session.connections.bigquery = createEmptyBigQueryConnection({
    status: "error",
    error: message
  });

  if (session.activeSource === "bigquery") {
    session.activeSource = null;
  }

  return session;
}

export function buildBigQueryAuthUrl(origin: string, session: SessionState) {
  if (!hasBigQueryOAuthConfig()) {
    return null;
  }

  const state = randomUUID();
  session.connections.bigquery.oauthState = state;
  session.connections.bigquery.error = undefined;

  const redirectUri = getRedirectUri(origin, "bigquery");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", appEnv.bigQueryClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/bigquery.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completeBigQueryOAuth(session: SessionState, params: URLSearchParams, origin: string) {
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    session.connections.bigquery.status = "error";
    session.connections.bigquery.error = error;
    return session;
  }

  if (!code || !state || state !== session.connections.bigquery.oauthState) {
    session.connections.bigquery.status = "error";
    session.connections.bigquery.error = "BigQuery OAuth state validation failed.";
    return session;
  }

  const tokenSet = await exchangeCodeForTokens(code, getRedirectUri(origin, "bigquery"));
  const metadata = await discoverMetadata(tokenSet.accessToken);
  session.connections.bigquery = createLiveConnection(tokenSet, metadata);
  session.activeSource = session.activeSource ?? "bigquery";
  return session;
}

export async function runBigQueryExecution(connection: BigQueryConnection, plan: PlannedExecution): Promise<ExecutionResult> {
  if (connection.status !== "connected" || connection.mode !== "live") {
    throw new Error("Connect BigQuery before asking questions.");
  }

  if (!isSafeReadOnlyQuery(plan.queryText)) {
    throw new Error("Blocked query because it is not read-only.");
  }

  const tokenSet = decryptTokenSet(connection.access);
  if (!tokenSet?.accessToken) {
    throw new Error("Missing BigQuery access token.");
  }

  const projectId = connection.selected.projectId ?? connection.metadata.projects[0]?.id ?? "";
  const payload = await fetchJson<{
    schema?: { fields?: Array<{ name: string }> };
    rows?: Array<{ f: Array<{ v: string | number | null }> }>;
  }>(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenSet.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: plan.queryText,
      useLegacySql: false,
      timeoutMs: 20000,
      maxResults: 20,
      maximumBytesBilled: appEnv.bigQueryMaxBytesBilled
    }),
    cache: "no-store"
  });

  const columns = payload.schema?.fields?.map((field) => field.name) ?? [];
  const preview = (payload.rows ?? []).map((row) =>
    Object.fromEntries(row.f.map((cell, index) => [columns[index] ?? `column_${index + 1}`, cell.v ?? ""]))
  );

  return {
    answer:
      preview.length > 0
        ? "BigQuery returned a live result for the selected warehouse context."
        : "BigQuery ran the query successfully but returned no rows.",
    preview
  };
}
