"use client";

import Link from "next/link";
import { BarChart2, Database, Globe } from "lucide-react";

import { ConnectionStatusBadge } from "@/components/ui/ConnectionStatusBadge";
import { useIntegrations } from "@/context/IntegrationContext";
import type { HealthState, IntegrationProvider, IntegrationStatus, IntegrationStatusSummary } from "@/types/integration";


const PROVIDERS: {
  provider: IntegrationProvider;
  label: string;
  icon: React.ReactNode;
}[] = [
  { provider: "powerbi", label: "Power BI", icon: <BarChart2 size={18} strokeWidth={1.75} /> },
  { provider: "google-analytics", label: "Google Analytics", icon: <Globe size={18} strokeWidth={1.75} /> },
  { provider: "bigquery", label: "BigQuery", icon: <Database size={18} strokeWidth={1.75} /> }
];

function SourceRow({
  label,
  icon,
  provider,
  summary
}: {
  label: string;
  icon: React.ReactNode;
  provider: IntegrationProvider;
  summary: IntegrationStatusSummary | undefined;
}) {
  const status: IntegrationStatus = summary?.status ?? "unconfigured";
  const healthState: HealthState = summary?.healthState ?? "unknown";

  return (
    <Link className="source-status-row" href={`/settings/integrations/${provider}`}>
      <div className="source-row-icon">{icon}</div>
      <div className="source-row-body">
        <span className="source-row-name">{label}</span>
        <ConnectionStatusBadge
          healthState={healthState}
          lastCheckedAt={summary?.lastCheckedAt}
          status={status}
        />
      </div>
    </Link>
  );
}

export function DataSourcesPanel() {
  const { integrations, isLoading } = useIntegrations();

  if (isLoading) {
    return <div className="source-rail-loading">Loading…</div>;
  }

  return (
    <div className="data-sources-status-list">
      {PROVIDERS.map(({ provider, label, icon }) => {
        const summary = integrations.find((i) => i.provider === provider);
        return (
          <SourceRow
            icon={icon}
            key={provider}
            label={label}
            provider={provider}
            summary={summary}
          />
        );
      })}
    </div>
  );
}
