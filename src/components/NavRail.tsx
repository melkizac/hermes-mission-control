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

const workspaceUtilityItems: NavRouteItem[] = [
  { key: "approvals", label: "Approvals", icon: "approvals" },
  { key: "usage", label: "Usage", icon: "usage" },
  { key: "capabilities", label: "Capabilities", icon: "setup" },
];

const adminConsoleGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { key: "desktop-gateway", label: "Admin Console", icon: "dashboard" },
      { key: "users-workspaces", label: "Users & Workspaces", icon: "profile" },
      { key: "workspace-runtime-console", label: "Workspace Runtime Console", icon: "runtimes" },
      { key: "agent-platform-admin", label: "Platform Agent Org", icon: "agentOrg" },
      { key: "shared-agent-templates", label: "Shared Agent Templates", icon: "agents" },
    ],
  },
  {
    label: "Runtime",
    items: [
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

type InboxSummary = { drafted?: number; ready?: number };
type InboxItem = { status?: string };
type InboxPayload = { summary?: InboxSummary; items?: InboxItem[] };

async function requestStatus(): Promise<RailStatus> {
  const url = `${window.location.protocol}//${window.location.host}/api/status`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<RailStatus>;
}

async function requestApprovalCount(fallbackCount: number): Promise<number> {
  const url = `${window.location.protocol}//${window.location.host}/api/inbox`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  const inbox = await res.json() as InboxPayload;
  if (inbox.summary) return Number(inbox.summary.drafted ?? 0) + Number(inbox.summary.ready ?? 0);
  if (!Array.isArray(inbox.items)) return fallbackCount;
  return inbox.items.filter((item) => item.status === "drafted" || item.status === "ready").length;
}

export function NavRail() {
  const { view, setView, uiMode, approvals, agents, selected, selectedId, select } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);
  const [approvalCount, setApprovalCount] = useState(approvals.length);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
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
    let alive = true;
    const load = async () => {
      try {
        const next = await requestApprovalCount(approvals.length);
        if (alive) setApprovalCount(next);
      } catch {
        if (alive) setApprovalCount(approvals.length);
      }
    };
    const timer = window.setTimeout(() => {
      void load();
    }, 20000);
    const interval = window.setInterval(load, 60000);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [approvals.length]);

  useEffect(() => {
    window.localStorage.setItem("hmc-nav-collapsed", String(collapsed));
    if (collapsed) {
      setAgentMenuOpen(false);
    }
  }, [collapsed]);

  const gatewayOnline = status?.gateway?.running ?? true;
  const visibleGroups = uiMode === "admin" ? adminConsoleGroups : simplifiedWorkspaceGroups;
  const settingsActive = view === "settings";
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
              const active = isRouteItem(it) && view === it.key;
              const key = navItemKey(it);
              const approvalBadge = isRouteItem(it) && it.key === "approvals" && approvalCount > 0
                ? (approvalCount > 99 ? "99+" : String(approvalCount))
                : null;
              const collapsedTitle = collapsed && approvalBadge ? `${it.label} (${approvalBadge})` : collapsed ? it.label : undefined;
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
                  data-tooltip={collapsedTitle ?? it.label}
                  title={collapsedTitle}
                >
                  <Icon name={it.icon} size={17} />
                  <span className="nav-text">{it.label}</span>
                  {approvalBadge && <span className="pill" aria-label={`${approvalBadge} pending approvals`}>{approvalBadge}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {!collapsed && (
        <div className="utility-dock" aria-label="Utilities">
          {workspaceUtilityItems.map((item) => {
            const active = view === item.key;
            const approvalBadge = item.key === "approvals" && approvalCount > 0
              ? (approvalCount > 99 ? "99+" : String(approvalCount))
              : null;
            return (
              <button
                key={item.key}
                className={"utility-dock-button" + (active ? " on" : "")}
                type="button"
                aria-label={approvalBadge ? `${item.label}, ${approvalBadge} pending` : item.label}
                title={item.label}
                data-tooltip={item.label}
                onClick={() => {
                  setView(item.key);
                }}
              >
                <Icon name={item.icon} size={18} />
                {approvalBadge && <span className="utility-dock-badge">{approvalBadge}</span>}
              </button>
            );
          })}
          <button
            className={"utility-dock-button utility-settings-button" + (settingsActive ? " on" : "")}
            type="button"
            onClick={() => setView("settings")}
            aria-label="Open Settings"
            title="Settings"
            data-tooltip="Settings"
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
      )}

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

    </nav>
  );
}
