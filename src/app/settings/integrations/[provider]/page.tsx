"use client";

import { useEffect, useState } from "react";
import { use } from "react";

import { IntegrationCard } from "@/components/settings/IntegrationCard";
import type { IntegrationProvider, PublicIntegration } from "@/types/integration";
import { useIntegrations } from "@/context/IntegrationContext";

const VALID_PROVIDERS: IntegrationProvider[] = ["google-analytics", "bigquery"];

export default function ProviderIntegrationPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = use(params);
  const [integrations, setIntegrations] = useState<PublicIntegration[]>([]);
  const [oauthBanner, setOauthBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const { refresh: refreshContext } = useIntegrations();

  const typedProvider = VALID_PROVIDERS.includes(provider as IntegrationProvider)
    ? (provider as IntegrationProvider)
    : null;

  async function load() {
    if (!typedProvider) return;
    const response = await fetch("/api/integrations");
    if (response.ok) {
      const data = (await response.json()) as PublicIntegration[];
      setIntegrations(data);
    }
  }

  useEffect(() => {
    void load();

    const search = new URLSearchParams(window.location.search);
    const clean = window.location.pathname;

    if (search.has("ga4_connected")) {
      setOauthBanner({ type: "success", message: "Google Analytics connected successfully." });
      window.history.replaceState({}, "", clean);
    } else if (search.has("ga4_error")) {
      setOauthBanner({ type: "error", message: `OAuth error: ${search.get("ga4_error") ?? "unknown"}` });
      window.history.replaceState({}, "", clean);
    } else if (search.has("bq_connected")) {
      setOauthBanner({ type: "success", message: "BigQuery connected successfully." });
      window.history.replaceState({}, "", clean);
    } else if (search.has("bq_error")) {
      setOauthBanner({ type: "error", message: `OAuth error: ${search.get("bq_error") ?? "unknown"}` });
      window.history.replaceState({}, "", clean);
    }
  }, [typedProvider]);

  if (!typedProvider) {
    return <div className="settings-page"><p>Unknown provider.</p></div>;
  }

  function onRefresh() {
    void load();
    refreshContext();
  }

  const integration = integrations.find((i) => i.provider === typedProvider) ?? null;
  const activeIntegration = integrations.find((i) => i.isActive) ?? null;

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <a className="settings-back-link" href="/settings/integrations">← Integrations</a>
      </div>
      {oauthBanner ? (
        <div className={`oauth-banner oauth-banner-${oauthBanner.type}`}>
          {oauthBanner.message}
          <button className="btn-ghost" onClick={() => setOauthBanner(null)} type="button">✕</button>
        </div>
      ) : null}
      <IntegrationCard
        activeIntegration={activeIntegration}
        integration={integration}
        onRefresh={onRefresh}
        provider={typedProvider}
      />
    </div>
  );
}
