import { NextResponse } from "next/server";

// This endpoint has been superseded by POST /api/chats/[id]/messages.
export async function POST() {
  return NextResponse.json(
    "This endpoint is no longer in use. Use POST /api/chats/[id]/messages instead.",
    { status: 410 }
  );
}
