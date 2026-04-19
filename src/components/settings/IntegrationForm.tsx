"use client";

import { useState } from "react";

import { MASKED_SENTINEL } from "@/lib/integration-constants";
import type { AuthConfig, IntegrationProvider, PublicIntegration } from "@/types/integration";

type Props = {
  provider: IntegrationProvider;
  existing?: PublicIntegration | null;
  onSave: (data: {
    displayName: string;
    authConfig: AuthConfig;
    providerFields: Record<string, string>;
  }) => Promise<void>;
  onCancel: () => void;
};

type FormErrors = Record<string, string>;

// ─── Power BI ──────────────────────────────────────────────────────────────

function PowerBIFields({
  values,
  errors,
  onChange
}: {
  values: Record<string, string>;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Tenant ID</span>
        <input
          className={errors.tenantId ? "error" : ""}
          onChange={(e) => onChange("tenantId", e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          type="text"
          value={values.tenantId ?? ""}
        />
        {errors.tenantId ? <span className="field-error">{errors.tenantId}</span> : null}
      </label>

      <label className="form-field">
        <span>Client ID</span>
        <input
          className={errors.clientId ? "error" : ""}
          onChange={(e) => onChange("clientId", e.target.value)}
          placeholder="Application (client) ID"
          type="text"
          value={values.clientId ?? ""}
        />
        {errors.clientId ? <span className="field-error">{errors.clientId}</span> : null}
      </label>

      <label className="form-field">
        <span>Client Secret</span>
        <input
          className={errors.clientSecret ? "error" : ""}
          onChange={(e) => onChange("clientSecret", e.target.value)}
          placeholder={values.clientSecret === MASKED_SENTINEL ? MASKED_SENTINEL : "Client secret value"}
          type="password"
          value={values.clientSecret ?? ""}
        />
        {errors.clientSecret ? <span className="field-error">{errors.clientSecret}</span> : null}
      </label>

      <label className="form-field">
        <span>Workspace ID (optional)</span>
        <input
          onChange={(e) => onChange("workspaceId", e.target.value)}
          placeholder="Default workspace ID"
          type="text"
          value={values.workspaceId ?? ""}
        />
      </label>
    </>
  );
}

// ─── Google Analytics ──────────────────────────────────────────────────────

function GoogleAnalyticsFields({
  values,
  errors,
  onChange
}: {
  values: Record<string, string>;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
}) {
  const credType = values.credentialType ?? "oauth2-code-flow";

  return (
    <>
      <label className="form-field">
        <span>Credential type</span>
        <select
          onChange={(e) => onChange("credentialType", e.target.value)}
          value={credType}
        >
          <option value="oauth2-code-flow">Google OAuth 2.0 (recommended)</option>
          <option value="service-account">Service account JSON</option>
        </select>
      </label>

      {credType === "oauth2-code-flow" ? (
        <>
          <label className="form-field">
            <span>Client ID</span>
            <input
              className={errors.clientId ? "error" : ""}
              onChange={(e) => onChange("clientId", e.target.value)}
              placeholder="441744xxx.apps.googleusercontent.com"
              type="text"
              value={values.clientId ?? ""}
            />
            {errors.clientId ? <span className="field-error">{errors.clientId}</span> : null}
          </label>
          <label className="form-field">
            <span>Client Secret</span>
            <input
              className={errors.clientSecret ? "error" : ""}
              onChange={(e) => onChange("clientSecret", e.target.value)}
              placeholder={values.clientSecret === MASKED_SENTINEL ? MASKED_SENTINEL : "GOCSPX-..."}
              type="password"
              value={values.clientSecret ?? ""}
            />
            {errors.clientSecret ? <span className="field-error">{errors.clientSecret}</span> : null}
          </label>
        </>
      ) : (
        <label className="form-field">
          <span>Service Account JSON</span>
          <textarea
            className={errors.serviceAccountJson ? "error" : ""}
            onChange={(e) => onChange("serviceAccountJson", e.target.value)}
            placeholder={values.serviceAccountJson === MASKED_SENTINEL ? MASKED_SENTINEL : '{"type":"service_account",...}'}
            rows={5}
            value={values.serviceAccountJson ?? ""}
          />
          {errors.serviceAccountJson ? <span className="field-error">{errors.serviceAccountJson}</span> : null}
        </label>
      )}
    </>
  );
}

// ─── Snowflake ─────────────────────────────────────────────────────────────

function SnowflakeFormFields({
  values,
  errors,
  onChange
}: {
  values: Record<string, string>;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Account Identifier</span>
        <input
          className={errors.accountId ? "error" : ""}
          onChange={(e) => onChange("accountId", e.target.value)}
          placeholder="xy12345.us-east-1"
          type="text"
          value={values.accountId ?? ""}
        />
        {errors.accountId ? <span className="field-error">{errors.accountId}</span> : null}
        <span className="form-hint">Your Snowflake account identifier, e.g. <code>xy12345.us-east-1</code> or <code>orgname-accountname</code>.</span>
      </label>

      <label className="form-field">
        <span>PAT Token</span>
        <input
          className={errors.patToken ? "error" : ""}
          onChange={(e) => onChange("patToken", e.target.value)}
          placeholder={values.patToken === MASKED_SENTINEL ? MASKED_SENTINEL : "Snowflake Programmatic Access Token"}
          type="password"
          value={values.patToken ?? ""}
        />
        {errors.patToken ? <span className="field-error">{errors.patToken}</span> : null}
        <span className="form-hint">Generate a PAT in Snowflake under Admin &gt; Security &gt; Programmatic Access Tokens.</span>
      </label>
    </>
  );
}

// ─── BigQuery ──────────────────────────────────────────────────────────────

function BigQueryFields({
  values,
  errors,
  onChange
}: {
  values: Record<string, string>;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>GCP Project ID</span>
        <input
          className={errors.projectId ? "error" : ""}
          onChange={(e) => onChange("projectId", e.target.value)}
          placeholder="my-gcp-project"
          type="text"
          value={values.projectId ?? ""}
        />
        {errors.projectId ? <span className="field-error">{errors.projectId}</span> : null}
      </label>

      <label className="form-field">
        <span>OAuth Client ID</span>
        <input
          className={errors.clientId ? "error" : ""}
          onChange={(e) => onChange("clientId", e.target.value)}
          placeholder="441744xxx.apps.googleusercontent.com"
          type="text"
          value={values.clientId ?? ""}
        />
        {errors.clientId ? <span className="field-error">{errors.clientId}</span> : null}
      </label>

      <label className="form-field">
        <span>OAuth Client Secret</span>
        <input
          className={errors.clientSecret ? "error" : ""}
          onChange={(e) => onChange("clientSecret", e.target.value)}
          placeholder={values.clientSecret === MASKED_SENTINEL ? MASKED_SENTINEL : "GOCSPX-..."}
          type="password"
          value={values.clientSecret ?? ""}
        />
        {errors.clientSecret ? <span className="field-error">{errors.clientSecret}</span> : null}
      </label>

      <label className="form-field">
        <span>Dataset ID</span>
        <input
          onChange={(e) => onChange("datasetId", e.target.value)}
          placeholder={values.datasetId ? values.datasetId : "Auto-set when you select a GA4 property"}
          type="text"
          value={values.datasetId ?? ""}
        />
        <span className="form-hint">Derived automatically from your GA4 property selection (e.g. analytics_516611632). Override only if your export uses a custom dataset name.</span>
      </label>
    </>
  );
}

// ─── Build authConfig from form values ────────────────────────────────────

function buildAuthConfig(provider: IntegrationProvider, values: Record<string, string>): AuthConfig | null {
  if (provider === "powerbi") {
    return {
      authType: "token-endpoint",
      token: values.clientSecret ?? "",
      endpoint: `https://login.microsoftonline.com/${values.tenantId ?? "common"}/oauth2/v2.0/token`
    };
  }

  if (provider === "google-analytics") {
    const credType = values.credentialType ?? "oauth2-code-flow";
    if (credType === "service-account") {
      return { authType: "service-account", serviceAccountJson: values.serviceAccountJson ?? "" };
    }
    return { authType: "oauth2-code-flow", clientId: values.clientId ?? "", clientSecret: values.clientSecret ?? "" };
  }

  if (provider === "bigquery") {
    return {
      authType: "oauth2-code-flow",
      clientId: values.clientId ?? "",
      clientSecret: values.clientSecret ?? ""
    };
  }

  if (provider === "snowflake") {
    return {
      authType: "api-key",
      apiKey: values.patToken ?? ""
    };
  }

  return null;
}

function buildProviderFields(provider: IntegrationProvider, values: Record<string, string>): Record<string, string> {
  if (provider === "powerbi") {
    return {
      tenantId: values.tenantId ?? "",
      clientId: values.clientId ?? "",
      workspaceId: values.workspaceId ?? ""
    };
  }
  if (provider === "google-analytics") {
    // propertyId is managed via GA4PropertySelector after credential save
    return { propertyId: values.propertyId ?? "" };
  }
  if (provider === "bigquery") {
    return {
      projectId: values.projectId ?? "",
      propertyId: values.propertyId ?? "",
      propertyName: values.propertyName ?? "",
      datasetId: values.datasetId ?? ""
    };
  }
  if (provider === "snowflake") {
    return { accountId: values.accountId ?? "" };
  }
  return {};
}

// ─── Validation ────────────────────────────────────────────────────────────

function validate(provider: IntegrationProvider, displayName: string, values: Record<string, string>): FormErrors {
  const errors: FormErrors = {};
  if (!displayName.trim()) errors.displayName = "Display name is required";

  if (provider === "powerbi") {
    if (!values.tenantId?.trim()) errors.tenantId = "Tenant ID is required";
    if (!values.clientId?.trim()) errors.clientId = "Client ID is required";
    if (!values.clientSecret?.trim() || values.clientSecret === MASKED_SENTINEL)
      errors.clientSecret = "Client secret is required";
  }

  if (provider === "google-analytics") {
    const credType = values.credentialType ?? "oauth2-code-flow";
    if (credType === "oauth2-code-flow") {
      if (!values.clientId?.trim()) errors.clientId = "Client ID is required";
      if (!values.clientSecret?.trim() || values.clientSecret === MASKED_SENTINEL)
        errors.clientSecret = "Client Secret is required";
    }
    if (credType === "service-account" && (!values.serviceAccountJson?.trim() || values.serviceAccountJson === MASKED_SENTINEL))
      errors.serviceAccountJson = "Service account JSON is required";
  }

  if (provider === "bigquery") {
    if (!values.projectId?.trim()) errors.projectId = "GCP Project ID is required";
    if (!values.clientId?.trim()) errors.clientId = "OAuth Client ID is required";
    if (!values.clientSecret?.trim() || values.clientSecret === MASKED_SENTINEL)
      errors.clientSecret = "OAuth Client Secret is required";
  }

  if (provider === "snowflake") {
    if (!values.accountId?.trim()) errors.accountId = "Account identifier is required";
    if (!values.patToken?.trim() || values.patToken === MASKED_SENTINEL)
      errors.patToken = "PAT token is required";
  }

  return errors;
}

// ─── Seed initial values from existing integration ─────────────────────────

function seedValues(provider: IntegrationProvider, existing: PublicIntegration | null | undefined): Record<string, string> {
  const values: Record<string, string> = {};

  if (!existing) return values;

  const pf = existing.providerFields as Record<string, string>;
  Object.assign(values, pf);

  const ac = existing.authConfig as Record<string, string>;
  if (ac.authType) values.credentialType = ac.authType;

  // Seed masked sentinel for secrets that are already set
  if (ac.authType === "api-key") values.apiKey = MASKED_SENTINEL;
  if (ac.authType === "oauth2") {
    values.accessToken = MASKED_SENTINEL;
    if (ac.refreshToken) values.refreshToken = MASKED_SENTINEL;
  }
  if (ac.authType === "service-account") values.serviceAccountJson = MASKED_SENTINEL;
  if (ac.authType === "token-endpoint") {
    values.token = MASKED_SENTINEL;
    values.clientSecret = MASKED_SENTINEL;
  }
  if (ac.authType === "oauth2-code-flow") {
    values.clientId = ac.clientId ?? "";
    values.clientSecret = MASKED_SENTINEL;
  }
  if (ac.authType === "api-key") {
    values.patToken = MASKED_SENTINEL;
  }

  return values;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function IntegrationForm({ provider, existing, onSave, onCancel }: Props) {
  const [displayName, setDisplayName] = useState(existing?.displayName ?? "");
  const [values, setValues] = useState<Record<string, string>>(() => seedValues(provider, existing));
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function onChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate(provider, displayName, values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const authConfig = buildAuthConfig(provider, values);
    if (!authConfig) return;

    setIsSaving(true);
    try {
      await onSave({
        displayName,
        authConfig,
        providerFields: buildProviderFields(provider, values)
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="integration-form" onSubmit={onSubmit}>
      <label className="form-field">
        <span>Display name</span>
        <input
          className={errors.displayName ? "error" : ""}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="My Data connection"
          type="text"
          value={displayName}
        />
        {errors.displayName ? <span className="field-error">{errors.displayName}</span> : null}
      </label>

      {provider === "powerbi" ? <PowerBIFields errors={errors} onChange={onChange} values={values} /> : null}
      {provider === "google-analytics" ? <GoogleAnalyticsFields errors={errors} onChange={onChange} values={values} /> : null}
      {provider === "bigquery" ? <BigQueryFields errors={errors} onChange={onChange} values={values} /> : null}
      {provider === "snowflake" ? <SnowflakeFormFields errors={errors} onChange={onChange} values={values} /> : null}

      <div className="form-actions">
        <button className="btn-primary" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : "Save connection"}
        </button>
        <button className="btn-ghost" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
