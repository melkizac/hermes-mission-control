import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import { AgentAvatar } from "./AgentAvatar";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ProjectChatResponse, ProjectChatSession, ViewKey } from "../types";

type NavRouteItem = { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavActionItem = { action: "logout"; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavLinkItem = { href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavItem = NavRouteItem | NavActionItem | NavLinkItem;

type NavGroup = { label: string; items: NavItem[]; system?: boolean };
type CollapsedGroups = Record<string, boolean>;

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
      { key: "agents", label: "Chat", icon: "chat" },
      { key: "projects", label: "Projects", icon: "projects" },
      { key: "files", label: "Files", icon: "folder" },
      { key: "board", label: "Task Board", icon: "board" },
      { key: "operations", label: "Automations", icon: "automations" },
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
  { key: "agent-org", label: "Org Chart", icon: "agentOrg" },
  { key: "capabilities", label: "Capabilities", icon: "setup" },
];

const collapsibleWorkspaceSections = new Set<string>();

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

async function requestProjectChats(): Promise<ProjectChatResponse | null> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/project-chats`, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<ProjectChatResponse>;
}

function sessionTimeLabel(value?: string) {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const diff = Date.now() - time;
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NavRail() {
  const { view, setView, uiMode, approvals, agents, selected, selectedId, permissions, setUiMode, select } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);
  const [projectChats, setProjectChats] = useState<ProjectChatResponse | null>(null);
  const [approvalCount, setApprovalCount] = useState(approvals.length);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [chatsCollapsed, setChatsCollapsed] = useState(() => window.localStorage.getItem("hmc-nav-chats-collapsed") === "true");
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem("hmc-nav-collapsed") === "true");
  const [collapsedGroups, setCollapsedGroups] = useState<CollapsedGroups>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("hmc-nav-collapsed-groups") || "{}") as CollapsedGroups;
    } catch {
      return {};
    }
  });

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
    if (uiMode === "admin") return;
    let alive = true;
    const timer = window.setTimeout(() => {
      void requestProjectChats()
        .then((next) => { if (alive) setProjectChats(next); })
        .catch(() => { if (alive) setProjectChats(null); });
    }, 900);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [uiMode]);

  useEffect(() => {
    window.localStorage.setItem("hmc-nav-collapsed", String(collapsed));
    if (collapsed) {
      setAgentMenuOpen(false);
    }
  }, [collapsed]);

  useEffect(() => {
    window.localStorage.setItem("hmc-nav-collapsed-groups", JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  useEffect(() => {
    window.localStorage.setItem("hmc-nav-chats-collapsed", String(chatsCollapsed));
  }, [chatsCollapsed]);

  const gatewayOnline = status?.gateway?.running ?? true;
  const visibleGroups = uiMode === "admin" ? adminConsoleGroups : simplifiedWorkspaceGroups;
  const settingsActive = view === "settings";
  const activeProfile = selected ?? agents.find((agent) => agent.id === selectedId) ?? agents[0];
  const activeProfileLabel = activeProfile?.name ?? "Melkizac";
  const activeProfileMeta = activeProfile?.squad || activeProfile?.statusLabel || "Active profile";
  const approvalBadge = approvalCount > 99 ? "99+" : String(approvalCount);

  useEffect(() => {
    const activeGroup = visibleGroups.find((group) => group.items.some((item) => isRouteItem(item) && item.key === view));
    if (!activeGroup?.label || !collapsibleWorkspaceSections.has(activeGroup.label)) return;
    setCollapsedGroups((current) => current[activeGroup.label] ? { ...current, [activeGroup.label]: false } : current);
  }, [view, visibleGroups]);

  function toggleNavGroup(label: string) {
    setCollapsedGroups((current) => ({ ...current, [label]: !current[label] }));
  }

  const chatSessions = (projectChats?.sessions ?? [])
    .filter((session) => session.human_initiated !== false)
    .slice()
    .sort((a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime())
    .slice(0, 5);

  function openChatSession(session: ProjectChatSession) {
    const needle = [session.project_owner, session.project_name, session.source, session.origin].filter(Boolean).join(" ").toLowerCase();
    const matchedAgent = agents.find((agent) => needle.includes(agent.id.toLowerCase()) || needle.includes(agent.name.toLowerCase()));
    if (matchedAgent) select(matchedAgent.id);
    window.dispatchEvent(new CustomEvent("hmc:open-chat-session", { detail: { sessionId: session.id } }));
    setView("agents");
  }

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
          className="rail-brand-home"
          onClick={() => {
            if (uiMode === "admin") setUiMode("workspace");
            setView("dashboard");
          }}
          aria-label="Go to Dashboard"
          data-tooltip="Dashboard"
        >
          <span className="mark">
            <img src={logoUrl} alt="Melverick_OS logo" />
          </span>
          <b className="brand-name">Melverick_OS</b>
          <span
            className="brand-status-dot"
            style={{ background: gatewayOnline ? "var(--good)" : "var(--bad)" }}
            aria-label={gatewayOnline ? "System online" : "System offline"}
            title={gatewayOnline ? "System online" : "System offline"}
          />
        </button>
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
            {group.label && collapsibleWorkspaceSections.has(group.label) ? (
              <button
                className={"nav-section-toggle" + (collapsedGroups[group.label] ? " collapsed" : "")}
                type="button"
                onClick={() => toggleNavGroup(group.label)}
                aria-expanded={!collapsedGroups[group.label]}
              >
                <span>{group.label}</span>
                <Icon name="chevronDown" size={13} />
              </button>
            ) : group.label ? <div className="nlabel">{group.label}</div> : null}
            {(collapsed || !collapsedGroups[group.label] ? group.items : []).map((it) => {
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
              const onClick = isRouteItem(it) ? () => {
                if (it.key === "agents") {
                  window.sessionStorage.removeItem("hmc:agents-manage-mode");
                  window.dispatchEvent(new CustomEvent("hmc:agents-chat-mode"));
                }
                setView(it.key);
              } : () => void handleLogout();
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
        {uiMode !== "admin" && (
          <section className="nav-chat-sessions" aria-label="Recent chat sessions">
            <button
              className={"nav-section-toggle nav-chat-toggle" + (chatsCollapsed ? " collapsed" : "")}
              type="button"
              onClick={() => setChatsCollapsed((next) => !next)}
              aria-expanded={!chatsCollapsed}
            >
              <span>Chats</span>
              <Icon name="chevronDown" size={13} />
            </button>
            {!chatsCollapsed && (
              <div className="nav-chat-list">
                {chatSessions.map((session) => (
                  <button key={session.id} className="nav-chat-session" type="button" onClick={() => openChatSession(session)} title={session.title}>
                    <span aria-hidden="true" />
                    <b>{session.title || session.project_name || "Untitled chat"}</b>
                    <small>{sessionTimeLabel(session.started_at)}</small>
                  </button>
                ))}
                {!chatSessions.length && <div className="nav-chat-empty">No saved chats yet</div>}
              </div>
            )}
          </section>
        )}
      </div>

      {!collapsed && (
        <div className="utility-dock" aria-label="Utilities">
          {workspaceUtilityItems.map((item) => {
            const active = view === item.key;
            return (
              <button
                key={item.key}
                className={"utility-dock-button" + (active ? " on" : "")}
                type="button"
                aria-label={item.label}
                title={item.label}
                data-tooltip={item.label}
                onClick={() => {
                  setView(item.key);
                }}
              >
                <Icon name={item.icon} size={18} />
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

      {approvalCount > 0 && (
        <button
          className={"top-approval-notification" + (view === "approvals" ? " on" : "")}
          type="button"
          onClick={() => setView("approvals")}
          aria-label={`Approvals, ${approvalBadge} pending`}
          title="Approvals"
        >
          <Icon name="approvals" size={20} />
          <span className="utility-dock-badge">{approvalBadge}</span>
        </button>
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
              <button
                className="profile-selector-manage"
                type="button"
                onClick={() => {
                  setAgentMenuOpen(false);
                  window.sessionStorage.setItem("hmc:agents-manage-mode", "true");
                  window.dispatchEvent(new CustomEvent("hmc:open-manage-profiles"));
                  setView("agents");
                }}
              >
                <Icon name="settings" size={17} />
                <span>Manage Profiles</span>
              </button>
              {permissions.accountIsAdmin && (
                <button
                  className="profile-selector-manage profile-selector-admin"
                  type="button"
                  onClick={() => {
                    setAgentMenuOpen(false);
                    setUiMode("admin");
                  }}
                >
                  <Icon name="dashboard" size={17} />
                  <span>Admin</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

    </nav>
  );
}
