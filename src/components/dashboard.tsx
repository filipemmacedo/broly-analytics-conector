"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Layers,
  Loader2,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message whenever messages or typing state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages.length, isTyping]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isTyping) return;
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

  return (
    <div className="editorial-app">
      <Topbar>
        <a className="topbar-icon" href="/settings/integrations" aria-label="Settings">
          <Settings size={16} strokeWidth={1.75} />
        </a>
        <div className="topbar-divider" />
        <div className="avatar-chip" aria-label="AI Agent">
          <Bot size={16} strokeWidth={1.75} />
        </div>
      </Topbar>

      <div className={cn("workspace-grid", !sidebarOpen && "sidebar-collapsed")}>
        <aside className="workspace-rail left-rail">
          <div className="rail-header">
            <div className="section-label">
              <Layers size={11} strokeWidth={2.5} />
              {sidebarOpen ? "Data Sources" : null}
            </div>
            <button
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="rail-toggle"
              onClick={() => setSidebarOpen((v) => !v)}
              type="button"
            >
              {sidebarOpen
                ? <ChevronLeft size={14} strokeWidth={2} />
                : <ChevronRight size={14} strokeWidth={2} />}
            </button>
          </div>

          {sidebarOpen ? (
            <>
              <div className="data-sources-section">
                <DataSourcesPanel />
              </div>
              <ChatHistorySidebar />
            </>
          ) : null}

          {sidebarOpen ? (
            <div className="rail-footer">
              <a href="/">
                <BookOpen size={12} strokeWidth={2} />
                Documentation
              </a>
              <a href="/">
                <HelpCircle size={12} strokeWidth={2} />
                Support
              </a>
            </div>
          ) : null}
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
              <div className="composer-icon">
                {isTyping
                  ? <Loader2 size={16} strokeWidth={1.75} className="loading-spin" />
                  : <Sparkles size={16} strokeWidth={1.75} />}
              </div>
              <textarea
                ref={textareaRef}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
              <button
                className="composer-submit"
                disabled={isTyping || !question.trim()}
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
