import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  BigQueryConnection,
  ChatMessage,
  PowerBIConnection,
  PublicSessionState,
  SessionState
} from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");
const stateFile = path.join(dataDir, "state.json");
let writeQueue = Promise.resolve();

export function createEmptyBigQueryConnection(
  overrides: Partial<BigQueryConnection> = {}
): BigQueryConnection {
  return {
    status: "disconnected",
    mode: null,
    selected: {},
    metadata: { projects: [] },
    error: undefined,
    connectedAt: undefined,
    lastSyncedAt: undefined,
    ...overrides
  };
}

export function createEmptyPowerBIConnection(
  overrides: Partial<PowerBIConnection> = {}
): PowerBIConnection {
  return {
    status: "disconnected",
    mode: null,
    selected: {},
    metadata: { workspaces: [] },
    error: undefined,
    connectedAt: undefined,
    lastSyncedAt: undefined,
    ...overrides
  };
}

function sanitizeChatMessage(message: ChatMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    source: message.source,
    status: message.status
  };
}

function normalizeSession(session: SessionState): SessionState {
  let activeSource = session.activeSource;
  let bigquery = session.connections.bigquery;
  let powerbi = session.connections.powerbi;

  if (bigquery.status === "demo" || bigquery.mode === "demo") {
    bigquery = createEmptyBigQueryConnection();
    if (activeSource === "bigquery") {
      activeSource = null;
    }
  }

  if (powerbi.status === "demo" || powerbi.mode === "demo") {
    powerbi = createEmptyPowerBIConnection();
    if (activeSource === "powerbi") {
      activeSource = null;
    }
  }

  return {
    ...session,
    activeSource,
    chat: session.chat.map((message) => sanitizeChatMessage(message)),
    connections: {
      bigquery,
      powerbi
    }
  };
}

function createSession(sessionId: string): SessionState {
  return {
    id: sessionId,
    createdAt: new Date().toISOString(),
    activeSource: null,
    chat: [],
    connections: {
      bigquery: createEmptyBigQueryConnection(),
      powerbi: createEmptyPowerBIConnection()
    }
  };
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(stateFile, "utf8");
  } catch {
    await writeFile(stateFile, JSON.stringify({ sessions: {} }, null, 2), "utf8");
  }
}

async function readStore(): Promise<{ sessions: Record<string, SessionState> }> {
  await ensureStoreFile();
  const content = await readFile(stateFile, "utf8");
  return JSON.parse(content) as { sessions: Record<string, SessionState> };
}

async function writeStore(store: { sessions: Record<string, SessionState> }) {
  writeQueue = writeQueue.then(async () => {
    await ensureStoreFile();
    await writeFile(stateFile, JSON.stringify(store, null, 2), "utf8");
  });
  await writeQueue;
}

export async function getOrCreateSession(sessionId?: string) {
  const resolvedId = sessionId ?? randomUUID();
  const store = await readStore();
  const existing = store.sessions[resolvedId];

  if (existing) {
    const session = normalizeSession(existing);
    store.sessions[resolvedId] = session;
    await writeStore(store);
    return { session, sessionId: resolvedId, created: false };
  }

  const session = createSession(resolvedId);
  store.sessions[resolvedId] = session;
  await writeStore(store);
  return { session, sessionId: resolvedId, created: true };
}

export async function saveSession(session: SessionState) {
  const store = await readStore();
  store.sessions[session.id] = normalizeSession(session);
  await writeStore(store);
  return store.sessions[session.id];
}

export async function mutateSession(
  sessionId: string,
  updater: (session: SessionState) => SessionState | Promise<SessionState>
) {
  const store = await readStore();
  const current = normalizeSession(store.sessions[sessionId] ?? createSession(sessionId));
  const updated = normalizeSession(await updater(current));
  store.sessions[sessionId] = updated;
  await writeStore(store);
  return updated;
}

export function toPublicSessionState(session: SessionState): PublicSessionState {
  return {
    id: session.id,
    createdAt: session.createdAt,
    activeSource: session.activeSource,
    chat: session.chat.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      source: message.source,
      status: message.status
    })),
    connections: {
      bigquery: {
        status: session.connections.bigquery.status,
        mode: session.connections.bigquery.mode,
        selected: session.connections.bigquery.selected,
        metadata: session.connections.bigquery.metadata,
        error: session.connections.bigquery.error,
        connectedAt: session.connections.bigquery.connectedAt,
        lastSyncedAt: session.connections.bigquery.lastSyncedAt
      },
      powerbi: {
        status: session.connections.powerbi.status,
        mode: session.connections.powerbi.mode,
        selected: session.connections.powerbi.selected,
        metadata: session.connections.powerbi.metadata,
        error: session.connections.powerbi.error,
        connectedAt: session.connections.powerbi.connectedAt,
        lastSyncedAt: session.connections.powerbi.lastSyncedAt
      }
    }
  };
}
