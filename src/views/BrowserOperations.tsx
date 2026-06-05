import { useEffect, useRef, useState } from "react";
import type { BrowserSession, BrowserSessionsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();

function statusTone(status: string) {
  if (status === "active") return "good";
  if (status === "blocked" || status === "stopped") return "warn";
  return "muted";
}

export function BrowserOperations() {
  const [payload, setPayload] = useState<BrowserSessionsResponse | null>(null);
  const [selected, setSelected] = useState<BrowserSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const deepLinkedSession = useRef<string | null>(null);

  async function load() {
    try {
      setError(null);
      const next = await client.listBrowserSessions();
      setPayload(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load browser sessions");
    }
  }

  async function openSession(id: string) {
    try {
      setError(null);
      const detail = await client.getBrowserSession(id);
      if (detail) setSelected(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load browser session");
    }
  }

  async function stopSelected() {
    if (!selected) return;
    try {
      setBusy(true);
      setError(null);
      await client.stopBrowserSession(selected.id);
      setSelected({ ...selected, status: "stopped", stopAvailable: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to stop browser session");
    } finally {
      setBusy(false);
    }
  }

  async function takeoverSelected() {
    if (!selected) return;
    try {
      setBusy(true);
      setError(null);
      await client.takeoverBrowserSession(selected.id);
      setSelected({ ...selected, status: "blocked", takeoverAvailable: false, stopAvailable: false });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request browser takeover");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session");
    if (!sessionId || deepLinkedSession.current === sessionId) return;
    deepLinkedSession.current = sessionId;
    void openSession(sessionId);
  }, [payload]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const summary = payload?.summary;
  const sessions = payload?.sessions ?? [];

  return (
    <div className="browser-ops-page scroll">
      <header className="skills-hero browser-ops-hero">
        <div>
          <span className="stub-tag">RUNTIME VISIBILITY</span>
          <h1>Browser operation visibility</h1>
          <p>Runtime event bridge: observe live browser runtime events, current domain, screenshot evidence, action log, risk labels, and approval gates before agents submit, post, send, purchase, or cross account-sensitive boundaries. Windows-local execution is blocked until gateway details are configured.</p>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh browser sessions" title="Refresh browser sessions" onClick={() => void load()}>
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <section className="skills-metrics browser-ops-metrics" aria-label="Browser operation metrics">
        <article className="skills-metric"><span>Sessions</span><b>{summary?.total ?? 0}</b><small>Real or simulated browser runs</small></article>
        <article className="skills-metric good"><span>Live runtime events</span><b>{summary?.liveRuntimeEvents ?? 0}</b><small>Runtime event bridge sessions</small></article>
        <article className="skills-metric good"><span>Screenshots</span><b>{summary?.screenshots ?? 0}</b><small>Latest screenshot/evidence slots</small></article>
        <article className="skills-metric warn"><span>Approval gates</span><b>{summary?.approvalRequired ?? 0}</b><small>Submit/post/send/purchase protected</small></article>
        <article className={"skills-metric " + (summary?.windowsReady ? "good" : "warn")}><span>Windows local</span><b>{summary?.windowsReady ? "Ready" : "Blocked"}</b><small>Windows-local execution path</small></article>
      </section>

      {error && <div className="skills-error">{error}</div>}
      <div className="desktop-attention-list browser-ops-attention">
        {(summary?.needsAttention?.length ? summary.needsAttention : ["No browser/runtime visibility blockers detected."]).map((item) => (
          <span className="tag warn" key={item}>{item}</span>
        ))}
      </div>

      <div className="browser-ops-grid">
        <section className="browser-session-list" aria-label="Browser sessions">
          {sessions.map((session) => (
            <article className="browser-session-card" data-testid="browser-session-card" key={session.id} onClick={() => void openSession(session.id)}>
              <div className="browser-session-card-top">
                <div className="browser-session-title-group">
                  <span className="browser-session-icon" aria-hidden="true">◉</span>
                  <div>
                    <span className="eyebrow">Browser session</span>
                    <h3>{session.title}</h3>
                  </div>
                </div>
                <span className={`tag ${statusTone(session.status)}`}>{session.status}</span>
              </div>
              <p className="browser-card-body">{session.approvalReason}</p>
              <div className="browser-card-meta">
                <span><b>Current domain</b>{session.currentDomain}</span>
                <span><b>Execution target</b>{session.runtimeLabel}</span>
              </div>
              <div className="browser-card-footer">
                <div className="browser-chip-row">
                  {session.accountSensitive && <span className="tag warn">account-sensitive</span>}
                  {session.approvalRequired && <span className="tag warn">Approval gate</span>}
                  {session.screenshot && <span className="tag good">Latest screenshot</span>}
                </div>
                <button className="btn ghost browser-card-open" type="button" onClick={(event) => { event.stopPropagation(); void openSession(session.id); }}>Open details</button>
              </div>
            </article>
          ))}
        </section>

      </div>

      {selected && (
        <div className="browser-session-layer" role="presentation">
          <button className="browser-session-scrim" aria-label="Close browser session details" onClick={() => setSelected(null)} />
          <aside className="browser-session-drawer" data-testid="browser-session-drawer" aria-label="Selected browser session detail">
            <article className="router-panel" data-testid="browser-operation-detail">
              <div className="section-head">
                <div>
                  <h2>{selected.title}</h2>
                  <p>{selected.executionTarget.executionBoundary}</p>
                </div>
                <div className="browser-control-row">
                  <button className="btn dark" disabled={busy || !selected.stopAvailable} onClick={() => void stopSelected()}>{busy ? "Stopping…" : "Stop"}</button>
                  <button className="btn ghost" disabled={busy || !selected.takeoverAvailable} onClick={() => void takeoverSelected()}>Takeover</button>
                  <button className="btn ghost" type="button" aria-label="Close browser session details" onClick={() => setSelected(null)}>Close</button>
                </div>
              </div>
              <div className="desktop-readiness-grid browser-detail-grid">
                <div className="kv"><span>Current domain</span><b>{selected.currentDomain}</b></div>
                <div className="kv"><span>Runtime</span><b>{selected.runtimeLabel}</b></div>
                <div className="kv browser-url-kv"><span>Current URL</span><b title={selected.currentUrl ?? "—"}>{selected.currentUrl ?? "—"}</b></div>
                <div className="kv browser-approval-kv"><span>Approval gate</span><b>{selected.approvalRequired ? selected.approvalReason : "No gate required"}</b></div>
              </div>
              <section className="browser-boundary-card" aria-label="External action boundary">
                <span className="stub-tag">External action boundary</span>
                <h3>Submit/post/send/purchase require approval before execution</h3>
                <p>{selected.accountSensitive ? "Account-sensitive session: operator takeover and explicit approval are required before any external action." : "NO_SUBMIT dry-run boundary: browser evidence can be reviewed, but external actions stay blocked."}</p>
              </section>

              <section className="browser-screenshot-panel">
                <div className="browser-screenshot-head">
                  <h3>Latest screenshot</h3>
                  {selected.screenshot && <a className="ghost tiny" data-testid="browser-final-evidence-link" href={selected.screenshot.url || selected.screenshot.path || '#'} target="_blank" rel="noreferrer">Open screenshot evidence</a>}
                </div>
                {selected.screenshot?.url || selected.screenshot?.path ? (
                  <figure className="browser-screenshot-frame">
                    <img className="browser-screenshot-image" src={selected.screenshot.url || selected.screenshot.path || ''} alt={selected.screenshot.title || 'Browser screenshot evidence'} />
                    <figcaption>{selected.screenshot.summary ?? 'Screenshot evidence captured by the browser runtime.'}</figcaption>
                  </figure>
                ) : (
                  <div className="browser-screenshot-placeholder">
                    <span>No screenshot yet</span>
                    <small>A live browser run will attach evidence here.</small>
                  </div>
                )}
              </section>

              <section className="browser-action-log">
                <h3>Action log</h3>
                {selected.actionLog.map((event) => (
                  <div className="browser-action-row" key={event.id}>
                    <span className={`tag ${event.approvalRequired ? "warn" : "muted"}`}>{event.type}</span>
                    <div>
                      <b>{event.title}</b>
                      <p>{event.summary}</p>
                      <small>{event.ts} · risk: {event.risk}</small>
                    </div>
                  </div>
                ))}
              </section>

              <section className="browser-action-log browser-evidence-log">
                <h3>Final screenshot/link evidence</h3>
                {selected.evidence.map((item) => (
                  <div className="browser-action-row" key={item.id}>
                    <span className="tag good">{item.kind}</span>
                    <div>
                      <b>{item.title}</b>
                      <p>{item.summary ?? item.source ?? "Evidence attached to this browser run."}</p>
                      <small>{item.createdAt ?? selected.updatedAt}</small>
                    </div>
                  </div>
                ))}
              </section>

              <section className="drawer-section-list">
                {selected.notes.map((note) => <div className="kv" key={note}><span>Operator note</span><b>{note}</b></div>)}
              </section>
            </article>
          </aside>
        </div>
      )}
    </div>
  );
}
