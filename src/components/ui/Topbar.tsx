import Link from "next/link";
import { Zap } from "lucide-react";

export function Topbar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <Link className="brand-block" href="/" aria-label="Broly home">
        <div className="brand-icon">
          <Zap size={14} strokeWidth={2.5} />
        </div>
        <div className="brand-mark">Broly</div>
      </Link>

      {children ? <div className="topbar-actions">{children}</div> : null}
    </header>
  );
}
