import { ReactNode, useEffect } from "react";

type DrawerWidth = "standard" | "wide" | "narrow";

type SlideOverDrawerProps<Tab extends string = string> = {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  statusClassName?: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  tabs?: readonly Tab[];
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  actions?: ReactNode;
  width?: DrawerWidth;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  dataDeepLinkTarget?: string;
};

export function SlideOverDrawer<Tab extends string = string>({
  title,
  subtitle,
  eyebrow,
  statusClassName,
  closeLabel = "Close details",
  onClose,
  children,
  tabs,
  activeTab,
  onTabChange,
  actions,
  width = "standard",
  className = "",
  contentClassName = "",
  ariaLabel,
  dataDeepLinkTarget,
}: SlideOverDrawerProps<Tab>) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="mc-drawer-layer" role="dialog" aria-modal="true" aria-label={ariaLabel || closeLabel.replace(/^Close /, "") || "Details"} data-deeplink-target={dataDeepLinkTarget}>
      <button className="mc-drawer-scrim" aria-label={closeLabel} onClick={onClose} />
      <aside className={`mc-drawer mc-drawer-${width} ${className}`.trim()}>
        <header className="mc-drawer-head">
          <div className="mc-drawer-title">
            {eyebrow && <span className={statusClassName || "tag muted"}>{eyebrow}</span>}
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="mc-drawer-close" onClick={onClose} aria-label={closeLabel}>×</button>
        </header>

        {tabs && tabs.length > 0 && activeTab && onTabChange && (
          <nav className="mc-drawer-tabs" aria-label="Detail sections">
            {tabs.map((item) => (
              <button key={item} className={activeTab === item ? "on" : ""} onClick={() => onTabChange(item)}>{item}</button>
            ))}
          </nav>
        )}

        {actions && <div className="mc-drawer-actions">{actions}</div>}
        <div className={`mc-drawer-body ${contentClassName}`.trim()}>{children}</div>
      </aside>
    </div>
  );
}
