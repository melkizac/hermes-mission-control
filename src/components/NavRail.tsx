import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import logoUrl from "../assets/melverick-os-logo.jpg";
import type { ViewKey } from "../types";

const items: { key: ViewKey; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { key: "mission", label: "Mission Control", icon: "mission" },
  { key: "agents", label: "Agents", icon: "board" },
  { key: "agent-org", label: "Agent Org", icon: "automations" },
  { key: "projects", label: "Projects", icon: "projects" },
  { key: "second-brain", label: "Second Brain", icon: "skills" },
  { key: "board", label: "Task Board", icon: "board" },
  { key: "skills", label: "Skills Hub", icon: "skills" },
  { key: "approvals", label: "Approvals", icon: "approvals" },
  { key: "automations", label: "Automations", icon: "automations" },
  { key: "audit", label: "Audit Log", icon: "audit" },
  { key: "costs", label: "Costs", icon: "costs" },
  { key: "settings", label: "Settings", icon: "settings" },
];

type RailStatus = {
  runtime?: { version?: string; profiles?: number };
  gateway?: { running?: boolean };
  sessions?: { total?: number; active_recent?: number };
};

function plural(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
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

  const fallbackActive = agents.filter((a) => a.status === "working" || a.status === "waiting").length;
  const activeSessions = status?.sessions?.active_recent ?? fallbackActive;
  const totalSessions = status?.sessions?.total ?? agents.reduce((n, a) => n + a.sessionCount, 0);
  const sessionPercent = useMemo(() => {
    if (!totalSessions) return 0;
    return Math.max(4, Math.min(100, Math.round((activeSessions / totalSessions) * 100)));
  }, [activeSessions, totalSessions]);
  const gatewayOnline = status?.gateway?.running ?? true;
  const version = status?.runtime?.version ? `v${status.runtime.version}` : "v—";
  const profileCount = status?.runtime?.profiles ?? 1;

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
        {items.map((it, i) => (
          <div key={it.key}>
            {i === 2 && <div className="nlabel">Manage</div>}
            <button
              className={"nitem" + (view === it.key ? " on" : "")}
              onClick={() => setView(it.key)}
            >
              <Icon name={it.icon} size={17} />
              {it.label}
              {it.key === "approvals" && approvals.length > 0 && (
                <span className="pill">{approvals.length}</span>
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="gw">
        <div className="row">
          <span className="dot" style={{ background: gatewayOnline ? "var(--good)" : "var(--bad)" }} /> {gatewayOnline ? "Gateway online" : "Gateway offline"}
        </div>
        <div className="sub">
          {version} · {plural(profileCount, "profile")} · {plural(activeSessions, "active session")}
        </div>
        <div className="bar">
          <i style={{ width: `${sessionPercent}%` }} />
        </div>
        <div className="sub" style={{ marginTop: 6 }}>
          Session activity · {activeSessions}/{totalSessions} active/recent
        </div>
      </div>
    </nav>
  );
}
