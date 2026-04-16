import Link from "next/link";
import { ChevronDown, Zap } from "lucide-react";

export function Topbar({
  children,
  title,
  onBrandClick
}: {
  children?: React.ReactNode;
  title?: string;
  onBrandClick?: () => void;
}) {
  const brandContent = (
    <>
      <div className="brand-icon">
        <Zap size={14} strokeWidth={2.5} />
      </div>
      <div className="brand-mark">Broly</div>
    </>
  );

  return (
    <header className="topbar">
      {onBrandClick ? (
        <button
          aria-label="Broly home"
          className="brand-block"
          onClick={onBrandClick}
          type="button"
        >
          {brandContent}
        </button>
      ) : (
        <Link className="brand-block" href="/" aria-label="Broly home">
          {brandContent}
        </Link>
      )}

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
