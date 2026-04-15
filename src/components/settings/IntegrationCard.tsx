"use client";

import { useState } from "react";

import { GA4PropertySelector } from "@/components/settings/GA4PropertySelector";
import { IntegrationForm } from "@/components/settings/IntegrationForm";
import { ConnectionStatusBadge } from "@/components/ui/ConnectionStatusBadge";
import type { AuthConfig, IntegrationProvider, OAuth2CodeFlowAuthConfig, PublicIntegration } from "@/types/integration";

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  powerbi: "Power BI",
  "google-analytics": "Google Analytics",
  bigquery: "BigQuery"
};

const PROVIDER_DESCRIPTIONS: Record<IntegrationProvider, string> = {
  powerbi: "Connect your Power BI workspace to query datasets, dashboards, and reports.",
  "google-analytics": "Connect your GA4 property to analyse web traffic and user behaviour.",
  bigquery: "Connect your BigQuery project to query datasets and run SQL analytics."
};

type TestState = "idle" | "testing" | "success" | "error";

type Props = {
  provider: IntegrationProvider;
  integration: PublicIntegration | null;
  onRefresh: () => void;
};

export function IntegrationCard({ provider, integration, onRefresh }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSave(data: {
    displayName: string;
    authConfig: AuthConfig;
    providerFields: Record<string, string>;
  }) {
    const method = integration ? "PUT" : "POST";
    const url = integration ? `/api/integrations/${integration.id}` : "/api/integrations";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, provider })
    });

    setIsEditing(false);
    onRefresh();
  }

  async function handleTest() {
    if (!integration) return;
    setTestState("testing");
    setTestMessage(null);

    try {
      const response = await fetch(`/api/integrations/${integration.id}/test`, { method: "POST" });
      const result = (await response.json()) as { success: boolean; error?: string; testedAt: string };

      if (result.success) {
        setTestState("success");
        setTestMessage("Connection successful");
      } else {
        setTestState("error");
        setTestMessage(result.error ?? "Connection test failed");
      }
    } catch {
      setTestState("error");
      setTestMessage("Connection test failed");
    }

    onRefresh();
    setTimeout(() => { setTestState("idle"); setTestMessage(null); }, 4000);
  }

  async function handleDelete() {
    if (!integration) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/integrations/${integration.id}`, { method: "DELETE" });
      setShowDeleteConfirm(false);
      onRefresh();
    } finally {
      setIsDeleting(false);
    }
  }

  function handleGoogleConnect() {
    window.location.href = "/api/connect/ga4/start";
  }

  if (isEditing) {
    return (
      <div className="integration-card editing">
        <div className="integration-card-header">
          <h3>{PROVIDER_LABELS[provider]}</h3>
        </div>
        <IntegrationForm
          existing={integration}
          onCancel={() => setIsEditing(false)}
          onSave={handleSave}
          provider={provider}
        />
      </div>
    );
  }

  return (
    <div className="integration-card">
      <div className="integration-card-header">
        <div>
          <h3>{PROVIDER_LABELS[provider]}</h3>
          <p className="integration-card-description">{PROVIDER_DESCRIPTIONS[provider]}</p>
        </div>
        {integration ? (
          <ConnectionStatusBadge
            healthState={integration.healthState}
            lastCheckedAt={integration.lastCheckedAt}
            status={integration.status}
          />
        ) : (
          <span className="connection-status-badge tone-neutral">
            <span className="status-dot tone-neutral" />
            Not configured
          </span>
        )}
      </div>

      {integration ? (
        <div className="integration-card-meta">
          <span className="integration-display-name">{integration.displayName}</span>
        </div>
      ) : null}

      {(() => {
        const ga4Auth = integration?.authConfig as OAuth2CodeFlowAuthConfig | undefined;
        const hasToken = ga4Auth?.authType === "oauth2-code-flow" && Boolean(ga4Auth?.accessToken);
        if (provider !== "google-analytics" || !hasToken) return null;
        const currentPropertyId = (integration?.providerFields as { propertyId?: string } | undefined)?.propertyId;
        return (
          <GA4PropertySelector
            currentPropertyId={currentPropertyId}
            onSelected={onRefresh}
          />
        );
      })()}

      {!integration ? (
        <p className="integration-empty-state">
          No connection configured. Set up your credentials to connect this source.
        </p>
      ) : null}

      {testMessage ? (
        <p className={`integration-test-result ${testState}`}>{testMessage}</p>
      ) : null}

      {showDeleteConfirm ? (
        <div className="delete-confirm">
          <p>Delete this integration? This will remove all stored credentials.</p>
          <div className="delete-confirm-actions">
            <button
              className="btn-danger"
              disabled={isDeleting}
              onClick={handleDelete}
              type="button"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => setShowDeleteConfirm(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="integration-card-actions">
        {provider === "google-analytics" ? (
          (() => {
            const ga4Auth = integration?.authConfig as OAuth2CodeFlowAuthConfig | undefined;
            const isCodeFlow = ga4Auth?.authType === "oauth2-code-flow";
            const hasToken = isCodeFlow && Boolean(ga4Auth?.accessToken);
            if (!integration || !isCodeFlow) {
              return (
                <button className="btn-primary" onClick={() => setIsEditing(true)} type="button">
                  Set up
                </button>
              );
            }
            return (
              <button className="btn-primary" onClick={handleGoogleConnect} type="button">
                {hasToken ? "Reconnect with Google" : "Connect with Google"}
              </button>
            );
          })()
        ) : (
          <button className="btn-primary" onClick={() => setIsEditing(true)} type="button">
            {integration ? "Edit" : "Set up"}
          </button>
        )}
        {integration ? (
          <>
            {provider === "google-analytics" ? (
              <button className="btn-secondary" onClick={() => setIsEditing(true)} type="button">
                Edit
              </button>
            ) : null}
            <button
              className="btn-secondary"
              disabled={testState === "testing"}
              onClick={handleTest}
              type="button"
            >
              {testState === "testing" ? "Testing…" : "Test connection"}
            </button>
            <button
              className="btn-ghost-danger"
              onClick={() => setShowDeleteConfirm(true)}
              type="button"
            >
              Delete
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
