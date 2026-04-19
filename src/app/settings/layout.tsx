import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Topbar } from "@/components/ui/Topbar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-shell">
      <Topbar />

      <div className="settings-layout">
        <aside className="settings-nav">
          <div className="settings-nav-header">Settings</div>
          <nav>
            <Link className="settings-nav-link settings-nav-link--home" href="/">
              <ArrowLeft size={13} strokeWidth={2} />
              Home
            </Link>
            <Link className="settings-nav-link" href="/settings/integrations">
              Integrations
            </Link>
            <Link className="settings-nav-link" href="/settings/llm">
              LLM Provider
            </Link>
          </nav>
        </aside>
        <main className="settings-content">{children}</main>
      </div>
    </div>
  );
}
