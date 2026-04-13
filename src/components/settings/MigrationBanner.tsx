"use client";

import { useEffect, useState } from "react";

type LegacyStatus = {
  bigquery: string;
  powerbi: string;
};

type Props = {
  onDismiss: () => void;
};

export function MigrationBanner({ onDismiss }: Props) {
  const [legacy, setLegacy] = useState<LegacyStatus | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const sessionRes = await fetch("/api/state");
        if (!sessionRes.ok) return;
        const session = (await sessionRes.json()) as {
          connections: { bigquery: { status: string }; powerbi: { status: string } };
        };

        const intRes = await fetch("/api/integrations");
        if (!intRes.ok) return;
        const integrations = (await intRes.json()) as { provider: string }[];

        const hasBQIntegration = integrations.some((i) => i.provider === "bigquery");
        const hasPBIIntegration = integrations.some((i) => i.provider === "powerbi");

        const bqConnected = session.connections.bigquery.status === "connected" && !hasBQIntegration;
        const pbiConnected = session.connections.powerbi.status === "connected" && !hasPBIIntegration;

        if (bqConnected || pbiConnected) {
          setLegacy({
            bigquery: session.connections.bigquery.status,
            powerbi: session.connections.powerbi.status
          });
        }
      } catch {
        // Ignore — banner is optional
      }
    }
    void check();
  }, []);

  if (!legacy || done) return null;

  const sources: string[] = [];
  if (legacy.bigquery === "connected") sources.push("BigQuery");
  if (legacy.powerbi === "connected") sources.push("Power BI");

  async function handleMigrate() {
    setMigrating(true);
    // Migration guidance: connection credentials for BigQuery/Power BI were managed via
    // OAuth flows and are already persisted in the server session. Users need to
    // re-enter credentials in the new Settings form since the new model stores
    // provider-specific config fields that the old session model did not capture.
    // We simply dismiss and guide the user to the Settings forms.
    await new Promise((resolve) => setTimeout(resolve, 400));
    setDone(true);
    onDismiss();
  }

  return (
    <div className="migration-banner" role="alert">
      <div className="migration-banner-body">
        <strong>Your existing {sources.join(" and ")} connection{sources.length > 1 ? "s have" : " has"} been detected.</strong>
        <p>
          Connection management has moved to Settings &gt; Integrations. Please re-enter your credentials
          here to continue using {sources.join(" and ")}.
        </p>
      </div>
      <div className="migration-banner-actions">
        <button className="btn-primary" disabled={migrating} onClick={handleMigrate} type="button">
          {migrating ? "Dismissing…" : "Got it"}
        </button>
        <button className="btn-ghost" onClick={() => { setDone(true); onDismiss(); }} type="button">
          Dismiss
        </button>
      </div>
    </div>
  );
}
