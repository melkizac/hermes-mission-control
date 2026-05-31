import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "../services/store";
import { Icon } from "../components/Icon";
import type { AutomationsResponse, BoardResponse, CostsResponse, InboxResponse, ProjectsResponse, SecondBrainResponse } from "../types";
import { formatSingaporeShort, formatSingaporeTime, singaporeHour } from "../utils/time";

type RuntimeStatus = {
  now: string;
  runtime?: { version?: string; profiles?: number };
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

type LoadState = {
  status: RuntimeStatus | null;
  sessions: SessionRow[];
  inbox: InboxResponse | null;
  automations: AutomationsResponse | null;
  costs: CostsResponse | null;
  board: BoardResponse | null;
  projects: ProjectsResponse | null;
  brain: SecondBrainResponse | null;
};

async function request<T>(path: string): Promise<T> {
  const url = `${window.location.protocol}//${window.location.host}${path}`;
  const res = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await request<T>(path);
  } catch {
    return fallback;
  }
}

function fmt(n?: number, digits = 0) {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

function money(n?: number) {
  return `$${Number(n ?? 0).toFixed(2)}`;
}

function shortTime(value?: string | null) {
  return formatSingaporeShort(value);
}

export function MissionControl() {
  const { agents, approvals, setView } = useStore();
  const [data, setData] = useState<LoadState>({ status: null, sessions: [], inbox: null, automations: null, costs: null, board: null, projects: null, brain: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [status, sessions, inbox, automations, costs, board, projects, brain] = await Promise.all([
          safe<RuntimeStatus | null>("/api/status", null),
          safe<SessionRow[]>("/api/sessions", []),
          safe<InboxResponse | null>("/api/inbox", null),
          safe<AutomationsResponse | null>("/api/automations", null),
          safe<CostsResponse | null>("/api/costs", null),
          safe<BoardResponse | null>("/api/task-board", null),
          safe<ProjectsResponse | null>("/api/projects", null),
          safe<SecondBrainResponse | null>("/api/second-brain", null),
        ]);
        if (!alive) return;
        setData({ status, sessions: sessions.slice(0, 8), inbox, automations, costs, board, projects, brain });
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load dashboard telemetry");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const id = window.setInterval(load, 15000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const status = data.status;
  const apiOk = Boolean(status?.api?.health?.ok);
  const gatewayOk = Boolean(status?.gateway?.running);
  const inboxSummary = data.inbox?.summary;
  const highRisk = inboxSummary?.high_risk ?? data.inbox?.items.filter((i) => i.risk === "high" || i.risk === "critical").length ?? 0;
  const failedAutomations = data.automations?.summary.error ?? 0;
  const blockedTasks = (data.board?.summary.blocked ?? 0) + (data.board?.summary.error ?? 0);
  const totalAttention = (inboxSummary?.drafted ?? approvals.length) + highRisk + failedAutomations + blockedTasks + (!apiOk ? 1 : 0) + (!gatewayOk ? 1 : 0);
  const runningTasks = data.board?.summary.running ?? agents.filter((a) => a.status === "working" || a.status === "waiting").length;
  const models = status?.api?.models?.join(", ") || "hermes-agent";
  const cronJobs = status?.cron?.jobs ?? [];
  const automationRows = data.automations?.automations ?? [];
  const nextAutomations = [...automationRows].sort((a, b) => (a.next_run_at || "zz").localeCompare(b.next_run_at || "zz")).slice(0, 5);
  const latestOutputs = automationRows.flatMap((a) => (a.recent_outputs || []).map((o) => ({ ...o, automation: a.name, status: a.last_status || a.status }))).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 5);
  const recentBrainPages = (data.brain?.wiki || []).slice(0, 5);
  const activeProjects = (data.projects?.projects || []).slice(0, 4);
  const today = data.costs?.summary.last_24h;
  const week = data.costs?.summary.last_7d;
  const topSource = data.costs?.by_source?.[0];
  const topModel = data.costs?.by_model?.[0];
  const healthWarnings = [
    apiOk ? null : "Hermes API needs attention",
    gatewayOk ? null : "Gateway process not detected",
    failedAutomations ? `${failedAutomations} automation error${failedAutomations === 1 ? "" : "s"}` : null,
    highRisk ? `${highRisk} high-risk inbox item${highRisk === 1 ? "" : "s"}` : null,
    data.brain && data.brain.summary.health !== "healthy" ? "Second Brain health warning" : null,
  ].filter(Boolean) as string[];

  const greeting = useMemo(() => {
    const hour = singaporeHour();
    if (hour < 12) return "Good morning, Melverick.";
    if (hour < 18) return "Good afternoon, Melverick.";
    return "Good evening, Melverick.";
  }, []);

  const feed = [
    ...(data.inbox?.items || []).slice(0, 3).map((i) => ({ kind: "Inbox", title: i.title, detail: `${i.status} · ${i.risk} risk · ${i.source}`, at: i.updated_at, view: "approvals" as const })),
    ...data.sessions.slice(0, 4).map((s) => ({ kind: "Session", title: s.title, detail: `${s.source} · ${fmt(s.tokens)} tokens · ${s.tools} tools`, at: s.started_at, view: "audit" as const })),
    ...latestOutputs.slice(0, 3).map((o) => ({ kind: "Output", title: o.name, detail: `${o.automation} · ${o.preview.slice(0, 90)}`, at: o.updated_at, view: "automations" as const })),
  ].sort((a, b) => (b.at || "").localeCompare(a.at || "")).slice(0, 9);

  return (
    <div className="home scroll">
      <div className="home-topbar">
        <div>
          <div className="crumb">Home › Daily Operator Brief</div>
          <h1>Mission Control</h1>
          <p>Decision-first dashboard for what needs attention, what changed, what is running, what agents produced, and whether the system is healthy.</p>
        </div>
        <div className={"safe-pill " + (healthWarnings.length ? "warn" : "ok")}>
          <span className="sdot" /> {healthWarnings.length ? `${healthWarnings.length} warning${healthWarnings.length === 1 ? "" : "s"}` : "All systems nominal"}
        </div>
      </div>

      <section className="hero-card operator-hero">
        <div className="moon">☾</div>
        <div className="hero-copy">
          <h2>{greeting}</h2>
          <p>{loading ? "Loading your operating picture…" : `You have ${totalAttention} item${totalAttention === 1 ? "" : "s"} needing attention across approvals, automations, tasks, and system health.`}</p>
        </div>
        <span className={"ai-badge " + (apiOk ? "ready" : "warn")}>{apiOk ? `AI: ${models}` : "AI: Needs attention"}</span>
        <div className="hero-metrics operator-metrics">
          <Metric label="Needs Attention" value={totalAttention} tone={totalAttention ? "warn" : "good"} />
          <Metric label="High-Risk" value={highRisk} tone={highRisk ? "warn" : "good"} />
          <Metric label="Running Now" value={runningTasks} />
          <Metric label="Next Automations" value={nextAutomations.length || cronJobs.length} />
        </div>
        <div className="hero-actions">
          <button className="home-action primary" onClick={() => setView("approvals")}>Review Inbox</button>
          <button className="home-action" onClick={() => setView("audit")}>Open Runs</button>
          <button className="home-action" onClick={() => setView("second-brain")}>Second Brain</button>
          <button className="home-action" onClick={() => setView("automations")}>Automations</button>
        </div>
      </section>

      {(error || healthWarnings.length > 0) && (
        <section className="attention-strip">
          <b>Attention signals</b>
          <div>{error ? <span>{error}</span> : healthWarnings.map((item) => <span key={item}>{item}</span>)}</div>
        </section>
      )}

      <section className="quick-grid operator-grid">
        <StatCard label="Today" value={`${fmt(today?.sessions)} runs`} sub={`${fmt(today?.tokens)} tokens · ${money(today?.cost)}`} icon="mission" />
        <StatCard label="Last 7 Days" value={money(week?.cost)} sub={`${fmt(week?.sessions)} sessions · ${fmt(week?.tool_calls)} tools`} icon="costs" />
        <StatCard label="Second Brain" value={data.brain?.summary.health || "—"} sub={`${fmt(data.brain?.summary.wiki_pages)} pages · ${fmt(data.brain?.summary.raw_sources)} sources`} icon="skills" />
        <StatCard label="System" value={gatewayOk && apiOk ? "Healthy" : "Warn"} sub={`${status?.runtime?.profiles ?? agents.length} profiles · ${status?.cron?.enabled ?? 0}/${status?.cron?.total ?? 0} jobs`} icon="settings" />
      </section>

      <section className="operator-layout">
        <div className="operator-main">
          <Panel title="Since last check" action="Audit" onAction={() => setView("audit")}>
            <div className="operator-feed">
              {feed.map((item, idx) => (
                <button className="feed-row" key={`${item.kind}-${idx}-${item.title}`} onClick={() => setView(item.view)}>
                  <span>{item.kind}</span>
                  <div><b>{item.title}</b><small>{item.detail}</small></div>
                  <em>{shortTime(item.at)}</em>
                </button>
              ))}
              {feed.length === 0 && <div className="empty">No recent activity found yet.</div>}
            </div>
          </Panel>

          <Panel title="Latest agent outputs" action="Automations" onAction={() => setView("automations")}>
            <div className="output-list">
              {latestOutputs.map((o) => (
                <div className="output-row" key={`${o.path}-${o.updated_at}`}>
                  <div><b>{o.name}</b><p>{o.preview || "No preview available"}</p><small>{o.automation} · {shortTime(o.updated_at)}</small></div>
                  <span className={o.status === "error" ? "tag warn" : "tag good"}>{o.status || "output"}</span>
                </div>
              ))}
              {latestOutputs.length === 0 && <div className="empty">No recent automation outputs found.</div>}
            </div>
          </Panel>

          <Panel title="Recent agent sessions" action="Audit Log" onAction={() => setView("audit")}>
            <div className="session-list compact">
              {data.sessions.slice(0, 6).map((s) => (
                <div className="session-row" key={s.id}>
                  <div><b>{s.title}</b><p>{s.preview || "No preview available"}</p><small>{s.source} · {shortTime(s.started_at)}</small></div>
                  <span>{s.messages} msgs</span>
                </div>
              ))}
              {data.sessions.length === 0 && <div className="empty">No recent sessions found.</div>}
            </div>
          </Panel>
        </div>

        <div className="operator-side">
          <Panel title="Needs attention" action="Inbox" onAction={() => setView("approvals")}>
            <div className="attention-grid">
              <Mini label="Draft approvals" value={inboxSummary?.drafted ?? approvals.length} />
              <Mini label="High-risk" value={highRisk} warn={highRisk > 0} />
              <Mini label="Failed jobs" value={failedAutomations} warn={failedAutomations > 0} />
              <Mini label="Blocked/error tasks" value={blockedTasks} warn={blockedTasks > 0} />
            </div>
          </Panel>

          <Panel title="Next automations" action="View all" onAction={() => setView("automations")}>
            <div className="timeline-list">
              {nextAutomations.map((job) => (
                <div className="timeline-row" key={job.id || job.name}>
                  <div><b>{job.name}</b><small>{job.next_run_relative || formatSingaporeTime(job.next_run_at) || job.schedule || "Schedule unavailable"}</small></div>
                  <span className={job.enabled ? "tag good" : "tag muted"}>{job.state || (job.enabled ? "enabled" : "paused")}</span>
                </div>
              ))}
              {nextAutomations.length === 0 && <div className="empty">No upcoming automations found.</div>}
            </div>
          </Panel>

          <Panel title="Second Brain pulse" action="Open" onAction={() => setView("second-brain")}>
            <div className="brain-pulse">
              <div><b>{fmt(data.brain?.summary.wiki_pages)}</b><span>wiki pages</span></div>
              <div><b>{fmt(data.brain?.summary.raw_sources)}</b><span>raw sources</span></div>
              <div><b>{data.brain?.summary.health || "—"}</b><span>health</span></div>
            </div>
            <div className="mini-list">
              {recentBrainPages.map((p) => <button key={p.id} onClick={() => setView("second-brain")}><b>{p.title}</b><small>{p.section} · {shortTime(p.updated_at)}</small></button>)}
            </div>
          </Panel>

          <Panel title="Project pulse" action="Projects" onAction={() => setView("projects")}>
            <div className="mini-list">
              {activeProjects.map((p) => <button key={p.id} onClick={() => setView("projects")}><b>{p.name}</b><small>{p.status} · {p.actions.open} open · {p.health}% health</small></button>)}
              {activeProjects.length === 0 && <div className="empty">No active projects found.</div>}
            </div>
          </Panel>

          <Panel title="Usage snapshot" action="Costs" onAction={() => setView("costs")}>
            <div className="usage-stack">
              <div><span>Top source</span><b>{topSource?.source || "—"}</b><small>{fmt(topSource?.tokens)} tokens · {money(topSource?.cost)}</small></div>
              <div><span>Top model</span><b>{topModel?.model || "—"}</b><small>{fmt(topModel?.tokens)} tokens · {money(topModel?.cost)}</small></div>
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return <div className="dash-panel"><div className="panel-head"><span>{title}</span>{action && <button onClick={onAction}>{action}</button>}</div>{children}</div>;
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" }) {
  return <div className={`hero-metric ${tone || ""}`}><span>✣ {label}</span><b>{value}</b></div>;
}

function Mini({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return <div className={"mini-attn " + (warn ? "warn" : "")}><b>{value}</b><span>{label}</span></div>;
}

function StatCard({ label, value, sub, icon }: { label: string; value: number | string; sub: string; icon: Parameters<typeof Icon>[0]["name"] }) {
  return <div className="stat-card"><div><span>{label}</span><b>{value}</b><small>{sub}</small></div><i><Icon name={icon} size={17} /></i></div>;
}
