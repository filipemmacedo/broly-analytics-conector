"use client";

import type { HealthState, IntegrationStatus } from "@/types/integration";

type Props = {
  status: IntegrationStatus;
  healthState: HealthState;
  lastCheckedAt?: string | null;
};

function getLabel(status: IntegrationStatus, healthState: HealthState): string {
  if (status === "unconfigured") return "Not set up";
  if (status === "expired") return "Needs reconnect";
  if (status === "error" || healthState === "unreachable") return "Connection error";
  if (healthState === "degraded") return "Degraded";
  if (healthState === "unknown") return "Not verified";
  if (healthState === "healthy") return "Connected";
  return "Connected";
}

function getTone(status: IntegrationStatus, healthState: HealthState): "connected" | "error" | "warning" | "neutral" {
  if (status === "unconfigured") return "neutral";
  if (status === "expired") return "warning";
  if (status === "error" || healthState === "unreachable") return "error";
  if (healthState === "degraded" || healthState === "unknown") return "warning";
  return "connected";
}

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ConnectionStatusBadge({ status, healthState, lastCheckedAt }: Props) {
  const label = getLabel(status, healthState);
  const tone = getTone(status, healthState);

  return (
    <span className={`connection-status-badge tone-${tone}`}>
      <span className={`status-dot tone-${tone}`} />
      {label}
      {lastCheckedAt && status !== "unconfigured" ? (
        <span className="status-checked">{formatRelativeTime(lastCheckedAt)}</span>
      ) : null}
    </span>
  );
}
