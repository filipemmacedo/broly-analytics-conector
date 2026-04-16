"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  MessageSquare,
  PanelLeft,
  Settings,
  Sparkles,
  Square,
  TrendingUp
} from "lucide-react";

import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import { ChatRouteLoader } from "@/components/chat/ChatRouteLoader";
import { DataSourcesPanel } from "@/components/data-sources-panel";
import { MessageBubble } from "@/components/ui/MessageBubble";
import { TypingIndicator } from "@/components/ui/TypingIndicator";
import { Topbar } from "@/components/ui/Topbar";
import { useChatSession } from "@/context/ChatSessionContext";
import { cn } from "@/lib/utils";

const templates = [
  "Weekly revenue trends",
  "User retention cohorts",
  "Marketing attribution"
];

const COMPOSER_MAX_HEIGHT_RATIO = 0.1;
const COMPOSER_MIN_HEIGHT = 24;

function resizeComposerInput(
  textarea: HTMLTextAreaElement,
  composer: HTMLFormElement | null = null
) {
  textarea.style.height = "auto";

  const isEmpty = textarea.value.length === 0;
  const maxHeight = Math.max(COMPOSER_MIN_HEIGHT, window.innerHeight * COMPOSER_MAX_HEIGHT_RATIO);
  const measuredHeight = isEmpty ? COMPOSER_MIN_HEIGHT : textarea.scrollHeight;
  const nextHeight = Math.max(
    COMPOSER_MIN_HEIGHT,
    Math.min(measuredHeight, maxHeight)
  );

  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = measuredHeight > maxHeight ? "auto" : "hidden";

  if (composer) {
    composer.dataset.isExpanded = !isEmpty && nextHeight > COMPOSER_MIN_HEIGHT ? "true" : "false";
  }
}

function EmptyState({
  onTemplateSelect
}: {
  onTemplateSelect: (value: string) => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon-wrap">
        <Sparkles size={26} strokeWidth={1.5} />
      </div>
      <h2>Ask anything.</h2>
      <p>Connect a source or pick a template to start exploring your intelligence landscape.</p>
      <div className="template-row">
        {templates.map((template) => (
          <button
            className="template-chip"
            key={template}
            onClick={() => onTemplateSelect(template)}
            type="button"
          >
            <TrendingUp size={13} strokeWidth={2} />
            {template}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const {
    activeSession,
    isTyping,
    isGenerating,
    sendMessage,
    abortMessage,
    isSessionLoading,
    homeDraftVersion,
    workspaceMode,
    goHome
  } = useChatSession();
  const [question, setQuestion] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const previousSessionIdRef = useRef<string | null>(null);
  const previousMessageCountRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerInnerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Snap when switching chats; only animate ongoing updates inside the same chat.
  useEffect(() => {
    if (!bottomRef.current) return;

    const sessionId = activeSession?.id ?? null;
    const messageCount = activeSession?.messages.length ?? 0;
    const sessionChanged = previousSessionIdRef.current !== sessionId;
    const messageCountIncreased = messageCount > previousMessageCountRef.current;
    const behavior =
      sessionChanged || (!messageCountIncreased && !isTyping) ? "auto" : "smooth";

    bottomRef.current.scrollIntoView({ behavior, block: "end" });

    previousSessionIdRef.current = sessionId;
    previousMessageCountRef.current = messageCount;
  }, [activeSession?.id, activeSession?.messages.length, isTyping]);

  useEffect(() => {
    if (!textareaRef.current) return;
    resizeComposerInput(textareaRef.current, composerInnerRef.current);
  }, [question]);

  useEffect(() => {
    function onResize() {
      if (!textareaRef.current) return;
      resizeComposerInput(textareaRef.current, composerInnerRef.current);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setQuestion("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      resizeComposerInput(textareaRef.current, composerInnerRef.current);
    }
    if (composerInnerRef.current) {
      composerInnerRef.current.dataset.hasContent = "false";
      composerInnerRef.current.dataset.isExpanded = "false";
    }
  }, [homeDraftVersion]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!hasHydrated || !trimmed || isTyping || isSessionLoading) return;
    setQuestion("");
    // Reset textarea height and data-has-content after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      resizeComposerInput(textareaRef.current, composerInnerRef.current);
    }
    if (composerInnerRef.current) {
      composerInnerRef.current.dataset.hasContent = "false";
      composerInnerRef.current.dataset.isExpanded = "false";
    }
    await sendMessage(trimmed);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const messages = activeSession?.messages ?? [];
  const chatTitle = activeSession?.title?.trim()
    || (isSessionLoading ? "Loading chat" : workspaceMode === "home" ? "Dashboard" : "New chat");
  const submitUnavailable = isTyping || isSessionLoading || !question.trim();

  return (
    <div className="editorial-app">
      <Topbar onBrandClick={goHome} title={chatTitle}>
        <button
          aria-label="Open data sources and settings"
          className="topbar-sidebar-trigger"
          onClick={() => setSidebarOpen(true)}
          type="button"
        >
          <PanelLeft size={16} strokeWidth={2} />
        </button>
      </Topbar>

      <div className={cn("workspace-grid", !sidebarOpen && "sidebar-collapsed")}>
        <aside className="workspace-rail left-rail">
          {sidebarOpen ? (
            <>
              <div className="rail-header">
                <div className="section-label">
                  <Layers size={11} strokeWidth={2.5} />
                  Data Sources
                </div>
                <button
                  aria-label="Collapse sidebar"
                  className="rail-toggle"
                  onClick={() => setSidebarOpen(false)}
                  type="button"
                >
                  <ChevronLeft size={14} strokeWidth={2} />
                </button>
              </div>

              <div className="data-sources-section">
                <DataSourcesPanel />
              </div>
              <ChatHistorySidebar />

              <div className="rail-footer">
                <a href="/settings/integrations">
                  <Settings size={12} strokeWidth={2} />
                  Settings
                </a>
                <a
                  href="https://github.com/filipemmacedo/broly-analytics-conector"
                  rel="noreferrer"
                  target="_blank"
                >
                  <BookOpen size={12} strokeWidth={2} />
                  Documentation
                </a>
                <a href="mailto:filipe.macedo@api.com.pt">
                  <HelpCircle size={12} strokeWidth={2} />
                  Support
                </a>
              </div>
            </>
          ) : (
            <div className="collapsed-rail">
              <button
                aria-label="Expand sidebar"
                className="collapsed-rail-button"
                onClick={() => setSidebarOpen(true)}
                title="Expand sidebar"
                type="button"
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
              <div className="collapsed-rail-nav" aria-label="Sidebar shortcuts">
                <button
                  aria-label="Open data sources"
                  className="collapsed-rail-button"
                  onClick={() => setSidebarOpen(true)}
                  title="Data Sources"
                  type="button"
                >
                  <Layers size={16} strokeWidth={2} />
                </button>
                <button
                  aria-label="Open chats"
                  className="collapsed-rail-button"
                  onClick={() => setSidebarOpen(true)}
                  title="Chats"
                  type="button"
                >
                  <MessageSquare size={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}
        </aside>

        <main className="analysis-panel">
          <div className="analysis-stage">
            {isSessionLoading ? (
              <ChatRouteLoader />
            ) : messages.length === 0 && !isTyping ? (
              <EmptyState onTemplateSelect={(t) => {
                setQuestion(t);
                textareaRef.current?.focus();
              }} />
            ) : (
              <div className="editorial-chat-list">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="composer-wrap">
            <form
              className="composer"
              ref={composerInnerRef}
              data-has-content="false"
              data-is-expanded="false"
              onSubmit={onSubmit}
            >
              <textarea
                aria-disabled={isSessionLoading ? "true" : undefined}
                ref={textareaRef}
                readOnly={isSessionLoading}
                rows={1}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  if (composerInnerRef.current) {
                    composerInnerRef.current.dataset.hasContent =
                      event.target.value.length > 0 ? "true" : "false";
                  }
                }}
                onKeyDown={onKeyDown}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
              {isGenerating ? (
                <button
                  className="composer-submit composer-stop"
                  type="button"
                  aria-label="Stop generating"
                  onClick={abortMessage}
                >
                  <Square size={14} strokeWidth={0} fill="currentColor" />
                </button>
              ) : (
                <button
                  aria-disabled={hasHydrated && submitUnavailable ? "true" : undefined}
                  className={cn(
                    "composer-submit",
                    hasHydrated && submitUnavailable && "composer-submit--disabled"
                  )}
                  type="submit"
                  aria-label="Send"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
