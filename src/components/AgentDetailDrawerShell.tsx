import { ReactNode, useRef, useState } from "react";

export type AgentDrawerTab = {
  id: string;
  label: string;
  count?: number;
  title?: string;
};

export type AgentDrawerAction = {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  dividerBefore?: boolean;
  onClick: () => void;
};

type AgentDetailDrawerShellProps = {
  title: string;
  avatar?: ReactNode;
  eyebrow?: string;
  subtitle?: ReactNode;
  summary?: ReactNode;
  statusTag?: ReactNode;
  tabs: AgentDrawerTab[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  actions?: AgentDrawerAction[];
  onClose?: () => void;
  ariaLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function AgentDetailDrawerShell({
  title,
  avatar,
  eyebrow,
  subtitle,
  summary,
  statusTag,
  tabs,
  activeTab,
  onTabChange,
  actions = [],
  onClose,
  ariaLabel,
  className = "",
  bodyClassName = "",
  children,
}: AgentDetailDrawerShellProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const tabRailRef = useRef<HTMLDivElement | null>(null);
  const scrollTabs = (direction: -1 | 1) => {
    tabRailRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  };
  const hasActions = actions.length > 0;

  return (
    <aside className={`agent-detail-shell ${className}`.trim()} aria-label={ariaLabel || `${title} details`} onClick={(e) => e.stopPropagation()}>
      {onClose && <button className="drawer-x" onClick={onClose} aria-label={`Close ${title} details`}>×</button>}
      <header className="agent-detail-shell-head">
        <div className="agent-detail-shell-copy">
          {statusTag}
          {eyebrow && <div className="sec-l tight">{eyebrow}</div>}
          <div className="drawer-title-row">
            {avatar && <div className="agent-detail-shell-avatar">{avatar}</div>}
            <h2>{title}</h2>
            {hasActions && <div className="drawer-kebab-wrap">
              <button className="drawer-kebab" type="button" aria-label={`Open actions for ${title}`} aria-expanded={actionMenuOpen} onClick={() => setActionMenuOpen((open) => !open)}>⋮</button>
              {actionMenuOpen && <div className="drawer-action-menu" role="menu">
                {actions.map((action) => (
                  <div className="drawer-action-menu-item" key={action.id}>
                    {action.dividerBefore && <i />}
                    <button role="menuitem" disabled={action.disabled} onClick={() => { setActionMenuOpen(false); action.onClick(); }}>
                      {action.icon && <span>{action.icon}</span>}{action.label}
                    </button>
                  </div>
                ))}
              </div>}
            </div>}
          </div>
          {subtitle && <div className="ctx-sub agent-detail-shell-subtitle">{subtitle}</div>}
          {summary && <p className="agent-detail-shell-summary">{summary}</p>}
        </div>
      </header>

      <div className="drawer-tab-rail" aria-label="Agent drawer sections">
        <button className="drawer-tab-arrow" type="button" aria-label="Scroll tabs left" onClick={() => scrollTabs(-1)}>‹</button>
        <nav className="drawer-tabs" ref={tabRailRef}>
          {tabs.map((tab) => (
            <button key={tab.id} className={activeTab === tab.id ? "on" : ""} aria-current={activeTab === tab.id ? "page" : undefined} onClick={() => onTabChange(tab.id)} title={tab.title || tab.label}>
              <span>{tab.label}</span>{Boolean(tab.count) && <em>{tab.count}</em>}
            </button>
          ))}
        </nav>
        <button className="drawer-tab-arrow" type="button" aria-label="Scroll tabs right" onClick={() => scrollTabs(1)}>›</button>
      </div>

      <div className={`agent-detail-shell-body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </aside>
  );
}
