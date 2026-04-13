"use client";

import { useEffect, useState } from "react";

import { IntegrationCard } from "@/components/settings/IntegrationCard";
import { MigrationBanner } from "@/components/settings/MigrationBanner";
import type { IntegrationProvider, PublicIntegration } from "@/types/integration";
import { useIntegrations } from "@/context/IntegrationContext";

const PROVIDERS: IntegrationProvider[] = ["powerbi", "google-analytics", "bigquery"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<PublicIntegration[]>([]);
  const [showBanner, setShowBanner] = useState(true);
  const { refresh: refreshContext } = useIntegrations();

  async function load() {
    const response = await fetch("/api/integrations");
    if (response.ok) {
      const data = (await response.json()) as PublicIntegration[];
      setIntegrations(data);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onRefresh() {
    void load();
    refreshContext();
  }

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Integrations</h1>
        <p>Connect your data sources to power the analytics assistant.</p>
      </div>

      {showBanner ? <MigrationBanner onDismiss={() => setShowBanner(false)} /> : null}

      <div className="integration-cards-list">
        {PROVIDERS.map((provider) => {
          const integration = integrations.find((i) => i.provider === provider) ?? null;
          return (
            <IntegrationCard
              integration={integration}
              key={provider}
              onRefresh={onRefresh}
              provider={provider}
            />
          );
        })}
      </div>
    </div>
  );
}
