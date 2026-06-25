import { ReactNode, useEffect, useRef, useState } from "react";

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
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const tabRailRef = useRef<HTMLElement | null>(null);
  const scrollTabs = (direction: -1 | 1) => {
    tabRailRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const rail = tabRailRef.current;
    if (!rail || !tabs?.length) return undefined;
    const syncOverflow = () => setTabsOverflow(rail.scrollWidth > rail.clientWidth + 2);
    syncOverflow();
    const resizeObserver = new ResizeObserver(syncOverflow);
    resizeObserver.observe(rail);
    window.addEventListener("resize", syncOverflow);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", syncOverflow);
    };
  }, [tabs?.length]);

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
          <div className={`mc-drawer-tab-rail ${tabsOverflow ? "has-overflow" : "no-overflow"}`} aria-label="Detail sections">
            <button className="mc-drawer-tab-arrow" type="button" aria-label="Scroll tabs left" onClick={() => scrollTabs(-1)}>‹</button>
            <nav className="mc-drawer-tabs" ref={tabRailRef}>
              {tabs.map((item) => (
                <button key={item} className={activeTab === item ? "on" : ""} aria-current={activeTab === item ? "page" : undefined} onClick={() => onTabChange(item)}>{item}</button>
              ))}
            </nav>
            <button className="mc-drawer-tab-arrow" type="button" aria-label="Scroll tabs right" onClick={() => scrollTabs(1)}>›</button>
          </div>
        )}

        {actions && <div className="mc-drawer-actions">{actions}</div>}
        <div className={`mc-drawer-body ${contentClassName}`.trim()}>{children}</div>
      </aside>
    </div>
  );
}
