import { useEffect, useMemo, useState } from "react";
import type { AuditMessage, AuditSession, AuditSessionDetailResponse, AuditSessionListResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";

const client = new HttpHermesClient();

type AuditTab = "summary" | "timeline";

function compactNumber(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function money(value: number | undefined | null) {
  return `$${(value ?? 0).toFixed(4)}`;
}

function duration(seconds: number | undefined | null) {
  const s = Math.max(0, seconds ?? 0);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function roleLabel(message: AuditMessage) {
  if (message.tool_name) return message.tool_name;
  if (message.tool_calls?.length) return "tool call requested";
  return message.role;
}

export function AuditLog() {
  const [data, setData] = useState<AuditSessionListResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditSessionDetailResponse | null>(null);
  const [tab, setTab] = useState<AuditTab>("summary");
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const next = await client.listAuditSessions({ q, source, limit: 80 });
        if (!alive) return;
        setData(next);
        setError(next.error ?? null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load audit sessions");
      } finally {
        if (alive) setLoading(false);
      }
    }, 180);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [q, source]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        setDetailLoading(true);
        const next = await client.getAuditSession(selected);
        if (!alive) return;
        setDetail(next);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load session detail");
      } finally {
        if (alive) setDetailLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [selected]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const sessions = data?.sessions ?? [];
  const summary = data?.summary;
  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selected) ?? detail?.session,
    [sessions, selected, detail],
  );

  const openSession = (id: string) => {
    setSelected(id);
    setTab("summary");
  };

  const closeSession = () => {
    setSelected(null);
    setDetail(null);
  };

  return (
    <div className="audit-page audit-drawer-first scroll">
      <header className="audit-hero">
        <div>
          <span className="stub-tag">AUDIT TRAIL</span>
          <h1>Audit Log</h1>
          <p>
            Full-width session history with slide-over run trace details. Click any session to inspect metadata and timeline without shrinking the list.
          </p>
        </div>
        <button className="btn dark" onClick={() => window.location.reload()}>Refresh</button>
      </header>

      <section className="audit-metrics">
        <Metric label="Sessions" value={summary?.total ?? sessions.length} sub={`${summary?.running ?? 0} running`} />
        <Metric label="Tool calls" value={compactNumber(summary?.tool_calls)} sub="Auditable tool activity" />
        <Metric label="Tokens" value={compactNumber(summary?.tokens)} sub="Input + output + cache" />
        <Metric label="Est. cost" value={money(summary?.estimated_cost_usd)} sub="From Hermes billing fields" />
      </section>

      <section className="audit-filters">
        <label>
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="title, session id, source, model…" />
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {(data?.sources ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <div className="audit-filter-note">No raw secrets are exposed by default. Message bodies are previewed and server-redacted.</div>
      </section>

      {error && <div className="audit-error">{error}</div>}

      <section className="audit-list audit-list-full">
        <div className="audit-panel-head">
          <span>Run/session history</span>
          <small>{loading ? "Loading…" : `${sessions.length} shown`}</small>
        </div>
        {sessions.length === 0 && !loading && <div className="empty big">No audit sessions found for this filter.</div>}
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            active={session.id === selected}
            onClick={() => openSession(session.id)}
          />
        ))}
      </section>

      {selectedSession && (
        <AuditDrawer
          session={selectedSession}
          detail={detail}
          detailLoading={detailLoading}
          tab={tab}
          setTab={setTab}
          onClose={closeSession}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="audit-metric">
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function SessionCard({ session, active, onClick }: { session: AuditSession; active: boolean; onClick: () => void }) {
  return (
    <button className={"audit-session" + (active ? " on" : "")} onClick={onClick}>
      <div className="audit-session-main">
        <div className="audit-session-top">
          <b>{session.title}</b>
          <span className={"tag " + (session.status === "running" ? "good" : "muted")}>{session.status}</span>
        </div>
        <p>{session.preview || "No preview available."}</p>
        <small className="mono">{session.id}</small>
      </div>
      <div className="audit-session-meta">
        <span>{session.source}</span>
        <small>{formatSingaporeTime(session.started_at)}</small>
        <em>{session.message_count} msgs · {session.tool_call_count} tools · {compactNumber(session.total_tokens)} tok</em>
      </div>
    </button>
  );
}

function AuditDrawer({ session, detail, detailLoading, tab, setTab, onClose }: {
  session: AuditSession;
  detail: AuditSessionDetailResponse | null;
  detailLoading: boolean;
  tab: AuditTab;
  setTab: (tab: AuditTab) => void;
  onClose: () => void;
}) {
  return (
    <SlideOverDrawer
      title={session.title}
      subtitle={<span className="mono">{session.id}</span>}
      eyebrow={session.status}
      statusClassName={"tag " + (session.status === "running" ? "good" : "muted")}
      onClose={onClose}
      closeLabel="Close audit details"
      ariaLabel="Audit session details"
      tabs={["summary", "timeline"] as const}
      activeTab={tab}
      onTabChange={setTab}
      className="audit-detail audit-detail-drawer"
    >
      {tab === "summary" && (
        <>
          <div className="audit-kv">
            <Info label="Source" value={session.source} />
            <Info label="Model" value={session.model} />
            <Info label="Started" value={formatSingaporeTime(session.started_at)} />
            <Info label="Duration" value={duration(session.duration_seconds)} />
            <Info label="Messages" value={String(session.message_count)} />
            <Info label="Tool calls" value={String(session.tool_call_count)} />
            <Info label="Tokens" value={session.total_tokens.toLocaleString()} />
            <Info label="Cost" value={money(session.estimated_cost_usd)} />
          </div>
          <section className="audit-drawer-section">
            <h3>Preview</h3>
            <pre>{session.preview || "No preview available."}</pre>
          </section>
        </>
      )}

      {tab === "timeline" && (
        <>
          <div className="timeline-title"><span>Chronological trace</span>{detailLoading && <small>Loading detail…</small>}</div>
          <div className="audit-timeline">
            {(detail?.messages ?? []).map((message) => <TimelineItem key={message.id} message={message} />)}
            {!detailLoading && (detail?.messages ?? []).length === 0 && <div className="empty">No messages recorded for this session.</div>}
          </div>
        </>
      )}
    </SlideOverDrawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-info">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function TimelineItem({ message }: { message: AuditMessage }) {
  const toolNames = (message.tool_calls ?? []).map((t) => t.name).filter(Boolean).join(", ");
  return (
    <article className={`audit-event role-${message.role}`}>
      <div className="audit-event-dot" />
      <div className="audit-event-card">
        <div className="audit-event-head">
          <b>{roleLabel(message)}</b>
          <span>{formatSingaporeTime(message.timestamp)}</span>
        </div>
        {toolNames && <div className="audit-tool-list">Requested: {toolNames}</div>}
        {message.tool_call_id && <div className="audit-tool-list mono">Tool call id: {message.tool_call_id}</div>}
        {message.content && <pre>{message.content}</pre>}
        {!message.content && !toolNames && <p className="empty">No text content recorded.</p>}
      </div>
    </article>
  );
}
