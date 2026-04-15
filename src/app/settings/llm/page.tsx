import { LLMProviderCard } from "@/components/settings/LLMProviderCard";

export default function LLMSettingsPage() {
  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h2>LLM Provider</h2>
        <p className="settings-page-description">
          Configure which AI model powers Broly&apos;s conversational assistant.
        </p>
      </div>
      <LLMProviderCard />
    </div>
  );
}
