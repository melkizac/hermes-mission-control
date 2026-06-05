import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ViewKey } from "../types";

type NavRouteItem = { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavActionItem = { action: "logout"; label: string; icon: Parameters<typeof Icon>[0]["name"] };
type NavItem = NavRouteItem | NavActionItem;

type NavGroup = { label: string; items: NavItem[] };

function isRouteItem(item: NavItem): item is NavRouteItem {
  return "key" in item;
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
      { key: "work", label: "Work", icon: "board" },
      { key: "board", label: "Task Board", icon: "board" },
      { key: "agents", label: "Agents", icon: "agents" },
      { key: "agent-org", label: "AI Workforce", icon: "agentOrg" },
      { key: "approvals", label: "Approvals", icon: "approvals" },
      { key: "evidence", label: "Evidence", icon: "audit" },
      { key: "settings", label: "Settings", icon: "settings" },
      { action: "logout", label: "Logout", icon: "logout" },
    ],
  },
];

const adminConsoleGroups: NavGroup[] = [
  {
    label: "Platform",
    items: [
      { key: "settings", label: "Admin Overview", icon: "dashboard" },
      { key: "users-workspaces", label: "Users & Workspaces", icon: "profile" },
      { key: "agent-org", label: "Platform Agent Org", icon: "agentOrg" },
      { key: "shared-agent-templates", label: "Shared Agent Templates", icon: "agents" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { key: "runtimes", label: "Runtime Connectors", icon: "runtimes" },
      { key: "desktop-gateway", label: "Desktop Gateway", icon: "settings" },
      { key: "browser-ops", label: "Browser Activity", icon: "runtimes" },
      { key: "research-runs", label: "Research Runs", icon: "audit" },
      { key: "models", label: "Model Router", icon: "modelRouter" },
      { key: "tools", label: "Tools", icon: "setup" },
      { key: "skills", label: "Skills", icon: "skills" },
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
// Home action cards, Work/Evidence hubs, deep links, Settings/Advanced, and direct
// URLs even though they are intentionally no longer primary workspace nav items.
// Previous primary nav fixture kept for regression context only:
// const visibleGroups = uiMode === "admin" ? adminConsoleGroups : primaryGroups;
// { key: "approvals", label: "Needs Attention", icon: "approvals" }
// { key: "delegate-work", label: "Delegate Work", icon: "send" }
// { key: "workflow-library", label: "Workflow Library", icon: "skills" }
// label: "Account"
// label: "Profile"
// label: "My AI Workforce"
// label: "Knowledge & Evidence"

type RailStatus = {
  runtime?: { version?: string; profiles?: number };
  gateway?: { running?: boolean };
  sessions?: { total?: number; active_recent?: number };
};

function plural(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

function systemLabel(online: boolean, active: number) {
  if (!online) return "Attention needed";
  return active > 0 ? "System online" : "Online";
}

async function requestStatus(): Promise<RailStatus> {
  const url = `${window.location.protocol}//${window.location.host}/api/status`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<RailStatus>;
}

export function NavRail() {
  const { view, setView, uiMode, agents, me } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);

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

  const fallbackActive = agents.filter((a) => a.status === "active" || a.status === "working" || a.status === "waiting").length;
  const activeSessions = status?.sessions?.active_recent ?? fallbackActive;
  const totalSessions = status?.sessions?.total ?? agents.reduce((n, a) => n + a.sessionCount, 0);
  const sessionPercent = useMemo(() => {
    if (!totalSessions) return 0;
    return Math.max(4, Math.min(100, Math.round((activeSessions / totalSessions) * 100)));
  }, [activeSessions, totalSessions]);
  const gatewayOnline = status?.gateway?.running ?? true;
  const systemStatus = systemLabel(gatewayOnline, activeSessions);
  const visibleGroups = uiMode === "admin" ? adminConsoleGroups : simplifiedWorkspaceGroups;

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
        <span className="workspace-pill">{me?.workspace?.name ?? "Workspace"}</span>
        <span className="chev">⌄</span>
      </div>

      <div className="nav scroll">
        {visibleGroups.map((group) => (
          <div className="nav-group" key={group.label || "primary-chat"}>
            {group.label && <div className="nlabel">{group.label}</div>}
            {group.items.map((it) => {
              const active = isRouteItem(it) && view === it.key;
              const key = isRouteItem(it) ? it.key : it.action;
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

      <div className="gw">
        <div className="row">
          <span className="dot" style={{ background: gatewayOnline ? "var(--good)" : "var(--bad)" }} /> {systemStatus}
        </div>
        <div className="sub status-main">
          {gatewayOnline ? plural(activeSessions, "active session") : "Gateway offline"}
        </div>
        {gatewayOnline && totalSessions > 0 && (
          <div className="bar" aria-label={`${activeSessions} active of ${totalSessions} total sessions`}>
            <i style={{ width: `${sessionPercent}%` }} />
          </div>
        )}
        <a className="sub status-link" href="/docs#daily-flow">View docs →</a>
      </div>

    </nav>
  );
}
