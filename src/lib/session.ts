import { cookies } from "next/headers";

import { getOrCreateSession } from "@/lib/store";

export const SESSION_COOKIE = "Broly_sid";

export async function ensureSession() {
  const cookieStore = await cookies();
  const existingId = cookieStore.get(SESSION_COOKIE)?.value;
  const { session, sessionId, created } = await getOrCreateSession(existingId);

  if (!existingId || created) {
    cookieStore.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }

  return { session, sessionId };
}
