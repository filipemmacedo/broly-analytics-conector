import Link from "next/link";

import { Topbar } from "@/components/ui/Topbar";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-shell">
      <Topbar />

      <div className="settings-layout">
        <aside className="settings-nav">
          <div className="settings-nav-header">Settings</div>
          <nav>
            <Link className="settings-nav-link" href="/settings/integrations">
              Integrations
            </Link>
          </nav>
        </aside>
        <main className="settings-content">{children}</main>
      </div>
    </div>
  );
}
