"use client";

import { Dashboard } from "@/components/dashboard";
import { ChatSessionProvider } from "@/context/ChatSessionContext";

interface ChatWorkspaceProps {
  initialChatId?: string;
  mode?: "home" | "session";
}

export function ChatWorkspace({
  initialChatId,
  mode = "home"
}: ChatWorkspaceProps) {
  return (
    <ChatSessionProvider initialChatId={initialChatId} mode={mode}>
      <Dashboard />
    </ChatSessionProvider>
  );
}
