import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "../components/Icon";

type RuntimeStatus = {
  now: string;
  api: { health?: { ok?: boolean }; models?: string[]; error?: string | null };
  gateway: { running?: boolean; processes?: string[] };
  sessions: { total?: number; active_recent?: number; tokens?: number; tool_calls?: number };
  cron: { total?: number; enabled?: number; jobs?: Array<{ id?: string; name?: string; enabled?: boolean; state?: string; schedule?: string; next_run_at?: string; last_status?: string }> };
};

type SessionRow = {
  id: string;
  title: string;
  source: string;
  started_at: string;
  messages: number;
  tools: number;
  tokens: number;
  preview: string;
};

async function request<T>(path: string): Promise<T> {
  const url = `${window.location.protocol}//${window.location.host}${path}`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(res.statusText);
  return res.json() as Promise<T>;
}

export function MissionControl() {
  const { agents, approvals, setView } = useStore();
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [s, recent] = await Promise.all([
          request<RuntimeStatus>("/api/status"),
          request<SessionRow[]>("/api/sessions"),
        ]);
        if (!alive) return;
        setStatus(s);
        setSessions(recent.slice(0, 6));
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard telemetry");
      }
    };
    void load();
    const id = window.setInterval(load, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const workingAgents = agents.filter((a) => a.status === "working" || a.status === "waiting").length;
  const activeContexts = agents.reduce((n, a) => n + a.sessionCount, 0);
  const totalMessages = agents.reduce((n, a) => n + a.messages.length, 0);
  const apiOk = Boolean(status?.api?.health?.ok);
  const gatewayOk = Boolean(status?.gateway?.running);
  const models = status?.api?.models?.join(", ") || "hermes-agent";
  const cronJobs = status?.cron?.jobs ?? [];

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning!";
    if (hour < 18) return "Good afternoon!";
    return "Good evening!";
  }, []);

  return (
    <div className="home scroll">
      <div className="home-topbar">
        <div>
          <div className="crumb">Home › Dashboard</div>
          <h1>Mission Control</h1>
          <p>Operator dashboard for Hermes: context, agents, approvals, automations, and runtime health in one place.</p>
        </div>
        <div className={"safe-pill " + (apiOk ? "ok" : "warn")}>
          <span className="sdot" /> {apiOk ? "Safe" : "Needs attention"}
        </div>
      </div>

      <section className="hero-card">
        <div className="moon">☾</div>
        <div className="hero-copy">
          <h2>{greeting}</h2>
          <p>Here’s your live overview for today.</p>
        </div>
        <span className={"ai-badge " + (apiOk ? "ready" : "warn")}>{apiOk ? `AI: ${models}` : "AI: Not configured"}</span>
        <div className="hero-metrics">
          <Metric label="Active Agents" value={workingAgents} />
          <Metric label="Approvals" value={approvals.length} />
          <Metric label="Automations" value={`${status?.cron?.enabled ?? 0}/${status?.cron?.total ?? 0}`} />
          <Metric label="Recent Sessions" value={status?.sessions?.active_recent ?? 0} />
        </div>
        <div className="hero-actions">
          <button className="home-action" onClick={() => setView("approvals")}>View Inbox</button>
          <button className="home-action" onClick={() => setView("agents")}>Open Agents</button>
          <button className="home-action" onClick={() => setView("automations")}>Automations</button>
        </div>
      </section>

      {(error || !apiOk || !gatewayOk) && (
        <section className="setup-card">
          <div className="setup-head">
            <div>
              <span>Finish setup</span>
              <p>{error ? error : "Complete these last pieces to keep the real phase-1 workflow healthy."}</p>
            </div>
            <b>{[!apiOk, !gatewayOk].filter(Boolean).length || 1} left</b>
          </div>
          <SetupRow title="Hermes API" detail={apiOk ? `Online · ${models}` : status?.api?.error || "API health check is not passing"} good={apiOk} />
          <SetupRow title="Gateway" detail={gatewayOk ? "Gateway process is running" : "Gateway process was not detected"} good={gatewayOk} />
        </section>
      )}

      <section className="quick-grid">
        <StatCard label="Total Sessions" value={status?.sessions?.total ?? activeContexts} sub={`${(status?.sessions?.tokens ?? 0).toLocaleString()} tokens`} icon="mission" />
        <StatCard label="Tool Calls" value={status?.sessions?.tool_calls ?? 0} sub="Auditable actions" icon="automations" />
        <StatCard label="Chat Contexts" value={totalMessages} sub="Messages loaded" icon="board" />
        <StatCard label="Profiles" value={agents.length} sub="Terminal · Telegram · Dashboard" icon="settings" />
      </section>

      <section className="home-grid">
        <div className="dash-panel span-left">
          <div className="panel-head">
            <span>Agent channels</span>
            <button onClick={() => setView("agents")}>{agents.length} open</button>
          </div>
          <div className="agent-cards">
            {agents.map((a) => (
              <button key={a.id} className="agent-card" onClick={() => setView("agents")}>
                <span className="av" style={{ background: a.color }}>{a.initials}</span>
                <span>
                  <b>{a.name}</b>
                  <small>{a.activity}</small>
                </span>
                <em>{a.status}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="dash-panel span-right">
          <div className="panel-head">
            <span>Today’s automations</span>
            <button onClick={() => setView("automations")}>{cronJobs.length} tracked</button>
          </div>
          <div className="timeline-list">
            {cronJobs.slice(0, 5).map((job) => (
              <div className="timeline-row" key={job.id || job.name}>
                <div>
                  <b>{job.name || job.id}</b>
                  <small>{job.schedule || "Schedule unavailable"}</small>
                </div>
                <span className={job.enabled ? "tag good" : "tag muted"}>{job.state || (job.enabled ? "enabled" : "paused")}</span>
              </div>
            ))}
            {cronJobs.length === 0 && <div className="empty">No cron missions found.</div>}
          </div>
        </div>

        <div className="dash-panel span-left">
          <div className="panel-head">
            <span>Recent agent history</span>
            <button onClick={() => setView("audit")}>Audit</button>
          </div>
          <div className="session-list">
            {sessions.map((s) => (
              <div className="session-row" key={s.id}>
                <div>
                  <b>{s.title}</b>
                  <p>{s.preview || "No preview available"}</p>
                  <small>{s.source} · {s.started_at}</small>
                </div>
                <span>{s.messages} msgs</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-panel span-right brief-card">
          <div className="panel-head">
            <span>Morning brief</span>
            <button onClick={() => setView("agents")}>Generate</button>
          </div>
          <h3>What Hermes is watching</h3>
          <p>
            This home dashboard follows the Mission Control pattern: one command center for human-in-the-loop approvals,
            background automations, real agent history, and channel context from terminal, Telegram, and dashboard sessions.
          </p>
          <div className="brief-pills">
            <span>Approvals inbox</span>
            <span>Agent history</span>
            <span>Automations</span>
            <span>Knowledge context</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="hero-metric">
      <span>✣ {label}</span>
      <b>{value}</b>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: number | string; sub: string; icon: Parameters<typeof Icon>[0]["name"] }) {
  return (
    <div className="stat-card">
      <div>
        <span>{label}</span>
        <b>{value}</b>
        <small>{sub}</small>
      </div>
      <i><Icon name={icon} size={17} /></i>
    </div>
  );
}

function SetupRow({ title, detail, good }: { title: string; detail: string; good: boolean }) {
  return (
    <div className="setup-row">
      <div>
        <b>{title}</b>
        <p>{detail}</p>
      </div>
      <span className={good ? "tag good" : "tag warn"}>{good ? "Ready" : "Open Settings"}</span>
    </div>
  );
}
