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
  onSelected: () => void;
}

export function BigQueryPropertySelector({ currentPropertyId, onSelected }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [properties, setProperties] = useState<GA4Property[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(currentPropertyId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    void loadProperties();
  }, []);

  async function loadProperties() {
    setLoadState("loading");
    try {
      const res = await fetch("/api/integrations/bigquery/properties");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to load properties");
        setLoadState("error");
        return;
      }
      const data = (await res.json()) as GA4Property[];
      setProperties(data);
      setLoadState("loaded");

      if (currentPropertyId) {
        setSelected(currentPropertyId);
      } else if (data.length === 1) {
        void saveProperty(data[0].propertyId, data[0].displayName);
      }
    } catch {
      setErrorMessage("Could not reach the properties API");
      setLoadState("error");
    }
  }

  async function saveProperty(propertyId: string, displayName: string) {
    if (!propertyId) return;
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/integrations/bigquery/properties/selected", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, propertyName: displayName })
      });

      if (res.ok) {
        setSelected(propertyId);
        setSaveResult("success");
        onSelected();
        setTimeout(() => setSaveResult(null), 3000);
      } else {
        setSaveResult("error");
        setTimeout(() => setSaveResult(null), 4000);
      }
    } catch {
      setSaveResult("error");
      setTimeout(() => setSaveResult(null), 4000);
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const property = properties.find((p) => p.propertyId === e.target.value);
    if (property) void saveProperty(property.propertyId, property.displayName);
  }

  return (
    <div className="ga4-property-selector">
      <label className="form-field">
        <span>GA4 Property</span>

        {loadState === "loading" && (
          <p className="form-hint">Loading properties…</p>
        )}

        {loadState === "loaded" && (
          <select disabled={isSaving} onChange={handleChange} value={selected}>
            <option value="">Select a property…</option>
            {properties.map((p) => (
              <option key={p.propertyId} value={p.propertyId}>
                {p.displayName} ({p.accountName})
              </option>
            ))}
          </select>
        )}

        {loadState === "error" && (
          <p className="field-error">{errorMessage}</p>
        )}
      </label>

      {saveResult === "success" && (
        <p className="integration-test-result success">Property saved</p>
      )}
      {saveResult === "error" && (
        <p className="integration-test-result error">Failed to save property</p>
      )}
    </div>
  );
}
