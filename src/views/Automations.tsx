import { useCallback, useEffect, useMemo, useState } from "react";
import type { AutomationRoutine, AutomationsResponse, BrowserConnectorConfig, BrowserConnectorsResponse, FunnelTarget, FunnelTargetsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { useStore } from "../services/store";
import { useRealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { InfoTooltip } from "../components/InfoTooltip";
import { OnboardingEmptyState } from "../components/OnboardingEmptyState";

const client = new HttpHermesClient();

type ActionName = "pause" | "resume" | "run" | "enable_funnel_routine";
type AutomationTab = "overview" | "safety" | "execution" | "outputs";
type ViewMode = "cards" | "list";

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function money(value: number | undefined | null) {
  return `$${(value ?? 0).toFixed(4)}`;
}

export function Automations() {
  const { uiMode, permissions, setView } = useStore();
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
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [next, targets, connectors] = await Promise.all([client.listAutomations({ q, state }), client.listFunnelTargets({ q }), client.listBrowserConnectors()]);
    setData(next);
    setTargetData(targets);
    setConnectorData(connectors);
    setError(next.error ?? targets.error ?? connectors.error ?? null);
  }, [q, state]);

  const refreshState = useRealtimeRefresh(load, [q, state], { pollMs: 15_000, staleAfterMs: 45_000 });
  const loading = refreshState.initialLoading;

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
  const showAdminRoutineManagement = uiMode === "admin" && permissions.canAccessAdmin;
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
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
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
      await refreshState.refresh("manual");
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
          <div className="hero-title-with-help">
            <h1>Routines</h1>
            <InfoTooltip label="About routines">
              Recurring and scheduled Hermes work. Click a routine to inspect schedule, prompt, outputs, and run evidence in a right-side drawer.
            </InfoTooltip>
          </div>
        </div>
        <div className="task-hero-actions">
          <span className={`realtime-status ${refreshState.stale ? "stale" : refreshState.refreshing ? "refreshing" : "live"}`}>{refreshState.statusLabel}</span>
          <button className="task-icon-action dark" aria-label="Refresh routines" title="Refresh routines" disabled={refreshState.refreshing} onClick={() => void refreshState.refresh("manual")}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="automation-metrics">
        <Metric label="Routines" value={summary?.total ?? automations.length} sub="Cron + governed routines" />
        <Metric label="Enabled" value={summary?.enabled ?? 0} sub="Visible background workers" />
        <Metric label="Governed" value={summary?.governed ?? 0} sub={`${summary?.platform ?? 0} platform · ${summary?.workspace ?? 0} workspace · ${summary?.personal ?? 0} personal`} />
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
            <option value="platform">Platform governed</option>
            <option value="workspace">Workspace governed</option>
            <option value="personal">Personal governed</option>
          </select>
        </label>
        <div className="automation-filter-help">
          <InfoTooltip label="Routine action safety">
            Actions call Hermes cron directly. “Run now” may execute real workflows and deliveries.
          </InfoTooltip>
        </div>
      </section>

      {showAdminRoutineManagement && (
        <>
      <section className="automation-connector-gate automation-targets-panel operator-routine-panel admin-routine-management-panel">
        <div className="automation-panel-head">
          <span>What browser routines are allowed to do</span>
          <small>{connectorData?.summary.total ?? 0} browser guardrail · {connectorData?.summary.enabled ?? 0} live</small>
        </div>
        <p className="operator-panel-intro">This explains the safety limits before any routine uses a browser. Normal checks can look and collect proof; risky clicks stay blocked.</p>
        <div className="operator-summary-grid" aria-label="Browser routine safety summary">
          <article className="connector-policy-card">
            <span className="stub-tag">Allowed now</span>
            <h3>Look, check, and collect evidence</h3>
            <p>Routines can open approved public pages, inspect forms/buttons, and save screenshots or run evidence.</p>
            <ul className="operator-check-list">
              <li>Open public URLs</li>
              <li>Verify forms or CTAs exist</li>
              <li>Capture screenshots/evidence</li>
            </ul>
          </article>
          <article className="connector-policy-card completion">
            <span className="stub-tag">Blocked unless approved</span>
            <h3>Real-world actions are off by default</h3>
            <p>Submitting, sending, posting, purchasing, login, and account-sensitive actions require explicit approval before they can run.</p>
            <div className="browser-chip-row">
              <span className="tag warn">Actions blocked</span>
              <span className="tag good">Evidence-only mode</span>
            </div>
          </article>
        </div>
        <details className="automation-advanced-details">
          <summary>Advanced/admin: browser connector setup</summary>
          <p className="automation-filter-note">Admin setup for Browserbase, desktop-browser, or future Windows gateway. Secrets are redacted and no real connector is enabled by default.</p>
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
                  <em>Approval: {connector.approvalStatus} · dry-run: {connector.dryRun?.status ?? 'not-run'} · enabled: {connector.enabled ? 'yes' : 'no'}</em>
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
        </details>
      </section>

      <section className="automation-targets-panel operator-routine-panel admin-routine-management-panel">
        <div className="automation-panel-head">
          <span>Websites being monitored</span>
          <small>{targetData?.summary.total ?? 0} website target · {targetData?.summary.enabled ?? 0} live</small>
        </div>
        <p className="operator-panel-intro">These are the public website pages that routines check on schedule. They verify that funnels/forms still work and keep evidence without submitting anything.</p>
        <div className="funnel-target-list compact-target-list">
          {(targetData?.targets ?? []).map((target) => (
            <article className="funnel-target-card" key={target.id}>
              <div>
                <b>{target.label}</b>
                <small>{target.latestRunStatus?.status ?? 'No recent run'} · {target.evidenceHistory?.length ?? 0} evidence records · no form submission</small>
              </div>
              <div className="ops-row-actions">
                <button className="ghost tiny" onClick={() => void openTarget(target)}>View evidence</button>
                <button className="ghost tiny" onClick={() => void runTargetAction(target, 'run_now')} disabled={!!busy}>{busy === `${target.id}:run_now` ? 'Queueing…' : 'Check now'}</button>
              </div>
            </article>
          ))}
          {(targetData?.targets ?? []).length === 0 && <div className="empty">No Website Check targets configured yet.</div>}
        </div>
        <details className="automation-advanced-details">
          <summary>Advanced/admin: add or manage website monitors</summary>
          <div className="funnel-target-form">
            <label><span>Label</span><input value={targetLabel} onChange={(event) => setTargetLabel(event.target.value)} placeholder="Nexius contact form" /></label>
            <label><span>Safe public URL</span><input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://example.com/contact" /></label>
            <label><span>Cron schedule</span><input value={targetSchedule} onChange={(event) => setTargetSchedule(event.target.value)} placeholder="0 9 * * 1" /></label>
            <button className="btn dark" onClick={() => void createTarget()} disabled={busy === 'funnel-target:create'}>{busy === 'funnel-target:create' ? 'Adding…' : 'Add target'}</button>
          </div>
          <p className="automation-filter-note">NO_SUBMIT and safeTargetRequired stay mandatory; account-sensitive/private URLs are blocked.</p>
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
          </div>
        </details>
      </section>
        </>
      )}

      {notice && <div className="automation-notice">{notice}</div>}
      {(error || refreshState.error) && <div className="task-error">{error || refreshState.error}</div>}

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
          {!loading && automations.length === 0 && (
            <OnboardingEmptyState
              compact
              title={q || state ? "No routines match this filter" : "Start your first routine"}
              actions={[
                { label: "Clear filters", onClick: () => { setQ(""); setState(""); }, disabled: !q && !state },
                { label: "Browse workflow library", variant: "primary", onClick: () => setView("workflow-library") },
                { label: "Open Task Board", onClick: () => setView("board") },
              ]}
              notes={["Routine entries come from real Hermes cron jobs or governed routine records.", "No fake scheduled work is shown when the workspace has not configured routines yet."]}
            >
              {q || state ? "Clear filters to see all configured routines, or create a new routine from an approved workflow template." : "Use Workflow Library to create a governed routine, or create a Task Board item for one-off agent work before scheduling it."}
            </OnboardingEmptyState>
          )}
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
          {!loading && automations.length === 0 && (
            <OnboardingEmptyState
              compact
              title={q || state ? "No routines match this filter" : "Start your first routine"}
              actions={[
                { label: "Clear filters", onClick: () => { setQ(""); setState(""); }, disabled: !q && !state },
                { label: "Browse workflow library", variant: "primary", onClick: () => setView("workflow-library") },
                { label: "Open Task Board", onClick: () => setView("board") },
              ]}
              notes={["Routine entries come from real Hermes cron jobs or governed routine records.", "No fake scheduled work is shown when the workspace has not configured routines yet."]}
            >
              {q || state ? "Clear filters to see all configured routines, or create a new routine from an approved workflow template." : "Use Workflow Library to create a governed routine, or create a Task Board item for one-off agent work before scheduling it."}
            </OnboardingEmptyState>
          )}
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

function usesBrowserAutomation(automation: AutomationRoutine) {
  const haystack = [
    automation.workflow_template_id,
    automation.script,
    automation.sourceOfTruth,
    automation.targetUrl,
    ...automation.enabled_toolsets,
  ].filter(Boolean).join(" ").toLowerCase();
  return Boolean(automation.targetUrl || automation.noSubmit || automation.safeTargetRequired || haystack.includes("browser") || haystack.includes("funnel") || haystack.includes("website"));
}

function isWebsiteMonitor(automation: AutomationRoutine) {
  return automation.workflow_template_id === "website-funnel-check" || Boolean(automation.targetUrl || automation.safeTargetRequired || automation.noSubmit);
}

function isGovernedRoutine(automation: AutomationRoutine) {
  return automation.workflow_template_id === "workflow-routine-admin" || Boolean(automation.routine_type);
}

function policyCount(value: Record<string, unknown> | undefined) {
  return value && Object.keys(value).length > 0 ? "configured" : "none";
}

function safetyChipsFor(automation: AutomationRoutine) {
  if (isGovernedRoutine(automation)) {
    const deps = automation.connector_dependencies?.length ?? 0;
    return [
      `${automation.routine_type ?? "workspace"} scoped`,
      deps ? `${deps} connector gate${deps === 1 ? "" : "s"}` : "No connector gates",
      `Approval ${policyCount(automation.approval_policy_dependency)}`,
      `Quota ${policyCount(automation.quota_policy)}`,
    ];
  }
  if (!usesBrowserAutomation(automation)) return ["No browser use"];
  const chips = ["Approval required"];
  if (automation.noSubmit || isWebsiteMonitor(automation)) chips.unshift("No form submission");
  if (automation.noSubmit || isWebsiteMonitor(automation)) chips.unshift("Evidence only");
  return Array.from(new Set(chips));
}

function RoutineSafetyPanel({ automation }: { automation: AutomationRoutine }) {
  const browser = usesBrowserAutomation(automation);
  const website = isWebsiteMonitor(automation);
  const evidenceCount = automation.evidenceHistory?.length ?? 0;

  if (isGovernedRoutine(automation)) {
    const run = automation.last_run;
    return (
      <section className="automation-section routine-safety-panel">
        <h3>Governance gates</h3>
        <p>This admin routine is checked against connector dependencies, approval policy, and quota policy before Mission Control records a run.</p>
        <div className="automation-chip-cloud safety-chip-cloud">
          {safetyChipsFor(automation).map((chip) => <span key={chip}>{chip}</span>)}
        </div>
        <div className="automation-kv operator-routine-kv">
          <Info label="Scope" value={automation.routine_type ?? "workspace"} />
          <Info label="Workspace" value={automation.workspace_id || "platform/personal"} />
          <Info label="Connector gates" value={String(automation.connector_dependencies?.length ?? 0)} />
          <Info label="Quota policy" value={policyCount(automation.quota_policy)} />
          <Info label="Last policy result" value={run?.status || automation.run_status || "not-run"} />
          <Info label="Approval request" value={run?.approval_request_id || "none"} />
        </div>
        {run?.reason && <div className="automation-error compact">{run.reason}</div>}
      </section>
    );
  }

  if (!browser) {
    return (
      <section className="automation-section routine-safety-panel">
        <h3>Safety</h3>
        <p>This routine does not use browser automation.</p>
        <div className="automation-chip-cloud safety-chip-cloud">
          {safetyChipsFor(automation).map((chip) => <span key={chip}>{chip}</span>)}
        </div>
        <div className="automation-kv operator-routine-kv">
          <Info label="Browser access" value="Not configured" />
          <Info label="Website actions" value="None" />
          <Info label="Approval for browser actions" value="Not needed" />
        </div>
      </section>
    );
  }

  return (
    <section className="automation-section routine-safety-panel">
      <h3>Safety</h3>
      <p>{website ? "This routine monitors an approved public website page and records evidence without submitting the form." : "This routine can use browser automation, but real-world actions stay approval-gated."}</p>
      <div className="automation-chip-cloud safety-chip-cloud">
        {safetyChipsFor(automation).map((chip) => <span key={chip}>{chip}</span>)}
      </div>
      <div className="routine-safety-rows">
        <article className="routine-safety-row allowed">
          <div className="routine-safety-row-label">
            <span className="stub-tag">Allowed</span>
            <h3>{website ? "Check the public page" : "Use browser with guardrails"}</h3>
          </div>
          <ul className="operator-check-list">
            <li>Open approved pages</li>
            <li>Verify forms, buttons, or page state</li>
            <li>Capture screenshots and evidence</li>
          </ul>
        </article>
        <article className="routine-safety-row blocked">
          <div className="routine-safety-row-label">
            <span className="stub-tag">Not allowed by default</span>
            <h3>Real-world actions require approval</h3>
          </div>
          <ul className="operator-check-list blocked">
            <li>Submit forms or send messages</li>
            <li>Log in or change account settings</li>
            <li>Purchase, post, or perform external-facing actions</li>
          </ul>
        </article>
      </div>
      <div className="automation-kv operator-routine-kv">
        <Info label="Mode" value={automation.noSubmit || website ? "Evidence only" : "Approval gated"} />
        <Info label="Form submission" value={automation.noSubmit || website ? "Blocked" : "Requires approval"} />
        <Info label="Target" value={automation.targetUrl || "No target URL configured"} />
        <Info label="Evidence records" value={String(evidenceCount)} />
      </div>
    </section>
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
  const governed = isGovernedRoutine(automation);
  const mode = governed ? `${automation.routine_type ?? "workspace"} governed` : automation.no_agent ? "Script watchdog" : "Agent routine";
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
          {automation.workflow_template_id === "linkedin-daily-operating-workflow" && <span>LinkedIn daily workflow</span>}
          {automation.taskBoardTenant && <span>Task Board: {automation.taskBoardTenant}</span>}
          {safetyChipsFor(automation).map((chip) => <span className="safety-chip" key={chip}>{chip}</span>)}
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
          {!governed && (
            <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>
              {isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}
            </button>
          )}
          <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Checking…" : governed ? "Run policy check" : "Run now"}</button>
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
  const governed = isGovernedRoutine(automation);
  return (
    <article className={`ops-row automation-list-row ${active ? "on" : ""} ${!automation.enabled ? "disabled" : ""}`}>
      <button className="ops-row-main" onClick={onSelect}>
        <div className="ops-row-top">
          <b>{automation.name}</b>
          <span className={`tag ${automation.status === "error" ? "warn" : automation.enabled ? "good" : "muted"}`}>{automation.status}</span>
        </div>
        <p>{automation.prompt_preview || "No prompt configured."}</p>
        <small className="mono">{automation.id}</small>
        <div className="automation-chips list-safety-chips">
          {safetyChipsFor(automation).map((chip) => <span className="safety-chip" key={chip}>{chip}</span>)}
        </div>
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
        {!governed && <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>{isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}</button>}
        <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Checking…" : governed ? "Run policy check" : "Run now"}</button>
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
  const governed = isGovernedRoutine(automation);
  return (
    <SlideOverDrawer
      title={automation.name}
      subtitle={<span className="mono">{automation.id}</span>}
      eyebrow={automation.enabled ? "enabled" : "paused"}
      statusClassName={`tag ${automation.enabled ? "good" : "muted"}`}
      onClose={onClose}
      closeLabel="Close routine details"
      ariaLabel="Routine details"
      tabs={["overview", "safety", "execution", "outputs"] as const}
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
              {!governed && <button className="ghost tiny" onClick={() => onAction(automation.enabled ? "pause" : "resume")} disabled={!!busy}>{isBusy(automation.enabled ? "pause" : "resume") ? "Working…" : automation.enabled ? "Pause" : "Resume"}</button>}
              <button className="ghost tiny" onClick={() => onAction("run")} disabled={!!busy}>{isBusy("run") ? "Checking…" : governed ? "Run policy check" : "Run now"}</button>
            </div>
            <div className="automation-kv operator-routine-kv">
              <Info label="Schedule" value={automation.schedule} />
              <Info label="Next run" value={`${formatSingaporeTime(automation.next_run_at)} · ${automation.next_run_relative}`} />
              <Info label="Last run" value={`${formatSingaporeTime(automation.last_run_at)} · ${automation.last_run_relative}`} />
              <Info label="Delivery" value={automation.deliver} />
              <Info label="Workflow" value={automation.workflowName || automation.workflow_template_id || "—"} />
              <Info label="Scope" value={automation.routine_type || automation.agent_class || "cron"} />
              <Info label="Runtime / agent" value={[automation.runtime_id, automation.agent_id].filter(Boolean).join(" / ") || automation.profile || "—"} />
              <Info label="Task Board" value={automation.taskBoardTenant || "—"} />
            </div>
            {automation.last_error && <div className="automation-error compact">{automation.last_error}</div>}
            <section className="automation-section operator-routine-summary">
              <h3>What this routine does</h3>
              <p>{automation.workflowName ? `Runs as part of ${automation.workflowName}.` : automation.workflow_template_id ? `Runs as part of ${automation.workflow_template_id}.` : automation.no_agent ? "Runs a script-based background check." : "Runs a scheduled Hermes agent task."}</p>
              <div className="automation-chip-cloud">
                <span>{automation.enabled ? "Enabled" : "Paused"}</span>
                <span>{automation.no_agent ? "Script watchdog" : "Agent routine"}</span>
                <span>{automation.last_status || "No recent run"}</span>
              </div>
            </section>
            <details className="automation-advanced-details routine-drawer-advanced">
              <summary>Advanced: prompt, skills, model, and runtime settings</summary>
              <div className="automation-kv">
                <Info label="Profile" value={automation.profile} />
                <Info label="Model" value={automation.model || "default"} />
                <Info label="Script" value={automation.script || (automation.no_agent ? "script-only" : "agent-run")} />
                <Info label="Created" value={formatSingaporeTime(automation.created_at)} />
              </div>
              <section className="automation-section"><h3>Skills & toolsets</h3><div className="automation-chip-cloud">{(automation.skills.length ? automation.skills : ["No skills attached"]).map((skill) => <span key={skill}>{skill}</span>)}{automation.enabled_toolsets.map((toolset) => <em key={toolset}>{toolset}</em>)}</div></section>
              <section className="automation-section"><h3>Routine prompt</h3><pre>{automation.prompt_preview || "No prompt preview available."}</pre></section>
            </details>
          </>
        )}

        {tab === "safety" && <RoutineSafetyPanel automation={automation} />}

        {tab === "execution" && (
          <section className="automation-section">
            <h3>Recent run trace</h3>
            {governed && automation.last_run && (
              <div className="automation-run">
                <div><b>Workflow Routine Admin run</b><small className="mono">{automation.last_run.id}</small></div>
                <span>{automation.last_run.status}</span>
                <small>{automation.last_run.reason || "Connector, approval, and quota gates passed."}</small>
                {automation.last_run.run_detail_url && <a href={automation.last_run.run_detail_url}>Open run detail</a>}
              </div>
            )}
            {automation.recent_runs.length === 0 && !automation.last_run && <div className="empty">No run sessions recorded yet.</div>}
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
            {governed && automation.last_run && (
              <>
                <details className="automation-output" open>
                  <summary>Browser evidence <span>{automation.last_run.status}</span></summary>
                  <pre>{JSON.stringify(automation.last_run.browser_evidence || {}, null, 2)}</pre>
                </details>
                <details className="automation-output">
                  <summary>Research artifact linkage <span>{String(automation.last_run.research_run?.source || "recorded")}</span></summary>
                  <pre>{JSON.stringify(automation.last_run.research_run || {}, null, 2)}</pre>
                </details>
              </>
            )}
            {automation.recent_outputs.length === 0 && !automation.last_run && <div className="empty">No saved cron outputs found.</div>}
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
