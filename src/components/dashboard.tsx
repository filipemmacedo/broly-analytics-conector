"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import type { ChatMessage, PublicSessionState, SourceId } from "@/lib/types";

type PatchBody = {
  activeSource?: SourceId | null;
  disconnectSource?: SourceId;
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

type ConnectorCardProps = {
  title: string;
  source: SourceId;
  description: string;
  state: PublicSessionState;
  activeSource: SourceId | null;
  onSetActive: (source: SourceId | null) => void;
  onDisconnect: (source: SourceId) => void;
  onBigQueryChange: (body: PatchBody["bigquerySelection"]) => void;
  onPowerBIChange: (body: PatchBody["powerbiSelection"]) => void;
};

type PassiveConnectorProps = {
  title: string;
  subtitle: string;
  icon: string;
};

const templates = [
  "Weekly revenue trends",
  "User retention cohorts",
  "Marketing attribution"
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

function getConnectionCopy(status: string) {
  switch (status) {
    case "connected":
      return "Connected";
    case "demo":
      return "Demo Mode";
    case "error":
      return "Needs Attention";
    default:
      return "Ready to connect";
  }
}

function getConnectionMeta(source: SourceId, state: PublicSessionState) {
  if (source === "bigquery") {
    const projectCount = state.connections.bigquery.metadata.projects.length;
    return projectCount > 0 ? `${projectCount} project${projectCount === 1 ? "" : "s"} ready` : "Warehouse access";
  }

  const workspaceCount = state.connections.powerbi.metadata.workspaces.length;
  return workspaceCount > 0
    ? `${workspaceCount} workspace${workspaceCount === 1 ? "" : "s"} ready`
    : "Semantic layer";
}

function PassiveConnector({ title, subtitle, icon }: PassiveConnectorProps) {
  return (
    <section className="connector-card passive">
      <div className="connector-leading">
        <div className="connector-icon muted">{icon}</div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      <button className="connector-add" type="button">
        +
      </button>
    </section>
  );
}

function SourceCard({
  title,
  source,
  description,
  state,
  activeSource,
  onSetActive,
  onDisconnect,
  onBigQueryChange,
  onPowerBIChange
}: ConnectorCardProps) {
  const connection = state.connections[source];
  const isActive = activeSource === source;
  const isConnected = connection.status !== "disconnected";

  const bigQueryProjects = state.connections.bigquery.metadata.projects;
  const selectedProject =
    bigQueryProjects.find((project) => project.id === state.connections.bigquery.selected.projectId) ??
    bigQueryProjects[0];
  const selectedDataset =
    selectedProject?.datasets.find((dataset) => dataset.id === state.connections.bigquery.selected.datasetId) ??
    selectedProject?.datasets[0];

  const powerBiWorkspaces = state.connections.powerbi.metadata.workspaces;
  const selectedWorkspace =
    powerBiWorkspaces.find((workspace) => workspace.id === state.connections.powerbi.selected.workspaceId) ??
    powerBiWorkspaces[0];

  return (
    <section className={cn("connector-card", isActive && "active")}>
      <div className="connector-row">
        <div className="connector-leading">
          <div className={cn("connector-icon", source === "bigquery" ? "is-bigquery" : "is-powerbi")}>
            {source === "bigquery" ? "◉" : "▣"}
          </div>
          <div>
            <h3>{title}</h3>
            <p>{getConnectionCopy(connection.status)}</p>
          </div>
        </div>

        <button
          className={cn("connector-action", isConnected ? "is-arrow" : "is-plus")}
          onClick={() => onSetActive(isActive ? null : source)}
          type="button"
        >
          {isConnected ? "›" : "+"}
        </button>
      </div>

      <div className="connector-copy">
        <span className={cn("status-dot", connection.status === "error" && "error")} />
        <span>{getConnectionMeta(source, state)}</span>
      </div>

      {isActive ? (
        <div className="connector-expanded">
          <p className="connector-description">{description}</p>

          <div className="connector-actions">
            <a className="editorial-button primary" href={`/api/connect/${source}/start`}>
              {isConnected ? "Reconnect" : "Connect"}
            </a>
            {isConnected ? (
              <button
                className="editorial-button subtle"
                onClick={() => onDisconnect(source)}
                type="button"
              >
                Disconnect
              </button>
            ) : null}
          </div>

          {connection.error ? <p className="editorial-note error">{connection.error}</p> : null}

          {source === "bigquery" && isConnected ? (
            <div className="source-selects">
              <label>
                Project
                <select
                  onChange={(event) =>
                    onBigQueryChange({
                      projectId: event.target.value,
                      datasetId:
                        bigQueryProjects.find((project) => project.id === event.target.value)?.datasets[0]?.id,
                      tableId:
                        bigQueryProjects.find((project) => project.id === event.target.value)?.datasets[0]?.tables[0]?.id
                    })
                  }
                  value={state.connections.bigquery.selected.projectId ?? ""}
                >
                  {bigQueryProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dataset
                <select
                  onChange={(event) =>
                    onBigQueryChange({
                      projectId: selectedProject?.id,
                      datasetId: event.target.value,
                      tableId:
                        selectedProject?.datasets.find((dataset) => dataset.id === event.target.value)?.tables[0]?.id
                    })
                  }
                  value={state.connections.bigquery.selected.datasetId ?? ""}
                >
                  {(selectedProject?.datasets ?? []).map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Table
                <select
                  onChange={(event) =>
                    onBigQueryChange({
                      projectId: selectedProject?.id,
                      datasetId: selectedDataset?.id,
                      tableId: event.target.value
                    })
                  }
                  value={state.connections.bigquery.selected.tableId ?? ""}
                >
                  {(selectedDataset?.tables ?? []).map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {source === "powerbi" && isConnected ? (
            <div className="source-selects">
              <label>
                Workspace
                <select
                  onChange={(event) =>
                    onPowerBIChange({
                      workspaceId: event.target.value,
                      datasetId:
                        powerBiWorkspaces.find((workspace) => workspace.id === event.target.value)?.datasets[0]?.id,
                      reportId:
                        powerBiWorkspaces.find((workspace) => workspace.id === event.target.value)?.reports[0]?.id
                    })
                  }
                  value={state.connections.powerbi.selected.workspaceId ?? ""}
                >
                  {powerBiWorkspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Dataset
                <select
                  onChange={(event) =>
                    onPowerBIChange({
                      workspaceId: selectedWorkspace?.id,
                      datasetId: event.target.value,
                      reportId: state.connections.powerbi.selected.reportId
                    })
                  }
                  value={state.connections.powerbi.selected.datasetId ?? ""}
                >
                  {(selectedWorkspace?.datasets ?? []).map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Report
                <select
                  onChange={(event) =>
                    onPowerBIChange({
                      workspaceId: selectedWorkspace?.id,
                      datasetId: state.connections.powerbi.selected.datasetId,
                      reportId: event.target.value
                    })
                  }
                  value={state.connections.powerbi.selected.reportId ?? ""}
                >
                  {(selectedWorkspace?.reports ?? []).map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function EmptyState({
  onTemplateSelect
}: {
  onTemplateSelect: (value: string) => void;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◼</div>
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

function EvidencePanel({ message, state }: { message?: ChatMessage; state: PublicSessionState }) {
  const recentMessages = [...state.chat]
    .filter((item) => item.role === "assistant")
    .slice(-2)
    .reverse();

  const freshness = state.connections.bigquery.status === "disconnected" ? "92.4%" : "99.8%";
  const latency = state.connections.powerbi.status === "disconnected" ? "311ms" : "142ms";

  return (
    <div className="evidence-shell">
      <div className="rail-header">
        <div>
          <div className="section-label">Evidence Panel</div>
        </div>
        <div className="rail-info">i</div>
      </div>

      <div className="evidence-stack">
        <section className="info-card muted-card">
          <div className="section-label soft">Recent Traces</div>
          <div className="trace-list">
            {recentMessages.length > 0 ? (
              recentMessages.map((item) => (
                <article className="trace-item" key={item.id}>
                  <div className="trace-icon">{item.source === "bigquery" ? "◌" : "✦"}</div>
                  <div>
                    <strong>{item.content}</strong>
                    <span>
                      {item.source ?? "system"} • {formatTime(item.createdAt)}
                    </span>
                  </div>
                </article>
              ))
            ) : (
              <>
                <article className="trace-item">
                  <div className="trace-icon">◌</div>
                  <div>
                    <strong>Data schema updated</strong>
                    <span>BigQuery • 2 mins ago</span>
                  </div>
                </article>
                <article className="trace-item">
                  <div className="trace-icon">✦</div>
                  <div>
                    <strong>Agent heartbeat check</strong>
                    <span>System • 12 mins ago</span>
                  </div>
                </article>
              </>
            )}
          </div>
        </section>

        <section className="info-card accent-card">
          <div className="section-label light">New Analysis Ready</div>
          <p>
            {message?.evidence
              ? "A fresh answer has been grounded with source evidence and is ready for review."
              : "We have identified a traceable workspace with one or more sources ready for analysis."}
          </p>
          <button className="editorial-button inverted" type="button">
            Generate Report
          </button>
        </section>

        <section className="health-card">
          <div className="section-label">Source Health</div>
          <div className="health-row">
            <span>Data Freshness</span>
            <strong>{freshness}</strong>
          </div>
          <div className="health-bar">
            <span style={{ width: freshness }} />
          </div>
          <div className="health-row">
            <span>Latency</span>
            <strong>{latency}</strong>
          </div>
        </section>

        {message?.evidence ? (
          <section className="info-card evidence-detail">
            <div className="section-label">Selected Evidence</div>
            <div className="mini-meta">
              <span>{message.evidence.source}</span>
              <span>{message.evidence.queryLanguage}</span>
            </div>
            <pre>{message.evidence.queryText}</pre>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [state, setState] = useState<PublicSessionState | null>(null);
  const [question, setQuestion] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedMessage = useMemo(() => {
    if (!state) {
      return undefined;
    }

    return (
      state.chat.find((message) => message.id === selectedMessageId && message.evidence) ??
      [...state.chat].reverse().find((message) => message.evidence)
    );
  }, [selectedMessageId, state]);

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
    return <div className="loading-editorial">Loading Editorial Intelligence...</div>;
  }

  return (
    <div className="editorial-app">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">Editorial Intelligence</div>
          <nav className="topnav">
            <a className="active" href="/">
              Analysis
            </a>
            <a href="/">Models</a>
            <a href="/">Library</a>
          </nav>
        </div>

        <div className="topbar-actions">
          <button className="topbar-icon" type="button">
            •
          </button>
          <button className="topbar-icon" type="button">
            ⚙
          </button>
          <div className="avatar-chip">AI</div>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className="workspace-rail left-rail">
          <div className="rail-header">
            <div className="section-label">Data Sources</div>
          </div>

          <div className="source-list">
            <SourceCard
              activeSource={state.activeSource}
              description="Warehouse access for raw datasets, SQL answers, and table-level metadata."
              onBigQueryChange={(body) => {
                void patchState({ bigquerySelection: body });
              }}
              onDisconnect={(source) => {
                void patchState({ disconnectSource: source });
              }}
              onPowerBIChange={(body) => {
                void patchState({ powerbiSelection: body });
              }}
              onSetActive={(source) => {
                void patchState({ activeSource: source });
              }}
              source="bigquery"
              state={state}
              title="BigQuery"
            />

            <PassiveConnector icon="∿" subtitle="Ready to connect" title="GA4" />

            <SourceCard
              activeSource={state.activeSource}
              description="Curated semantic models, dashboards, reports, and DAX-backed answers."
              onBigQueryChange={(body) => {
                void patchState({ bigquerySelection: body });
              }}
              onDisconnect={(source) => {
                void patchState({ disconnectSource: source });
              }}
              onPowerBIChange={(body) => {
                void patchState({ powerbiSelection: body });
              }}
              onSetActive={(source) => {
                void patchState({ activeSource: source });
              }}
              source="powerbi"
              state={state}
              title="PowerBI"
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
                  <button
                    className={cn("editorial-message", message.role, message.status === "error" && "error")}
                    key={message.id}
                    onClick={() => setSelectedMessageId(message.id)}
                    type="button"
                  >
                    <div className="editorial-stamp">
                      <span>{message.role}</span>
                      {message.source ? <span>{message.source}</span> : null}
                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                    <div>{message.content}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="composer-wrap">
            <form className="composer" onSubmit={onSubmit}>
              <div className="composer-icon">✦</div>
              <textarea
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask your intelligence agent..."
                value={question}
              />
              <button className="composer-submit" disabled={isPending} type="submit">
                ↑
              </button>
            </form>
          </div>
        </main>

        <aside className="workspace-rail right-rail">
          <EvidencePanel message={selectedMessage} state={state} />
        </aside>
      </div>
    </div>
  );
}
