import { useEffect, useMemo, useState } from "react";
import type { AutomationRoutine, AutomationsResponse, BrowserConnectorConfig, BrowserConnectorsResponse, FunnelTarget, FunnelTargetsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";

const client = new HttpHermesClient();

type ActionName = "pause" | "resume" | "run" | "enable_funnel_routine";
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
  const [targetData, setTargetData] = useState<FunnelTargetsResponse | null>(null);
  const [connectorData, setConnectorData] = useState<BrowserConnectorsResponse | null>(null);
  const [q, setQ] = useState("");
  const [targetLabel, setTargetLabel] = useState("Demo public form");
  const [targetUrl, setTargetUrl] = useState("https://httpbingo.org/forms/post");
  const [targetSchedule, setTargetSchedule] = useState("0 9 * * 1");
  const [connectorLabel, setConnectorLabel] = useState("Browserbase production gate");
  const [connectorType, setConnectorType] = useState("browserbase");
  const [connectorBaseUrl, setConnectorBaseUrl] = useState("https://api.browserbase.com");
  const [connectorSecret, setConnectorSecret] = useState("");
  const [state, setState] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<FunnelTarget | null>(null);
  const [tab, setTab] = useState<AutomationTab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [next, targets, connectors] = await Promise.all([client.listAutomations({ q, state }), client.listFunnelTargets({ q }), client.listBrowserConnectors()]);
      setData(next);
      setTargetData(targets);
      setConnectorData(connectors);
      setError(next.error ?? targets.error ?? connectors.error ?? null);
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
      if (event.key === "Escape") {
        setSelected(null);
        setSelectedTarget(null);
      }
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
    setSelectedTarget(null);
    setTab("overview");
  };

  const openTarget = async (target: FunnelTarget) => {
    setSelected(null);
    setSelectedTarget(target);
    try {
      const detail = await client.getFunnelTarget(target.id);
      if (detail.ok && detail.target) setSelectedTarget(detail.target);
    } catch {
      // Keep list-level target visible if detail fetch fails.
    }
  };

  const runAction = async (automation: AutomationRoutine, action: ActionName) => {
    setBusy(`${automation.id}:${action}`);
    setNotice(null);
    setError(null);
    try {
      const result = action === "enable_funnel_routine"
        ? await client.enableAutomationRoutine(automation.id, {
          approved: true,
          approvedBy: "Mission Control operator",
          note: "Operator clicked Enable approved routine in Mission Control.",
          routine: {
            id: automation.id,
            name: automation.name,
            workflow_template_id: automation.workflow_template_id,
            schedule: automation.schedule,
            targetUrl: automation.targetUrl,
            noSubmit: automation.noSubmit,
            safeTargetRequired: automation.safeTargetRequired,
            script: automation.script ?? "browser_funnel_check_job.py",
            latestRunStatus: automation.latestRunStatus,
            evidenceHistory: automation.evidenceHistory ?? [],
          },
        })
        : await client.automationAction(automation.id, action);
      if (!result.ok) throw new Error(result.error || result.stderr || "Routine action failed");
      setNotice(action === "enable_funnel_routine" ? `Enable approved routine sent for ${automation.name}. NO_SUBMIT safeguards remain active.` : `${action} sent for ${automation.name}. ${result.stdout || "Cron state updated."}`.trim());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Routine action failed");
    } finally {
      setBusy(null);
    }
  };

  const createTarget = async () => {
    setBusy('funnel-target:create');
    setNotice(null);
    setError(null);
    try {
      const result = await client.createFunnelTarget({ label: targetLabel, url: targetUrl, schedule: targetSchedule, approved: true, approvedBy: "Mission Control operator", expected: "public lead/order form submit boundary" });
      if (!result.ok) throw new Error(result.error || "Unable to add target");
      setNotice(`Add target complete: ${result.target?.label ?? targetLabel}. NO_SUBMIT safeguards are active.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add target");
    } finally {
      setBusy(null);
    }
  };

  const createConnector = async () => {
    setBusy('browser-connector:create');
    setNotice(null);
    setError(null);
    try {
      const result = await client.createBrowserConnector({
        label: connectorLabel,
        type: connectorType,
        baseUrl: connectorBaseUrl,
        apiKey: connectorSecret || undefined,
        approved: false,
      });
      if (!result.ok) throw new Error(result.error || "Unable to save connector gate");
      setConnectorSecret("");
      setNotice(`Production connector configuration gate saved for ${result.connector?.label ?? connectorLabel}. No real connector is enabled yet; secrets are stored as [REDACTED].`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save connector gate");
    } finally {
      setBusy(null);
    }
  };

  const runConnectorAction = async (connector: BrowserConnectorConfig, action: "approve" | "dry_run_probe" | "archive_probe" | "enable") => {
    setBusy(`${connector.id}:${action}`);
    setNotice(null);
    setError(null);
    try {
      const result = await client.browserConnectorAction(connector.id, action, { approvedBy: "Mission Control operator", archivedBy: "Mission Control operator", probeId: "latest", dryRunConfirmed: action === "dry_run_probe" });
      if (!result.ok) throw new Error(result.error || "Connector action failed");
      const label = action === "approve" ? "Approve connector config" : action === "dry_run_probe" ? "Dry-run connectivity test" : action === "archive_probe" ? "Archive old probe evidence" : "Enable connector";
      setNotice(`${label} recorded for ${connector.label}. No real connector is enabled yet.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connector action failed");
    } finally {
      setBusy(null);
    }
  };

  const runConnectorProbe = async (connector: BrowserConnectorConfig) => {
    setBusy(`${connector.id}:probe`);
    setNotice(null);
    setError(null);
    try {
      const result = await client.browserConnectorProbe(connector.id, {
        targetUrl: targetUrl || "https://httpbingo.org/forms/post",
        dryRunConfirmed: true,
        noSubmit: true,
      });
      if (!result.ok) throw new Error(result.error || "Desktop-browser dry-run probe failed");
      setNotice(`Run desktop-browser dry-run probe complete for ${connector.label}. NO_SUBMIT probe stopped before submit; Browser Activity: ${result.browserActivityUrl ?? 'created'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Desktop-browser dry-run probe failed");
    } finally {
      setBusy(null);
    }
  };

  const runTargetAction = async (target: FunnelTarget, action: "enable" | "pause" | "run_now") => {
    setBusy(`${target.id}:${action}`);
    setNotice(null);
    setError(null);
    try {
      const result = await client.funnelTargetAction(target.id, action, { approved: true, approvedBy: "Mission Control operator", dryRunConfirmed: action === "run_now" });
      if (!result.ok) throw new Error(result.error || "Target action failed");
      const labels = { enable: "Enable target routine", pause: "Pause target routine", run_now: "Run target now" };
      setNotice(`${labels[action]} sent for ${target.label}. NO_SUBMIT remains mandatory.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Target action failed");
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

      <section className="automation-connector-gate automation-targets-panel">
        <div className="automation-panel-head">
          <span>Production connector configuration gate</span>
          <small>{connectorData?.summary.total ?? 0} configured · {connectorData?.summary.enabled ?? 0} enabled</small>
        </div>
        <p className="automation-filter-note">Configure Browserbase, desktop-browser, or future Windows gateway here first. This is a checkpoint gate only: No real connector is enabled yet, secrets are redacted, and Website Funnel Check stays NO_SUBMIT.</p>
        <div className="connector-command-center" aria-label="Production connector policy and completion status">
          <article className="connector-policy-card">
            <span className="stub-tag">Production enablement policy</span>
            <h3>submit/post/send/purchase blocked</h3>
            <p>{connectorData?.productionPolicy?.summary ?? "Production browser connector actions remain blocked; only safe NO_SUBMIT dry-runs are allowed."}</p>
            <div className="browser-chip-row">
              <span className="tag warn">{connectorData?.productionPolicy?.enablementStatus ?? "blocked"}</span>
              <span className="tag good">NO_SUBMIT locked</span>
              <span className="tag warn">account-sensitive blocked</span>
            </div>
          </article>
          <article className="connector-policy-card completion">
            <span className="stub-tag">Browser runtime track completion</span>
            <h3>{connectorData?.browserTrackCompletion?.currentPhase ?? "Phase 25"}</h3>
            <p>{connectorData?.browserTrackCompletion?.summary ?? "Ready for supervised dry-runs; not ready for account-sensitive autonomy."}</p>
            <div className="connector-readiness-list">
              {(connectorData?.browserTrackCompletion?.checklist ?? []).slice(0, 4).map((item) => <span className={`tag ${item.status === 'ready' ? 'good' : 'warn'}`} key={item.label}>{item.label}: {item.status}</span>)}
            </div>
          </article>
        </div>
        <div className="funnel-target-form">
          <label><span>Connector label</span><input value={connectorLabel} onChange={(event) => setConnectorLabel(event.target.value)} placeholder="Browserbase production gate" /></label>
          <label><span>Connector type</span><select value={connectorType} onChange={(event) => setConnectorType(event.target.value)}><option value="browserbase">Browserbase</option><option value="desktop-browser">desktop-browser</option><option value="windows-gateway">future Windows gateway</option></select></label>
          <label><span>Base URL</span><input value={connectorBaseUrl} onChange={(event) => setConnectorBaseUrl(event.target.value)} placeholder="https://api.browserbase.com" /></label>
          <label><span>Secret/token</span><input type="password" value={connectorSecret} onChange={(event) => setConnectorSecret(event.target.value)} placeholder="Stored as [REDACTED]" /></label>
          <button className="btn dark" onClick={() => void createConnector()} disabled={busy === 'browser-connector:create'}>{busy === 'browser-connector:create' ? 'Saving…' : 'Save connector gate'}</button>
        </div>
        <div className="funnel-target-list">
          {(connectorData?.connectors ?? []).map((connector) => (
            <article className="funnel-target-card" key={connector.id}>
              <div>
                <b>{connector.label}</b>
                <small className="mono">{connector.type} · {connector.baseUrl || 'no base URL'} · credentials {connector.credentials ? '[REDACTED]' : 'not set'}</small>
                <em>Approval: {connector.approvalStatus} · dry-run: {connector.dryRun?.status ?? 'not-run'} · enabled: {connector.enabled ? 'yes' : 'no'} · No real connector is enabled yet</em>
                {connector.lastProbe && <em>Last dry-run probe: {connector.lastProbe.status} · NO_SUBMIT probe · {connector.lastProbe.domain ?? 'safe target'} · <a href={connector.lastProbe.browserActivityUrl}>Browser Activity</a></em>}
                {(connector.probeHistory ?? []).length > 0 && (
                  <div className="probe-history-panel">
                    <b>Probe history</b>
                    {(connector.probeHistory ?? []).slice(0, 3).map((probe, index) => (
                      <small className="mono" key={probe.id ?? `${connector.id}-probe-${index}`}>{probe.status}{probe.archived ? ' · archived' : ''} · {probe.domain ?? 'safe target'} · {probe.screenshotPath ?? 'no screenshot path'}</small>
                    ))}
                  </div>
                )}
              </div>
              <div className="ops-row-actions">
                <button className="ghost tiny" onClick={() => void runConnectorAction(connector, 'dry_run_probe')} disabled={!!busy}>{busy === `${connector.id}:dry_run_probe` ? 'Checking…' : 'Dry-run connectivity test'}</button>
                <button className="ghost tiny" onClick={() => void runConnectorProbe(connector)} disabled={!!busy || connector.type !== 'desktop-browser'}>{busy === `${connector.id}:probe` ? 'Running…' : 'Run desktop-browser dry-run probe'}</button>
                <button className="ghost tiny" onClick={() => void runConnectorAction(connector, 'archive_probe')} disabled={!!busy || !(connector.probeHistory ?? []).length}>{busy === `${connector.id}:archive_probe` ? 'Archiving…' : 'Archive old probe evidence'}</button>
                <button className="ghost tiny" onClick={() => void runConnectorAction(connector, 'approve')} disabled={!!busy}>{busy === `${connector.id}:approve` ? 'Approving…' : 'Approve connector config'}</button>
                <button className="ghost tiny" onClick={() => void runConnectorAction(connector, 'enable')} disabled={!!busy}>{busy === `${connector.id}:enable` ? 'Blocked…' : 'Enable connector blocked'}</button>
              </div>
              <div className="connector-readiness-list">
                {connector.readinessChecklist.map((item) => <span className={`tag ${item.status === 'ready' ? 'good' : 'warn'}`} key={item.label}>{item.label}: {item.status}</span>)}
              </div>
            </article>
          ))}
          {(connectorData?.connectors ?? []).length === 0 && <div className="empty">No production connector gates configured yet.</div>}
        </div>
      </section>

      <section className="automation-targets-panel">
        <div className="automation-panel-head">
          <span>Website Funnel Check targets</span>
          <small>{targetData?.summary.total ?? 0} configured · {targetData?.summary.enabled ?? 0} enabled</small>
        </div>
        <div className="funnel-target-form">
          <label><span>Label</span><input value={targetLabel} onChange={(event) => setTargetLabel(event.target.value)} placeholder="Nexius contact form" /></label>
          <label><span>Safe public URL</span><input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://example.com/contact" /></label>
          <label><span>Cron schedule</span><input value={targetSchedule} onChange={(event) => setTargetSchedule(event.target.value)} placeholder="0 9 * * 1" /></label>
          <button className="btn dark" onClick={() => void createTarget()} disabled={busy === 'funnel-target:create'}>{busy === 'funnel-target:create' ? 'Adding…' : 'Add target'}</button>
        </div>
        <p className="automation-filter-note">Target approval is required before enablement. NO_SUBMIT and safeTargetRequired stay mandatory; account-sensitive/private URLs are blocked.</p>
        <div className="funnel-target-list">
          {(targetData?.targets ?? []).map((target) => (
            <article className="funnel-target-card" key={target.id}>
              <div>
                <b>{target.label}</b>
                <small className="mono">{target.url}</small>
                <em>Target approval: {target.approvalStatus} · latest: {target.latestRunStatus?.status ?? 'not-run'} · evidence history: {target.evidenceHistory?.length ?? 0}</em>
              </div>
              <div className="ops-row-actions">
                <button className="ghost tiny" onClick={() => void openTarget(target)}>Open evidence</button>
                <button className="ghost tiny" onClick={() => void runTargetAction(target, 'enable')} disabled={!!busy}>{busy === `${target.id}:enable` ? 'Enabling…' : 'Enable target routine'}</button>
                <button className="ghost tiny" onClick={() => void runTargetAction(target, 'pause')} disabled={!!busy}>{busy === `${target.id}:pause` ? 'Pausing…' : 'Pause target routine'}</button>
                <button className="ghost tiny" onClick={() => void runTargetAction(target, 'run_now')} disabled={!!busy}>{busy === `${target.id}:run_now` ? 'Queueing…' : 'Run target now'}</button>
              </div>
            </article>
          ))}
          {(targetData?.targets ?? []).length === 0 && <div className="empty">No Website Funnel Check targets configured yet.</div>}
        </div>
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

      {selectedTarget && (
        <TargetEvidenceDrawer
          target={selectedTarget}
          busy={busy}
          onClose={() => setSelectedTarget(null)}
          onAction={(action) => void runTargetAction(selectedTarget, action)}
        />
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

function TargetEvidenceDrawer({ target, busy, onClose, onAction }: {
  target: FunnelTarget;
  busy: string | null;
  onClose: () => void;
  onAction: (action: "enable" | "pause" | "run_now") => void;
}) {
  const evidence = target.evidenceHistory ?? [];
  const readiness = target.connectorReadiness ?? [];
  const dryBusy = busy === `${target.id}:run_now`;
  return (
    <SlideOverDrawer
      title={target.label}
      subtitle={<span className="mono">{target.url}</span>}
      eyebrow="Target evidence detail"
      statusClassName="tag good"
      onClose={onClose}
      closeLabel="Close target evidence detail"
      ariaLabel="Target evidence detail"
      className="automation-detail automation-detail-drawer funnel-target-detail-drawer"
    >
      <div className="automation-drawer-actions">
        <button className="ghost tiny" onClick={() => onAction("enable")} disabled={!!busy}>Enable target routine</button>
        <button className="ghost tiny" onClick={() => onAction("pause")} disabled={!!busy}>Pause target routine</button>
        <button className="ghost tiny" onClick={() => onAction("run_now")} disabled={!!busy}>{dryBusy ? "Queueing…" : "Dry-run only / NO_SUBMIT"}</button>
      </div>
      <section className="automation-section">
        <h3>Latest screenshot</h3>
        {target.latestScreenshot ? <p className="mono">{target.latestScreenshot.path || target.latestScreenshot.url}</p> : <div className="empty">No screenshot evidence yet.</div>}
      </section>
      <section className="automation-section target-link-grid">
        <h3>Evidence links</h3>
        <a href={target.browserActivityUrl || "#"}>Browser Activity session</a>
        <a href={target.taskResultUrl || "#"}>Task result evidence</a>
        <a href={target.finalUrl || target.url}>Final URL</a>
      </section>
      <section className="automation-section">
        <h3>Approval history</h3>
        {(target.approvalHistory ?? []).map((approval, index) => <div className="automation-output" key={`${approval.status}-${index}`}><b>{approval.status}</b><p>{approval.approvedBy || "operator"} · {approval.approvedAt || "—"}</p></div>)}
        {(target.approvalHistory ?? []).length === 0 && <div className="empty">No approval history yet.</div>}
      </section>
      <section className="automation-section">
        <h3>Production connector readiness</h3>
        {readiness.map((item) => <div className="automation-run" key={item.label}><div><b>{item.label}</b><small>{item.detail}</small></div><span className={`tag ${item.status === "ready" ? "good" : "warn"}`}>{item.status}</span></div>)}
      </section>
      <section className="automation-section">
        <h3>Evidence history</h3>
        {evidence.map((item, index) => <div className="automation-output" key={`${item.title}-${index}`}><b>{item.title}</b><p>{item.summary || item.url || item.path || "Evidence recorded."}</p></div>)}
        {evidence.length === 0 && <div className="empty">No target evidence history yet.</div>}
      </section>
    </SlideOverDrawer>
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
          {automation.workflow_template_id === "website-funnel-check" && <span>NO_SUBMIT routine</span>}
        </div>
        {automation.workflow_template_id === "website-funnel-check" && (
          <div className="automation-funnel-meta">
            <small>Latest funnel run: {automation.latestRunStatus?.status ?? automation.last_status}</small>
            <small>Evidence history: {automation.evidenceHistory?.length ?? 0}</small>
          </div>
        )}
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
          {automation.workflow_template_id === "website-funnel-check" && !automation.enabled && (
            <button className="ghost tiny" onClick={() => onAction("enable_funnel_routine")} disabled={!!busy}>{isBusy("enable_funnel_routine") ? "Enabling…" : "Enable approved routine"}</button>
          )}
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
        {automation.workflow_template_id === "website-funnel-check" && !automation.enabled && (
          <button className="ghost tiny" onClick={() => onAction("enable_funnel_routine")} disabled={!!busy}>{isBusy("enable_funnel_routine") ? "Enabling…" : "Enable approved routine"}</button>
        )}
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
              {automation.workflow_template_id === "website-funnel-check" && !automation.enabled && (
                <button className="ghost tiny" onClick={() => onAction("enable_funnel_routine")} disabled={!!busy}>{isBusy("enable_funnel_routine") ? "Enabling…" : "Enable approved routine"}</button>
              )}
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
