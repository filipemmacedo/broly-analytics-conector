import { randomUUID } from "node:crypto";

import { decryptTokenSet, encryptTokenSet } from "@/lib/crypto";
import { appEnv, getRedirectUri, hasPowerBIOAuthConfig } from "@/lib/env";
import { createEmptyPowerBIConnection } from "@/lib/store";
import type {
  ExecutionResult,
  PlannedExecution,
  PowerBIConnection,
  PowerBIDataset,
  PowerBIWorkspace,
  SessionState,
  TokenSet
} from "@/lib/types";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Power BI request failed");
  }
  return (await response.json()) as T;
}

async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    client_id: appEnv.powerBiClientId,
    client_secret: appEnv.powerBiClientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "openid offline_access profile https://analysis.windows.net/powerbi/api/Dataset.Read.All https://analysis.windows.net/powerbi/api/Report.Read.All https://analysis.windows.net/powerbi/api/Workspace.Read.All"
  });

  const tokenUrl = `https://login.microsoftonline.com/${appEnv.powerBiTenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
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

async function discoverMetadata(accessToken: string) {
  const groups = await fetchJson<{ value?: Array<{ id: string; name: string }> }>(
    "https://api.powerbi.com/v1.0/myorg/groups",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    }
  );

  const workspaces: PowerBIWorkspace[] = [];
  for (const group of groups.value ?? []) {
    const [datasetsResponse, reportsResponse] = await Promise.all([
      fetchJson<{ value?: Array<{ id: string; name: string }> }>(
        `https://api.powerbi.com/v1.0/myorg/groups/${group.id}/datasets`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        }
      ),
      fetchJson<{ value?: Array<{ id: string; name: string; embedUrl?: string }> }>(
        `https://api.powerbi.com/v1.0/myorg/groups/${group.id}/reports`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store"
        }
      )
    ]);

    const datasets: PowerBIDataset[] = (datasetsResponse.value ?? []).map((dataset) => ({
      id: dataset.id,
      name: dataset.name,
      tables: []
    }));

    workspaces.push({
      id: group.id,
      name: group.name,
      datasets,
      reports: reportsResponse.value ?? []
    });
  }

  return { workspaces };
}

function createLiveConnection(tokenSet: TokenSet, metadata: Awaited<ReturnType<typeof discoverMetadata>>): PowerBIConnection {
  const workspace = metadata.workspaces[0];
  return {
    status: "connected",
    mode: "live",
    selected: {
      workspaceId: workspace?.id,
      datasetId: workspace?.datasets[0]?.id,
      reportId: workspace?.reports[0]?.id
    },
    metadata,
    access: encryptTokenSet(tokenSet),
    connectedAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString()
  };
}

export function markPowerBIConnectionUnavailable(session: SessionState, message: string) {
  session.connections.powerbi = createEmptyPowerBIConnection({
    status: "error",
    error: message
  });

  if (session.activeSource === "powerbi") {
    session.activeSource = null;
  }

  return session;
}

export function buildPowerBIAuthUrl(origin: string, session: SessionState) {
  if (!hasPowerBIOAuthConfig()) {
    return null;
  }

  const state = randomUUID();
  session.connections.powerbi.oauthState = state;
  session.connections.powerbi.error = undefined;

  const url = new URL(`https://login.microsoftonline.com/${appEnv.powerBiTenantId}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", appEnv.powerBiClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri(origin, "powerbi"));
  url.searchParams.set("response_mode", "query");
  url.searchParams.set(
    "scope",
    "openid offline_access profile https://analysis.windows.net/powerbi/api/Dataset.Read.All https://analysis.windows.net/powerbi/api/Report.Read.All https://analysis.windows.net/powerbi/api/Workspace.Read.All"
  );
  url.searchParams.set("state", state);
  return url.toString();
}

export async function completePowerBIOAuth(session: SessionState, params: URLSearchParams, origin: string) {
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) {
    session.connections.powerbi.status = "error";
    session.connections.powerbi.error = error;
    return session;
  }

  if (!code || !state || state !== session.connections.powerbi.oauthState) {
    session.connections.powerbi.status = "error";
    session.connections.powerbi.error = "Power BI OAuth state validation failed.";
    return session;
  }

  const tokenSet = await exchangeCodeForTokens(code, getRedirectUri(origin, "powerbi"));
  const metadata = await discoverMetadata(tokenSet.accessToken);
  session.connections.powerbi = createLiveConnection(tokenSet, metadata);
  session.activeSource = session.activeSource ?? "powerbi";
  return session;
}

export async function runPowerBIExecution(connection: PowerBIConnection, plan: PlannedExecution): Promise<ExecutionResult> {
  if (connection.status !== "connected" || connection.mode !== "live") {
    throw new Error("Connect Power BI before asking questions.");
  }

  if (plan.intent === "report_inventory") {
    const workspace =
      connection.metadata.workspaces.find((item) => item.id === connection.selected.workspaceId) ??
      connection.metadata.workspaces[0];
    return {
      answer: `Power BI workspace ${workspace?.name ?? "selected workspace"} is active.`,
      preview: (workspace?.reports ?? []).map((report) => ({ report: report.name }))
    };
  }

  const tokenSet = decryptTokenSet(connection.access);
  if (!tokenSet?.accessToken) {
    throw new Error("Missing Power BI access token.");
  }

  const datasetId = connection.selected.datasetId ?? connection.metadata.workspaces[0]?.datasets[0]?.id;
  const payload = await fetchJson<{
    results?: Array<{ tables?: Array<{ rows?: Record<string, string | number>[] }> }>;
  }>(`https://api.powerbi.com/v1.0/myorg/datasets/${datasetId}/executeQueries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenSet.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      queries: [{ query: plan.queryText }],
      serializerSettings: { includeNulls: true }
    }),
    cache: "no-store"
  });

  const preview = payload.results?.[0]?.tables?.[0]?.rows ?? [];

  return {
    answer:
      preview.length > 0
        ? "Power BI returned a live dataset query result."
        : "Power BI ran the query successfully but returned no rows.",
    preview
  };
}
