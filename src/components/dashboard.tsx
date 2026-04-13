"use client";

import { useEffect, useState, useTransition } from "react";
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
  TrendingUp,
  User
} from "lucide-react";

import { DataSourcesPanel } from "@/components/data-sources-panel";
import { Topbar } from "@/components/ui/Topbar";
import type { PublicSessionState } from "@/lib/types";
import { cn } from "@/lib/utils";


const templates = [
  "Weekly revenue trends",
  "User retention cohorts",
  "Marketing attribution"
];

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
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
  const [state, setState] = useState<PublicSessionState | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      try {
        const nextState = await readJson<PublicSessionState>("/api/state");
        setState(nextState);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load the workspace.");
      }
    });
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) {
      return;
    }

    setError(null);
    const outgoing = question.trim();
    setQuestion("");

    startTransition(async () => {
      try {
        const nextState = await readJson<PublicSessionState>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: outgoing })
        });
        setState(nextState);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Unable to send your question.");
      }
    });
  }

  if (!state) {
    return (
      <div className="loading-editorial">
        <Loader2 size={20} strokeWidth={1.5} className="loading-spin" />
        Loading workspace
      </div>
    );
  }

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
            <div className="source-rail-body">
              <DataSourcesPanel />
            </div>
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
            {state.chat.length === 0 ? (
              <EmptyState onTemplateSelect={setQuestion} />
            ) : (
              <div className="editorial-chat-list">
                {state.chat.map((message) => (
                  <article
                    className={cn("editorial-message", message.role, message.status === "error" && "error")}
                    key={message.id}
                  >
                    <div className="editorial-stamp">
                      <span className="stamp-icon">
                        {message.role === "user"
                          ? <User size={11} strokeWidth={2.5} />
                          : <Bot size={11} strokeWidth={2.5} />}
                      </span>
                      <span>{message.role}</span>
                      {message.source ? <span>{message.source}</span> : null}
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <div>{message.content}</div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="composer-wrap">
            <form className="composer" onSubmit={onSubmit}>
              <div className="composer-icon">
                {isPending
                  ? <Loader2 size={16} strokeWidth={1.75} className="loading-spin" />
                  : <Sparkles size={16} strokeWidth={1.75} />}
              </div>
              <textarea
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
              <button className="composer-submit" disabled={isPending} type="submit" aria-label="Send">
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </form>
            {error ? <p className="editorial-note error">{error}</p> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
