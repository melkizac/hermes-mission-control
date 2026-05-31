import { useEffect, useMemo, useState } from "react";
import type { CostBreakdownRow, CostSessionRecord, CostsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";

const client = new HttpHermesClient();
const windows = [7, 14, 30, 90, 365];

function money(value: number | undefined | null) {
  const v = value ?? 0;
  if (v === 0) return "$0.00";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function pct(part: number | undefined, total: number | undefined) {
  if (!part || !total) return 0;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

export function CostDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<CostsResponse | null>(null);
  const [selected, setSelected] = useState<CostSessionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        const next = await client.getCosts({ days });
        if (!alive) return;
        setData(next);
        setError(next.error ?? null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load cost telemetry");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [days]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const summary = data?.summary;
  const selectedWindow = summary?.selected;
  const maxDaily = useMemo(() => Math.max(0, ...(data?.daily ?? []).map((row) => row.cost)), [data]);

  return (
    <div className="cost-page scroll">
      <header className="cost-hero">
        <div>
          <span className="stub-tag">COST OPS</span>
          <h1>Cost Dashboard</h1>
          <p>
            Token, session, tool-call, and estimated spend telemetry from Hermes state.db. Costs prefer actual billing fields when present and fall back to Hermes estimates.
          </p>
        </div>
        <div className="cost-window">
          <span>Window</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {windows.map((w) => <option key={w} value={w}>{w} days</option>)}
          </select>
        </div>
      </header>

      <section className="cost-metrics">
        <Metric label="Selected spend" value={money(selectedWindow?.cost)} sub={`${selectedWindow?.sessions ?? 0} sessions · ${compact(selectedWindow?.tokens)} tokens`} />
        <Metric label="Last 24h" value={money(summary?.last_24h?.cost)} sub={`${summary?.last_24h?.sessions ?? 0} sessions · ${compact(summary?.last_24h?.tool_calls)} tools`} />
        <Metric label="Last 7d" value={money(summary?.last_7d?.cost)} sub={`${compact(summary?.last_7d?.tokens)} tokens`} />
        <Metric label="All-time" value={money(summary?.all_time?.cost)} sub={`${summary?.all_time?.sessions ?? 0} sessions recorded`} />
      </section>

      {error && <div className="cost-error">{error}</div>}

      <section className="cost-grid">
        <div className="cost-panel cost-span-8">
          <div className="cost-panel-head">
            <span>Daily spend trend</span>
            <small>{loading ? "Loading…" : `${data?.daily.length ?? 0} days`}</small>
          </div>
          <div className="cost-bars">
            {(data?.daily ?? []).map((row) => (
              <div className="cost-bar-row" key={row.day}>
                <span>{row.day}</span>
                <div><i style={{ width: `${pct(row.cost, maxDaily)}%` }} /></div>
                <b>{money(row.cost)}</b>
                <em>{compact(row.tokens)} tok</em>
              </div>
            ))}
            {!loading && (data?.daily ?? []).length === 0 && <div className="empty big">No cost activity found for this window.</div>}
          </div>
        </div>

        <div className="cost-panel cost-span-4">
          <div className="cost-panel-head"><span>Token mix</span><small>selected window</small></div>
          <TokenMix summary={selectedWindow} />
        </div>

        <Breakdown title="Spend by model" rows={data?.by_model ?? []} field="model" total={selectedWindow?.cost ?? 0} />
        <Breakdown title="Spend by source" rows={data?.by_source ?? []} field="source" total={selectedWindow?.cost ?? 0} />

        <div className="cost-panel cost-span-12">
          <div className="cost-panel-head">
            <span>Highest-cost sessions</span>
            <small>{data?.expensive_sessions.length ?? 0} shown</small>
          </div>
          <div className="cost-session-list">
            {(data?.expensive_sessions ?? []).map((session) => <SessionRow key={session.id} session={session} onClick={() => setSelected(session)} />)}
            {!loading && (data?.expensive_sessions ?? []).length === 0 && <div className="empty big">No sessions with recorded costs for this window.</div>}
          </div>
        </div>
      </section>

      {selected && <CostDrawer session={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="cost-metric"><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function TokenMix({ summary }: { summary?: { input_tokens?: number; output_tokens?: number; cache_read_tokens?: number; cache_write_tokens?: number; reasoning_tokens?: number; tokens?: number; total_tokens?: number } }) {
  const totalTokens = summary?.tokens ?? summary?.total_tokens ?? 0;
  const parts = [
    ["Input", summary?.input_tokens ?? 0, "input"],
    ["Output", summary?.output_tokens ?? 0, "output"],
    ["Cache read", summary?.cache_read_tokens ?? 0, "cache"],
    ["Cache write", summary?.cache_write_tokens ?? 0, "cachewrite"],
    ["Reasoning", summary?.reasoning_tokens ?? 0, "reasoning"],
  ] as const;
  return <div className="token-mix">{parts.map(([label, value, kind]) => <div key={label}><span>{label}</span><div><i className={kind} style={{ width: `${pct(value, totalTokens)}%` }} /></div><b>{compact(value)}</b></div>)}</div>;
}

function Breakdown({ title, rows, field, total }: { title: string; rows: CostBreakdownRow[]; field: "model" | "source"; total: number }) {
  return (
    <div className="cost-panel cost-span-6">
      <div className="cost-panel-head"><span>{title}</span><small>{rows.length} groups</small></div>
      <div className="cost-breakdown">
        {rows.map((row) => (
          <div className="cost-breakdown-row" key={row[field] ?? "unknown"}>
            <div>
              <b>{row[field] ?? "unknown"}</b>
              <small>{row.sessions} sessions · {compact(row.tokens)} tokens · {compact(row.tool_calls)} tools</small>
            </div>
            <span>{money(row.cost)}</span>
            <div className="mini-bar"><i style={{ width: `${pct(row.cost, total)}%` }} /></div>
          </div>
        ))}
        {rows.length === 0 && <div className="empty">No grouped cost data for this window.</div>}
      </div>
    </div>
  );
}

function SessionRow({ session, onClick }: { session: CostSessionRecord; onClick: () => void }) {
  return (
    <button className="cost-session" onClick={onClick}>
      <div>
        <b>{session.title}</b>
        <p>{session.model}</p>
        <small className="mono">{session.id}</small>
      </div>
      <span>{session.source}</span>
      <em>{compact(session.total_tokens)} tok · {session.tool_call_count} tools</em>
      <strong>{money(session.display_cost_usd)}</strong>
    </button>
  );
}

function CostDrawer({ session, onClose }: { session: CostSessionRecord; onClose: () => void }) {
  return (
    <div className="cost-drawer-layer" role="dialog" aria-modal="true" aria-label="Cost session details">
      <button className="cost-drawer-scrim" aria-label="Close cost details" onClick={onClose} />
      <aside className="cost-detail cost-detail-drawer">
        <header className="cost-detail-head cost-drawer-head">
          <div>
            <span className="tag muted">{session.status}</span>
            <h2>{session.title}</h2>
            <p className="mono">{session.id}</p>
          </div>
          <button className="cost-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="cost-kv">
          <Info label="Displayed cost" value={money(session.display_cost_usd)} />
          <Info label="Estimated" value={money(session.estimated_cost_usd)} />
          <Info label="Actual" value={session.actual_cost_usd == null ? "—" : money(session.actual_cost_usd)} />
          <Info label="Provider" value={session.billing_provider || "—"} />
          <Info label="Source" value={session.source} />
          <Info label="Started" value={session.started_at} />
          <Info label="Messages" value={String(session.message_count)} />
          <Info label="API calls" value={String(session.api_call_count)} />
        </div>
        <section className="cost-section">
          <h3>Token breakdown</h3>
          <TokenMix summary={session} />
        </section>
        <section className="cost-section">
          <h3>Billing metadata</h3>
          <pre>{JSON.stringify({ cost_status: session.cost_status, cost_source: session.cost_source, provider: session.billing_provider, model: session.model }, null, 2)}</pre>
        </section>
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="cost-info"><span>{label}</span><b>{value}</b></div>;
}
