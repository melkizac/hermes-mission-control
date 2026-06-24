import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import { AgentAvatar } from "./AgentAvatar";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ViewKey } from "../types";

type NavRouteItem = { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavActionItem = { action: "logout"; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavLinkItem = { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavItem = NavRouteItem | NavActionItem | NavLinkItem;

type NavGroup = { label: string; items: NavItem[]; system?: boolean };

const workforceSelectorKeys: ViewKey[] = ["skills", "tools", "plugins", "memory", "reflections"];

function isRouteItem(item: NavItem): item is NavRouteItem {
  return "key" in item;
}

function isLinkItem(item: NavItem): item is NavLinkItem {
  return "href" in item;
}

function navItemKey(item: NavItem) {
  if (isRouteItem(item)) return item.key;
  if (isLinkItem(item)) return item.href;
  return item.action;
}

const simplifiedWorkspaceGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { key: "mission", label: "Chat", icon: "chat" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { key: "dashboard", label: "Dashboard", icon: "dashboard" },
      { key: "projects", label: "Projects", icon: "projects" },
      { key: "files", label: "Files", icon: "folder" },
      { key: "board", label: "Task Board", icon: "board" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "automations", label: "Routines", icon: "automations" },
      { key: "workflow-library", label: "Workflows", icon: "workflow" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { key: "agents", label: "Agents", icon: "agents" },
      { key: "agent-org", label: "Org Chart", icon: "agentOrg" },
      { key: "skills", label: "Skills", icon: "skills" },
      { key: "tools", label: "Tools", icon: "tools" },
      { key: "plugins", label: "Plugins", icon: "plugins" },
      { key: "memory", label: "Memory", icon: "memory" },
      { key: "reflections", label: "Reflections", icon: "reflections" },
      { key: "approvals", label: "Approvals", icon: "approvals" },
    ],
  },
  {
    label: "System",
    system: true,
    items: [
      { key: "profile", label: "Profile", icon: "profile" },
      { key: "settings", label: "Settings", icon: "settings" },
      { key: "models", label: "Models & limits", icon: "modelRouter" },
      { href: "/docs#daily-flow", label: "Docs", icon: "file" },
      { action: "logout", label: "Log out", icon: "logout" },
    ],
  },
];

const adminConsoleGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { key: "settings", label: "Admin Console", icon: "dashboard" },
      { key: "users-workspaces", label: "Users & Workspaces", icon: "profile" },
      { key: "workspace-runtime-console", label: "Workspace Runtime Console", icon: "runtimes" },
      { key: "agent-platform-admin", label: "Platform Agent Org", icon: "agentOrg" },
      { key: "shared-agent-templates", label: "Shared Agent Templates", icon: "agents" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { key: "desktop-gateway", label: "Hermes Desktop", icon: "dashboard" },
      { key: "runtimes", label: "Runtime Connectors", icon: "runtimes" },
      { key: "workflow-library", label: "Workflow Templates Admin", icon: "skills" },
      { key: "research-runs", label: "Research Run Monitor", icon: "audit" },
      { key: "capabilities", label: "Capabilities", icon: "setup" },
      { key: "automations", label: "Routine Governance", icon: "automations" },
    ],
  },
  {
    label: "Governance",
    items: [
      { key: "audit", label: "Runs / Activity", icon: "audit" },
      { key: "costs", label: "Costs / Usage", icon: "costs" },
      { key: "approval-policy", label: "Approval Rules", icon: "approvals" },
    ],
  },
];

// S1 route preservation note: these legacy workspace routes remain available via
// Home action cards, Project/Task detail surfaces, deep links, Settings/Advanced, and
// direct URLs even though they are intentionally no longer primary workspace nav items.
// Previous primary nav fixture kept for regression context only:
// const visibleGroups = uiMode === "admin" ? adminConsoleGroups : primaryGroups;
// { key: "approvals", label: "Needs Attention", icon: "approvals" }
// { key: "delegate-work", label: "Delegate Work", icon: "send" }
// { key: "workflow-library", label: "Workflow Library", icon: "skills" }
// { key: "work", label: "Work", icon: "board" }
// label: "Account"
// label: "Profile"
// label: "My AI Workforce"
// label: "Knowledge & Evidence"

type RailStatus = {
  gateway?: { running?: boolean };
};

type UsageWindow = { label?: string; percent_used?: number; remaining_percent?: number; reset_label?: string };
type UsageRemainingSummary = {
  daily?: UsageWindow;
  weekly?: UsageWindow;
};

async function requestStatus(): Promise<RailStatus> {
  const url = `${window.location.protocol}//${window.location.host}/api/status`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<RailStatus>;
}

async function requestUsageRemaining(): Promise<UsageRemainingSummary | null> {
  const url = `${window.location.protocol}//${window.location.host}/api/costs?days=30`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json() as { model_usage?: UsageRemainingSummary };
  return data.model_usage ?? null;
}

function remainingPercent(window?: UsageWindow) {
  const explicit = Number(window?.remaining_percent);
  if (Number.isFinite(explicit)) return `${Math.max(0, Math.min(100, Math.round(explicit)))}%`;
  if (window?.percent_used === undefined || window?.percent_used === null) return "—";
  const used = Number(window.percent_used);
  if (!Number.isFinite(used)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(100 - used)))}%`;
}

function UsageRemainingPeek({ usage }: { usage: UsageRemainingSummary | null }) {
  const rows = [usage?.daily, usage?.weekly].filter(Boolean) as UsageWindow[];
  return (
    <div className="settings-usage-peek" aria-label="Rate limits summary">
      {(rows.length ? rows : [{ label: "5h" }, { label: "Weekly" }]).map((row) => (
        <div className="settings-usage-row" key={row.label}>
          <b>{row.label}</b>
          <span>{remainingPercent(row)}</span>
          <em>{row.reset_label || "—"}</em>
        </div>
      ))}
    </div>
  );
}

export function NavRail() {
  const { view, setView, uiMode, setUiMode, permissions, agents, selected, selectedId, select } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);
  const [usageRemaining, setUsageRemaining] = useState<UsageRemainingSummary | null>(null);
  const [workforceMenuOpen, setWorkforceMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [usagePeekOpen, setUsagePeekOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem("hmc-nav-collapsed") === "true");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next = await requestStatus();
        if (alive) setStatus(next);
      } catch {
        if (alive) setStatus(null);
      }
    };
    const timer = window.setTimeout(() => {
      void load();
    }, 5000);
    const interval = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!settingsOpen || !usagePeekOpen) return;
    let alive = true;
    requestUsageRemaining()
      .then((next) => { if (alive) setUsageRemaining(next); })
      .catch(() => { if (alive) setUsageRemaining(null); });
    return () => { alive = false; };
  }, [settingsOpen, usagePeekOpen]);

  useEffect(() => {
    if (settingsOpen) setUsagePeekOpen(true);
  }, [settingsOpen]);

  useEffect(() => {
    window.localStorage.setItem("hmc-nav-collapsed", String(collapsed));
    if (collapsed) {
      setSettingsOpen(false);
      setUsagePeekOpen(false);
      setWorkforceMenuOpen(false);
      setAgentMenuOpen(false);
    }
  }, [collapsed]);

  const gatewayOnline = status?.gateway?.running ?? true;
  const visibleGroups = uiMode === "admin" ? adminConsoleGroups : simplifiedWorkspaceGroups;
  const workspaceSystemGroup = simplifiedWorkspaceGroups.find((group) => group.system);
  const workspaceSystemItems = workspaceSystemGroup?.items ?? [];
  const settingsActive = view === "profile" || view === "settings" || view === "models" || view === "usage";
  const workforceSelectorItems = simplifiedWorkspaceGroups
    .find((group) => group.label === "Workforce")
    ?.items.filter((item): item is NavRouteItem => isRouteItem(item) && workforceSelectorKeys.includes(item.key)) ?? [];
  const workforceSelectorActive = workforceSelectorKeys.includes(view);
  const workforceMenuExpanded = !collapsed && (workforceMenuOpen || workforceSelectorActive);
  const activeProfile = selected ?? agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const activeProfileLabel = activeProfile?.name ?? "Melkizac";
  const activeProfileMeta = activeProfile?.squad || activeProfile?.statusLabel || "Active profile";

  async function handleLogout() {
    try {
      await fetch(`${window.location.protocol}//${window.location.host}/api/logout`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } finally {
      window.location.href = "/login";
    }
  }

  function switchToUserMode() {
    window.history.pushState({}, "", "/app");
    setUiMode("workspace");
    setView("mission");
    setSettingsOpen(false);
  }


  function switchToAdminMode() {
    window.history.pushState({}, "", "/admin");
    setUiMode("admin");
    setView("settings");
    setSettingsOpen(false);
  }

  return (
    <nav className={"rail" + (collapsed ? " collapsed" : "")} aria-label={collapsed ? "Mission Control navigation collapsed" : "Mission Control navigation"}>
      <div className="ws">
        <button
          className="rail-brand-toggle"
          onClick={() => setCollapsed((next) => !next)}
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          aria-expanded={!collapsed}
          data-tooltip={collapsed ? "Open sidebar" : "Close sidebar"}
        >
          <span className="mark">
            <img src={logoUrl} alt="Melverick_OS logo" />
          </span>
          <span className="rail-toggle-icon" aria-hidden="true">
            <Icon name="sidebar" size={18} />
          </span>
        </button>
        <b className="brand-name">Melverick_OS</b>
        <span
          className="brand-status-dot"
          style={{ background: gatewayOnline ? "var(--good)" : "var(--bad)" }}
          aria-label={gatewayOnline ? "System online" : "System offline"}
          title={gatewayOnline ? "System online" : "System offline"}
        />
        {!collapsed && (
          <button
            className="rail-collapse-button"
            onClick={() => setCollapsed(true)}
            aria-label="Close sidebar"
            data-tooltip="Close sidebar"
          >
            <Icon name="sidebar" size={18} />
          </button>
        )}
      </div>

      <div className="nav scroll">
        {visibleGroups.map((group) => (
          <div className={"nav-group" + (group.system ? " system-nav" : "")} key={group.label || "primary-chat"}>
            {group.label && <div className="nlabel">{group.label}</div>}
            {group.items.map((it) => {
              if (uiMode !== "admin" && group.label === "Workforce" && isRouteItem(it) && workforceSelectorKeys.includes(it.key)) {
                if (it.key !== workforceSelectorKeys[0]) return null;
                return (
                  <div className="workforce-selector" key="workforce-selector">
                    <button
                      className={"nitem workforce-selector-trigger" + (workforceSelectorActive ? " on" : "")}
                      onClick={() => setWorkforceMenuOpen((open) => !open)}
                      aria-haspopup="menu"
                      aria-expanded={workforceMenuExpanded}
                      data-tooltip="Capabilities"
                      title={collapsed ? "Capabilities" : undefined}
                    >
                      <Icon name="setup" size={17} />
                      <span className="nav-text">Capabilities</span>
                      <span className={"nav-right-icon workforce-chevron" + (workforceMenuExpanded ? " open" : "")}>
                        <Icon name="chevronDown" size={15} />
                      </span>
                    </button>
                    {workforceMenuExpanded && (
                      <div className="workforce-menu" role="menu" aria-label="Capabilities">
                        {workforceSelectorItems.map((item) => {
                          const active = view === item.key;
                          return (
                            <button
                              key={item.key}
                              className={"workforce-menu-item" + (active ? " on" : "")}
                              onClick={() => {
                                setView(item.key);
                                setWorkforceMenuOpen(true);
                              }}
                              role="menuitem"
                            >
                              <Icon name={item.icon} size={17} />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              const active = isRouteItem(it) && view === it.key;
              const key = navItemKey(it);
              if (isLinkItem(it)) {
                return (
                  <a key={key} className="nitem" href={it.href} data-tooltip={it.label} title={collapsed ? it.label : undefined}>
                    <Icon name={it.icon} size={17} />
                    <span className="nav-text">{it.label}</span>
                  </a>
                );
              }
              const onClick = isRouteItem(it) ? () => setView(it.key) : () => void handleLogout();
              return (
                <button
                  key={key}
                  className={"nitem" + (active ? " on" : "")}
                  onClick={onClick}
                  data-tooltip={it.label}
                  title={collapsed ? it.label : undefined}
                >
                  <Icon name={it.icon} size={17} />
                  <span className="nav-text">{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="profile-selector-dock">
          <button
            className={"profile-selector-trigger" + (agentMenuOpen ? " on" : "")}
            type="button"
            onClick={() => setAgentMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={agentMenuOpen}
            aria-label={`Active profile: ${activeProfileLabel}. Select agent profile`}
          >
            {activeProfile ? (
              <AgentAvatar agent={activeProfile} className="profile-selector-avatar" />
            ) : (
              <span className="profile-selector-avatar profile-selector-avatar-fallback">M</span>
            )}
            <span className="profile-selector-copy">
              <span>Active profile</span>
              <b>{activeProfileLabel}</b>
              <small>{activeProfileMeta}</small>
            </span>
            <Icon name="chevronDown" size={15} />
          </button>
          {agentMenuOpen && (
            <div className="profile-selector-menu" role="listbox" aria-label="Select active agent profile">
              {(agents.length ? agents : activeProfile ? [activeProfile] : []).map((agent) => {
                const active = agent.id === activeProfile?.id;
                return (
                  <button
                    key={agent.id}
                    className={"profile-selector-menu-item" + (active ? " on" : "")}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      select(agent.id);
                      setView("mission");
                      setAgentMenuOpen(false);
                    }}
                  >
                    <AgentAvatar agent={agent} className="profile-selector-menu-avatar" />
                    <span>
                      <b>{agent.name}</b>
                      <small>{agent.squad || agent.statusLabel || agent.model}</small>
                    </span>
                    {active && <Icon name="check" size={15} />}
                  </button>
                );
              })}
              {!agents.length && !activeProfile && <div className="profile-selector-empty">No agents available</div>}
            </div>
          )}
        </div>
      )}

      {!collapsed && (
        <div className="settings-dock">
          {settingsOpen && (
            <div className="settings-menu" role="menu" aria-label="System menu">
              {permissions.accountIsAdmin && (
                <div className="settings-mode-toggle" aria-label="Profile mode">
                  <button
                    className={"settings-mode-toggle-button" + (uiMode === "workspace" ? " on" : "")}
                    aria-pressed={uiMode === "workspace"}
                    onClick={switchToUserMode}
                    type="button"
                  >
                    User
                  </button>
                  <button
                    className={"settings-mode-toggle-button" + (uiMode === "admin" ? " on" : "")}
                    aria-pressed={uiMode === "admin"}
                    onClick={switchToAdminMode}
                    type="button"
                  >
                    Admin
                  </button>
                </div>
              )}
              {workspaceSystemItems.map((it, index) => {
                const active = isRouteItem(it) && view === it.key;
                const key = navItemKey(it);
                if (isLinkItem(it)) {
                  return (
                    <div key={key}>
                      {index === 2 && <div className="settings-menu-divider" />}
                      <a className="settings-menu-item" href={it.href} role="menuitem">
                        <Icon name={it.icon} size={17} />
                        {it.label}
                      </a>
                    </div>
                  );
                }
                const onClick = isRouteItem(it)
                  ? () => {
                      setView(it.key);
                      setSettingsOpen(false);
                    }
                  : () => {
                      setSettingsOpen(false);
                      void handleLogout();
                    };
                if (isRouteItem(it) && it.key === "usage") {
                  return (
                    <div key={key}>
                      {index === 2 && <div className="settings-menu-divider" />}
                      <div className={"settings-menu-row" + (active ? " on" : "")}>
                        <button
                          className="settings-menu-item settings-menu-primary"
                          onClick={onClick}
                          role="menuitem"
                        >
                          <Icon name={it.icon} size={17} />
                          {it.label}
                        </button>
                        <button
                          className={"settings-menu-expand" + (usagePeekOpen ? " open" : "")}
                          onClick={(event) => {
                            event.stopPropagation();
                            setUsagePeekOpen((open) => !open);
                          }}
                          aria-label={usagePeekOpen ? "Hide rate limits details" : "Show rate limits details"}
                          aria-expanded={usagePeekOpen}
                          title={usagePeekOpen ? "Hide rate limits details" : "Show rate limits details"}
                        >
                          <Icon name="chevronDown" size={15} />
                        </button>
                      </div>
                      {usagePeekOpen && <UsageRemainingPeek usage={usageRemaining} />}
                    </div>
                  );
                }
                return (
                  <div key={key}>
                    {index === 2 && <div className="settings-menu-divider" />}
                    <button className={"settings-menu-item" + (active ? " on" : "")} onClick={onClick} role="menuitem">
                      <Icon name={it.icon} size={17} />
                      {it.label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            className={"settings-trigger" + (settingsActive || settingsOpen ? " on" : "")}
            onClick={() => setSettingsOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={settingsOpen}
            aria-label={settingsOpen ? "Hide Settings menu with rate limit details" : "Open Settings menu with rate limit details"}
            title="Settings and rate limit details"
            data-tooltip="Settings"
          >
            <Icon name="settings" size={18} />
            Settings
          </button>
        </div>
      )}
    </nav>
  );
}
