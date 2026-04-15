import Link from "next/link";
import { ChevronDown, Zap } from "lucide-react";

export function Topbar({
  children,
  title
}: {
  children?: React.ReactNode;
  title?: string;
}) {
  return (
    <header className="topbar">
      <Link className="brand-block" href="/" aria-label="Broly home">
        <div className="brand-icon">
          <Zap size={14} strokeWidth={2.5} />
        </div>
        <div className="brand-mark">Broly</div>
      </Link>

      {children ? <div className="topbar-actions">{children}</div> : null}

      {title ? (
        <div className="topbar-title" title={title}>
          <span>{title}</span>
          <ChevronDown size={14} strokeWidth={1.75} />
        </div>
      ) : <div />}
    </header>
  );
}
