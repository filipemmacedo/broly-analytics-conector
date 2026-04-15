"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import type { ChatMessage, ChatSession, ChatSummary } from "@/lib/types";

interface ChatSessionContextValue {
  chats: ChatSummary[];
  activeChatId: string | null;
  activeSession: ChatSession | null;
  isTyping: boolean;
  openChat: (id: string) => Promise<void>;
  createChat: () => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

export function ChatSessionProvider({ children }: { children: React.ReactNode }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Keep activeChatId in a ref so callbacks always see the latest value
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  // Load chat list on mount
  useEffect(() => {
    readJson<ChatSummary[]>("/api/chats").then((list) => {
      setChats(list);
      if (list.length > 0) {
        void loadSession(list[0].id);
      }
    }).catch(() => {/* ignore initial load errors */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadSession(id: string) {
    const session = await readJson<ChatSession>(`/api/chats/${id}`);
    setActiveChatId(id);
    setActiveSession(session);
  }

  const openChat = useCallback(async (id: string) => {
    await loadSession(id);
  }, []);

  const createChat = useCallback(async () => {
    const summary = await readJson<ChatSummary>("/api/chats", { method: "POST" });
    const session = await readJson<ChatSession>(`/api/chats/${summary.id}`);
    setChats((prev) => [summary, ...prev]);
    setActiveChatId(summary.id);
    setActiveSession(session);
  }, []);

  const deleteChat = useCallback(async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    const remaining = chats.filter((c) => c.id !== id);
    setChats(remaining);

    if (activeChatIdRef.current === id) {
      if (remaining.length > 0) {
        await loadSession(remaining[0].id);
      } else {
        // Create a fresh session when the last chat is deleted
        const summary = await readJson<ChatSummary>("/api/chats", { method: "POST" });
        const session = await readJson<ChatSession>(`/api/chats/${summary.id}`);
        setChats([summary]);
        setActiveChatId(summary.id);
        setActiveSession(session);
      }
    }
  }, [chats]);

  const sendMessage = useCallback(async (question: string) => {
    const id = activeChatIdRef.current;
    if (!id) return;

    // Optimistic: append user message immediately
    const optimisticUserMsg: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
      status: "complete"
    };
    setActiveSession((prev) =>
      prev ? { ...prev, messages: [...prev.messages, optimisticUserMsg] } : prev
    );
    setIsTyping(true);

    try {
      const updated = await readJson<ChatSession>(
        `/api/chats/${id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question })
        }
      );
      setActiveSession(updated);
      // Update sidebar title/timestamp
      setChats((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                title: updated.title,
                updatedAt: updated.updatedAt,
                messageCount: updated.messages.length
              }
            : c
        ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      );
    } finally {
      setIsTyping(false);
    }
  }, []);

  return (
    <ChatSessionContext.Provider
      value={{
        chats,
        activeChatId,
        activeSession,
        isTyping,
        openChat,
        createChat,
        deleteChat,
        sendMessage
      }}
    >
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSession() {
  const ctx = useContext(ChatSessionContext);
  if (!ctx) throw new Error("useChatSession must be used within ChatSessionProvider");
  return ctx;
}
