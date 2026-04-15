"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Globe } from "lucide-react";

import { ConnectionStatusBadge } from "@/components/ui/ConnectionStatusBadge";
import { useIntegrations } from "@/context/IntegrationContext";
import type { HealthState, IntegrationProvider, IntegrationStatus, IntegrationStatusSummary } from "@/types/integration";

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

function GA4PropertyPicker() {
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [propsRes, selRes] = await Promise.all([
          fetch("/api/integrations/google-analytics/properties"),
          fetch("/api/integrations/google-analytics/properties/selected")
        ]);
        if (propsRes.ok) {
          const data = (await propsRes.json()) as GA4Property[];
          setProperties(data);
        }
        if (selRes.ok) {
          const sel = (await selRes.json()) as { propertyId: string | null };
          setSelected(sel.propertyId ?? "");
        }
      } catch {
        // silently ignore — sidebar should not hard-fail
      }
    })();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (properties.length === 0) return null;

  const selectedProp = properties.find((p) => p.propertyId === selected);

  async function handleSelect(propertyId: string) {
    setSelected(propertyId);
    setOpen(false);
    try {
      await fetch("/api/integrations/google-analytics/properties/selected", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId })
      });
    } catch {
      // silently ignore
    }
  }

  return (
    <div className="ga4-property-picker" ref={ref}>
      <button
        className={`ga4-picker-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="ga4-picker-label">
          {selectedProp ? selectedProp.displayName : "Select property…"}
        </span>
        <ChevronDown className={`ga4-picker-chevron${open ? " rotated" : ""}`} size={12} strokeWidth={2} />
      </button>

      {open ? (
        <div className="ga4-picker-dropdown">
          {properties.map((p) => (
            <button
              className={`ga4-picker-option${p.propertyId === selected ? " selected" : ""}`}
              key={p.propertyId}
              onClick={() => void handleSelect(p.propertyId)}
              type="button"
            >
              <span className="ga4-picker-option-text">
                <span className="ga4-picker-option-name">{p.displayName}</span>
                <span className="ga4-picker-option-account">{p.accountName}</span>
              </span>
              {p.propertyId === selected ? <Check size={11} strokeWidth={2.5} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}


const PROVIDERS: {
  provider: IntegrationProvider;
  label: string;
  icon: React.ReactNode;
}[] = [
  { provider: "google-analytics", label: "Google Analytics", icon: <Globe size={18} strokeWidth={1.75} /> }
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
  const isGA4Connected = provider === "google-analytics" && status === "configured";

  return (
    <div className="source-status-group">
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
      {isGA4Connected ? <GA4PropertyPicker /> : null}
    </div>
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
