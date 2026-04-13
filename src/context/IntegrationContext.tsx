"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { IntegrationStatusSummary } from "@/types/integration";

type IntegrationContextValue = {
  integrations: IntegrationStatusSummary[];
  isLoading: boolean;
  refresh: () => void;
};

const IntegrationContext = createContext<IntegrationContextValue>({
  integrations: [],
  isLoading: true,
  refresh: () => {}
});

const POLL_INTERVAL_MS = 60_000;

export function IntegrationProvider({ children }: { children: React.ReactNode }) {
  const [integrations, setIntegrations] = useState<IntegrationStatusSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchStatus() {
    try {
      const response = await fetch("/api/integrations/status");
      if (response.ok) {
        const data = (await response.json()) as IntegrationStatusSummary[];
        setIntegrations(data);
      }
    } catch {
      // Silently fail — stale data is acceptable
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <IntegrationContext.Provider value={{ integrations, isLoading, refresh: fetchStatus }}>
      {children}
    </IntegrationContext.Provider>
  );
}

export function useIntegrations(): IntegrationContextValue {
  return useContext(IntegrationContext);
}
