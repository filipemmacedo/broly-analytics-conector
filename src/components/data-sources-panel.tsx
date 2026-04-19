"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Database, Globe, Snowflake } from "lucide-react";

import { useIntegrations } from "@/context/IntegrationContext";
import type { IntegrationProvider, IntegrationStatusSummary } from "@/types/integration";

// ─── GA4 property picker ──────────────────────────────────────────────────────

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

function PropertyPicker({
  endpoint,
  selectedEndpoint
}: {
  endpoint: string;
  selectedEndpoint: string;
}) {
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [propsRes, selRes] = await Promise.all([
          fetch(endpoint),
          fetch(selectedEndpoint)
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
        // silently ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, [endpoint, selectedEndpoint]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading || properties.length === 0) return null;

  const selectedProp = properties.find((p) => p.propertyId === selected);

  async function handleSelect(propertyId: string) {
    setSelected(propertyId);
    setOpen(false);
    try {
      await fetch(selectedEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId })
      });
    } catch { /* silently ignore */ }
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

// ─── Snowflake schema picker ──────────────────────────────────────────────────

function SnowflakePicker() {
  const [databases, setDatabases] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [metaRes, selRes] = await Promise.all([
          fetch("/api/integrations/snowflake/databases"),
          fetch("/api/integrations/snowflake/databases/selected")
        ]);
        if (metaRes.ok) {
          const data = (await metaRes.json()) as { databases: string[] };
          setDatabases(data.databases ?? []);
        }
        if (selRes.ok) {
          const sel = (await selRes.json()) as { database: string | null };
          setSelected(sel.database ?? "");
        }
      } catch {
        // silently ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading || databases.length === 0) return null;

  async function handleSelect(database: string) {
    setSelected(database);
    setOpen(false);
    try {
      // Only update database — schema/warehouse are managed in integrations settings
      await fetch("/api/integrations/snowflake/databases/selected", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ database })
      });
    } catch { /* silently ignore */ }
  }

  return (
    <div className="ga4-property-picker" ref={ref}>
      <button
        className={`ga4-picker-trigger${open ? " open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <span className="ga4-picker-label">
          {selected || "Select database…"}
        </span>
        <ChevronDown className={`ga4-picker-chevron${open ? " rotated" : ""}`} size={12} strokeWidth={2} />
      </button>

      {open ? (
        <div className="ga4-picker-dropdown">
          {databases.map((db) => (
            <button
              className={`ga4-picker-option${db === selected ? " selected" : ""}`}
              key={db}
              onClick={() => void handleSelect(db)}
              type="button"
            >
              <span className="ga4-picker-option-text">
                <span className="ga4-picker-option-name">{db}</span>
              </span>
              {db === selected ? <Check size={11} strokeWidth={2.5} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Source row ───────────────────────────────────────────────────────────────

const PROVIDER_META: Record<IntegrationProvider, { label: string; icon: React.ReactNode }> = {
  "google-analytics": { label: "Google Analytics", icon: <Globe size={15} strokeWidth={1.75} /> },
  bigquery:           { label: "BigQuery",          icon: <Database size={15} strokeWidth={1.75} /> },
  powerbi:            { label: "Power BI",          icon: <Database size={15} strokeWidth={1.75} /> },
  snowflake:          { label: "Snowflake",         icon: <Snowflake size={15} strokeWidth={1.75} /> }
};

function SourceRow({
  summary,
  isActive,
  onActivate
}: {
  summary: IntegrationStatusSummary;
  isActive: boolean;
  onActivate: () => void;
}) {
  const meta = PROVIDER_META[summary.provider];
  const isConfigured = summary.status === "configured";

  const ga4HasToken       = summary.provider === "google-analytics" && isConfigured;
  const bqHasToken        = summary.provider === "bigquery" && isConfigured;
  const snowflakeHasToken = summary.provider === "snowflake" && isConfigured;

  return (
    <div className={`source-row-entry${isActive ? " source-row-entry--active" : ""}`}>
      <div className="source-row-header">
        <button
          className="source-row-selector"
          disabled={!isConfigured || isActive}
          onClick={isConfigured && !isActive ? onActivate : undefined}
          title={isActive ? "Active source" : isConfigured ? "Set as active source" : "Not configured"}
          type="button"
        >
          <span className={`source-radio${isActive ? " source-radio--on" : ""}`} />
          <span className="source-row-icon">{meta.icon}</span>
          <span className="source-row-label">{meta.label}</span>
        </button>

        <Link
          className="source-row-settings"
          href={`/settings/integrations/${summary.provider}`}
          title="Configure"
        >
          {isConfigured ? (
            <span className="source-dot source-dot--connected" />
          ) : (
            <span className="source-dot source-dot--idle" />
          )}
        </Link>
      </div>

      {ga4HasToken ? (
        <PropertyPicker
          endpoint="/api/integrations/google-analytics/properties"
          selectedEndpoint="/api/integrations/google-analytics/properties/selected"
        />
      ) : null}

      {bqHasToken ? (
        <PropertyPicker
          endpoint="/api/integrations/bigquery/properties"
          selectedEndpoint="/api/integrations/bigquery/properties/selected"
        />
      ) : null}

      {snowflakeHasToken ? <SnowflakePicker /> : null}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

const PANEL_PROVIDERS: IntegrationProvider[] = ["google-analytics", "bigquery", "snowflake"];

export function DataSourcesPanel() {
  const { integrations, isLoading, refresh } = useIntegrations();

  async function activate(provider: IntegrationProvider) {
    try {
      await fetch("/api/integrations/active-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider })
      });
      refresh();
    } catch { /* silently ignore */ }
  }

  if (isLoading) {
    return <div className="source-rail-loading">Loading…</div>;
  }

  return (
    <div className="data-sources-status-list">
      {PANEL_PROVIDERS.map((provider) => {
        const summary = integrations.find((i) => i.provider === provider);
        if (!summary) {
          // Not configured yet — show a link to set it up
          const meta = PROVIDER_META[provider];
          return (
            <div className="source-row-entry" key={provider}>
              <div className="source-row-header">
                <span className="source-row-selector source-row-selector--unconfigured">
                  <span className="source-radio" />
                  <span className="source-row-icon">{meta.icon}</span>
                  <span className="source-row-label">{meta.label}</span>
                </span>
                <Link
                  className="source-row-settings"
                  href={`/settings/integrations/${provider}`}
                  title="Configure"
                >
                  <span className="source-dot source-dot--idle" />
                </Link>
              </div>
            </div>
          );
        }

        return (
          <SourceRow
            isActive={summary.isActive}
            key={provider}
            onActivate={() => void activate(provider)}
            summary={summary}
          />
        );
      })}
    </div>
  );
}
