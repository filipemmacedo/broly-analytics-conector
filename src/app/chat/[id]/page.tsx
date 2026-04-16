import { ChatWorkspace } from "@/components/chat/ChatWorkspace";

export default async function ChatPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ChatWorkspace initialChatId={id} mode="session" />;
}
