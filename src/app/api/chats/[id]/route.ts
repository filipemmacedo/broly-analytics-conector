import { NextResponse } from "next/server";

import { deleteChat, getChat } from "@/lib/chat-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = getChat(id);
  if (!session) return NextResponse.json("Not found.", { status: 404 });
  return NextResponse.json(session);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteChat(id);
  if (!deleted) return NextResponse.json("Not found.", { status: 404 });
  return new NextResponse(null, { status: 204 });
}
