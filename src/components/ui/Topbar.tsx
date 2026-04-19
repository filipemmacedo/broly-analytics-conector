import Link from "next/link";

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
        <img alt="Broly logo" src="/broly.png" />
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
        </div>
      ) : <div />}
    </header>
  );
}
