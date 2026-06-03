import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ViewKey } from "../types";

type NavItem = { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] };

type NavGroup = { label: string; items: NavItem[] };

const primaryGroups: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { key: "mission", label: "Mission Control", icon: "mission" },
      { key: "agents", label: "Agents", icon: "agents" },
      { key: "board", label: "Task Board", icon: "board" },
      { key: "approvals", label: "Approval Gates", icon: "approvals" },
    ],
  },
  {
    label: "Work",
    items: [
      { key: "projects", label: "Projects", icon: "projects" },
      { key: "automations", label: "Routines", icon: "automations" },
    ],
  },
];

const adminItems: NavItem[] = [
  { key: "settings", label: "Admin Overview", icon: "dashboard" },
  { key: "agent-org", label: "Agent Org", icon: "agentOrg" },
  { key: "models", label: "Model Router", icon: "modelRouter" },
  { key: "costs", label: "Costs", icon: "costs" },
  { key: "audit", label: "Audit Log", icon: "audit" },
];

const setupItems: NavItem[] = [
  { key: "runtimes", label: "Runtime Connectors", icon: "runtimes" },
  { key: "tools", label: "Tools", icon: "setup" },
  { key: "skills", label: "Skills", icon: "skills" },
  { key: "second-brain", label: "Second Brain", icon: "secondBrain" },
];

const adminKeys = new Set<ViewKey>(adminItems.map((item) => item.key));
const setupKeys = new Set<ViewKey>(setupItems.map((item) => item.key));
const settingsKeys = new Set<ViewKey>(["profile", ...adminItems.map((item) => item.key), ...setupItems.map((item) => item.key)]);

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
  const { view, setView, approvals, agents } = useStore();
  const [status, setStatus] = useState<RailStatus | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(() => settingsKeys.has(view));
  const [adminOpen, setAdminOpen] = useState(() => adminKeys.has(view));
  const [setupOpen, setSetupOpen] = useState(() => setupKeys.has(view));

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
        <span className="chev">⌄</span>
      </div>

      <div className="nav scroll">
        {primaryGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nlabel">{group.label}</div>
            {group.items.map((it) => (
              <button
                key={it.key}
                className={"nitem" + (view === it.key ? " on" : "")}
                onClick={() => setView(it.key)}
              >
                <Icon name={it.icon} size={17} />
                {it.label}
                {it.key === "approvals" && approvals.length > 0 && (
                  <span className="pill">{approvals.length}</span>
                )}
              </button>
            ))}
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

      <div className={"settings-dock" + (settingsOpen ? " open" : "")}>
        <button
          className={"settings-trigger" + (settingsKeys.has(view) ? " on" : "")}
          aria-expanded={settingsOpen}
          aria-controls="settings-menu"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Icon name="settings" size={17} />
          Settings
          <span className="nav-caret">{settingsOpen ? "⌃" : "⌄"}</span>
        </button>
        {settingsOpen && (
          <div className="settings-menu" id="settings-menu">
            <button
              className={"settings-menu-item" + (view === "profile" ? " on" : "")}
              onClick={() => {
                setSettingsOpen(true);
                setView("profile");
              }}
            >
              <Icon name="profile" size={15} />
              Profile
            </button>
            <button className="settings-menu-item" onClick={() => void handleLogout()}>
              <Icon name="logout" size={15} />
              Logout
            </button>
            <div className="settings-menu-divider" />
            <button
              className={"settings-menu-item settings-parent" + (adminKeys.has(view) ? " on" : "")}
              aria-expanded={adminOpen}
              onClick={() => {
                if (adminKeys.has(view)) {
                  setAdminOpen((open) => !open);
                } else {
                  setAdminOpen(true);
                  setView("settings");
                }
              }}
            >
              <Icon name="admin" size={15} />
              Admin
              <span className="nav-caret">{adminOpen ? "⌃" : "⌄"}</span>
            </button>
            {adminOpen && (
              <div className="settings-submenu">
                {adminItems.map((it) => (
                  <button
                    key={it.key}
                    className={"settings-menu-item settings-subitem" + (view === it.key ? " on" : "")}
                    onClick={() => {
                      setAdminOpen(true);
                      setView(it.key);
                    }}
                  >
                    <Icon name={it.icon} size={14} />
                    {it.label}
                  </button>
                ))}
              </div>
            )}
            <button
              className={"settings-menu-item settings-parent" + (setupKeys.has(view) ? " on" : "")}
              aria-expanded={setupOpen}
              onClick={() => {
                if (setupKeys.has(view)) {
                  setSetupOpen((open) => !open);
                } else {
                  setSetupOpen(true);
                  setView("runtimes");
                }
              }}
            >
              <Icon name="setup" size={15} />
              Setup
              <span className="nav-caret">{setupOpen ? "⌃" : "⌄"}</span>
            </button>
            {setupOpen && (
              <div className="settings-submenu">
                {setupItems.map((it) => (
                  <button
                    key={it.key}
                    className={"settings-menu-item settings-subitem" + (view === it.key ? " on" : "")}
                    onClick={() => {
                      setSetupOpen(true);
                      setView(it.key);
                    }}
                  >
                    <Icon name={it.icon} size={14} />
                    {it.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
