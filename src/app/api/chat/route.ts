import { NextResponse } from "next/server";

import { handleQuestion } from "@/lib/orchestrator";
import { ensureSession } from "@/lib/session";
import { mutateSession, toPublicSessionState } from "@/lib/store";

export async function POST(request: Request) {
  const body = (await request.json()) as { question?: string };

  if (!body.question?.trim()) {
    return NextResponse.json("Question is required.", { status: 400 });
  }

  const { sessionId } = await ensureSession();
  const updated = await mutateSession(sessionId, async (session) => handleQuestion(session, body.question!.trim()));

  return NextResponse.json(toPublicSessionState(updated));
}
