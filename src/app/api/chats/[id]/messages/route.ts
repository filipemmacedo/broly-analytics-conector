import { getChat, saveChat } from "@/lib/chat-store";
import { getLLMSettings } from "@/lib/llm-settings-store";
import { handleQuestion } from "@/lib/orchestrator";
import { ensureSession } from "@/lib/session";
import type { SessionState } from "@/lib/types";
import { writeSseEvent } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json()) as { question?: string };

  if (!body.question?.trim()) {
    return new Response("Question is required.", { status: 400 });
  }

  const chatSession = getChat(id);
  if (!chatSession) return new Response("Not found.", { status: 404 });

  const isFirstMessage = chatSession.messages.length === 0;

  const llmSettings = getLLMSettings();
  const llmConfig = llmSettings
    ? { provider: llmSettings.provider, model: llmSettings.model, apiKey: llmSettings.apiKey }
    : null;

  const { session: connSession } = await ensureSession();

  const tempSession: SessionState = {
    id: chatSession.id,
    createdAt: chatSession.createdAt,
    activeSource: connSession.activeSource,
    chat: [...chatSession.messages],
    connections: connSession.connections
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const writer = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };

      try {
        const updated = await handleQuestion(tempSession, body.question!.trim(), {
          llmConfig,
          writer
        });

        chatSession.messages = updated.chat;

        if (isFirstMessage) {
          const q = body.question!.trim();
          chatSession.title = q.length > 40 ? `${q.slice(0, 40)}…` : q;
        }

        saveChat(chatSession);

        writeSseEvent(writer, { type: "done", session: chatSession });
      } catch (err) {
        writeSseEvent(writer, {
          type: "error",
          message: err instanceof Error ? err.message : "An unexpected error occurred."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
