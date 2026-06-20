import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatSingaporeShort } from "../utils/time";
import { Icon } from "../components/Icon";
import { AgentDetailDrawerShell, type AgentDrawerAction, type AgentDrawerTab } from "../components/AgentDetailDrawerShell";
import { useStore } from "../services/store";
import type { AgentHandoff, CapabilityMatrixCapability, CapabilityMatrixRow, RunTreePayload, RunTreeRunNode, RunTreeTaskNode } from "../types";
import { useRealtimeRefresh, type RefreshMode } from "../hooks/useRealtimeRefresh";
import { cachedJsonRequest, invalidateQueryCache } from "../services/queryCache";

type DrawerTab = "overview" | "goals" | "queue" | "handoffs" | "approvals" | "runs" | "run-tree" | "outputs" | "activity" | "tools" | "memory" | "skills" | "permissions" | "profile" | "config";
type AgentStatus = "active" | "idle" | "blocked" | "failed" | "attention";

type Automation = { id: string; name: string; enabled: boolean; status: string; schedule: string; next_run_relative?: string; next_run_at?: string; last_run_at?: string; last_status?: string; prompt_preview?: string; recent_runs?: Run[]; recent_outputs?: Output[] };
type Task = { id: string; title: string; body?: string; status: string; priority_label?: string; updated_at?: string; assignee?: string; tenant?: string; skills?: string[] };
type Review = { id: string; title: string; description?: string; body?: string; status: string; risk: string; destination?: string; updated_at?: string; source?: string; source_id?: string; metadata?: Record<string, unknown> };
type Run = { id: string; title?: string; automation_id?: string; automation_name?: string; started_at?: string; ended_at?: string | null; status: string; tool_call_count?: number; tokens?: number; estimated_cost_usd?: number };
type Output = { id?: string; name: string; type?: string; path?: string; status?: string; updated_at?: string; preview?: string; destination?: string; automation_name?: string };
type GoalStep = { id: string; title: string; description?: string; status: string; owner?: string; task_id?: string; task?: Task; tools_needed?: string[]; access_needed?: string[]; data_needed?: string[]; deliverable?: string };
type GoalAction = { id: string; title: string; description?: string; status: string; owner?: string; owner_type?: "agent" | "human" | string; execution_type?: string; task_id?: string; task?: Task; step_id?: string; tools_needed?: string[]; access_needed?: string[]; data_needed?: string[]; evidence_needed?: string; deliverable?: string; automation_id?: string; updated_at?: string; last_note?: string };
type Goal = { id: string; title: string; objective?: string; context?: string; owner?: string; status: string; primary_kpi?: string; created_at?: string; updated_at?: string; goal_brief?: string; collaborators?: string[]; tools_needed?: string[]; access_needed?: string[]; data_needed?: string[]; progress: number; step_counts?: { total: number; done: number; running: number; blocked: number; queued: number }; action_counts?: { total: number; done: number; running: number; blocked: number; queued: number }; steps: GoalStep[]; actions?: GoalAction[] };
type Activity = { id: string; action: string; title: string; detail?: string; status: "info" | "success" | "error" | string; actor?: string; source?: string; job_id?: string; job_name?: string; created_at?: string; metadata?: Record<string, unknown> };
type SkillDetail = { name: string; description?: string; category?: string; source?: string };
type ProfileRuntimeDetails = {
  profile_id: string;
  profile_path: string;
  identity?: { name?: string; source?: string };
  model_routing?: { provider?: string; model?: string };
  toolsets?: string[];
  memory?: { entries: number; files: Array<{ name: string; entries: number; updated_at?: string }>; items?: Array<{ id: string; source?: string; file?: string; line_start?: number; title?: string; text: string; updated_at?: string; redacted?: boolean }>; redacted_or_sensitive_mentions?: number };
  sessions?: { count: number; recent: Array<Partial<Run> & { source?: string; model?: string; total_tokens?: number; estimated_cost_usd?: number }> };
  plugins?: { enabled: number; total: number; items: Array<{ id: string; name: string; category?: string; status?: string; source?: string }>; error?: string };
  gateway?: { channels: Array<{ id: string; enabled: boolean; source?: string }>; webhooks_configured?: number };
  environment?: { env_files: Array<{ name: string; status: string; variable_count: number; sensitive_count: number }>; policy: string };
  routines?: { count: number; items: Array<Partial<Automation> & { skill_count?: number; toolsets?: string[]; profile?: string }> };
  config_files?: Array<{ name: string; kind?: string; updated_at?: string }>;
};
type AgentActionResult = { ok?: boolean; error?: string; stdout?: string; stderr?: string; job_id?: string; choices?: Array<{ id: string; name: string; schedule?: string; last_status?: string }> };
type ActionFeedback = { agentId: string; tone: "busy" | "success" | "error"; title: string; detail?: string } | null;

type OrgAgent = {
  id: string;
  name: string;
  role: string;
  reports_to?: string | null;
  reportsTo?: string | null;
  runtime?: string;
  profile?: string;
  type?: string;
  mode: "observe" | "draft" | "approval" | "execute";
  summary: string;
  status: AgentStatus;
  tools: string[];
  permissions: string[];
  skills: string[];
  skills_detail: SkillDetail[];
  automations: Automation[];
  tasks: Task[];
  inbox: Review[];
  handoffs?: AgentHandoff[];
  handoff_summary?: { sent: number; received: number; open: number; blocked: number };
  runs: Run[];
  run_trees?: RunTreePayload[];
  outputs: Output[];
  activity: Activity[];
  queue: { queued: number; running: number; blocked: number; done: number; failed: number };
  cost7d: number;
  tokens7d: number;
  lastActivity?: string | null;
  active_goal?: Goal | null;
  goals?: Goal[];
  profile_details?: ProfileRuntimeDetails;
  detailLoaded?: boolean;
  detailEndpoint?: string;
  avatar_url?: string;
  automation_count?: number;
  task_count?: number;
  inbox_count?: number;
  run_count?: number;
  output_count?: number;
};

type OrgFlow = { id: string; name: string; trigger?: string; gate?: string; status: string; steps: Array<{ label: string; agent?: string; approval?: string; status?: string }> };
type AgentOrgResponse = { agents: OrgAgent[]; relationships: Array<{ from: string; to: string }>; flows: OrgFlow[]; summary: Record<string, number>; health: { errors: string[]; generated_at: string }; registry_path: string };

const emptyOrg: AgentOrgResponse = { agents: [], relationships: [], flows: [], summary: {}, health: { errors: [], generated_at: "" }, registry_path: "" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : res.statusText);
  return data as T;
}

const AGENT_ORG_SUMMARY_CACHE_KEY = "agent-org:summary";
const DETAIL_STALE_AFTER_MS = 60_000;

function agentOrgDetailCacheKey(agentId: string) {
  return `agent-org:detail:${agentId}`;
}

function invalidateAgentOrgCache(agentId?: string) {
  invalidateQueryCache(AGENT_ORG_SUMMARY_CACHE_KEY);
  if (agentId) invalidateQueryCache(agentOrgDetailCacheKey(agentId));
}

function mergeSummaryWithCachedDetail(summary: OrgAgent, detail?: OrgAgent): OrgAgent {
  if (!detail?.detailLoaded) return summary;
  return {
    ...summary,
    automations: detail.automations,
    tasks: detail.tasks,
    skills_detail: detail.skills_detail,
    inbox: detail.inbox,
    handoffs: detail.handoffs,
    runs: detail.runs,
    run_trees: detail.run_trees,
    outputs: detail.outputs,
    activity: detail.activity,
    goals: detail.goals,
    active_goal: detail.active_goal,
    profile_details: detail.profile_details,
    detailLoaded: true,
    detailEndpoint: summary.detailEndpoint || detail.detailEndpoint,
  };
}

function fmtMoney(value: number) {
  return `$${Number(value || 0).toFixed(value >= 1 ? 2 : 4)}`;
}

function fmtNum(value: number) {
  return Intl.NumberFormat("en-SG", { notation: value > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value || 0);
}

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: string }) {
  return <div className={`org-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function nodeReportName(agent: OrgAgent, agents: OrgAgent[]) {
  const parent = agent.reportsTo ?? agent.reports_to;
  if (!parent) return "Melverick / Human Operator";
  return agents.find((a) => a.id === parent)?.name || parent;
}

function agentIssueCount(agent: OrgAgent) {
  const queue = agent.queue || { blocked: 0, failed: 0, queued: 0, running: 0, done: 0 };
  const reviewCount = agent.inbox_count ?? agent.inbox.length;
  const blockedHandoffs = agent.handoff_summary?.blocked || 0;
  const count = (queue.blocked || 0) + (queue.failed || 0) + reviewCount + blockedHandoffs;
  return count || (["failed", "blocked", "attention"].includes(agent.status) ? 1 : 0);
}

function agentStatusPresentation(agent: OrgAgent) {
  const issues = agentIssueCount(agent);
  if (issues > 0) {
    return {
      tone: "issue",
      icon: "🔔",
      count: issues,
      title: `${issues} issue${issues === 1 ? "" : "s"} ${issues === 1 ? "needs" : "need"} attention: failed, blocked, review, or error work`,
    };
  }
  if (agent.status === "active") {
    return { tone: "ok", icon: "✓", title: "Active and healthy" };
  }
  return { tone: "idle", icon: "☾", title: "Idle / no active work" };
}

function AgentStatusBadge({ agent, compact = false }: { agent: OrgAgent; compact?: boolean }) {
  const status = agentStatusPresentation(agent);
  return (
    <i className={`org-node-status ${status.tone} ${compact ? "compact" : ""}`} title={status.title} aria-label={status.title}>
      <b>{status.icon}</b>
      {status.count ? <em>{status.count}</em> : null}
    </i>
  );
}

function NodeCard({ agent, selected, avatarUrl, onClick, onAvatarFile }: { agent: OrgAgent; selected: boolean; avatarUrl?: string; onClick: () => void; onAvatarFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openWork = (agent.queue?.queued || 0) + (agent.queue?.running || 0) + (agent.queue?.blocked || 0) + (agent.queue?.failed || 0);
  const automationCount = agent.automation_count ?? agent.automations.length;
  const inboxCount = agent.inbox_count ?? agent.inbox.length;
  const skillCount = agent.skills_detail.length || agent.skills.length;
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };
  return (
    <article className={`org-node ${agent.status} ${selected ? "selected" : ""}`} role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown} aria-label={`Open ${agent.name} details`}>
      <div className="org-node-head">
        <button
          className="org-node-avatar-button"
          type="button"
          aria-label={`Add or change profile picture for ${agent.name}`}
          title="Add/change profile picture"
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials(agent.name)}</span>}
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/*"
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) onAvatarFile(file);
            event.currentTarget.value = "";
          }}
        />
        <AgentStatusBadge agent={agent} />
      </div>
      <h3>{agent.name}</h3>
      <p>{agent.role}</p>
      <div className="org-node-foot"><span>{agent.mode}</span><span>{agent.profile || "default"}</span></div>
      <div className="org-node-hover-details" aria-hidden="true">
        <b>More about this agent</b>
        <span>{agent.summary || agent.role}</span>
        <div className="chip-row compact"><span>{agent.type || "workflow_agent"}</span><span>{agent.runtime || "hermes"}</span><span>runs as {agent.profile || "default"}</span></div>
        <div className="org-node-stats"><b>{automationCount}</b><small>routines</small><b>{openWork}</b><small>queue</small><b>{inboxCount}</b><small>gates</small></div>
        <small>{skillCount} skills · {agent.tools.length} tools · {agent.permissions.length} permissions · last {agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "no recent run"}</small>
      </div>
    </article>
  );
}

function MiniRow({ title, meta, body }: { title: string; meta?: string; body?: string }) {
  return <div className="mini-row"><b>{title}</b>{meta && <small>{meta}</small>}{body && <p>{body}</p>}</div>;
}

function GoalProgress({ goal }: { goal: Goal }) {
  const totalActions = goal.action_counts?.total || goal.actions?.length || 0;
  const doneActions = goal.action_counts?.done || 0;
  const runningActions = goal.action_counts?.running || 0;
  const blockedActions = goal.action_counts?.blocked || 0;
  const basis = totalActions
    ? `${doneActions}/${totalActions} required actions done${runningActions ? ` · ${runningActions} running` : ""}${blockedActions ? ` · ${blockedActions} blocked` : ""}`
    : `${goal.step_counts?.done || 0}/${goal.step_counts?.total || goal.steps.length} analysis steps done`;
  return <div className="goal-progress"><div><span style={{ width: `${Math.max(0, Math.min(100, goal.progress || 0))}%` }} /></div><small>{goal.progress || 0}% complete · progress is based on completed required actions · {basis}</small></div>;
}

function GoalActionSummary({ goal }: { goal: Goal }) {
  const counts = goal.action_counts;
  if (!counts?.total) return null;
  return <div className="goal-action-summary" aria-label="Goal action status summary"><span><b>{counts.total}</b> required actions</span><span><b>{counts.done}</b> done</span><span><b>{counts.running}</b> running</span><span><b>{counts.queued}</b> queued</span>{counts.blocked > 0 && <span className="blocked"><b>{counts.blocked}</b> blocked</span>}</div>;
}

function GoalActionRow({ action, onRun, onDone }: { action: GoalAction; onRun?: (action: GoalAction) => void; onDone?: (action: GoalAction) => void }) {
  const isHuman = action.owner_type === "human";
  return <div className={`goal-action ${action.status || "queued"} ${isHuman ? "human" : "agent"}`}>
    <div className="goal-action-main"><span className="goal-action-owner">{isHuman ? "Human" : "Agent"}</span><b>{action.title}</b><small>{action.status || "queued"} · {action.execution_type || "action"}{action.task_id ? ` · task ${action.task_id}` : ""}{action.automation_id ? ` · job ${action.automation_id}` : ""}</small>{action.description && <p>{action.description}</p>}{action.evidence_needed && <em>Evidence: {action.evidence_needed}</em>}</div>
    <div className="goal-action-buttons"><button className="btn ghost small" onClick={() => onRun?.(action)}>{action.execution_type === "automation" ? "Run" : "Start"}</button><button className="btn dark small" onClick={() => onDone?.(action)}>Done</button></div>
  </div>;
}

function GoalCard({ goal, compact = false, onRunAction, onDoneAction }: { goal: Goal; compact?: boolean; onRunAction?: (goal: Goal, action: GoalAction) => void; onDoneAction?: (goal: Goal, action: GoalAction) => void }) {
  const visibleActions = (goal.actions || []).slice(0, compact ? 3 : 12);
  return (
    <article className={`goal-card ${compact ? "compact" : ""}`}>
      <div className="goal-card-head"><span className={`tag ${goal.status}`}>{goal.status || "active"}</span><b>{goal.title}</b></div>
      {goal.objective && <p>{goal.objective}</p>}
      <GoalProgress goal={goal} />
      <GoalActionSummary goal={goal} />
      <div className="goal-meta"><span>Outcome KPI: {goal.primary_kpi || "Defined by operator"}</span>{goal.goal_brief && <span>Brief: {goal.goal_brief}</span>}</div>
      <div className="goal-actions-block"><div className="goal-section-head"><h4>Required actions</h4><small>Real work by agents or humans. These drive progress.</small></div>{visibleActions.map((action) => <GoalActionRow key={action.id} action={action} onRun={(a) => onRunAction?.(goal, a)} onDone={(a) => onDoneAction?.(goal, a)} />)}{!visibleActions.length && <p className="muted">No concrete actions generated yet.</p>}</div>
      {!compact && <details className="goal-steps-details"><summary>Supporting analysis: tools, access, data, and planning steps</summary><div className="goal-requirements">
        <div><b>Tools needed</b>{(goal.tools_needed || []).slice(0, 6).map((x) => <span key={x}>{x}</span>)}</div>
        <div><b>Access needed</b>{(goal.access_needed || []).slice(0, 6).map((x) => <span key={x}>{x}</span>)}</div>
        <div><b>Data/info needed</b>{(goal.data_needed || []).slice(0, 6).map((x) => <span key={x}>{x}</span>)}</div>
      </div><div className="goal-step-list">{goal.steps.slice(0, 8).map((step, index) => <div className="goal-step" key={step.id}><i>{index + 1}</i><div><b>{step.title}</b><small>{step.status}{step.task_id ? ` · task ${step.task_id}` : ""}</small>{step.description && <p>{step.description}</p>}</div></div>)}</div></details>}
    </article>
  );
}

function GoalModal({ agent, onClose, onCreated }: { agent: OrgAgent; onClose: () => void; onCreated: (goal: Goal) => void }) {
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [kpi, setKpi] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!objective.trim() && !title.trim()) { setError("Enter a goal objective first."); return; }
    setBusy(true); setError(null);
    try {
      const data = await request<{ ok: boolean; goal: Goal; error?: string }>(`/api/agent-org/agents/${encodeURIComponent(agent.id)}/goals`, { method: "POST", body: JSON.stringify({ title, objective: objective || title, primary_kpi: kpi, context }) });
      if (!data.ok) throw new Error(data.error || "Goal creation failed");
      onCreated(data.goal);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return <div className="drawer-backdrop goal-modal-backdrop" onClick={onClose}><aside className="goal-modal" onClick={(e) => e.stopPropagation()}><button className="drawer-x" onClick={onClose}>×</button><span className="stub-tag">GOAL</span><h2>Create goal for {agent.name}</h2><p>Mission Control turns the outcome into required actions first: real agent work, human decisions, evidence, and progress. Supporting analysis for tools, access, data, and planning is kept under Advanced.</p><label>Goal title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Increase qualified course signups" /></label><label>Objective<textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Describe the result you want this agent to achieve." /></label><label>Primary KPI<input value={kpi} onChange={(e) => setKpi(e.target.value)} placeholder="How should progress be measured?" /></label><label>Context / source links<textarea value={context} onChange={(e) => setContext(e.target.value)} placeholder="Useful links, audience, constraints, deadline, current blockers…" /></label>{error && <div className="org-warning">{error}</div>}<div className="org-action-row"><button className="btn dark" disabled={busy} onClick={() => void submit()}>{busy ? "Creating action plan…" : "Create goal + actions"}</button><button className="btn ghost" onClick={onClose}>Cancel</button></div></aside></div>;
}

function reviewJobId(review?: Review | null) {
  if (!review) return "";
  const metaJob = typeof review.metadata?.job_id === "string" ? review.metadata.job_id : "";
  return review.source_id || metaJob || "";
}

function activityNeedsApproval(item: Activity, review?: Review | null) {
  if (!review) return false;
  if (!(review.status === "drafted" || review.status === "ready")) return false;
  const jobId = item.job_id || (typeof item.metadata?.job_id === "string" ? item.metadata.job_id : "");
  return Boolean(jobId && reviewJobId(review) === jobId) || item.action === "run_agent" || item.action === "run_automation";
}

function ActivityRow({ item, approval, approvingId, onApprove }: { item: Activity; approval?: Review | null; approvingId?: string | null; onApprove?: (review: Review) => void }) {
  const needsApproval = activityNeedsApproval(item, approval);
  return (
    <div className={`activity-row ${item.status || "info"} ${needsApproval ? "with-action needs-approval" : ""}`}>
      <span className="activity-dot" />
      <div className="activity-body">
        <div className="activity-title-line"><b>{item.title}</b>{needsApproval && <span className="approval-needed-pill">Needs approval</span>}</div>
        <small>{item.created_at || "—"} · {item.actor || "Mission Control"}{item.job_name ? ` · ${item.job_name}` : item.job_id ? ` · ${item.job_id}` : ""}</small>
        {item.detail && <p>{item.detail}</p>}
        {needsApproval && approval && <small className="activity-approval-meta">Approval: {approval.title} · {approval.risk} risk · {approval.destination || "no destination"}</small>}
      </div>
      {needsApproval && approval && <button className="btn dark approval-inline-btn" disabled={approvingId === approval.id} onClick={() => onApprove?.(approval)}>{approvingId === approval.id ? "Approving…" : "Approve"}</button>}
    </div>
  );
}

function handoffEvidenceCount(handoff: AgentHandoff) {
  return Array.isArray(handoff.evidence) ? handoff.evidence.length : 0;
}

function HandoffTimeline({ handoffs, compact = false }: { handoffs?: AgentHandoff[]; compact?: boolean }) {
  const visible = (handoffs || []).slice(0, compact ? 6 : 20);
  return <section className="handoff-timeline-panel">
    <div className="task-result-heading"><span className="stub-tag">Agent handoffs</span><h3>Explicit collaboration timeline</h3></div>
    <p className="muted">Persistent handoff records show which agent asked another agent to own a next step, the requested output, risk/status, and attached evidence.</p>
    <div className="handoff-timeline">
      {visible.map((handoff) => <article className={`handoff-card ${handoff.status} ${handoff.risk}`} key={handoff.id}>
        <span className="activity-dot" />
        <div>
          <div className="handoff-card-head"><b>{handoff.from_agent} → {handoff.to_agent}</b><span className={`tag ${handoff.status}`}>{handoff.status}</span></div>
          <h4>{handoff.objective}</h4>
          <p>{handoff.requested_output}</p>
          {handoff.context && !compact && <small>{handoff.context}</small>}
          <div className="chip-row compact"><span>{handoff.risk} risk</span>{handoff.task_id && <span>task {handoff.task_id}</span>}<span>{formatSingaporeShort(handoff.updated_at || handoff.created_at)}</span><span>{handoffEvidenceCount(handoff)} evidence</span></div>
        </div>
      </article>)}
      {!visible.length && <div className="empty">No handoffs recorded yet. When ownership transfers between agents, the request and evidence will appear here.</div>}
    </div>
  </section>;
}

function AgentRunTreePanel({ trees }: { trees?: RunTreePayload[] }) {
  const visible = trees || [];
  return <section><h3>Subagent run tree</h3><p className="muted">Delegated subtasks, self-check loops, model/toolset routing, outputs, and verification blockers for this agent.</p>{visible.map((tree, index) => <AgentRunTree key={tree.root?.id || index} tree={tree} />)}{!visible.length && <p className="muted">No delegated run trees mapped to this agent yet.</p>}</section>;
}

function AgentRunTree({ tree }: { tree: RunTreePayload }) {
  const summary = tree.summary;
  return <article className={`agent-run-tree-card ${summary?.completion_blocked ? "blocked" : ""}`}>
    <div className="run-tree-summary"><span>{summary?.total_tasks || 0} tasks</span><span>{summary?.total_runs || 0} runs</span><span>{summary?.status || "pending"}</span>{summary?.completion_blocked && <b>Completion blocked</b>}</div>
    {(summary?.blocking_reasons || []).length > 0 && <p className="muted">Failed verification: {(summary?.blocking_reasons || []).join(" · ")}</p>}
    {tree.root && <AgentRunTreeTask node={tree.root} depth={0} />}
  </article>;
}

function AgentRunTreeTask({ node, depth }: { node: RunTreeTaskNode; depth: number }) {
  return <div className={`run-tree-node ${node.verification?.blocked ? "blocked" : node.verification?.status || ""}`} style={{ marginLeft: depth ? 16 : 0 }}>
    <div className="run-tree-node-head"><div><b>{node.title || node.task_id}</b><small>{node.task_id} · {node.agent || "unassigned"} · {node.status}</small></div><span className={`tag ${node.verification?.blocked ? "warn" : "muted"}`}>{node.verification?.status || "pending"}</span></div>
    <div className="chip-row compact"><span>model {node.model || "default"}</span>{(node.toolsets || []).slice(0, 3).map((tool) => <span key={tool}>{tool}</span>)}</div>
    {(node.runs || []).slice(0, 4).map((run) => <AgentRunTreeRun key={run.id} run={run} />)}
    {(node.children || []).map((child) => <AgentRunTreeTask key={child.id} node={child} depth={depth + 1} />)}
  </div>;
}

function AgentRunTreeRun({ run }: { run: RunTreeRunNode }) {
  return <div className={`run-tree-run ${run.verification?.blocked ? "blocked" : ""}`}><span className="activity-dot" /><div><b>{run.agent || "worker"} run {run.run_id}</b><small>{run.status}{run.outcome ? ` · ${run.outcome}` : ""}</small>{run.output && <p>{run.output}</p>}</div><em>{run.verification?.status || "pending"}</em></div>;
}

function agentRunLabel(agent: OrgAgent) {
  if (!agent.automations.length) return "No runtime";
  return agent.automations.length === 1 ? "Run agent" : "Choose run";
}

function drawerTabsFor(agent: OrgAgent): DrawerTab[] {
  const tabs: DrawerTab[] = ["overview", "profile", "tools", "skills"];
  if ((agent.goals || []).length || agent.active_goal) tabs.push("goals");
  if ((agent.task_count ?? agent.tasks.length) > 0) tabs.push("queue");
  if ((agent.handoff_summary?.open || agent.handoffs?.length || 0) > 0) tabs.push("handoffs");
  if ((agent.inbox_count ?? agent.inbox.length) > 0) tabs.push("approvals");
  if ((agent.run_count ?? agent.runs.length) > 0) tabs.push("runs");
  if ((agent.run_trees || []).length > 0) tabs.push("run-tree");
  if ((agent.output_count ?? agent.outputs.length) > 0) tabs.push("outputs");
  if ((agent.activity || []).length > 0) tabs.push("activity");
  tabs.push("memory", "permissions");
  return tabs;
}

function drawerTabLabel(tab: DrawerTab, agent: OrgAgent) {
  const labels: Record<DrawerTab, string> = {
    overview: "Overview", goals: "Goals", queue: "Queue", handoffs: "Handoffs", approvals: "Approvals", runs: "Runs", "run-tree": "Run tree", outputs: "Outputs", activity: "Activity", tools: "Tools", memory: "Memory", skills: "Skills", permissions: "Permissions", profile: "Runtime", config: "Config",
  };
  const count = drawerTabCount(tab, agent);
  return count ? `${labels[tab]} ${count}` : labels[tab];
}

function drawerTabCount(tab: DrawerTab, agent: OrgAgent) {
  return tab === "goals" ? (agent.goals?.length || 0)
    : tab === "queue" ? (agent.task_count ?? agent.tasks.length)
    : tab === "handoffs" ? (agent.handoff_summary?.open || agent.handoffs?.length || 0)
    : tab === "approvals" ? (agent.inbox_count ?? agent.inbox.length)
    : tab === "runs" ? (agent.run_count ?? agent.runs.length)
    : tab === "outputs" ? (agent.output_count ?? agent.outputs.length)
    : tab === "activity" ? (agent.activity?.length || 0)
    : tab === "tools" ? agent.tools.length
    : tab === "skills" ? (agent.skills_detail.length || agent.skills.length)
    : tab === "memory" ? (agent.profile_details?.memory?.entries || 0)
    : 0;
}

function drawerTabBaseLabel(tab: DrawerTab) {
  const labels: Record<DrawerTab, string> = {
    overview: "Overview", goals: "Goals", queue: "Queue", handoffs: "Handoffs", approvals: "Approvals", runs: "Runs", "run-tree": "Run tree", outputs: "Outputs", activity: "Activity", tools: "Tools", memory: "Memory", skills: "Skills", permissions: "Permissions", profile: "Runtime", config: "Config",
  };
  return labels[tab];
}

function capabilityBlocked(capability: CapabilityMatrixCapability) {
  return Boolean(capability.actionableBlocker || (capability.approvalRequired && capability.approvalStatus !== "approved"));
}

function capabilityScopeLabel(capability: CapabilityMatrixCapability) {
  if (capability.assignmentScope === "inherited" || capability.inherited) return "inherited";
  if (capability.assigned) return "assigned";
  return "available";
}

function capabilityBlockerText(capability: CapabilityMatrixCapability) {
  return String((capability.actionableBlocker as { message?: unknown } | null)?.message || capability.policyGate || "Governance approval is required before assignment changes.");
}

function CapabilityAssignmentCard({ capability, canEdit, busy, onAction }: { capability: CapabilityMatrixCapability; canEdit: boolean; busy?: boolean; onAction: (capability: CapabilityMatrixCapability) => void }) {
  const blocked = capabilityBlocked(capability);
  const scope = capabilityScopeLabel(capability);
  const label = capability.displayName || capability.name || capability.id;
  return <article className={`capability-assignment-card ${scope} ${blocked ? "blocked" : ""}`}>
    <div className="capability-card-head"><div><b>{label}</b><small>{capability.type || "capability"} · {capability.sourceLabel || capability.source || "runtime"} · {capability.healthState || "unknown"}</small></div><span className={`tag ${blocked ? "blocked" : scope}`}>{blocked ? "governed" : scope}</span></div>
    {capability.description && <p>{capability.description}</p>}
    <div className="chip-row compact">
      {(capability.riskLevels || []).slice(0, 4).map((risk) => <span key={risk}>{risk}</span>)}
      {capability.assignmentUnit && <span>unit {capability.assignmentUnit}</span>}
      {capability.approvalRequired && <span>approval {capability.approvalStatus || "required"}</span>}
      {scope === "inherited" && <span>profile/runtime inherited</span>}
    </div>
    {blocked && <p className="muted">{capabilityBlockerText(capability)}</p>}
    {capability.source === "registry" ? (
      canEdit ? <button className="btn dark small" disabled={blocked || busy} onClick={() => onAction(capability)}>{busy ? "Saving…" : capability.assigned ? "Unassign" : "Assign"}</button> : <p className="muted">Admin-only safe edit: visible here, editable from an admin session only.</p>
    ) : <p className="muted">Inherited from profile runtime config. Change the underlying profile/tool/plugin source instead of registry assignment.</p>}
  </article>;
}

function CapabilityAssignmentPanel({ row, loading, error, message, canEdit, busyId, onAction }: { row: CapabilityMatrixRow | null; loading: boolean; error: string | null; message: string | null; canEdit: boolean; busyId?: string | null; onAction: (capability: CapabilityMatrixCapability) => void }) {
  const capabilities = row?.capabilities || [];
  const explicitAssigned = capabilities.filter((capability) => capability.source === "registry" && capability.assigned);
  const inherited = capabilities.filter((capability) => capabilityScopeLabel(capability) === "inherited");
  const available = capabilities.filter((capability) => capability.source === "registry" && !capability.assigned);
  return <section className="capability-assignment-panel">
    <div className="capability-panel-head"><div><h3>Capability assignments</h3><p className="muted">Assigned registry capabilities are explicit. Inherited capabilities come from the Hermes profile runtime, skills, tools, and plugins. Secrets remain hidden.</p></div>{row && <span className="tag assigned">{row.summary.assigned}/{row.summary.total} effective</span>}</div>
    {loading && !row && <p className="muted">Loading capability matrix…</p>}
    {error && <div className="org-warning">{error}</div>}
    {message && <div className="drawer-action-notice success"><b>{message}</b></div>}
    {row && <div className="org-footprint capability-summary"><span>Assigned {explicitAssigned.length}</span><span>Inherited {row.summary.inherited ?? inherited.length}</span><span>Available {available.length}</span><span>Blocked {row.summary.blocked}</span><span>Registry {row.summary.registry}</span></div>}
    <div className="capability-section"><h4>Assigned registry capabilities</h4><div className="capability-card-grid">{explicitAssigned.map((capability) => <CapabilityAssignmentCard key={capability.id} capability={capability} canEdit={canEdit} busy={busyId === capability.id} onAction={onAction} />)}{!explicitAssigned.length && <p className="muted">No explicit registry capabilities assigned to this agent yet.</p>}</div></div>
    <div className="capability-section"><h4>Inherited profile/runtime capabilities</h4><div className="capability-card-grid">{inherited.slice(0, 12).map((capability) => <CapabilityAssignmentCard key={capability.id} capability={capability} canEdit={false} onAction={onAction} />)}{!inherited.length && <p className="muted">No inherited runtime capabilities reported.</p>}</div>{inherited.length > 12 && <p className="muted">+ {inherited.length - 12} more inherited capabilities in the profile runtime.</p>}</div>
    <div className="capability-section"><h4>Assignable registry capabilities</h4><div className="capability-card-grid">{available.map((capability) => <CapabilityAssignmentCard key={capability.id} capability={capability} canEdit={canEdit} busy={busyId === capability.id} onAction={onAction} />)}{!available.length && <p className="muted">No additional registry capabilities are available for this profile.</p>}</div></div>
  </section>;
}

function AgentToolsPanel({ agent }: { agent: OrgAgent }) {
  const routines = agent.profile_details?.routines?.items || [];
  const routineToolsets = Array.from(new Set(routines.flatMap((routine) => routine.toolsets || []))).sort();
  const channels = agent.profile_details?.gateway?.channels || [];
  return <section>
    <h3>Assigned tools</h3>
    <p className="muted">Tools listed here come from the Agent Org backend registry. Routine toolsets show what the scheduled backend runs actually load.</p>
    <div className="capability-card-grid">{agent.tools.map((tool) => <article className="capability-assignment-card assigned" key={tool}><div className="capability-card-head"><div><b>{tool}</b><small>assigned registry tool</small></div><span className="tag assigned">assigned</span></div></article>)}{!agent.tools.length && <p className="muted">No assigned tools in the registry.</p>}</div>
    <h3>Routine backend toolsets</h3>
    <div className="chip-row">{routineToolsets.map((toolset) => <span key={toolset}>{toolset}</span>)}{!routineToolsets.length && <span>No routine toolsets mapped yet</span>}</div>
    <div className="runtime-workflows">{routines.map((routine) => <div className="runtime-workflow" key={routine.id || routine.name}><div><b>{routine.name || routine.id}</b><small>{routine.schedule || "manual"} · {routine.profile || agent.profile || "default"}</small><div className="chip-row compact">{(routine.toolsets || []).map((toolset) => <span key={`${routine.id}-${toolset}`}>{toolset}</span>)}</div></div><span className={`tag ${String(routine.last_status || routine.status || "").toLowerCase().includes("error") ? "failed" : "active"}`}>{routine.last_status || routine.status || "—"}</span></div>)}</div>
    <h3>Gateway channels</h3>
    <div className="chip-row">{channels.map((channel) => <span key={channel.id}>{channel.id} · {channel.enabled ? "enabled" : "disabled"}</span>)}{!channels.length && <span>No configured channels reported</span>}</div>
  </section>;
}

function AgentOrgInfo({ k, v }: { k: string; v: ReactNode }) {
  return <div className="info"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

function AgentSkillsPanel({ agent }: { agent: OrgAgent }) {
  const mappedSkills: SkillDetail[] = agent.skills_detail.length ? agent.skills_detail : agent.skills.map((name) => ({ name, category: "profile skill" }));
  const skillsByCategory = mappedSkills.reduce<Record<string, typeof mappedSkills>>((acc, skill) => {
    const key = skill.category || "profile skill";
    acc[key] = [...(acc[key] ?? []), skill];
    return acc;
  }, {});
  return <section>
    <div className="sec-l">Skills assigned to this agent · {mappedSkills.length}</div>
    <p className="muted">Explicit registry skills and directly-used backend skills are shown with the same card treatment as the selected-agent drawer.</p>
    {Object.entries(skillsByCategory).map(([category, skills]) => (
      <div className="skill-group" key={category}>
        <div className="skill-group-head">{category}<span>{skills.length}</span></div>
        <div className="skills detail-skills">
          {skills.map((skill) => (
            <span className="skill" key={skill.name} title={skill.description || skill.source || category}>
              {skill.name}
              {(skill.source || category) && <em>{skill.source || category}</em>}
            </span>
          ))}
        </div>
      </div>
    ))}
    {!mappedSkills.length && <p className="muted">No explicit skills mapped.</p>}
  </section>;
}

function AgentMemoryPanel({ agent }: { agent: OrgAgent }) {
  const memory = agent.profile_details?.memory;
  const items = memory?.items || [];
  return <section>
    <h3>Memory held by this agent</h3>
    <p className="muted">These entries are read from the Hermes backend profile memory files for <b>{agent.profile || "default"}</b>. Secret-like values are redacted before display.</p>
    <div className="org-footprint"><span>{memory?.entries || 0} entries</span><span>{memory?.files?.length || 0} files</span><span>{memory?.redacted_or_sensitive_mentions || 0} redacted/sensitive entries</span></div>
    {(memory?.files || []).map((file) => <MiniRow key={file.name} title={file.name} meta={`${file.entries} entries · ${file.updated_at || "—"}`} />)}
    <div className="activity-list memory-entry-list">{items.map((item) => <div className={`activity-row ${item.redacted ? "attention" : "info"}`} key={item.id}><span className="activity-dot" /><div className="activity-body"><div className="activity-title-line"><b>{item.title || "Memory entry"}</b>{item.redacted && <span className="approval-needed-pill">redacted</span>}</div><small>{item.source || "memory"} · {item.file || "MEMORY.md"}{item.line_start ? `:${item.line_start}` : ""} · {item.updated_at || "—"}</small><p>{item.text}</p></div></div>)}</div>
    {!items.length && <p className="muted">No readable memory entries reported for this profile.</p>}
  </section>;
}

function ProfileRuntimePanel({ agent, capabilityRow, capabilityLoading, capabilityError, capabilityMessage, canEditCapabilities, capabilityBusyId, onCapabilityAction }: { agent: OrgAgent; capabilityRow: CapabilityMatrixRow | null; capabilityLoading: boolean; capabilityError: string | null; capabilityMessage: string | null; canEditCapabilities: boolean; capabilityBusyId?: string | null; onCapabilityAction: (capability: CapabilityMatrixCapability) => void }) {
  const profile = agent.profile_details;
  if (!profile) return <section><h3>Profile runtime</h3><p className="muted">No profile runtime details reported yet.</p></section>;
  const channels = profile.gateway?.channels || [];
  const envFiles = profile.environment?.env_files || [];
  const routines = profile.routines?.items || [];
  const unhealthyRoutines = routines.filter((routine) => String(routine.last_status || routine.status || "").toLowerCase().includes("error") || String(routine.status || "").toLowerCase().includes("fail"));
  return <section>
    <h3>Backend runtime</h3>
    <p className="muted">Live Hermes profile data for this coworker. Secrets and raw credential values stay hidden.</p>
    <div className="org-detail-grid">
      <div><span>Runs as profile</span><b>{profile.profile_id}</b></div>
      <div><span>Identity</span><b>{profile.identity?.name || agent.name}</b></div>
      <div><span>Model route</span><b>{profile.model_routing?.model || profile.model_routing?.provider || "runtime default"}</b></div>
      <div><span>Tools / skills</span><b>{agent.tools.length} assigned tools · {agent.skills_detail.length || agent.skills.length} skills</b></div>
      <div><span>Memory</span><b>{profile.memory?.entries || 0} entries</b></div>
      <div><span>Routines</span><b>{profile.routines?.count ?? agent.automations.length} mapped</b></div>
      <div><span>Channels</span><b>{channels.filter((c) => c.enabled).length}/{channels.length} enabled</b></div>
      <div><span>Credential readiness</span><b>{envFiles.length ? `${envFiles.length} env file(s), values hidden` : "No env file reported"}</b></div>
    </div>

    {unhealthyRoutines.length > 0 && <div className="org-warning">Needs attention: {unhealthyRoutines.slice(0, 3).map((routine) => routine.name || routine.id).join(" · ")}</div>}

    <h3>Assigned tools</h3>
    <div className="chip-row">{agent.tools.map((tool) => <span key={tool}>{tool}</span>)}{!agent.tools.length && <span>No registry tools assigned</span>}</div>
    <p className="muted">These are the operator-facing capabilities assigned in the Agent Org registry. Routine-level toolsets are shown below so the drawer reflects the actual Hermes backend execution path.</p>

    <h3>Mapped routines</h3>
    <div className="runtime-workflows">{routines.map((routine) => <div className="runtime-workflow" key={routine.id || routine.name}><div><b>{routine.name || routine.id}</b><small>{routine.schedule || "manual"} · next {routine.next_run_relative || "—"} · last {routine.last_status || routine.status || "—"}</small><div className="chip-row compact">{(routine.toolsets || []).slice(0, 6).map((toolset) => <span key={`${routine.id}-${toolset}`}>{toolset}</span>)}</div></div><span className={`tag ${String(routine.last_status || routine.status || "").toLowerCase().includes("error") ? "failed" : "active"}`}>{routine.profile || profile.profile_id}</span></div>)}{!routines.length && <p className="muted">No routines mapped to this runtime profile yet.</p>}</div>

    <CapabilityAssignmentPanel row={capabilityRow} loading={capabilityLoading} error={capabilityError} message={capabilityMessage} canEdit={canEditCapabilities} busyId={capabilityBusyId} onAction={onCapabilityAction} />

    <h3>Runtime readiness</h3>
    <div className="org-footprint"><span>{profile.plugins?.enabled || 0}/{profile.plugins?.total || 0} plugins enabled</span><span>{profile.gateway?.webhooks_configured || 0} webhooks</span><span>{profile.sessions?.count ?? 0} recent sessions</span><span>{(profile.config_files || []).map((file) => file.name).join(", ") || "No config files"}</span></div>
    {profile.plugins?.error && <p className="muted">Plugin inventory note: {profile.plugins.error}</p>}
    <h3>Memory and environment</h3>
    {(profile.memory?.files || []).map((file) => <MiniRow key={file.name} title={file.name} meta={`${file.entries} entries · ${file.updated_at || "—"}`} />)}
    {envFiles.map((file) => <MiniRow key={file.name} title={file.name} meta={`${file.status} · ${file.variable_count} variables · ${file.sensitive_count} sensitive names hidden`} />)}
    {!envFiles.length && !(profile.memory?.files || []).length && <p className="muted">No profile memory or env files reported.</p>}
    <p className="muted">{profile.environment?.policy}</p>
  </section>;
}

function DetailDrawer({ agent, agents, avatarUrl, onClose, onAction, onCreateGoal, onApproveReview, onGoalAction, approvingId, actionFeedback }: { agent: OrgAgent; agents: OrgAgent[]; avatarUrl?: string; onClose: () => void; onAction: (agent: OrgAgent, action: string, payload?: Record<string, unknown>) => void; onCreateGoal: (agent: OrgAgent) => void; onApproveReview: (agent: OrgAgent, review: Review) => void; onGoalAction: (agent: OrgAgent, goal: Goal, action: GoalAction, status: string, execute?: boolean) => void; approvingId?: string | null; actionFeedback?: ActionFeedback }) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const [capabilityRow, setCapabilityRow] = useState<CapabilityMatrixRow | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [capabilityMessage, setCapabilityMessage] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [capabilityBusyId, setCapabilityBusyId] = useState<string | null>(null);
  const { permissions, getCapabilityMatrix, assignCapability, unassignCapability } = useStore();
  const canEditCapabilities = permissions.canEditGlobalAgents;
  const tabs: DrawerTab[] = drawerTabsFor(agent);
  const feedback = actionFeedback?.agentId === agent.id ? actionFeedback : null;
  const shellTabs: AgentDrawerTab[] = tabs.map((item) => ({ id: item, label: drawerTabBaseLabel(item), count: drawerTabCount(item, agent), title: drawerTabLabel(item, agent) }));
  const drawerActions: AgentDrawerAction[] = [
    { id: "run", label: agentRunLabel(agent), icon: "▶", disabled: !agent.automations.length, onClick: () => onAction(agent, "run_agent") },
    { id: "goal", label: "Create goal", icon: "✦", onClick: () => onCreateGoal(agent) },
    { id: "task", label: "Assign task", icon: "▣", onClick: () => onAction(agent, "create_task") },
    { id: "health", label: "Health check", icon: "⚙", dividerBefore: true, onClick: () => onAction(agent, "run_health_check") },
    { id: "pause", label: "Pause flows", icon: "Ⅱ", disabled: !agent.automations.length, onClick: () => onAction(agent, "pause_automations") },
    { id: "resume", label: "Resume flows", icon: "↻", disabled: !agent.automations.length, onClick: () => onAction(agent, "resume_automations") },
  ];
  const approvalForActivity = (item: Activity) => {
    const jobId = item.job_id || (typeof item.metadata?.job_id === "string" ? item.metadata.job_id : "");
    const pending = (agent.inbox || []).filter((review) => review.status === "drafted" || review.status === "ready");
    const matched = pending.find((review) => jobId && reviewJobId(review) === jobId);
    if (matched) return matched;
    const isManualRun = item.action === "run_agent" || item.action === "run_automation";
    return isManualRun && pending.length === 1 ? pending[0] : null;
  };
  const loadCapabilityMatrix = async () => {
    setCapabilityLoading(true);
    setCapabilityError(null);
    try {
      const result = await getCapabilityMatrix({ agent: agent.id });
      setCapabilityRow(result.matrix?.[0] ?? null);
    } catch (e) {
      setCapabilityError(e instanceof Error ? e.message : String(e));
    } finally {
      setCapabilityLoading(false);
    }
  };
  useEffect(() => {
    if (tab === "profile" || tab === "permissions" || tab === "skills") void loadCapabilityMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, tab]);
  useEffect(() => {
    if (!tabs.includes(tab)) setTab("overview");
  }, [agent.id, tabs, tab]);
  const handleCapabilityAction = async (capability: CapabilityMatrixCapability) => {
    if (!canEditCapabilities || capability.source !== "registry") return;
    setCapabilityMessage(null);
    setCapabilityError(null);
    setCapabilityBusyId(capability.id);
    try {
      if (capability.assigned) {
        await unassignCapability(capability.id, { agentId: agent.id, agent: { id: agent.id, name: agent.name }, reason: "Unassigned from Agent Org profile drawer" });
        setCapabilityMessage(`Unassigned ${capability.displayName || capability.name || capability.id}`);
      } else {
        await assignCapability(capability.id, { agentId: agent.id, agent: { id: agent.id, name: agent.name }, reason: "Assigned from Agent Org profile drawer" });
        setCapabilityMessage(`Assigned ${capability.displayName || capability.name || capability.id}`);
      }
      await loadCapabilityMatrix();
    } catch (e) {
      setCapabilityError(e instanceof Error ? e.message : String(e));
    } finally {
      setCapabilityBusyId(null);
    }
  };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <AgentDetailDrawerShell
        className="org-drawer wide"
        title={agent.name}
        avatar={avatarUrl ? <img className={`agent-detail-avatar org-agent-avatar image ${agent.status}`} src={avatarUrl} alt="" /> : <span className={`agent-detail-avatar org-agent-avatar ${agent.status}`}>{initials(agent.name)}</span>}
        eyebrow="Selected agent"
        statusTag={<AgentStatusBadge agent={agent} compact />}
        subtitle={`${agent.role} · ${agent.profile || "default"}`}
        tabs={shellTabs}
        activeTab={tab}
        onTabChange={(next) => setTab(next as DrawerTab)}
        actions={drawerActions}
        onClose={onClose}
        ariaLabel={`Agent Org details for ${agent.name}`}
      >
        {feedback && <div className={`drawer-action-notice ${feedback.tone}`} role="status" aria-live="polite"><b>{feedback.title}</b>{feedback.detail && <small>{feedback.detail}</small>}</div>}

        {tab === "overview" && <>
          <div className="sec-l">Runtime</div>
          <AgentOrgInfo k="Reports to" v={nodeReportName(agent, agents)} />
          <AgentOrgInfo k="Mode" v={agent.mode} />
          <AgentOrgInfo k="Role type" v={agent.type || "workflow_agent"} />
          <AgentOrgInfo k="Backend profile" v={<span className="mono">{agent.profile || "default"}</span>} />
          <AgentOrgInfo k="Runtime" v={agent.runtime || "hermes"} />
          <AgentOrgInfo k="Cost 7d" v={`${fmtMoney(agent.cost7d)} · ${fmtNum(agent.tokens7d)} tokens`} />
          {agent.active_goal && <section><h3>Active goal</h3><GoalCard goal={agent.active_goal} compact onRunAction={(goal, action) => onGoalAction(agent, goal, action, 'running', true)} onDoneAction={(goal, action) => onGoalAction(agent, goal, action, 'done')} /></section>}
          <section><h3>Run from Mission Control</h3><div className="runtime-workflows">{agent.automations.map((automation) => <div className="runtime-workflow" key={automation.id}><div><b>{automation.name}</b><small>{automation.schedule || "manual"} · last {automation.last_status || automation.status || "—"}</small></div><button className="btn dark" onClick={() => onAction(agent, "run_automation", { job_id: automation.id })}>Run</button></div>)}{!agent.automations.length && <p className="muted">This agent has no mapped routine yet. Assign a cron routine before it can be run from the UI.</p>}</div></section>
          <section><h3>Operational footprint</h3><div className="org-footprint"><span>{agent.goals?.length || 0} goals</span><span>{agent.automations.length} routines</span><span>{agent.tasks.length} tasks</span><span>{agent.skills_detail.length || agent.skills.length} skills</span><span>{agent.inbox.length} approvals</span><span>{agent.runs.length} recent runs</span><span>{agent.outputs.length} outputs</span><span>{agent.activity?.length || 0} activity events</span></div></section>
          <section><h3>Responsibilities</h3><p>{agent.role}. {agent.summary}</p></section>
        </>}

        {tab === "goals" && <section><h3>Goals</h3><p className="muted">A goal is the outcome. Required actions are the real agent/human work and they drive progress. Supporting analysis is tucked under each goal for reference.</p><div className="goal-list">{(agent.goals || []).map((goal) => <GoalCard key={goal.id} goal={goal} onRunAction={(g, a) => onGoalAction(agent, g, a, 'running', true)} onDoneAction={(g, a) => onGoalAction(agent, g, a, 'done')} />)}</div>{!(agent.goals || []).length && <p className="muted">No goals assigned yet. Use Create goal to generate required actions for the first objective.</p>}</section>}

        {tab === "queue" && <section><h3>Queue</h3><div className="queue-pills"><span>Queued {agent.queue.queued}</span><span>Running {agent.queue.running}</span><span>Blocked {agent.queue.blocked}</span><span>Done {agent.queue.done}</span><span>Failed {agent.queue.failed}</span></div>{agent.tasks.slice(0, 12).map((t) => <MiniRow key={t.id} title={t.title} meta={`${t.status} · ${t.priority_label || "normal"} · ${t.updated_at || "—"}`} body={t.body} />)}{!agent.tasks.length && <p className="muted">No queue items assigned yet. Use Assign task to create the first operational item.</p>}</section>}

        {tab === "handoffs" && <HandoffTimeline handoffs={agent.handoffs} />}

        {tab === "approvals" && <section><h3>Approval Gates</h3>{agent.inbox.map((i) => <MiniRow key={i.id} title={i.title} meta={`${i.status} · ${i.risk} risk · ${i.destination || "no destination"}`} body={i.description || i.body} />)}{!agent.inbox.length && <p className="muted">No pending approval gates for this agent.</p>}</section>}

        {tab === "runs" && <section><h3>Recent runs</h3>{agent.runs.map((r) => <MiniRow key={r.id} title={r.title || r.automation_name || r.id} meta={`${r.status} · ${r.started_at || "—"} · ${r.tool_call_count || 0} tools · ${fmtNum(r.tokens || 0)} tokens`} />)}{!agent.runs.length && <p className="muted">No recent runtime traces mapped to this agent yet.</p>}</section>}

        {tab === "run-tree" && <AgentRunTreePanel trees={agent.run_trees} />}

        {tab === "outputs" && <section><h3>Outputs and artifacts</h3>{agent.outputs.map((o, i) => <MiniRow key={o.id || o.path || `${o.name}-${i}`} title={o.name} meta={`${o.status || o.type || "output"} · ${o.updated_at || "—"}${o.destination ? ` · ${o.destination}` : ""}`} body={o.preview} />)}{!agent.outputs.length && <p className="muted">No outputs mapped yet.</p>}</section>}

        {tab === "activity" && <section><h3>Activity timeline</h3><p className="muted">Operator actions from Mission Control plus trigger results for this agent. If a manual run creates a pending approval, approve it from the right side of the activity message.</p><div className="activity-list">{(agent.activity || []).map((item) => <ActivityRow key={item.id} item={item} approval={approvalForActivity(item)} approvingId={approvingId} onApprove={(review) => onApproveReview(agent, review)} />)}</div>{!(agent.activity || []).length && <p className="muted">No Mission Control activity recorded for this agent yet. Trigger a run, health check, or assignment to create the first entry.</p>}</section>}

        {tab === "tools" && <AgentToolsPanel agent={agent} />}

        {tab === "memory" && <AgentMemoryPanel agent={agent} />}

        {tab === "skills" && <AgentSkillsPanel agent={agent} />}

        {tab === "permissions" && <section><h3>Tools / permissions</h3><div className="chip-row">{agent.tools.map((tool) => <span key={tool}>{tool}</span>)}</div>{agent.permissions.map((permission) => <p className="permission" key={permission}>• {permission}</p>)}<CapabilityAssignmentPanel row={capabilityRow} loading={capabilityLoading} error={capabilityError} message={capabilityMessage} canEdit={canEditCapabilities} busyId={capabilityBusyId} onAction={handleCapabilityAction} /></section>}

        {tab === "profile" && <ProfileRuntimePanel agent={agent} capabilityRow={capabilityRow} capabilityLoading={capabilityLoading} capabilityError={capabilityError} capabilityMessage={capabilityMessage} canEditCapabilities={canEditCapabilities} capabilityBusyId={capabilityBusyId} onCapabilityAction={handleCapabilityAction} />}

        {tab === "config" && <section><h3>Registry config</h3><div className="org-detail-grid"><div><span>Agent ID</span><b>{agent.id}</b></div><div><span>Profile</span><b>{agent.profile || "default"}</b></div><div><span>Type</span><b>{agent.type || "logical_agent"}</b></div><div><span>Last activity</span><b>{agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "—"}</b></div></div><p className="muted">Edit the registry file on the server to change durable agent identity, skills, modes, and relationships.</p></section>}
      </AgentDetailDrawerShell>
    </div>
  );
}

export function AgentOrg() {
  const [data, setData] = useState<AgentOrgResponse>(emptyOrg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [goalAgent, setGoalAgent] = useState<OrgAgent | null>(null);
  const [agentAvatars, setAgentAvatars] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem("hmc-agent-org-avatars") || "{}");
    } catch {
      return {};
    }
  });
  const detailCache = useRef(new Map<string, OrgAgent>());

  const load = useCallback(async (mode: RefreshMode = "manual") => {
    const next = await cachedJsonRequest<AgentOrgResponse>(
      AGENT_ORG_SUMMARY_CACHE_KEY,
      () => request<AgentOrgResponse>("/api/agent-org"),
      { staleAfterMs: 10_000, force: mode === "manual" },
    );
    setData({
      ...next,
      agents: next.agents.map((agent) => mergeSummaryWithCachedDetail(agent, detailCache.current.get(agent.id))),
    });
    setNotice(null);
  }, []);

  const refreshState = useRealtimeRefresh(load, [], { pollMs: 10_000, staleAfterMs: 30_000 });
  const loading = refreshState.initialLoading;

  const agents = data.agents;
  const selected = selectedId ? agents.find((n) => n.id === selectedId) : null;

  useEffect(() => {
    if (!selectedId || selected?.detailLoaded) return;
    let alive = true;
    void cachedJsonRequest<{ agent: OrgAgent }>(
      agentOrgDetailCacheKey(selectedId),
      () => request<{ agent: OrgAgent }>(`/api/agent-org/agents/${encodeURIComponent(selectedId)}`),
      { staleAfterMs: DETAIL_STALE_AFTER_MS },
    )
      .then((detail) => {
        if (!alive || !detail.agent) return;
        const loadedAgent = { ...detail.agent, detailLoaded: true };
        detailCache.current.set(selectedId, loadedAgent);
        setData((cur) => ({
          ...cur,
          agents: cur.agents.map((agent) => (agent.id === selectedId ? mergeSummaryWithCachedDetail(agent, loadedAgent) : agent)),
        }));
      })
      .catch(() => {
        // Summary data stays visible; explicit refresh/action paths surface API errors.
      });
    return () => {
      alive = false;
    };
  }, [selectedId, selected?.detailLoaded]);

  const chief = agents.find((a) => a.id === "chief-operator") || agents[0];
  const childNodes = useMemo(() => agents.filter((n) => (n.reportsTo ?? n.reports_to) === (chief?.id || "chief-operator")), [agents, chief]);
  function handleAvatarFile(agent: OrgAgent, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value) return;
      setAgentAvatars((current) => {
        const next = { ...current, [agent.id]: value };
        window.localStorage.setItem("hmc-agent-org-avatars", JSON.stringify(next));
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  const handleAction = async (agent: OrgAgent, action: string, payload?: Record<string, unknown>) => {
    let body: Record<string, unknown> = { action, ...(payload || {}) };
    if (action === "create_task") {
      const title = window.prompt(`Task to assign to ${agent.name}`, `Operate ${agent.name}: next work item`);
      if (!title) return;
      body = { ...body, title };
    }
    const actionLabel = action.replaceAll("_", " ");
    try {
      setSelectedId(agent.id);
      setNotice(null);
      setActionFeedback({ agentId: agent.id, tone: "busy", title: `Running ${actionLabel}…`, detail: `${agent.name} is being triggered from Mission Control.` });
      const result = await request<Record<string, unknown>>(`/api/agent-org/agents/${encodeURIComponent(agent.id)}/action`, { method: "POST", body: JSON.stringify(body) });
      const actionResult = result as AgentActionResult;
      const detail = actionResult.stdout || actionResult.stderr || actionResult.error || actionResult.job_id || "";
      setActionFeedback({
        agentId: agent.id,
        tone: actionResult.ok === false ? "error" : "success",
        title: `${agent.name}: ${actionLabel} ${actionResult.ok === false ? "failed" : "started"}`,
        detail: detail ? String(detail).slice(0, 360) : undefined,
      });
      invalidateAgentOrgCache(agent.id);
      detailCache.current.delete(agent.id);
      await refreshState.refresh("manual");
    } catch (e) {
      setActionFeedback({
        agentId: agent.id,
        tone: "error",
        title: `${agent.name}: action failed`,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleGoalAction = async (agent: OrgAgent, goal: Goal, action: GoalAction, status: string, execute = false) => {
    try {
      setSelectedId(agent.id);
      setActionFeedback({ agentId: agent.id, tone: "busy", title: `${action.title}: ${execute ? "executing" : status}…`, detail: `Goal: ${goal.title}` });
      const result = await request<Record<string, unknown>>(`/api/agent-org/agents/${encodeURIComponent(agent.id)}/goals/${encodeURIComponent(goal.id)}/actions/${encodeURIComponent(action.id)}`, { method: "POST", body: JSON.stringify({ status, execute, automation_id: action.automation_id }) });
      setActionFeedback({ agentId: agent.id, tone: result.ok === false ? "error" : "success", title: `${action.title}: ${result.ok === false ? "failed" : status}`, detail: String((result.run_result as Record<string, unknown> | undefined)?.stdout || (result.run_result as Record<string, unknown> | undefined)?.stderr || result.error || "Action status recorded.").slice(0, 360) });
      invalidateAgentOrgCache(agent.id);
      detailCache.current.delete(agent.id);
      await refreshState.refresh("manual");
    } catch (e) {
      setActionFeedback({ agentId: agent.id, tone: "error", title: `${action.title}: action failed`, detail: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleApproveReview = async (agent: OrgAgent, review: Review) => {
    try {
      setApprovingId(review.id);
      setSelectedId(agent.id);
      setActionFeedback({ agentId: agent.id, tone: "busy", title: `Approving: ${review.title}`, detail: "Sending approval from the Agent Org activity timeline." });
      const result = await request<Record<string, unknown>>(`/api/inbox/${encodeURIComponent(review.id)}/action`, { method: "POST", body: JSON.stringify({ action: "approve" }) });
      const ok = result.ok !== false;
      setActionFeedback({ agentId: agent.id, tone: ok ? "success" : "error", title: ok ? `Approved: ${review.title}` : `Approval failed: ${review.title}`, detail: ok ? "Approval recorded. The item will no longer appear as pending." : String(result.error || "Unable to approve item.") });
      invalidateAgentOrgCache(agent.id);
      detailCache.current.delete(agent.id);
      await refreshState.refresh("manual");
    } catch (e) {
      setActionFeedback({ agentId: agent.id, tone: "error", title: `${agent.name}: approval failed`, detail: e instanceof Error ? e.message : String(e) });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="agent-org-page scroll">
      <header className="org-hero">
        <div>
          <span className="stub-tag">AI WORKFORCE</span>
          <div className="org-title-row">
            <h1>Agent Org</h1>
            <button className="org-title-help" type="button" aria-label="Agent Org page guidance">
              ?
              <span role="tooltip">Operational control plane for Melverick's digital coworkers: registry-backed agents, queues, runs, outputs, permissions, handoffs, and safe actions. The diagram shows who owns what; click an agent card for the detail drawer, hover for quick context, and click the avatar area to add or change a profile image.{data.registry_path ? ` Registry: ${data.registry_path} · Generated ${data.health.generated_at}` : ""}</span>
            </button>
          </div>
        </div>
        <div className="org-hero-actions"><span className={`realtime-status ${refreshState.stale ? "stale" : refreshState.refreshing ? "refreshing" : "live"}`}>{refreshState.statusLabel}</span><button className="task-icon-action dark" aria-label="Refresh agent org" title="Refresh agent org" disabled={refreshState.refreshing} onClick={() => void refreshState.refresh("manual")}><Icon name="refresh" size={18} /></button></div>
      </header>

      <section className="org-metrics">
        <Metric label="Digital Coworkers" value={data.summary.digital_coworkers ?? agents.length} sub="registered agents" />
        <Metric label="Running Now" value={data.summary.running_now ?? 0} sub="agent queues in progress" tone={(data.summary.running_now ?? 0) ? "good" : ""} />
        <Metric label="Queued Work" value={data.summary.queued_work ?? 0} sub="assigned tasks waiting" />
        <Metric label="Approval Gates" value={data.summary.approvals_needed ?? 0} sub="human gates pending" tone={(data.summary.approvals_needed ?? 0) ? "warn" : "good"} />
        <Metric label="Open Handoffs" value={data.summary.open_handoffs ?? 0} sub={`${data.summary.blocked_handoffs ?? 0} blocked`} tone={(data.summary.blocked_handoffs ?? 0) ? "warn" : (data.summary.open_handoffs ?? 0) ? "good" : ""} />
      </section>

      {(notice || refreshState.error || data.health.errors.length > 0) && <div className="org-warning">{notice || refreshState.error || `Partial data loaded: ${data.health.errors.join(" · ")}`}</div>}

      {loading && <div className="empty">Loading registry-backed Agent Org from tasks, routines, approvals, audit runs, skills, costs, projects, and outputs…</div>}

      {!loading && <section className="org-chart org-chart-option-a" aria-label="Agent organization chart">
        <div className="org-chart-intro"><h2>Who owns what</h2></div>
        <div className="org-diagram" aria-label="Melverick agent org diagram">
          <div className="human-card"><span>Human Operator</span><b>Melverick Ng</b><small>Approves risk, defines operating model, owns business judgment</small></div>
          <div className="org-line" />
          {chief && <NodeCard agent={chief} selected={selected?.id === chief.id} avatarUrl={agentAvatars[chief.id] || chief.avatar_url} onAvatarFile={(file) => handleAvatarFile(chief, file)} onClick={() => setSelectedId(chief.id)} />}
          <div className="org-branch" />
          <div className="org-node-grid">{childNodes.map((agent) => <NodeCard key={agent.id} agent={agent} selected={selected?.id === agent.id} avatarUrl={agentAvatars[agent.id] || agent.avatar_url} onAvatarFile={(file) => handleAvatarFile(agent, file)} onClick={() => setSelectedId(agent.id)} />)}</div>
        </div>
      </section>}

      {selected && <DetailDrawer agent={selected} agents={agents} avatarUrl={agentAvatars[selected.id] || selected.avatar_url} onClose={() => setSelectedId(null)} onAction={handleAction} onCreateGoal={setGoalAgent} onApproveReview={handleApproveReview} onGoalAction={handleGoalAction} approvingId={approvingId} actionFeedback={actionFeedback} />}
      {goalAgent && <GoalModal agent={goalAgent} onClose={() => setGoalAgent(null)} onCreated={() => { invalidateAgentOrgCache(goalAgent.id); detailCache.current.delete(goalAgent.id); setSelectedId(goalAgent.id); setGoalAgent(null); void refreshState.refresh("manual"); }} />}
    </div>
  );
}
