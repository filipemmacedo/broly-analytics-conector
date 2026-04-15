import type { AuthConfig, IntegrationProvider, ProviderFields } from "@/types/integration";
import * as bigquery from "@/lib/providers/bigquery";
import * as googleAnalytics from "@/lib/providers/google-analytics";
import * as powerbi from "@/lib/providers/powerbi";

type ProviderAdapter = {
  testConnection: (authConfig: AuthConfig, providerFields: ProviderFields, integrationId?: string) => Promise<{ success: boolean; error?: string }>;
};

const registry: Record<IntegrationProvider, ProviderAdapter> = {
  powerbi,
  "google-analytics": googleAnalytics,
  bigquery
};

export function getProviderAdapter(provider: IntegrationProvider): ProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) throw new Error(`No adapter registered for provider: ${provider}`);
  return adapter;
}
