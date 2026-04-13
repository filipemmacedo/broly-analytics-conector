"use client";

import { useEffect, useState } from "react";
import { use } from "react";

import { IntegrationCard } from "@/components/settings/IntegrationCard";
import type { IntegrationProvider, PublicIntegration } from "@/types/integration";
import { useIntegrations } from "@/context/IntegrationContext";

const VALID_PROVIDERS: IntegrationProvider[] = ["powerbi", "google-analytics", "bigquery"];

export default function ProviderIntegrationPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = use(params);
  const [integration, setIntegration] = useState<PublicIntegration | null>(null);
  const { refresh: refreshContext } = useIntegrations();

  const typedProvider = VALID_PROVIDERS.includes(provider as IntegrationProvider)
    ? (provider as IntegrationProvider)
    : null;

  async function load() {
    if (!typedProvider) return;
    const response = await fetch("/api/integrations");
    if (response.ok) {
      const data = (await response.json()) as PublicIntegration[];
      setIntegration(data.find((i) => i.provider === typedProvider) ?? null);
    }
  }

  useEffect(() => {
    void load();
  }, [typedProvider]);

  if (!typedProvider) {
    return <div className="settings-page"><p>Unknown provider.</p></div>;
  }

  function onRefresh() {
    void load();
    refreshContext();
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <a className="settings-back-link" href="/settings/integrations">← Integrations</a>
      </div>
      <IntegrationCard
        integration={integration}
        onRefresh={onRefresh}
        provider={typedProvider}
      />
    </div>
  );
}
