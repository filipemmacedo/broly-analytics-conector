"use client";

import { useEffect, useState } from "react";

import { IntegrationCard } from "@/components/settings/IntegrationCard";
import type { IntegrationProvider, PublicIntegration } from "@/types/integration";
import { useIntegrations } from "@/context/IntegrationContext";

const PROVIDERS: IntegrationProvider[] = ["google-analytics", "bigquery"];

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<PublicIntegration[]>([]);
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

  const activeIntegration = integrations.find((i) => i.isActive) ?? null;

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Integrations</h1>
        <p>Connect your data sources to power the analytics assistant. Only one source can be active at a time.</p>
      </div>

      <div className="integration-cards-list">
        {PROVIDERS.map((provider) => {
          const integration = integrations.find((i) => i.provider === provider) ?? null;
          return (
            <IntegrationCard
              activeIntegration={activeIntegration}
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
