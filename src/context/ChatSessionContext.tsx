"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { usePathname, useRouter } from "next/navigation";

import type { ChatMessage, ChatSession, ChatSummary, SseProgressStep } from "@/lib/types";

type ChatWorkspaceMode = "home" | "session";

interface ChatSessionContextValue {
  chats: ChatSummary[];
  activeChatId: string | null;
  activeSession: ChatSession | null;
  isTyping: boolean;
  isGenerating: boolean;
  isSessionLoading: boolean;
  streamingStep: SseProgressStep | null;
  homeDraftVersion: number;
  workspaceMode: ChatWorkspaceMode;
  openChat: (id: string) => Promise<void>;
  goHome: () => void;
  deleteChat: (id: string) => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  abortMessage: () => void;
}

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);
const PENDING_CHAT_START_KEY = "broly.pendingChatStart";

interface PendingChatStart {
  chatId: string;
  question: string;
  createdAt: string;
}

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(await response.text());
  return (await response.json()) as T;
}

function sortChats(chats: ChatSummary[]): ChatSummary[] {
  return [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function upsertChatSummary(chats: ChatSummary[], summary: ChatSummary): ChatSummary[] {
  return sortChats([summary, ...chats.filter((chat) => chat.id !== summary.id)]);
}

function setPendingChatStart(chatId: string, question: string) {
  if (typeof window === "undefined") return;
  const pendingStart: PendingChatStart = {
    chatId,
    question,
    createdAt: new Date().toISOString()
  };
  window.sessionStorage.setItem(
    PENDING_CHAT_START_KEY,
    JSON.stringify(pendingStart)
  );
}

function readPendingChatStart(chatId: string): PendingChatStart | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PENDING_CHAT_START_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<PendingChatStart>;
    if (parsed.chatId !== chatId || !parsed.question?.trim()) return null;
    return {
      chatId,
      question: parsed.question.trim(),
      createdAt: parsed.createdAt ?? new Date().toISOString()
    };
  } catch {
    window.sessionStorage.removeItem(PENDING_CHAT_START_KEY);
    return null;
  }
}

function clearPendingChatStart() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PENDING_CHAT_START_KEY);
}

function createPendingChatSession(
  chatId: string,
  pendingStart: PendingChatStart
): ChatSession {
  return {
    id: chatId,
    title: "New Chat",
    createdAt: pendingStart.createdAt,
    updatedAt: pendingStart.createdAt,
    messages: [
      {
        id: `optimistic-${pendingStart.createdAt}`,
        role: "user",
        content: pendingStart.question,
        createdAt: pendingStart.createdAt,
        status: "complete"
      }
    ]
  };
}

interface ChatSessionProviderProps {
  children: React.ReactNode;
  mode?: ChatWorkspaceMode;
  initialChatId?: string;
}

export function ChatSessionProvider({
  children,
  mode = "home",
  initialChatId
}: ChatSessionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingStep, setStreamingStep] = useState<SseProgressStep | null>(null);
  const streamingMsgIdRef = useRef<string | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(() => {
    if (mode !== "session" || !initialChatId) return false;
    if (typeof window !== "undefined" && readPendingChatStart(initialChatId)) return false;
    return true;
  });
  const [homeDraftVersion, setHomeDraftVersion] = useState(0);

  // Keep activeChatId in a ref so callbacks always see the latest value
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = activeChatId;

  // AbortController for in-flight LLM requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const refreshChats = useCallback(async (): Promise<ChatSummary[]> => {
    const list = await readJson<ChatSummary[]>("/api/chats");
    setChats(sortChats(list));
    return list;
  }, []);

  const loadSession = useCallback(async (
    id: string,
    options?: { syncState?: boolean }
  ): Promise<ChatSession | null> => {
    const syncState = options?.syncState ?? true;
    const response = await fetch(`/api/chats/${id}`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await response.text());
    const session = (await response.json()) as ChatSession;
    if (syncState) {
      setActiveChatId(id);
      setActiveSession(session);
    }
    return session;
  }, []);

  const createSession = useCallback(async (): Promise<ChatSummary> => {
    const summary = await readJson<ChatSummary>("/api/chats", { method: "POST" });
    setChats((prev) => upsertChatSummary(prev, summary));
    return summary;
  }, []);

  const sendQuestionToSession = useCallback(async (
    id: string,
    question: string,
    baseSession?: ChatSession | null,
    options?: { skipOptimisticUserMessage?: boolean }
  ) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!options?.skipOptimisticUserMessage) {
      const optimisticUserMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: "user",
        content: question,
        createdAt: new Date().toISOString(),
        status: "complete"
      };
      setActiveSession((prev) => {
        const session = prev ?? baseSession;
        return session ? { ...session, messages: [...session.messages, optimisticUserMsg] } : prev;
      });
    }
    setIsTyping(true);
    setStreamingStep(null);

    // Add an empty streaming assistant message immediately
    const streamingMsgId = `streaming-${Date.now()}`;
    streamingMsgIdRef.current = streamingMsgId;
    const streamingMsg: ChatMessage = {
      id: streamingMsgId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "streaming"
    };
    setActiveSession((prev) => {
      const session = prev ?? baseSession;
      return session ? { ...session, messages: [...session.messages, streamingMsg] } : prev;
    });

    let receivedDone = false;

    try {
      const response = await fetch(`/api/chats/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; [k: string]: unknown };
          try { event = JSON.parse(raw) as typeof event; } catch { continue; }

          if (event.type === "progress") {
            setStreamingStep(event.step as SseProgressStep);
          } else if (event.type === "text") {
            const delta = event.delta as string;
            setStreamingStep(null);
            setActiveSession((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === streamingMsgId
                    ? { ...m, content: m.content + delta }
                    : m
                )
              };
            });
          } else if (event.type === "done") {
            receivedDone = true;
            const updated = event.session as ChatSession;
            setActiveChatId(id);
            setActiveSession(updated);
            setIsTyping(false);
            setStreamingStep(null);
            setChats((prev) =>
              sortChats(
                prev.map((chat) =>
                  chat.id === id
                    ? { ...chat, title: updated.title, updatedAt: updated.updatedAt, messageCount: updated.messages.length }
                    : chat
                )
              )
            );
          } else if (event.type === "error") {
            const msg = event.message as string;
            setActiveSession((prev) =>
              prev
                ? {
                    ...prev,
                    messages: prev.messages.map((m) =>
                      m.id === streamingMsgId ? { ...m, content: msg, status: "error" } : m
                    )
                  }
                : prev
            );
            receivedDone = true;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      if (!receivedDone) {
        // Stream closed without a done event — mark the message as error
        setActiveSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.map((m) =>
                  m.id === streamingMsgId && m.status === "streaming"
                    ? { ...m, status: "error", content: m.content || "Response was interrupted." }
                    : m
                )
              }
            : prev
        );
      }
      setIsTyping(false);
      setStreamingStep(null);
      streamingMsgIdRef.current = null;
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        await refreshChats();
      } catch {
        if (!alive) return;
        setChats([]);
      }

      if (!alive) return;

      if (mode === "session" && initialChatId) {
        const pendingStart = readPendingChatStart(initialChatId);

        if (pendingStart) {
          setActiveChatId(initialChatId);
          setActiveSession(createPendingChatSession(initialChatId, pendingStart));
          setIsTyping(true);
          setIsSessionLoading(false);
        } else {
          setIsSessionLoading(true);
        }

        const session = await loadSession(
          initialChatId,
          pendingStart ? { syncState: false } : undefined
        ).catch(() => null);

        if (!alive) return;

        if (!session) {
          clearPendingChatStart();
          setIsTyping(false);
          setIsSessionLoading(false);
          router.replace("/");
          return;
        }

        setIsSessionLoading(false);
        if (pendingStart) {
          clearPendingChatStart();
          void sendQuestionToSession(
            initialChatId,
            pendingStart.question,
            session,
            { skipOptimisticUserMessage: true }
          );
        }
        return;
      }

      setIsSessionLoading(false);
      setActiveChatId(null);
      setActiveSession(null);
      setIsTyping(false);
    }

    void init();

    return () => { alive = false; };
  }, [initialChatId, loadSession, mode, refreshChats, router, sendQuestionToSession]);

  const openChat = useCallback(async (id: string) => {
    setIsSessionLoading(true);
    setActiveChatId(id);
    setActiveSession(null);
    setIsTyping(false);
    router.push(`/chat/${id}`);
  }, [router]);

  const resetToHomeState = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsTyping(false);
    setIsSessionLoading(false);
    setActiveChatId(null);
    setActiveSession(null);
    setHomeDraftVersion((prev) => prev + 1);
  }, []);

  const goHome = useCallback(() => {
    resetToHomeState();

    if (pathname !== "/") {
      router.push("/");
    }
  }, [pathname, resetToHomeState, router]);

  const deleteChat = useCallback(async (id: string) => {
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    const remaining = chats.filter((c) => c.id !== id);
    setChats(remaining);

    if (activeChatIdRef.current === id) {
      resetToHomeState();
      router.push("/");
    }
  }, [chats, resetToHomeState, router]);

  const abortMessage = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsTyping(false);
  }, []);

  const sendMessage = useCallback(async (question: string) => {
    const id = activeChatIdRef.current;

    if (id) {
      await sendQuestionToSession(id, question);
      return;
    }

    try {
      const summary = await createSession();
      setPendingChatStart(summary.id, question);
      setActiveChatId(summary.id);
      router.push(`/chat/${summary.id}`);
    } catch {
      // Session creation failed — stay on current view; user can retry
    }
  }, [createSession, router, sendQuestionToSession]);

  return (
    <ChatSessionContext.Provider
      value={{
        chats,
        activeChatId,
        activeSession,
        isTyping,
        isGenerating: isTyping,
        isSessionLoading,
        streamingStep,
        homeDraftVersion,
        workspaceMode: mode,
        openChat,
        goHome,
        deleteChat,
        sendMessage,
        abortMessage
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
