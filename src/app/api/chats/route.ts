import { NextResponse } from "next/server";

import { createChat, listChats } from "@/lib/chat-store";
import type { ChatSummary } from "@/lib/types";

export async function GET() {
  const chats = listChats();
  return NextResponse.json(chats satisfies ChatSummary[]);
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
