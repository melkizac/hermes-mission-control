import { useEffect, useMemo, useState } from "react";
import type { InboxAction, InboxItem, InboxResponse, InboxStatus } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { queryCacheEventName } from "../services/queryCache";
import { parseMissionControlDeepLink } from "../services/deepLinks";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";
import { OnboardingEmptyState } from "../components/OnboardingEmptyState";
import { useStore } from "../services/store";

const client = new HttpHermesClient();
const tabs: Array<{ key: InboxStatus | "all"; label: string; helper: string }> = [
  { key: "drafted", label: "Needs decision", helper: "Items where your approval changes what an agent is allowed to do" },
  { key: "ready", label: "Ready to approve", helper: "Reviewed items awaiting your final yes/no decision" },
  { key: "sent", label: "Approved", helper: "Past items you approved, including what was released or allowed" },
  { key: "rejected", label: "Rejected", helper: "Past items you declined or sent back" },
  { key: "all", label: "All", helper: "Every approval decision with source, destination, and effect" },
];

function metadataString(item: InboxItem, key: string): string | null {
  const value = item.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readableToken(value?: string | null): string {
  return (value || "").replace(/[_-]+/g, " ").trim();
}

function decisionState(item: InboxItem): string {
  if (item.status === "drafted") return "Needs decision";
  if (item.status === "ready") return "Reviewed — final decision";
  if (item.status === "sent") return "Approved / done";
  if (item.status === "rejected") return "Rejected";
  return readableToken(item.status) || "Decision state unknown";
}

function projectRelation(item: InboxItem): string {
  const projectName = item.project_name || metadataString(item, "project_name") || metadataString(item, "project") || metadataString(item, "tenant");
  const projectId = item.project_id || metadataString(item, "project_id");
  const taskId = item.task_id || metadataString(item, "task_id") || metadataString(item, "kanban_task_id");
  const relation = [projectName || projectId, taskId ? `task ${taskId}` : null].filter(Boolean).join(" · ");
  return relation || "No project/task link supplied";
}

function evidencePreview(item: InboxItem): string {
  const evidence = item.evidence || metadataString(item, "evidence") || metadataString(item, "evidence_url") || metadataString(item, "evidence_path") || metadataString(item, "source_excerpt");
  if (evidence) return evidence;
  const body = (item.body || item.description || "").replace(/\s+/g, " ").trim();
  if (body) return body.length > 240 ? `${body.slice(0, 237)}…` : body;
  return "No evidence attached — approval disabled until evidence is visible.";
}

function hasEvidence(item: InboxItem): boolean {
  return evidencePreview(item) !== "No evidence attached — approval disabled until evidence is visible.";
}

function approvalTarget(item: InboxItem): string {
  const derivedFrom = metadataString(item, "derived_from");
  const action = readableToken(metadataString(item, "action"));
  const resourceType = readableToken(metadataString(item, "resource_type"));
  const resourceId = metadataString(item, "resource_id") || item.source_id || item.source_path || item.destination;
  const connectorId = metadataString(item, "connector_id");
  const jobName = metadataString(item, "job_name");

  if (derivedFrom === "approval_policy") {
    const actionText = action || readableToken(item.kind) || "run a gated action";
    const resourceText = [resourceType, resourceId].filter(Boolean).join(" ") || item.destination;
    const connectorText = connectorId ? ` through connector ${connectorId}` : "";
    return `Allow ${item.agent_name || item.agent_id} to ${actionText} on ${resourceText}${connectorText}.`;
  }

  if (derivedFrom === "cron_output" || item.kind === "automation_output") {
    return `Accept routine output from ${jobName || item.agent_name || item.source_id || "this automation"} for ${item.destination || "its configured destination"}.`;
  }

  if (item.kind === "workspace_item") {
    return `Approve workspace item “${item.title}” from ${item.agent_name || item.source || "Mission Control"}.`;
  }

  return `Approve “${item.title}” for ${item.destination || "the listed destination"}.`;
}

function approvalEffect(item: InboxItem): string {
  const derivedFrom = metadataString(item, "derived_from");
  if (derivedFrom === "approval_policy") {
    return "Approve records your permission for this paused policy-gated action; Reject keeps it blocked.";
  }
  if (derivedFrom === "cron_output" || item.kind === "automation_output") {
    return "Approve marks this generated routine output as accepted for use/release; Reject keeps it out of the approved history.";
  }
  return "Approve records your operator decision for this item; Reject marks it declined.";
}

function statusLabel(status: InboxStatus): string {
  if (status === "drafted") return "Needs decision";
  if (status === "ready") return "Reviewed";
  if (status === "sent") return "Approved";
  if (status === "rejected") return "Rejected";
  return status;
}

function riskLabel(risk: string): string {
  if (risk === "critical") return "Critical risk";
  if (risk === "high") return "High risk";
  if (risk === "medium") return "Medium risk";
  if (risk === "low") return "Low risk";
  return risk;
}

export function Approvals() {
  const { setView } = useStore();
  const [data, setData] = useState<InboxResponse | null>(null);
  const [status, setStatus] = useState<InboxStatus | "all">("drafted");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const [draft, setDraft] = useState<Partial<InboxItem>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deepLinkedApprovalId = useMemo(() => parseMissionControlDeepLink(window.location).approvalId ?? null, []);

  const load = async (mode: "initial" | "manual" | "event" = "initial") => {
    const previousRefreshMode = window.__hmcRefreshMode;
    try {
      window.__hmcRefreshMode = mode;
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
      window.__hmcRefreshMode = previousRefreshMode;
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, status]);

  useEffect(() => {
    const onQueryCacheUpdated = () => void load("event");
    window.addEventListener(queryCacheEventName(), onQueryCacheUpdated);
    return () => window.removeEventListener(queryCacheEventName(), onQueryCacheUpdated);
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

  const canApproveSelected = selected ? hasEvidence(selected) : false;

  return (
    <div className="inbox-page scroll">
      <header className="inbox-hero">
        <div>
          <span className="stub-tag">APPROVAL GATE</span>
          <div className="hero-title-with-help">
            <h1>Approval Gates</h1>
            <InfoTooltip label="About approval gates">Approve or reject external-facing and irreversible agent actions. Email alerts, blockers, and “needs attention” items belong on the Task Board instead.</InfoTooltip>
          </div>
        </div>
        <button className="task-icon-action dark" aria-label="Refresh approvals" title="Refresh approvals" onClick={() => void load("manual")}>
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
        <div className="filter-help"><InfoTooltip label="About approval filters">Only items requiring an operator decision should appear here. Attention-only items are routed to the Task Board.</InfoTooltip></div>
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
                <span className={`inbox-status ${item.status}`}>{decisionState(item)}</span>
                {(item.risk === "high" || item.risk === "critical") && <span className={`inbox-risk ${item.risk}`}>{riskLabel(item.risk)}</span>}
              </div>
              <h2>{item.title}</h2>
              <div className="inbox-approval-explain">
                <strong>You are approving:</strong>
                <span>{approvalTarget(item)}</span>
              </div>
              <p>{item.description}</p>
              <small className="inbox-approval-effect">{approvalEffect(item)}</small>
              <div className="inbox-decision-group">
                <div><span>Project</span><b>{projectRelation(item)}</b></div>
                <div><span>Agent</span><b>{item.agent_name || item.agent_id || "Mission Control"}</b></div>
                <div><span>Evidence</span><b>{evidencePreview(item)}</b></div>
              </div>
              <div className="inbox-meta">
                <span>{item.destination}</span>
                <span>{item.provenance}</span>
                <span>{formatSingaporeTime(item.created_at)}</span>
              </div>
            </button>
            <footer>
              <span className="inbox-card-hint">Click card for details</span>
              {(item.status === "drafted" || item.status === "ready") && (
                <span className="inbox-decision-actions">
                  <button className="approval-decision-button reject" onClick={() => void runAction(item, "reject")}>Reject</button>
                  <button className="approval-decision-button approve" disabled={!hasEvidence(item)} title={!hasEvidence(item) ? "Evidence is required before approval" : "Approve"} onClick={() => void runAction(item, "approve")}>Approve</button>
                  <button className="approval-decision-button snooze" disabled title="Snooze is not supported by the current inbox API yet">Snooze</button>
                </span>
              )}
            </footer>
          </article>
        ))}
        {!loading && items.length === 0 && (
          <OnboardingEmptyState
            compact
            title={q ? "No approval gates match this filter" : "No approval gates need a decision"}
            actions={[
              { label: "Clear search", onClick: () => setQ(""), disabled: !q },
              { label: "Open Task Board", variant: "primary", onClick: () => setView("board") },
              { label: "Set approval-producing workflows", onClick: () => setView("workflow-library") },
            ]}
            notes={["Approvals appear only when a real agent action or routine output needs operator permission.", "Attention-only blockers are routed to Task Board instead of being mixed into approval gates."]}
          >
            {q ? "Clear the search or switch tabs to inspect other decision states." : "When agents request permission to publish, send, submit, or use high-risk output, the decision card and evidence will appear here."}
          </OnboardingEmptyState>
        )}
      </section>

      {selected && (
        <SlideOverDrawer
          title={selected.title}
          subtitle={selected.provenance}
          eyebrow={statusLabel(selected.status)}
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
              <Info label="Decision state" value={decisionState(selected)} />
              <Info label="Risk" value={selected.risk} />
              <Info label="Destination" value={selected.destination} />
              <Info label="Project / task" value={projectRelation(selected)} />
              <Info label="Agent" value={selected.agent_name || selected.agent_id} />
              <Info label="Source" value={selected.source_path ?? selected.source_id ?? selected.source} />
              <Info label="Created" value={formatSingaporeTime(selected.created_at)} />
              <Info label="Reviewed" value={selected.reviewed_at ?? "—"} />
            </div>

            <section className="inbox-section approval-decision-summary">
              <h3>What exactly am I approving?</h3>
              <p><strong>You are approving:</strong> {approvalTarget(selected)}</p>
              <p><strong>If you click Approve:</strong> {approvalEffect(selected)}</p>
              <p><strong>Destination:</strong> {selected.destination || "—"}</p>
              <p><strong>Source:</strong> {selected.source_path ?? selected.source_id ?? selected.source}</p>
              <p><strong>Evidence:</strong> {evidencePreview(selected)}</p>
            </section>

            <section className="inbox-section">
              <h3>Edit decision artifact before approval</h3>
              <label>Title<input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label>Destination<input value={draft.destination ?? ""} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} /></label>
              <label>Summary<textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
              <label>Body<textarea className="body" value={draft.body ?? ""} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></label>
              <div className="inbox-drawer-actions">
                <span className="inbox-secondary-actions">
                  <button className="ghost tiny" onClick={() => void save()}>Save edits</button>
                  {selected.status === "drafted" && <button className="ghost tiny" onClick={() => void runAction(selected, "ready")}>Mark reviewed</button>}
                </span>
                {(selected.status === "drafted" || selected.status === "ready") && (
                  <span className="inbox-decision-actions drawer">
                    <button className="approval-decision-button reject" onClick={() => void runAction(selected, "reject")}>Reject</button>
                    <button className="approval-decision-button approve" disabled={!canApproveSelected} title={!canApproveSelected ? "Evidence is required before approval" : "Approve"} onClick={() => void runAction(selected, "approve")}>Approve</button>
                    <button className="approval-decision-button snooze" disabled title="Snooze is not supported by the current inbox API yet">Snooze</button>
                  </span>
                )}
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
