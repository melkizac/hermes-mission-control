import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "../services/store";
import type { AutomationsResponse, BoardResponse, CostsResponse, InboxResponse, ProjectsResponse, SecondBrainResponse, ViewKey } from "../types";
import { formatSingaporeShort, formatSingaporeTime, singaporeHour } from "../utils/time";

type RuntimeStatus = {
  now: string;
  mode?: string;
  demo?: boolean;
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

type CockpitLink = {
  title: string;
  detail: string;
  view: ViewKey;
  tone?: "neutral" | "warn" | "bad";
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
  const failedRoutines = data.automations?.summary.error ?? 0;
  const blockedTasks = (data.board?.summary.blocked ?? 0) + (data.board?.summary.error ?? 0);
  const totalAttention = (inboxSummary?.drafted ?? approvals.length) + highRisk + failedRoutines + blockedTasks + (!apiOk ? 1 : 0) + (!gatewayOk ? 1 : 0);
  const runningTasks = data.board?.summary.running ?? agents.filter((a) => a.status === "active" || a.status === "working" || a.status === "waiting").length;
  const automationRows = data.automations?.automations ?? [];
  const nextAutomations = [...automationRows].filter((a) => a.enabled).sort((a, b) => (a.next_run_at || "zz").localeCompare(b.next_run_at || "zz")).slice(0, 4);
  const latestOutputs = automationRows.flatMap((a) => (a.recent_outputs || []).map((o) => ({ ...o, automation: a.name, status: a.last_status || a.status }))).sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || "")).slice(0, 5);
  const runningBoardTasks = (data.board?.tasks || []).filter((task) => task.status === "running").slice(0, 4);
  const blockedBoardTasks = (data.board?.tasks || []).filter((task) => task.status === "blocked" || task.status === "error").slice(0, 4);
  const queuedHumanTasks = (data.board?.tasks || []).filter((task) => task.assignee?.toLowerCase().includes("melverick") && task.status !== "done").slice(0, 3);
  const today = data.costs?.summary.last_24h;
  const week = data.costs?.summary.last_7d;
  const activeAgentCount = agents.filter((a) => a.status === "active" || a.status === "working" || a.status === "waiting").length;
  const draftApprovals = inboxSummary?.drafted ?? approvals.length;

  const healthWarnings = [
    apiOk ? null : "Hermes API needs attention",
    gatewayOk ? null : "Gateway process not detected",
    failedRoutines ? `${failedRoutines} routine error${failedRoutines === 1 ? "" : "s"}` : null,
    highRisk ? `${highRisk} high-risk approval${highRisk === 1 ? "" : "s"}` : null,
    data.brain && data.brain.summary.health !== "healthy" ? "Second Brain health warning" : null,
  ].filter(Boolean) as string[];

  const greeting = useMemo(() => {
    if (status?.demo) return "Welcome, demo visitor.";
    const hour = singaporeHour();
    if (hour < 12) return "Good morning, Melverick.";
    if (hour < 18) return "Good afternoon, Melverick.";
    return "Good evening, Melverick.";
  }, [status?.demo]);

  const attentionItems: CockpitLink[] = [
    ...(highRisk ? [{ title: `${highRisk} high-risk approval${highRisk === 1 ? "" : "s"}`, detail: "Review before anything is published or sent.", tone: "warn" as const, view: "approvals" as const }] : []),
    ...blockedBoardTasks.map((task) => ({ title: task.title, detail: `${task.status} · ${task.assignee || "unassigned"} · ${task.priority_label} priority`, tone: "warn" as const, view: "board" as const })),
    ...(failedRoutines ? [{ title: `${failedRoutines} routine failure${failedRoutines === 1 ? "" : "s"}`, detail: "Open Routines to inspect the failed run and last error.", tone: "warn" as const, view: "automations" as const }] : []),
    ...(!apiOk ? [{ title: "Hermes API is not healthy", detail: "Agent execution may be unavailable until API health recovers.", tone: "bad" as const, view: "settings" as const }] : []),
    ...(!gatewayOk ? [{ title: "Gateway is offline", detail: "Desktop/local runtime bridge is not currently detected.", tone: "bad" as const, view: "settings" as const }] : []),
    ...(draftApprovals ? [{ title: `${draftApprovals} draft approval${draftApprovals === 1 ? "" : "s"}`, detail: "Approve, edit, or reject pending AI-generated output.", tone: "neutral" as const, view: "approvals" as const }] : []),
  ].slice(0, 6);

  const runningNowItems: CockpitLink[] = [
    ...runningBoardTasks.map((task) => ({ title: task.title, detail: `${task.assignee || "agent"} · started ${shortTime(task.started_at || task.updated_at)}`, view: "board" as const })),
    ...agents.filter((a) => a.status === "active" || a.status === "working" || a.status === "waiting").slice(0, 3).map((agent) => ({ title: agent.name, detail: `${agent.statusLabel || agent.status} · ${agent.activity || "active"}`, view: "agents" as const })),
    ...nextAutomations.slice(0, 3).map((job) => ({ title: job.name, detail: `Next: ${job.next_run_relative || formatSingaporeTime(job.next_run_at) || job.schedule || "schedule unavailable"}`, view: "automations" as const })),
  ].slice(0, 7);

  const healthItems = [
    { label: "Hermes API", value: apiOk ? "Online" : "Needs attention", ok: apiOk, detail: status?.api?.error || `${status?.api?.models?.length ?? 0} model${(status?.api?.models?.length ?? 0) === 1 ? "" : "s"} visible` },
    { label: "Gateway", value: gatewayOk ? "Online" : "Offline", ok: gatewayOk, detail: `${status?.gateway?.processes?.length ?? 0} process${(status?.gateway?.processes?.length ?? 0) === 1 ? "" : "es"} detected` },
    { label: "Scheduler", value: `${status?.cron?.enabled ?? 0}/${status?.cron?.total ?? 0} enabled`, ok: !failedRoutines, detail: failedRoutines ? `${failedRoutines} failed routine${failedRoutines === 1 ? "" : "s"}` : "No routine errors in summary" },
    { label: "Second Brain", value: data.brain?.summary.health || "Unknown", ok: !data.brain || data.brain.summary.health === "healthy", detail: `${fmt(data.brain?.summary.wiki_pages)} wiki pages · ${fmt(data.brain?.summary.raw_sources)} sources` },
  ];

  const recommendedActions: CockpitLink[] = [
    ...(attentionItems.length ? [{ title: "Clear the attention queue", detail: "Start with high-risk approvals, blocked tasks, failed jobs, and offline gateway/API warnings.", view: "approvals" as const }] : []),
    ...(queuedHumanTasks.length ? queuedHumanTasks.map((task) => ({ title: `Melverick: ${task.title.replace(/^Melverick:\s*/i, "")}`, detail: `${task.priority_label} priority · ${task.status} · Task Board`, view: "board" as const })) : []),
    ...(latestOutputs.length ? [{ title: "Review latest agent outputs", detail: "Open the newest routine artifacts before they go stale.", view: "automations" as const }] : []),
    ...(nextAutomations.length ? [{ title: "Check the next scheduled runs", detail: `${nextAutomations.length} enabled routine${nextAutomations.length === 1 ? "" : "s"} coming up.`, view: "automations" as const }] : []),
    { title: "Open Audit Log if something looks wrong", detail: "Use run traces for evidence, tool calls, timestamps, and output provenance.", view: "audit" as const },
  ].slice(0, 5);

  return (
    <div className="home cockpit scroll">
      <div className="home-topbar cockpit-topbar">
        <div>
          <div className="crumb">Home › Mission Control Cockpit</div>
          <h1>Mission Control</h1>
          <p>Operator cockpit focused only on what needs action: attention, live work, fresh outputs, system health, and the next move.</p>
        </div>
        <div className={"safe-pill " + (healthWarnings.length ? "warn" : "ok")}>
          <span className="sdot" /> {healthWarnings.length ? `${healthWarnings.length} warning${healthWarnings.length === 1 ? "" : "s"}` : "Healthy"}
        </div>
      </div>

      <section className="cockpit-hero">
        <div className="cockpit-hero-main">
          <div className="cockpit-mark">✦</div>
          <div>
            <span className="cockpit-eyebrow">Operator cockpit</span>
            <h2>{greeting}</h2>
            <p>{loading ? "Building the live operating picture…" : `${totalAttention} attention signal${totalAttention === 1 ? "" : "s"}, ${runningTasks} active task${runningTasks === 1 ? "" : "s"}, and ${latestOutputs.length} recent output${latestOutputs.length === 1 ? "" : "s"} to review.`}</p>
          </div>
        </div>
        <div className="cockpit-metrics" aria-label="Mission Control cockpit summary">
          <Metric label="Needs Attention" value={totalAttention} tone={totalAttention ? "warn" : "good"} />
          <Metric label="Running Now" value={runningTasks + runningBoardTasks.length} />
          <Metric label="Recent Outputs" value={latestOutputs.length} />
          <Metric label="System Health" value={healthWarnings.length ? "Warn" : "Good"} tone={healthWarnings.length ? "warn" : "good"} />
        </div>
      </section>

      {(error || healthWarnings.length > 0) && (
        <section className="attention-strip cockpit-alerts">
          <b>Attention signals</b>
          <div>{error ? <span>{error}</span> : healthWarnings.map((item) => <span key={item}>{item}</span>)}</div>
        </section>
      )}

      <section className="cockpit-layout">
        <div className="cockpit-primary">
          <Panel title="Needs Attention" action="Review" onAction={() => setView("approvals")}>
            <div className="cockpit-list attention-list">
              {attentionItems.map((item, idx) => (
                <button className={`cockpit-row ${item.tone || "neutral"}`} key={`${item.title}-${idx}`} onClick={() => setView(item.view)}>
                  <span className="row-signal" />
                  <div><b>{item.title}</b><small>{item.detail}</small></div>
                  <em>Open</em>
                </button>
              ))}
              {attentionItems.length === 0 && <div className="cockpit-empty good">No approvals, blockers, failed jobs, or health warnings need operator action.</div>}
            </div>
          </Panel>

          <Panel title="Running Now" action="Task Board" onAction={() => setView("board")}>
            <div className="running-strip">
              <Mini label="Running tasks" value={data.board?.summary.running ?? 0} />
              <Mini label="Active agents" value={activeAgentCount} />
              <Mini label="Enabled jobs" value={`${status?.cron?.enabled ?? 0}/${status?.cron?.total ?? 0}`} />
            </div>
            <div className="cockpit-list">
              {runningNowItems.map((item, idx) => (
                <button className="cockpit-row live" key={`${item.title}-${idx}`} onClick={() => setView(item.view)}>
                  <span className="row-signal pulse" />
                  <div><b>{item.title}</b><small>{item.detail}</small></div>
                  <em>Track</em>
                </button>
              ))}
              {runningNowItems.length === 0 && <div className="cockpit-empty">Nothing is actively running. Scheduled jobs will appear here before their next run.</div>}
            </div>
          </Panel>

          <Panel title="Recent Outputs" action="Outputs" onAction={() => setView("automations")}>
            <div className="output-list cockpit-outputs">
              {latestOutputs.map((o) => (
                <button className="output-row output-button" key={`${o.path}-${o.updated_at}`} onClick={() => setView("automations")}>
                  <div><b>{o.name}</b><p>{o.preview || "No preview available"}</p><small>{o.automation} · {shortTime(o.updated_at)}</small></div>
                  <span className={o.status === "error" ? "tag warn" : "tag good"}>{o.status || "output"}</span>
                </button>
              ))}
              {latestOutputs.length === 0 && <div className="cockpit-empty">No recent routine outputs found yet.</div>}
            </div>
          </Panel>
        </div>

        <aside className="cockpit-secondary">
          <Panel title="System Health" action="Settings" onAction={() => setView("settings")}>
            <div className="health-stack">
              {healthItems.map((item) => (
                <div className={`health-row ${item.ok ? "ok" : "warn"}`} key={item.label}>
                  <span className="health-dot" />
                  <div><b>{item.label}</b><small>{item.detail}</small></div>
                  <em>{item.value}</em>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Next Recommended Actions" action="Audit" onAction={() => setView("audit")}>
            <div className="recommend-list">
              {recommendedActions.map((item, idx) => (
                <button className="recommend-row" key={`${item.title}-${idx}`} onClick={() => setView(item.view)}>
                  <span>{idx + 1}</span>
                  <div><b>{item.title}</b><small>{item.detail}</small></div>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Operating Load" action="Costs" onAction={() => setView("costs")}>
            <div className="usage-stack cockpit-load">
              <div><span>Last 24h</span><b>{fmt(today?.sessions)} runs</b><small>{fmt(today?.tokens)} tokens · {money(today?.cost)}</small></div>
              <div><span>Last 7d</span><b>{money(week?.cost)}</b><small>{fmt(week?.sessions)} sessions · {fmt(week?.tool_calls)} tools</small></div>
            </div>
          </Panel>
        </aside>
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
