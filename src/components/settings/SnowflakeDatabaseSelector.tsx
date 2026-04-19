"use client";

import { useEffect, useState } from "react";

type LoadState = "idle" | "loading" | "loaded" | "error";

interface Props {
  currentWarehouse?: string | null;
  onSelected: () => void;
}

export function SnowflakeDatabaseSelector({ currentWarehouse, onSelected }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(currentWarehouse ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    void loadWarehouses();
  }, []);

  async function loadWarehouses() {
    setLoadState("loading");
    try {
      const res = await fetch("/api/integrations/snowflake/databases");
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to load Snowflake metadata");
        setLoadState("error");
        return;
      }
      const data = (await res.json()) as { warehouses: string[] };
      setWarehouses(data.warehouses);
      setLoadState("loaded");
      if (!currentWarehouse && data.warehouses.length === 1) {
        setSelectedWarehouse(data.warehouses[0]);
      }
    } catch {
      setErrorMessage("Could not reach the Snowflake API");
      setLoadState("error");
    }
  }

  async function saveSelection() {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/integrations/snowflake/databases/selected", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ warehouse: selectedWarehouse })
      });
      if (res.ok) {
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

  if (loadState === "error") {
    return (
      <div className="ga4-property-selector">
        <p className="field-error">{errorMessage}</p>
        <p className="form-hint">
          Make sure your PAT token role has the USAGE privilege on at least one warehouse.
        </p>
      </div>
    );
  }

  return (
    <div className="ga4-property-selector">
      <label className="form-field">
        <span>Warehouse <span className="form-hint">(optional)</span></span>
        {loadState === "loading" && <p className="form-hint">Loading warehouses…</p>}
        {loadState === "loaded" && (
          <select disabled={isSaving} onChange={(e) => setSelectedWarehouse(e.target.value)} value={selectedWarehouse}>
            <option value="">Account default</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        )}
      </label>

      <button
        className="btn-secondary"
        disabled={isSaving}
        onClick={() => void saveSelection()}
        type="button"
      >
        {isSaving ? "Saving…" : "Save selection"}
      </button>

      {saveResult === "success" && (
        <p className="integration-test-result success">Selection saved</p>
      )}
      {saveResult === "error" && (
        <p className="integration-test-result error">Failed to save selection</p>
      )}
    </div>
  );
}
