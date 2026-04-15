import { NextResponse } from "next/server";

import { createChat, listChats } from "@/lib/chat-store";
import type { ChatSummary } from "@/lib/types";

export async function GET() {
  let chats = listChats();
  // Auto-create a default session if none exist
  if (chats.length === 0) {
    const created = createChat("New Chat");
    const summary: ChatSummary = {
      id: created.id,
      title: created.title,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      messageCount: 0
    };
    chats = [summary];
  }
  return NextResponse.json(chats);
}

export async function POST() {
  const session = createChat("New Chat");
  const summary: ChatSummary = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: 0
  };
  return NextResponse.json(summary, { status: 201 });
}
