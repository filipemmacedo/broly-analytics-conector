"use client";

import { useEffect, useState } from "react";

interface GA4Property {
  propertyId: string;
  displayName: string;
  accountName: string;
}

type LoadState = "idle" | "loading" | "loaded" | "error";

interface Props {
  currentPropertyId?: string | null;
  onSelected: (propertyId: string) => void;
}

export function GA4PropertySelector({ currentPropertyId, onSelected }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentPropertyId ?? "");
  const [manualId, setManualId] = useState<string>(currentPropertyId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    void loadProperties();
  }, []);

  async function loadProperties() {
    setLoadState("loading");
    try {
      const res = await fetch("/api/integrations/google-analytics/properties");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to load properties");
        setLoadState("error");
        return;
      }
      const data = (await res.json()) as GA4Property[];
      setProperties(data);
      setLoadState("loaded");
      if (currentPropertyId && !selected) {
        setSelected(currentPropertyId);
      }
    } catch {
      setErrorMessage("Could not reach the properties API");
      setLoadState("error");
    }
  }

  async function handleSave() {
    const propertyId = loadState === "error" ? manualId : selected;
    if (!propertyId) return;

    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/integrations/google-analytics/properties/selected", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId })
      });

      if (res.ok) {
        setSaveResult("success");
        onSelected(propertyId);
      } else {
        setSaveResult("error");
      }
    } catch {
      setSaveResult("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveResult(null), 4000);
    }
  }

  return (
    <div className="ga4-property-selector">
      <label className="form-field">
        <span>GA4 Property</span>

        {loadState === "loading" && (
          <p className="form-hint">Loading properties…</p>
        )}

        {loadState === "loaded" && (
          <select
            onChange={(e) => setSelected(e.target.value)}
            value={selected}
          >
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.displayName} ({p.accountName})
              </option>
            ))}
          </select>
        )}

        {loadState === "error" && (
          <>
            <p className="field-error">{errorMessage} — enter property ID manually:</p>
            <input
              onChange={(e) => setManualId(e.target.value)}
              placeholder="properties/123456789"
              type="text"
              value={manualId}
            />
          </>
        )}
      </label>

      {saveResult === "success" && (
        <p className="integration-test-result success">Property saved</p>
      )}
      {saveResult === "error" && (
        <p className="integration-test-result error">Failed to save property</p>
      )}

      <div className="form-actions">
        <button
          className="btn-primary"
          disabled={isSaving || (loadState === "loaded" && !selected) || (loadState === "error" && !manualId)}
          onClick={handleSave}
          type="button"
        >
          {isSaving ? "Saving…" : "Save property"}
        </button>
      </div>
    </div>
  );
}
