"use client";

import { useEffect, useState, useTransition } from "react";

import { DataSourcesPanel } from "@/components/data-sources-panel";
import type { PublicSessionState } from "@/lib/types";
import { cn } from "@/lib/utils";

type PatchBody = {
  activeSource?: "bigquery" | "powerbi" | null;
  disconnectSource?: "bigquery" | "powerbi";
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
      <h2>No questions yet.</h2>
      <p>Connect a source or select a template to start exploring your intelligence landscape.</p>
      <div className="template-row">
        {templates.map((template) => (
          <button
            className="template-chip"
            key={template}
            onClick={() => onTemplateSelect(template)}
            type="button"
          >
            "{template}"
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

  async function patchState(body: PatchBody) {
    const nextState = await readJson<PublicSessionState>("/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setState(nextState);
  }

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
    return <div className="loading-editorial">Loading Broly...</div>;
  }

  return (
    <div className="editorial-app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">Broly</div>
        </div>

        <div className="topbar-actions">
          <div className="avatar-chip">AI</div>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="workspace-rail left-rail">
          <div className="rail-header">
            <div className="section-label">Data Sources</div>
          </div>

          <div className="source-rail-body">
            <DataSourcesPanel
              onPatchState={(body) => patchState(body)}
              state={state}
            />
          </div>

          <div className="rail-footer">
            <a href="/">Documentation</a>
            <a href="/">Support</a>
          </div>
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
              <div className="composer-icon"></div>
              <textarea
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
              <button className="composer-submit" disabled={isPending} type="submit">
                â†‘
              </button>
            </form>
            {error ? <p className="editorial-note error">{error}</p> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
