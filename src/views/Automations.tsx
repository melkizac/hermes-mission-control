import { useEffect, useMemo, useState } from "react";
import type { AutomationRoutine, AutomationsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";

const client = new HttpHermesClient();

type ActionName = "pause" | "resume" | "run";
type AutomationTab = "overview" | "execution" | "outputs";
type ViewMode = "cards" | "list";

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function money(value: number | undefined | null) {
  return `$${(value ?? 0).toFixed(4)}`;
}

export function Automations() {
  const [data, setData] = useState<AutomationsResponse | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<AutomationTab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.listAutomations({ q, state });
      setData(next);
      setError(next.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load routines");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, state]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const automations = data?.automations ?? [];
  const summary = data?.summary;
  const selectedAutomation = useMemo(
    () => automations.find((item) => item.id === selected),
    [automations, selected],
  );

  const openAutomation = (automation: AutomationRoutine) => {
    setSelected(automation.id);
    setTab("overview");
  };

  const runAction = async (automation: AutomationRoutine, action: ActionName) => {
    setBusy(`${automation.id}:${action}`);
    setNotice(null);
    setError(null);
    try {
      const result = await client.automationAction(automation.id, action);
      if (!result.ok) throw new Error(result.error || result.stderr || "Routine action failed");
      setNotice(`${action} sent for ${automation.name}. ${result.stdout || "Cron state updated."}`.trim());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Routine action failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="automations-page automations-drawer-first scroll">
      <header className="automations-hero">
        <div>
          <span className="stub-tag">ROUTINE CONTROL</span>
          <h1>Routines</h1>
          <p>
            Recurring and scheduled Hermes work. Click a routine to inspect schedule, prompt, outputs, and run evidence in a right-side drawer.
          </p>
        </div>
        <div className="task-hero-actions">
          <button className="btn dark" onClick={() => void load()}>Refresh</button>
        </div>
      </header>

      <section className="automation-metrics">
        <Metric label="Routines" value={summary?.total ?? automations.length} sub="Hermes cron jobs" />
        <Metric label="Enabled" value={summary?.enabled ?? 0} sub="Visible background workers" />
        <Metric label="Script-only" value={summary?.no_agent ?? 0} sub="Watchdogs/no-agent jobs" />
        <Metric label="Needs attention" value={summary?.error ?? 0} sub={`${summary?.paused ?? 0} paused`} tone={(summary?.error ?? 0) > 0 ? "bad" : "good"} />
      </section>

      <section className="automation-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="name, skill, schedule, prompt…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Routine view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
        <label>
          <span>Status</span>
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="">All routines</option>
            <option value="enabled">Enabled</option>
            <option value="paused">Paused</option>
            <option value="error">Error</option>
            <option value="script">Script-only</option>
          </select>
        </label>
        <div className="automation-filter-note">Actions call Hermes cron directly. “Run now” may execute real workflows and deliveries.</div>
      </section>

      {notice && <div className="automation-notice">{notice}</div>}
      {error && <div className="automation-error">{error}</div>}

      {viewMode === "cards" ? (
        <section className="automation-grid automation-grid-full">
          <div className="automation-panel-head">
            <span>Routine cards</span>
            <small>{loading ? "Loading…" : `${automations.length} shown`}</small>
          </div>
          {automations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              active={automation.id === selectedAutomation?.id}
              busy={busy}
              onSelect={() => openAutomation(automation)}
              onAction={(action) => void runAction(automation, action)}
            />
          ))}
          {!loading && automations.length === 0 && <div className="empty big">No routines matched this filter.</div>}
        </section>
      ) : (
        <section className="ops-list automation-list-view">
          <div className="ops-list-head"><span>Routine list</span><small>{loading ? "Loading…" : `${automations.length} shown`}</small></div>
          {automations.map((automation) => (
            <AutomationListRow
              key={automation.id}
              automation={automation}
              active={automation.id === selectedAutomation?.id}
              busy={busy}
              onSelect={() => openAutomation(automation)}
              onAction={(action) => void runAction(automation, action)}
            />
          ))}
          {!loading && automations.length === 0 && <div className="empty big">No routines matched this filter.</div>}
        </section>
      )}

      {selectedAutomation && (
        <AutomationDrawer
          automation={selectedAutomation}
          tab={tab}
          setTab={setTab}
          busy={busy}
          onClose={() => setSelected(null)}
          onAction={(action) => void runAction(selectedAutomation, action)}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`automation-metric ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function AutomationCard({ automation, active, busy, onSelect, onAction }: {
  automation: AutomationRoutine;
  active: boolean;
  busy: string | null;
  onSelect: () => void;
  onAction: (action: ActionName) => void;
}) {
  const isBusy = (action: ActionName) => busy === `${automation.id}:${action}`;
  const mode = automation.no_agent ? "Script watchdog" : "Agent routine";
  return (
    <article className={`automation-card ${active ? "on" : ""} ${!automation.enabled ? "disabled" : ""}`}>
      <button className="automation-card-main" onClick={onSelect}>
        <div className="automation-card-top">
          <div className="automation-icon">⚙</div>
          <span className={`automation-toggle ${automation.enabled ? "enabled" : ""}`} aria-label={automation.enabled ? "enabled" : "paused"} />
        </div>
        <div className="automation-title-row">
          <h2>{automation.name}</h2>
          <span className={`tag ${automation.status === "error" ? "warn" : automation.enabled ? "good" : "muted"}`}>{automation.status}</span>
        </div>
        <div className="automation-chips">
          <span>{mode}</span>
          <span>{automation.schedule_kind}</span>
          <span>{automation.schedule}</span>
        </div>
        <p>{automation.prompt_preview || "No prompt configured."}</p>
        <div className="automation-triplet">
          <Mini label="Runs" value={automation.run_count} />
          <Mini label="Skills" value={automation.skill_count} />
          <Mini label="Last" value={automation.last_status} />
        </div>
      </button>
      <footer className="automation-card-foot">
        <span>Next: <b>{automation.next_run_relative}</b></span>
        <div>
          <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>
            {isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}
          </button>
          <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Queued…" : "Run now"}</button>
        </div>
      </footer>
    </article>
  );
}


function AutomationListRow({ automation, active, busy, onSelect, onAction }: {
  automation: AutomationRoutine;
  active: boolean;
  busy: string | null;
  onSelect: () => void;
  onAction: (action: ActionName) => void;
}) {
  const isBusy = (action: ActionName) => busy === `${automation.id}:${action}`;
  return (
    <article className={`ops-row automation-list-row ${active ? "on" : ""} ${!automation.enabled ? "disabled" : ""}`}>
      <button className="ops-row-main" onClick={onSelect}>
        <div className="ops-row-top">
          <b>{automation.name}</b>
          <span className={`tag ${automation.status === "error" ? "warn" : automation.enabled ? "good" : "muted"}`}>{automation.status}</span>
        </div>
        <p>{automation.prompt_preview || "No prompt configured."}</p>
        <small className="mono">{automation.id}</small>
      </button>
      <div className="ops-row-meta">
        <span>{automation.schedule_kind}</span>
        <small>Next: {automation.next_run_relative}</small>
        <em>{automation.run_count} runs · {automation.skill_count} skills · {automation.no_agent ? "script" : "agent"}</em>
      </div>
      <div className="ops-row-actions">
        <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>{isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}</button>
        <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Queued…" : "Run now"}</button>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function AutomationDrawer({ automation, tab, setTab, busy, onClose, onAction }: {
  automation: AutomationRoutine;
  tab: AutomationTab;
  setTab: (tab: AutomationTab) => void;
  busy: string | null;
  onClose: () => void;
  onAction: (action: ActionName) => void;
}) {
  const lastRun = automation.recent_runs[0];
  const isBusy = (action: ActionName) => busy === `${automation.id}:${action}`;
  return (
    <SlideOverDrawer
      title={automation.name}
      subtitle={<span className="mono">{automation.id}</span>}
      eyebrow={automation.enabled ? "enabled" : "paused"}
      statusClassName={`tag ${automation.enabled ? "good" : "muted"}`}
      onClose={onClose}
      closeLabel="Close routine details"
      ariaLabel="Routine details"
      tabs={["overview", "execution", "outputs"] as const}
      activeTab={tab}
      onTabChange={setTab}
      className="automation-detail automation-detail-drawer"
    >
        {tab === "overview" && (
          <>
            <div className="automation-drawer-actions">
              <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>{isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}</button>
              <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Queued…" : "Run now"}</button>
            </div>
            <div className="automation-kv">
              <Info label="Schedule" value={automation.schedule} />
              <Info label="Next run" value={`${formatSingaporeTime(automation.next_run_at)} · ${automation.next_run_relative}`} />
              <Info label="Last run" value={`${formatSingaporeTime(automation.last_run_at)} · ${automation.last_run_relative}`} />
              <Info label="Delivery" value={automation.deliver} />
              <Info label="Profile" value={automation.profile} />
              <Info label="Model" value={automation.model || "default"} />
              <Info label="Script" value={automation.script || (automation.no_agent ? "script-only" : "agent-run")} />
              <Info label="Created" value={formatSingaporeTime(automation.created_at)} />
            </div>
            {automation.last_error && <div className="automation-error compact">{automation.last_error}</div>}
            <section className="automation-section"><h3>Skills & toolsets</h3><div className="automation-chip-cloud">{(automation.skills.length ? automation.skills : ["No skills attached"]).map((skill) => <span key={skill}>{skill}</span>)}{automation.enabled_toolsets.map((toolset) => <em key={toolset}>{toolset}</em>)}</div></section>
            <section className="automation-section"><h3>Routine prompt</h3><pre>{automation.prompt_preview || "No prompt preview available."}</pre></section>
          </>
        )}

        {tab === "execution" && (
          <section className="automation-section">
            <h3>Recent run trace</h3>
            {automation.recent_runs.length === 0 && <div className="empty">No run sessions recorded yet.</div>}
            {automation.recent_runs.map((run) => (
              <div className="automation-run" key={run.id}>
                <div><b>{run.title}</b><small className="mono">{run.id}</small></div>
                <span>{run.status}</span>
                <small>{formatSingaporeTime(run.started_at)} · {run.message_count} msgs · {run.tool_call_count} tools · {compact(run.tokens)} tok · {money(run.estimated_cost_usd)}</small>
              </div>
            ))}
          </section>
        )}

        {tab === "outputs" && (
          <section className="automation-section">
            <h3>Latest outputs</h3>
            {automation.recent_outputs.length === 0 && <div className="empty">No saved cron outputs found.</div>}
            {automation.recent_outputs.map((output) => (
              <details className="automation-output" key={output.path}>
                <summary>{output.name} <span>{formatSingaporeTime(output.updated_at)}</span></summary>
                <pre>{output.preview}</pre>
              </details>
            ))}
            {lastRun && <div className="automation-audit-link">Audit evidence: open Audit Log and search <span className="mono">{lastRun.id}</span></div>}
          </section>
        )}
    </SlideOverDrawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="automation-info">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
