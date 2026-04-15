import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ChatMessage, ChatSession, ChatSummary } from "@/lib/types";

function chatsDir() {
  return join(process.cwd(), "data", "chats");
}

function indexPath() {
  return join(chatsDir(), "index.json");
}

function sessionPath(id: string) {
  return join(chatsDir(), `${id}.json`);
}

function ensureDir() {
  const dir = chatsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readIndex(): ChatSummary[] {
  ensureDir();
  const path = indexPath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ChatSummary[];
  } catch {
    return [];
  }
}

function writeIndex(summaries: ChatSummary[]): void {
  ensureDir();
  writeFileSync(indexPath(), JSON.stringify(summaries, null, 2), "utf-8");
}

// ─── Public API ────────────────────────────────────────────────────────────────

export function listChats(): ChatSummary[] {
  const index = readIndex();
  // Reconcile: remove index entries whose session file no longer exists
  const reconciled = index.filter((s) => existsSync(sessionPath(s.id)));
  if (reconciled.length !== index.length) {
    writeIndex(reconciled);
  }
  return reconciled.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createChat(title = "New Chat"): ChatSession {
  ensureDir();
  const now = new Date().toISOString();
  const session: ChatSession = {
    id: randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8");
  const index = readIndex();
  index.push({
    id: session.id,
    title: session.title,
    createdAt: now,
    updatedAt: now,
    messageCount: 0
  });
  writeIndex(index);
  return session;
}

export function getChat(id: string): ChatSession | null {
  const path = sessionPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as ChatSession;
  } catch {
    return null;
  }
}

export function deleteChat(id: string): boolean {
  const path = sessionPath(id);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  const index = readIndex().filter((s) => s.id !== id);
  writeIndex(index);
  return true;
}

export function saveChat(session: ChatSession): void {
  ensureDir();
  session.updatedAt = new Date().toISOString();
  writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2), "utf-8");
  const index = readIndex();
  const entry = index.find((s) => s.id === session.id);
  if (entry) {
    entry.title = session.title;
    entry.updatedAt = session.updatedAt;
    entry.messageCount = session.messages.length;
    writeIndex(index);
  }
}

export function appendMessage(id: string, message: ChatMessage): ChatSession | null {
  const session = getChat(id);
  if (!session) return null;
  session.messages.push(message);
  saveChat(session);
  return session;
}

export function setTitle(id: string, title: string): void {
  const session = getChat(id);
  if (!session) return;
  session.title = title;
  saveChat(session);
}
