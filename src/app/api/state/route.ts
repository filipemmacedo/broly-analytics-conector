import { NextResponse } from "next/server";

import { ensureSession } from "@/lib/session";
import { mutateSession, saveSession, toPublicSessionState } from "@/lib/store";
import type { SourceId } from "@/lib/types";

export async function GET() {
  const { session } = await ensureSession();
  await saveSession(session);
  return NextResponse.json(toPublicSessionState(session));
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    activeSource?: SourceId | null;
    disconnectSource?: SourceId;
    bigquerySelection?: {
      projectId?: string;
      datasetId?: string;
      tableId?: string;
    };
    powerbiSelection?: {
      workspaceId?: string;
      datasetId?: string;
      reportId?: string;
    };
  };
  const { sessionId } = await ensureSession();

  const updated = await mutateSession(sessionId, (session) => {
    if (body.activeSource !== undefined) {
      session.activeSource = body.activeSource;
    }

    if (body.disconnectSource === "bigquery") {
      session.connections.bigquery = {
        status: "disconnected",
        mode: null,
        selected: {},
        metadata: { projects: [] }
      };
      if (session.activeSource === "bigquery") {
        session.activeSource = null;
      }
    }

    if (body.disconnectSource === "powerbi") {
      session.connections.powerbi = {
        status: "disconnected",
        mode: null,
        selected: {},
        metadata: { workspaces: [] }
      };
      if (session.activeSource === "powerbi") {
        session.activeSource = null;
      }
    }

    if (body.bigquerySelection) {
      session.connections.bigquery.selected = {
        ...session.connections.bigquery.selected,
        ...body.bigquerySelection
      };
    }

    if (body.powerbiSelection) {
      session.connections.powerbi.selected = {
        ...session.connections.powerbi.selected,
        ...body.powerbiSelection
      };
    }

    return session;
  });

  return NextResponse.json(toPublicSessionState(updated));
}
