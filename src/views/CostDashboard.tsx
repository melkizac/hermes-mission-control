import { useEffect, useMemo, useState } from "react";
import type { CostBreakdownRow, CostSessionRecord, CostUsageRecord, CostsResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { InfoTooltip } from "../components/InfoTooltip";

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
          <div className="hero-title-with-help">
            <h1>Cost Dashboard</h1>
            <InfoTooltip label="About costs">
              Token, session, tool-call, and estimated spend telemetry from Hermes state.db. Costs prefer actual billing fields when present and fall back to Hermes estimates.
            </InfoTooltip>
          </div>
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

        <AgentClassUsage rows={data?.by_agent_class ?? []} total={(data?.by_agent_class ?? []).reduce((sum, row) => sum + (row.cost ?? 0), 0)} />
        <GovernanceUsage data={data} />
        <QuotaEnforcement dimensions={data?.quota_dimensions ?? []} />

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

function AgentClassUsage({ rows, total }: { rows: CostBreakdownRow[]; total: number }) {
  const defaults = [
    { agent_class: "platform", label: "Platform agents", sessions: 0, cost: 0, tokens: 0, tool_calls: 0 },
    { agent_class: "workspace", label: "Workspace agents", sessions: 0, cost: 0, tokens: 0, tool_calls: 0 },
    { agent_class: "personal", label: "Personal agents", sessions: 0, cost: 0, tokens: 0, tool_calls: 0 },
  ];
  const merged = defaults.map((fallback) => rows.find((row) => row.agent_class === fallback.agent_class || row.label === fallback.label) ?? fallback);
  return (
    <div className="cost-panel cost-span-6">
      <div className="cost-panel-head"><span>Agent class usage</span><small>Platform / Workspace / Personal</small></div>
      <div className="cost-breakdown">
        {merged.map((row) => (
          <div className="cost-breakdown-row" key={row.agent_class ?? row.label}>
            <div>
              <b>{row.label ?? row.agent_class ?? "Unknown agents"}</b>
              <small>{row.sessions} runs · {compact(row.tokens)} tokens</small>
            </div>
            <span>{money(row.cost)}</span>
            <div className="mini-bar"><i style={{ width: `${pct(row.cost, total)}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GovernanceUsage({ data }: { data: CostsResponse | null }) {
  const research = data?.research_usage;
  const browser = data?.browser_usage;
  const files = data?.file_extraction_usage;
  const recent = (data?.usage_records ?? []).slice(0, 5);
  return (
    <div className="cost-panel cost-span-6">
      <div className="cost-panel-head"><span>Governance usage</span><small>research, browser, file evidence</small></div>
      <div className="cost-governance-metrics">
        <Info label="Research usage" value={`${research?.runs ?? 0} runs · ${money(research?.cost)}`} />
        <Info label="Browser usage" value={`${browser?.runs ?? 0} runs · ${compact(browser?.actions)} actions`} />
        <Info label="File extraction" value={`${files?.count ?? 0} files · ${compact(files?.size_bytes)}B`} />
      </div>
      <div className="cost-usage-list">
        {recent.map((record) => <UsageRecordRow key={record.id ?? record.routine_id ?? `${record.agent_id}-${record.model}`} record={record} />)}
        {recent.length === 0 && <div className="empty">No governed routine usage recorded in this window.</div>}
      </div>
    </div>
  );
}

function UsageRecordRow({ record }: { record: CostUsageRecord }) {
  return (
    <div className="cost-usage-row">
      <div>
        <b>{record.routine_id ?? record.agent_id ?? "Routine usage"}</b>
        <small>{record.agent_class ?? "unknown"} · {record.provider ?? "provider"}/{record.model ?? "model"} · {record.run_type ?? "routine"}</small>
      </div>
      <span>{money(record.cost)}</span>
    </div>
  );
}

function QuotaEnforcement({ dimensions }: { dimensions: string[] }) {
  const defaults = dimensions.length ? dimensions : ["platform", "workspace", "user", "agent", "routine", "connector", "model/provider", "research_depth"];
  return (
    <div className="cost-panel cost-span-12">
      <div className="cost-panel-head"><span>Quota enforcement</span><small>checked before routine execution</small></div>
      <p className="cost-policy-copy">
        Quota enforcement is evaluated before runs start across platform, workspace, user, agent, routine, connector, model/provider, and research depth dimensions. Quota blocks are written to Audit Log evidence instead of appearing as successful executions.
      </p>
      <div className="cost-quota-tags">{defaults.map((dimension) => <span key={dimension}>{dimension}</span>)}</div>
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
    <SlideOverDrawer
      title={session.title}
      subtitle={<span className="mono">{session.id}</span>}
      eyebrow={session.status}
      statusClassName="tag muted"
      onClose={onClose}
      closeLabel="Close cost details"
      ariaLabel="Cost session details"
      className="cost-detail cost-detail-drawer"
    >
      <div className="cost-kv">
        <Info label="Displayed cost" value={money(session.display_cost_usd)} />
        <Info label="Estimated" value={money(session.estimated_cost_usd)} />
        <Info label="Actual" value={session.actual_cost_usd == null ? "—" : money(session.actual_cost_usd)} />
        <Info label="Provider" value={session.billing_provider || "—"} />
        <Info label="Source" value={session.source} />
        <Info label="Started" value={formatSingaporeTime(session.started_at)} />
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
    </SlideOverDrawer>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="cost-info"><span>{label}</span><b>{value}</b></div>;
}
