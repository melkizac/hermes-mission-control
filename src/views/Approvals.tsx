import { useEffect, useMemo, useState } from "react";
import type { InboxAction, InboxItem, InboxResponse, InboxStatus } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { parseMissionControlDeepLink } from "../services/deepLinks";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();
const tabs: Array<{ key: InboxStatus | "all"; label: string; helper: string }> = [
  { key: "drafted", label: "Needs decision", helper: "External or irreversible actions awaiting operator decision" },
  { key: "ready", label: "Ready to approve", helper: "Reviewed proposals ready for final approval" },
  { key: "sent", label: "Approved", helper: "Approved / released history" },
  { key: "rejected", label: "Rejected", helper: "Declined or reclassified proposals" },
  { key: "all", label: "All", helper: "Full approval decision history" },
];

export function Approvals() {
  const [data, setData] = useState<InboxResponse | null>(null);
  const [status, setStatus] = useState<InboxStatus | "all">("drafted");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [draft, setDraft] = useState<Partial<InboxItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deepLinkedApprovalId = useMemo(() => parseMissionControlDeepLink(window.location).approvalId ?? null, []);

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
      setError(err instanceof Error ? err.message : "Unable to load approval gates");
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

  useEffect(() => {
    if (deepLinkedApprovalId) setStatus("all");
  }, [deepLinkedApprovalId]);

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

  useEffect(() => {
    if (!deepLinkedApprovalId || loading || !data) return;
    if (selected?.id === deepLinkedApprovalId) return;
    const match = data.items.find((item) => item.id === deepLinkedApprovalId);
    if (match) open(match);
    else setError(`Deep-linked approval ${deepLinkedApprovalId} is not visible in the current workspace.`);
  }, [deepLinkedApprovalId, loading, data, selected?.id]);

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
          <span className="stub-tag">APPROVAL GATE</span>
          <h1>Approval Gates</h1>
          <p>Approve or reject external-facing and irreversible agent actions. Email alerts, blockers, and “needs attention” items belong on the Task Board instead.</p>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh approvals" title="Refresh approvals" onClick={() => void load()}>
          <Icon name="refresh" size={18} />
        </button>
      </header>

      <section className="inbox-metrics">
        <Metric label="Needs decision" value={counts.drafted} sub="Approve/reject required" />
        <Metric label="Ready" value={counts.ready} sub="Reviewed proposals" tone="good" />
        <Metric label="Approved" value={counts.sent} sub="Decision history" />
        <Metric label="Risk Watch" value={summary?.high_risk ?? 0} sub="High-risk approvals" tone="bad" />
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
        <div className="inbox-filter-note">Only items requiring an operator decision should appear here. Attention-only items are routed to the Task Board.</div>
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
        {!loading && items.length === 0 && <div className="empty big">No approval gates in this view.</div>}
      </section>

      {selected && (
        <SlideOverDrawer
          title={selected.title}
          subtitle={selected.provenance}
          eyebrow={selected.status}
          statusClassName={`inbox-status ${selected.status}`}
          onClose={() => setSelected(null)}
          closeLabel="Close approval details"
          ariaLabel="Approval details"
          dataDeepLinkTarget="approval"
          // rendered attribute: data-deeplink-target="approval"
          width="wide"
          className="inbox-detail-drawer"
        >

            <div className="inbox-kv">
              <Info label="Kind" value={selected.kind} />
              <Info label="Risk" value={selected.risk} />
              <Info label="Destination" value={selected.destination} />
              <Info label="Source" value={selected.source_path ?? selected.source_id ?? selected.source} />
              <Info label="Created" value={formatSingaporeTime(selected.created_at)} />
              <Info label="Reviewed" value={selected.reviewed_at ?? "—"} />
            </div>

            <section className="inbox-section">
              <h3>Edit decision artifact before approval</h3>
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
        </SlideOverDrawer>
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
