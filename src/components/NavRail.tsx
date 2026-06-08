import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ViewKey } from "../types";

type NavRouteItem = { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavActionItem = { action: "logout"; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavLinkItem = { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavItem = NavRouteItem | NavActionItem | NavLinkItem;

type NavGroup = { label: string; items: NavItem[]; system?: boolean };

const workforceSelectorKeys: ViewKey[] = ["skills", "memory", "tools", "plugins"];

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
      { key: "board", label: "Task Board", icon: "board" },
    ],
  },
  {
    label: "Operations",
    items: [
      { key: "automations", label: "Routines", icon: "automations" },
      { key: "workflow-library", label: "Workflows", icon: "skills" },
    ],
  },
  {
    label: "Workforce",
    items: [
      { key: "agents", label: "Agents", icon: "agents" },
      { key: "agent-org", label: "Org Chart", icon: "agentOrg" },
      { key: "skills", label: "Capabilities", icon: "skills" },
      { key: "memory", label: "Memory", icon: "memory" },
      { key: "tools", label: "Tools", icon: "setup" },
      { key: "plugins", label: "Plugins", icon: "setup" },
      { key: "approvals", label: "Approvals", icon: "approvals" },
    ],
  },
  {
    label: "System",
    system: true,
    items: [
      { key: "profile", label: "Profile", icon: "profile" },
      { key: "settings", label: "Settings", icon: "settings" },
      { key: "costs", label: "Usage remaining", icon: "usage" },
      { href: "/docs#daily-flow", label: "Docs", icon: "file" },
      { action: "logout", label: "Log out", icon: "logout" },
    ],
  },
];

const adminConsoleGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { key: "settings", label: "Hermes Desktop", icon: "dashboard" },
      { key: "users-workspaces", label: "User Access", icon: "profile" },
      { key: "workspace-runtime-console", label: "Workspace Runtime Console", icon: "runtimes" },
      { key: "agent-platform-admin", label: "Agent Platform Admin", icon: "agentOrg" },
      { key: "shared-agent-templates", label: "Shared Agent Templates", icon: "agents" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { key: "runtimes", label: "Runtime Connectors", icon: "runtimes" },
      { key: "desktop-gateway", label: "Desktop Gateway", icon: "setup" },
      { key: "workflow-library", label: "Workflow Library", icon: "skills" },
      { key: "research-runs", label: "Research Runs", icon: "audit" },
      { key: "models", label: "Model Router", icon: "modelRouter" },
      { key: "tools", label: "Tools", icon: "setup" },
      { key: "skills", label: "Skills", icon: "skills" },
      { key: "capabilities", label: "Capability Registry", icon: "setup" },
      { key: "automations", label: "Workflow Routine Admin", icon: "automations" },
    ],
  },
  {
    label: "Governance",
    items: [
      { key: "audit", label: "Global Audit Log", icon: "audit" },
      { key: "costs", label: "Costs / Usage", icon: "costs" },
      { key: "approval-policy", label: "Approval Policy", icon: "approvals" },
      { key: "quota", label: "Quota", icon: "dashboard" },
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

async function requestStatus(): Promise<RailStatus> {
  const url = `${window.location.protocol}//${window.location.host}/api/status`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<RailStatus>;
}

export function NavRail() {
  const { view, setView, uiMode } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);
  const [workforceMenuOpen, setWorkforceMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const gatewayOnline = status?.gateway?.running ?? true;
  const visibleGroups = uiMode === "admin" ? adminConsoleGroups : simplifiedWorkspaceGroups;
  const workspaceSystemGroup = simplifiedWorkspaceGroups.find((group) => group.system);
  const workspaceSystemItems = workspaceSystemGroup?.items ?? [];
  const settingsActive = view === "profile" || view === "settings" || view === "costs";
  const workforceSelectorItems = simplifiedWorkspaceGroups
    .find((group) => group.label === "Workforce")
    ?.items.filter((item): item is NavRouteItem => isRouteItem(item) && workforceSelectorKeys.includes(item.key)) ?? [];
  const workforceSelectorActive = workforceSelectorKeys.includes(view);

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

  return (
    <nav className="rail">
      <div className="ws">
        <span className="mark">
          <img src={logoUrl} alt="Melverick_OS logo" />
        </span>
        <b>Melverick_OS</b>
        <span
          className="brand-status-dot"
          style={{ background: gatewayOnline ? "var(--good)" : "var(--bad)" }}
          aria-label={gatewayOnline ? "System online" : "System offline"}
          title={gatewayOnline ? "System online" : "System offline"}
        />
      </div>

      <div className="nav scroll">
        {visibleGroups.map((group) => (
          <div className={"nav-group" + (group.system ? " system-nav" : "")} key={group.label || "primary-chat"}>
            {group.label && <div className="nlabel">{group.label}</div>}
            {group.items.map((it) => {
              if (uiMode !== "admin" && group.label === "Workforce" && isRouteItem(it) && workforceSelectorKeys.includes(it.key)) {
                if (it.key !== workforceSelectorKeys[0]) return null;
                const selectedItem = workforceSelectorItems.find((item) => item.key === view) ?? workforceSelectorItems[0];
                return (
                  <div className="workforce-selector" key="workforce-selector">
                    <button
                      className={"nitem workforce-selector-trigger" + (workforceSelectorActive ? " on" : "")}
                      onClick={() => setWorkforceMenuOpen((open) => !open)}
                      aria-haspopup="menu"
                      aria-expanded={workforceMenuOpen}
                    >
                      <Icon name={selectedItem.icon} size={17} />
                      {selectedItem.label}
                      <span className={"nav-right-icon workforce-chevron" + (workforceMenuOpen ? " open" : "")}>
                        <Icon name="chevronDown" size={15} />
                      </span>
                    </button>
                    {workforceMenuOpen && (
                      <div className="workforce-menu" role="menu" aria-label="Workforce resources">
                        {workforceSelectorItems.map((item) => {
                          const active = view === item.key;
                          return (
                            <button
                              key={item.key}
                              className={"workforce-menu-item" + (active ? " on" : "")}
                              onClick={() => {
                                setView(item.key);
                                setWorkforceMenuOpen(false);
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
                  <a key={key} className="nitem" href={it.href}>
                    <Icon name={it.icon} size={17} />
                    {it.label}
                  </a>
                );
              }
              const onClick = isRouteItem(it) ? () => setView(it.key) : () => void handleLogout();
              return (
                <button
                  key={key}
                  className={"nitem" + (active ? " on" : "")}
                  onClick={onClick}
                >
                  <Icon name={it.icon} size={17} />
                  {it.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {uiMode !== "admin" && (
        <div className="settings-dock">
          {settingsOpen && (
            <div className="settings-menu" role="menu" aria-label="System menu">
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
          >
            <Icon name="settings" size={18} />
            Settings
          </button>
        </div>
      )}
    </nav>
  );
}
