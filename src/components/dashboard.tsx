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
  TrendingUp
} from "lucide-react";

import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
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

function resizeComposerInput(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";

  const maxHeight = Math.max(COMPOSER_MIN_HEIGHT, window.innerHeight * COMPOSER_MAX_HEIGHT_RATIO);
  const nextHeight = Math.max(
    COMPOSER_MIN_HEIGHT,
    Math.min(textarea.scrollHeight, maxHeight)
  );

  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
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
  const { activeSession, isTyping, sendMessage } = useChatSession();
  const [question, setQuestion] = useState("");
  const [hasHydrated, setHasHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Auto-scroll to latest message whenever messages or typing state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, isTyping]);

  useEffect(() => {
    if (!textareaRef.current) return;
    resizeComposerInput(textareaRef.current);
  }, [question]);

  useEffect(() => {
    function onResize() {
      if (!textareaRef.current) return;
      resizeComposerInput(textareaRef.current);
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!hasHydrated || !trimmed || isTyping) return;
    setQuestion("");
    await sendMessage(trimmed);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const messages = activeSession?.messages ?? [];
  const chatTitle = activeSession?.title?.trim() || "New chat";
  const submitUnavailable = isTyping || !question.trim();

  return (
    <div className="editorial-app">
      <Topbar title={chatTitle}>
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
            {messages.length === 0 && !isTyping ? (
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
            <form className="composer" onSubmit={onSubmit}>
              <textarea
                ref={textareaRef}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
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
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
