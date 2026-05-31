import { useEffect, useMemo, useState } from "react";
import type { InboxAction, InboxItem, InboxResponse, InboxStatus } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";

const client = new HttpHermesClient();
const tabs: Array<{ key: InboxStatus | "all"; label: string; helper: string }> = [
  { key: "drafted", label: "Drafted", helper: "Needs review before going live" },
  { key: "ready", label: "Ready", helper: "Reviewed and ready for final approval" },
  { key: "sent", label: "Sent", helper: "Approved or marked complete" },
  { key: "rejected", label: "Rejected", helper: "Dismissed proposals" },
  { key: "all", label: "All", helper: "Full approval history" },
];

export function Approvals() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [status, setStatus] = useState<InboxStatus | "all">("drafted");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [draft, setDraft] = useState<Partial<InboxItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.listInbox({ q, status });
      setData(next);
      setError(next.error ?? null);
      if (selected) {
        setSelected(next.items.find((item) => item.id === selected.id) ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load approval inbox");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, status]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const items = data?.items ?? [];
  const summary = data?.summary;
  const activeTab = tabs.find((tab) => tab.key === status) ?? tabs[0];
  const counts = useMemo(() => ({
    drafted: summary?.drafted ?? 0,
    ready: summary?.ready ?? 0,
    sent: summary?.sent ?? 0,
    rejected: summary?.rejected ?? 0,
    all: summary?.total ?? 0,
  }), [summary]);

  const open = (item: InboxItem) => {
    setSelected(item);
    setDraft({ title: item.title, description: item.description, body: item.body, destination: item.destination, risk: item.risk });
  };

  const runAction = async (item: InboxItem, action: InboxAction) => {
    await client.inboxAction(item.id, action);
    await load();
  };

  const save = async () => {
    if (!selected) return;
    const result = await client.updateInboxItem(selected.id, {
      title: draft.title,
      description: draft.description,
      body: draft.body,
      destination: draft.destination,
      risk: draft.risk,
    });
    if (result.item) setSelected(result.item);
    await load();
  };

  return (
    <div className="inbox-page scroll">
      <header className="inbox-hero">
        <div>
          <span className="stub-tag">REVIEW QUEUE</span>
          <h1>Inbox</h1>
          <p>Review AI-drafted automation outputs, outbound messages, risky actions, and generated follow-ups before they become approved work.</p>
        </div>
        <button className="btn dark" onClick={() => void load()}>Refresh</button>
      </header>

      <section className="inbox-metrics">
        <Metric label="Drafted" value={counts.drafted} sub="Needs review" />
        <Metric label="Ready" value={counts.ready} sub="Reviewed queue" tone="good" />
        <Metric label="Sent" value={counts.sent} sub="Approved history" />
        <Metric label="Risk Watch" value={summary?.high_risk ?? 0} sub="High-risk pending" tone="bad" />
      </section>

      <section className="inbox-tabs">
        {tabs.map((tab) => (
          <button key={tab.key} className={status === tab.key ? "on" : ""} onClick={() => setStatus(tab.key)}>
            <span>{tab.label}</span><b>{counts[tab.key]}</b>
          </button>
        ))}
      </section>

      <section className="inbox-filters">
        <label>
          <span>Search</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="title, body, source, destination…" />
        </label>
        <div className="inbox-filter-note">Derived from real Hermes approval records and recent cron outputs. Actions update `/opt/hermes-mission-control/approvals.db`.</div>
      </section>

      {error && <div className="inbox-error">{error}</div>}

      <section className="inbox-list">
        <div className="inbox-panel-head">
          <div><span>{activeTab.label}</span><small>{activeTab.helper}</small></div>
          <small>{loading ? "Loading…" : `${items.length} shown`}</small>
        </div>
        {items.map((item) => (
          <article className="inbox-card" key={item.id}>
            <button className="inbox-card-main" onClick={() => open(item)}>
              <div className="inbox-card-top">
                <span className={`inbox-status ${item.status}`}>{item.status}</span>
                <span className={`inbox-risk ${item.risk}`}>{item.risk}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <div className="inbox-meta">
                <span>{item.destination}</span>
                <span>{item.provenance}</span>
                <span>{formatSingaporeTime(item.created_at)}</span>
              </div>
            </button>
            <footer>
              <button className="ghost tiny" onClick={() => open(item)}>Open</button>
              {item.status === "drafted" && <button className="ghost tiny" onClick={() => void runAction(item, "ready")}>Mark reviewed</button>}
              {(item.status === "drafted" || item.status === "ready") && <button className="ghost tiny danger" onClick={() => void runAction(item, "reject")}>Reject</button>}
              {(item.status === "drafted" || item.status === "ready") && <button className="btn dark tinybtn" onClick={() => void runAction(item, "approve")}>Approve</button>}
            </footer>
          </article>
        ))}
        {!loading && items.length === 0 && <div className="empty big">No inbox items in this view.</div>}
      </section>

      {selected && (
        <div className="inbox-drawer-layer" role="dialog" aria-modal="true" aria-label="Approval details">
          <button className="inbox-drawer-scrim" aria-label="Close approval details" onClick={() => setSelected(null)} />
          <aside className="inbox-detail-drawer">
            <header className="inbox-drawer-head">
              <div>
                <span className={`inbox-status ${selected.status}`}>{selected.status}</span>
                <h2>{selected.title}</h2>
                <p>{selected.provenance}</p>
              </div>
              <button className="inbox-drawer-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </header>

            <div className="inbox-kv">
              <Info label="Kind" value={selected.kind} />
              <Info label="Risk" value={selected.risk} />
              <Info label="Destination" value={selected.destination} />
              <Info label="Source" value={selected.source_path ?? selected.source_id ?? selected.source} />
              <Info label="Created" value={formatSingaporeTime(selected.created_at)} />
              <Info label="Reviewed" value={selected.reviewed_at ?? "—"} />
            </div>

            <section className="inbox-section">
              <h3>Edit before approval</h3>
              <label>Title<input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label>Destination<input value={draft.destination ?? ""} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} /></label>
              <label>Summary<textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              <label>Body<textarea className="body" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
              <div className="inbox-drawer-actions">
                <button className="ghost tiny" onClick={() => void save()}>Save edits</button>
                <button className="ghost tiny" onClick={() => void runAction(selected, "ready")}>Mark reviewed</button>
                <button className="ghost tiny danger" onClick={() => void runAction(selected, "reject")}>Reject</button>
                <button className="btn dark" onClick={() => void runAction(selected, "approve")}>Approve</button>
              </div>
            </section>

            <section className="inbox-section">
              <h3>Raw source body</h3>
              <pre>{selected.body}</pre>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "good" | "bad" }) {
  return <div className={`inbox-metric ${tone ?? ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return <div className="inbox-info"><span>{label}</span><b>{value || "—"}</b></div>;
}
