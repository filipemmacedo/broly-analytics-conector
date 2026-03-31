"use client";

import { useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { PublicSessionState, SourceId } from "@/lib/types";
import { cn } from "@/lib/utils";

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

type SourceTone = "connected" | "ready" | "error";

type ManagedSourceItemProps = {
  title: string;
  iconLabel: string;
  source: SourceId;
  description: string;
  state: PublicSessionState;
  onPatchState: (body: PatchBody) => Promise<void> | void;
};

function getConnectionCopy(status: string) {
  switch (status) {
    case "connected":
      return "Connected";
    case "error":
      return "Setup needed";
    default:
      return "Not connected";
  }
}

function getConnectionMeta(source: SourceId, state: PublicSessionState) {
  if (source === "bigquery") {
    const projectCount = state.connections.bigquery.metadata.projects.length;
    return projectCount > 0
      ? `${projectCount} project${projectCount === 1 ? "" : "s"} available`
      : "No projects loaded";
  }

  const workspaceCount = state.connections.powerbi.metadata.workspaces.length;
  return workspaceCount > 0
    ? `${workspaceCount} workspace${workspaceCount === 1 ? "" : "s"} available`
    : "No workspaces loaded";
}

function getSourceTone(status: string): SourceTone {
  if (status === "error") {
    return "error";
  }

  if (status === "disconnected") {
    return "ready";
  }

  return "connected";
}

function ManagedSourceItem({
  title,
  iconLabel,
  source,
  description,
  state,
  onPatchState
}: ManagedSourceItemProps) {
  const connection = state.connections[source];
  const tone = getSourceTone(connection.status);
  const isConnected = connection.status === "connected";

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
    <AccordionItem className={cn("data-source-item", tone)} value={source}>
      <AccordionTrigger>
        <div className="data-source-summary">
          <div className={cn("data-source-icon", tone)} aria-hidden="true">
            {iconLabel}
          </div>
          <div className="data-source-copy">
            <span className="data-source-name">{title}</span>
            <span className={cn("data-source-status", tone)}>{getConnectionCopy(connection.status)}</span>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        <div className="data-source-panel">
          <p className="data-source-description">{description}</p>

          <div className="data-source-meta">
            <span className={cn("data-source-badge", tone)}>{getConnectionCopy(connection.status)}</span>
            <span>{getConnectionMeta(source, state)}</span>
          </div>

          <div className="data-source-actions">
            <a className="editorial-button primary" href={`/api/connect/${source}/start`}>
              {isConnected ? "Reconnect" : "Connect"}
            </a>
            {isConnected ? (
              <button
                className="editorial-button subtle"
                onClick={() => onPatchState({ disconnectSource: source })}
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
                    onPatchState({
                      bigquerySelection: {
                        projectId: event.target.value,
                        datasetId:
                          bigQueryProjects.find((project) => project.id === event.target.value)?.datasets[0]?.id,
                        tableId:
                          bigQueryProjects.find((project) => project.id === event.target.value)?.datasets[0]?.tables[0]?.id
                      }
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
                    onPatchState({
                      bigquerySelection: {
                        projectId: selectedProject?.id,
                        datasetId: event.target.value,
                        tableId:
                          selectedProject?.datasets.find((dataset) => dataset.id === event.target.value)?.tables[0]?.id
                      }
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
                    onPatchState({
                      bigquerySelection: {
                        projectId: selectedProject?.id,
                        datasetId: selectedDataset?.id,
                        tableId: event.target.value
                      }
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
                    onPatchState({
                      powerbiSelection: {
                        workspaceId: event.target.value,
                        datasetId:
                          powerBiWorkspaces.find((workspace) => workspace.id === event.target.value)?.datasets[0]?.id,
                        reportId:
                          powerBiWorkspaces.find((workspace) => workspace.id === event.target.value)?.reports[0]?.id
                      }
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
                    onPatchState({
                      powerbiSelection: {
                        workspaceId: selectedWorkspace?.id,
                        datasetId: event.target.value,
                        reportId: state.connections.powerbi.selected.reportId
                      }
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
                    onPatchState({
                      powerbiSelection: {
                        workspaceId: selectedWorkspace?.id,
                        datasetId: state.connections.powerbi.selected.datasetId,
                        reportId: event.target.value
                      }
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
      </AccordionContent>
    </AccordionItem>
  );
}

export function DataSourcesPanel({
  state,
  onPatchState
}: {
  state: PublicSessionState;
  onPatchState: (body: PatchBody) => Promise<void> | void;
}) {
  const [openSource, setOpenSource] = useState<SourceId | "">(state.activeSource ?? "");

  return (
    <Accordion
      className="data-sources-accordion"
      collapsible
      onValueChange={(value) => {
        const nextValue = (value as SourceId) || "";
        setOpenSource(nextValue);

        if (nextValue === "bigquery" || nextValue === "powerbi") {
          void onPatchState({ activeSource: nextValue });
          return;
        }

        void onPatchState({ activeSource: null });
      }}
      type="single"
      value={openSource}
    >
      <ManagedSourceItem
        description="Warehouse access for raw datasets, SQL answers, and table-level metadata."
        iconLabel="BQ"
        onPatchState={onPatchState}
        source="bigquery"
        state={state}
        title="BigQuery"
      />

      <ManagedSourceItem
        description="Connected workspace datasets, dashboards, and DAX-backed answers."
        iconLabel="BI"
        onPatchState={onPatchState}
        source="powerbi"
        state={state}
        title="Power BI"
      />
    </Accordion>
  );
}
