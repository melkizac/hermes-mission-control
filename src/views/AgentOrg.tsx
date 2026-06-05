import { useEffect, useMemo, useState } from "react";
import { formatSingaporeShort } from "../utils/time";
import { Icon } from "../components/Icon";

type Tab = "org" | "agents" | "goals" | "queues" | "flows" | "runs" | "outputs" | "permissions" | "health";
type DrawerTab = "overview" | "goals" | "queue" | "approvals" | "runs" | "outputs" | "activity" | "skills" | "permissions" | "config";
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
  runs: Run[];
  outputs: Output[];
  activity: Activity[];
  queue: { queued: number; running: number; blocked: number; done: number; failed: number };
  cost7d: number;
  tokens7d: number;
  lastActivity?: string | null;
  active_goal?: Goal | null;
  goals?: Goal[];
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

function NodeCard({ agent, selected, onClick }: { agent: OrgAgent; selected: boolean; onClick: () => void }) {
  const openWork = (agent.queue?.queued || 0) + (agent.queue?.running || 0) + (agent.queue?.blocked || 0) + (agent.queue?.failed || 0);
  return (
    <button className={`org-node ${agent.status} ${selected ? "selected" : ""}`} onClick={onClick}>
      <div className="org-node-head"><span>{initials(agent.name)}</span><i>{agent.status}</i></div>
      <h3>{agent.name}</h3>
      <p>{agent.role}</p>
      <div className="chip-row compact"><span>{agent.type || "logical_agent"}</span><span>{agent.runtime || "hermes"}</span><span>{agent.mode}</span></div>
      <div className="org-node-stats"><b>{agent.automations.length}</b><small>routines</small><b>{openWork}</b><small>queue</small><b>{agent.inbox.length}</b><small>gates</small></div>
      <div className="org-node-foot"><span>{agent.mode}</span><span>{agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "No recent run"}</span></div>
    </button>
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

function agentRunLabel(agent: OrgAgent) {
  if (!agent.automations.length) return "No runtime";
  return agent.automations.length === 1 ? "Run agent" : "Choose run";
}

function DetailDrawer({ agent, agents, onClose, onAction, onCreateGoal, onApproveReview, onGoalAction, approvingId, actionFeedback }: { agent: OrgAgent; agents: OrgAgent[]; onClose: () => void; onAction: (agent: OrgAgent, action: string, payload?: Record<string, unknown>) => void; onCreateGoal: (agent: OrgAgent) => void; onApproveReview: (agent: OrgAgent, review: Review) => void; onGoalAction: (agent: OrgAgent, goal: Goal, action: GoalAction, status: string, execute?: boolean) => void; approvingId?: string | null; actionFeedback?: ActionFeedback }) {
  const [tab, setTab] = useState<DrawerTab>("overview");
  const tabs: DrawerTab[] = ["overview", "goals", "queue", "approvals", "runs", "outputs", "activity", "skills", "permissions", "config"];
  const feedback = actionFeedback?.agentId === agent.id ? actionFeedback : null;
  const approvalForActivity = (item: Activity) => {
    const jobId = item.job_id || (typeof item.metadata?.job_id === "string" ? item.metadata.job_id : "");
    const pending = (agent.inbox || []).filter((review) => review.status === "drafted" || review.status === "ready");
    const matched = pending.find((review) => jobId && reviewJobId(review) === jobId);
    if (matched) return matched;
    const isManualRun = item.action === "run_agent" || item.action === "run_automation";
    return isManualRun && pending.length === 1 ? pending[0] : null;
  };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="org-drawer wide" onClick={(e) => e.stopPropagation()}>
        <button className="drawer-x" onClick={onClose}>×</button>
        <span className={`tag ${agent.status}`}>{agent.status}</span>
        <h2>{agent.name}</h2>
        <p>{agent.summary}</p>
        {feedback && <div className={`drawer-action-notice ${feedback.tone}`} role="status" aria-live="polite"><b>{feedback.title}</b>{feedback.detail && <small>{feedback.detail}</small>}</div>}
        <div className="org-action-row">
          <button className="btn dark" disabled={!agent.automations.length} onClick={() => onAction(agent, "run_agent")}>{agentRunLabel(agent)}</button>
          <button className="btn dark" onClick={() => onCreateGoal(agent)}>Create goal</button>
          <button className="btn dark" onClick={() => onAction(agent, "create_task")}>Assign task</button>
          <button className="btn ghost" onClick={() => onAction(agent, "run_health_check")}>Health check</button>
          <button className="btn ghost" disabled={!agent.automations.length} onClick={() => onAction(agent, "pause_automations")}>Pause flows</button>
          <button className="btn ghost" disabled={!agent.automations.length} onClick={() => onAction(agent, "resume_automations")}>Resume flows</button>
        </div>
        <nav className="drawer-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

        {tab === "overview" && <>
          <div className="org-detail-grid">
            <div><span>Reports to</span><b>{nodeReportName(agent, agents)}</b></div>
            <div><span>Mode</span><b>{agent.mode}</b></div>
            <div><span>Runtime</span><b>{agent.runtime || "hermes"} · {agent.profile || "default"}</b></div>
            <div><span>Cost 7d</span><b>{fmtMoney(agent.cost7d)} · {fmtNum(agent.tokens7d)} tokens</b></div>
          </div>
          {agent.active_goal && <section><h3>Active goal</h3><GoalCard goal={agent.active_goal} compact onRunAction={(goal, action) => onGoalAction(agent, goal, action, 'running', true)} onDoneAction={(goal, action) => onGoalAction(agent, goal, action, 'done')} /></section>}
          <section><h3>Run from Mission Control</h3><div className="runtime-workflows">{agent.automations.map((automation) => <div className="runtime-workflow" key={automation.id}><div><b>{automation.name}</b><small>{automation.schedule || "manual"} · last {automation.last_status || automation.status || "—"}</small></div><button className="btn dark" onClick={() => onAction(agent, "run_automation", { job_id: automation.id })}>Run</button></div>)}{!agent.automations.length && <p className="muted">This agent has no mapped routine yet. Assign a cron routine before it can be run from the UI.</p>}</div></section>
          <section><h3>Operational footprint</h3><div className="org-footprint"><span>{agent.goals?.length || 0} goals</span><span>{agent.automations.length} routines</span><span>{agent.tasks.length} tasks</span><span>{agent.skills_detail.length || agent.skills.length} skills</span><span>{agent.inbox.length} approvals</span><span>{agent.runs.length} recent runs</span><span>{agent.outputs.length} outputs</span><span>{agent.activity?.length || 0} activity events</span></div></section>
          <section><h3>Responsibilities</h3><p>{agent.role}. {agent.summary}</p></section>
        </>}

        {tab === "goals" && <section><h3>Goals</h3><p className="muted">A goal is the outcome. Required actions are the real agent/human work and they drive progress. Supporting analysis is tucked under each goal for reference.</p><div className="goal-list">{(agent.goals || []).map((goal) => <GoalCard key={goal.id} goal={goal} onRunAction={(g, a) => onGoalAction(agent, g, a, 'running', true)} onDoneAction={(g, a) => onGoalAction(agent, g, a, 'done')} />)}</div>{!(agent.goals || []).length && <p className="muted">No goals assigned yet. Use Create goal to generate required actions for the first objective.</p>}</section>}

        {tab === "queue" && <section><h3>Queue</h3><div className="queue-pills"><span>Queued {agent.queue.queued}</span><span>Running {agent.queue.running}</span><span>Blocked {agent.queue.blocked}</span><span>Done {agent.queue.done}</span><span>Failed {agent.queue.failed}</span></div>{agent.tasks.slice(0, 12).map((t) => <MiniRow key={t.id} title={t.title} meta={`${t.status} · ${t.priority_label || "normal"} · ${t.updated_at || "—"}`} body={t.body} />)}{!agent.tasks.length && <p className="muted">No queue items assigned yet. Use Assign task to create the first operational item.</p>}</section>}

        {tab === "approvals" && <section><h3>Approval Gates</h3>{agent.inbox.map((i) => <MiniRow key={i.id} title={i.title} meta={`${i.status} · ${i.risk} risk · ${i.destination || "no destination"}`} body={i.description || i.body} />)}{!agent.inbox.length && <p className="muted">No pending approval gates for this agent.</p>}</section>}

        {tab === "runs" && <section><h3>Recent runs</h3>{agent.runs.map((r) => <MiniRow key={r.id} title={r.title || r.automation_name || r.id} meta={`${r.status} · ${r.started_at || "—"} · ${r.tool_call_count || 0} tools · ${fmtNum(r.tokens || 0)} tokens`} />)}{!agent.runs.length && <p className="muted">No recent runtime traces mapped to this agent yet.</p>}</section>}

        {tab === "outputs" && <section><h3>Outputs and artifacts</h3>{agent.outputs.map((o, i) => <MiniRow key={o.id || o.path || `${o.name}-${i}`} title={o.name} meta={`${o.status || o.type || "output"} · ${o.updated_at || "—"}${o.destination ? ` · ${o.destination}` : ""}`} body={o.preview} />)}{!agent.outputs.length && <p className="muted">No outputs mapped yet.</p>}</section>}

        {tab === "activity" && <section><h3>Activity timeline</h3><p className="muted">Operator actions from Mission Control plus trigger results for this agent. If a manual run creates a pending approval, approve it from the right side of the activity message.</p><div className="activity-list">{(agent.activity || []).map((item) => <ActivityRow key={item.id} item={item} approval={approvalForActivity(item)} approvingId={approvingId} onApprove={(review) => onApproveReview(agent, review)} />)}</div>{!(agent.activity || []).length && <p className="muted">No Mission Control activity recorded for this agent yet. Trigger a run, health check, or assignment to create the first entry.</p>}</section>}

        {tab === "skills" && <section><h3>Skills</h3><div className="chip-row">{(agent.skills_detail.length ? agent.skills_detail.map((s) => s.name) : agent.skills).map((s) => <span key={s}>{s}</span>)}</div>{!agent.skills.length && !agent.skills_detail.length && <p className="muted">No explicit skills mapped.</p>}</section>}

        {tab === "permissions" && <section><h3>Tools / permissions</h3><div className="chip-row">{agent.tools.map((tool) => <span key={tool}>{tool}</span>)}</div>{agent.permissions.map((permission) => <p className="permission" key={permission}>• {permission}</p>)}</section>}

        {tab === "config" && <section><h3>Registry config</h3><div className="org-detail-grid"><div><span>Agent ID</span><b>{agent.id}</b></div><div><span>Profile</span><b>{agent.profile || "default"}</b></div><div><span>Type</span><b>{agent.type || "logical_agent"}</b></div><div><span>Last activity</span><b>{agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "—"}</b></div></div><p className="muted">Edit the registry file on the server to change durable agent identity, skills, modes, and relationships.</p></section>}
      </aside>
    </div>
  );
}

export function AgentOrg() {
  const [data, setData] = useState<AgentOrgResponse>(emptyOrg);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("org");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [goalAgent, setGoalAgent] = useState<OrgAgent | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setData(await request<AgentOrgResponse>("/api/agent-org"));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const agents = data.agents;
  const selected = selectedId ? agents.find((n) => n.id === selectedId) : null;
  const chief = agents.find((a) => a.id === "chief-operator") || agents[0];
  const childNodes = useMemo(() => agents.filter((n) => (n.reportsTo ?? n.reports_to) === (chief?.id || "chief-operator")), [agents, chief]);
  const tabs: Tab[] = ["org", "agents", "goals", "queues", "flows", "runs", "outputs", "permissions", "health"];

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
      await load();
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
      await load();
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
      await load();
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
          <h1>Agent Org</h1>
          <p>Operational control plane for Melverick's digital coworkers: registry-backed agents, queues, runs, outputs, permissions, handoffs, and safe actions.</p>
          {data.registry_path && <small className="muted">Registry: {data.registry_path} · Generated {data.health.generated_at}</small>}
        </div>
        <div className="org-hero-actions"><button className="task-icon-action dark" aria-label="Refresh agent org" title="Refresh agent org" onClick={() => void load()}><Icon name="refresh" size={18} /></button></div>
      </header>

      <section className="org-metrics">
        <Metric label="Digital Coworkers" value={data.summary.digital_coworkers ?? agents.length} sub="registered agents" />
        <Metric label="Running Now" value={data.summary.running_now ?? 0} sub="agent queues in progress" tone={(data.summary.running_now ?? 0) ? "good" : ""} />
        <Metric label="Queued Work" value={data.summary.queued_work ?? 0} sub="assigned tasks waiting" />
        <Metric label="Approval Gates" value={data.summary.approvals_needed ?? 0} sub="human gates pending" tone={(data.summary.approvals_needed ?? 0) ? "warn" : "good"} />
        <Metric label="Active Goals" value={data.summary.active_goals ?? agents.reduce((n, a) => n + (a.goals?.length || 0), 0)} sub={`${data.summary.goal_progress_avg ?? 0}% avg progress`} tone={(data.summary.active_goals ?? 0) ? "good" : ""} />
      </section>

      {(notice || data.health.errors.length > 0) && <div className="org-warning">{notice || `Partial data loaded: ${data.health.errors.join(" · ")}`}</div>}

      <nav className="org-tabs">{tabs.map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>

      {loading && <div className="empty">Loading registry-backed Agent Org from tasks, routines, approvals, audit runs, skills, costs, projects, and outputs…</div>}

      {!loading && tab === "org" && <section className="org-chart">
        <div className="human-card"><span>Human Operator</span><b>Melverick Ng</b><small>Approves risk, defines operating model, owns business judgment</small></div>
        <div className="org-line" />
        {chief && <NodeCard agent={chief} selected={selected?.id === chief.id} onClick={() => setSelectedId(chief.id)} />}
        <div className="org-branch" />
        <div className="org-node-grid">{childNodes.map((agent) => <NodeCard key={agent.id} agent={agent} selected={selected?.id === agent.id} onClick={() => setSelectedId(agent.id)} />)}</div>
      </section>}

      {!loading && tab === "agents" && <section className="org-table operational"><div className="org-table-head"><span>Agent</span><span>Status</span><span>Runtime</span><span>Queue</span><span>Runs</span><span>Outputs</span><span>Actions</span></div>{agents.map((agent) => <div className="org-table-row" role="button" tabIndex={0} key={agent.id} onClick={() => setSelectedId(agent.id)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedId(agent.id); }}><b>{agent.name}<small>{agent.role}</small></b><span className={`tag ${agent.status}`}>{agent.status}</span><span>{agent.runtime || "hermes"}<small>{agent.profile || "default"}</small></span><span>{agent.queue.queued}/{agent.queue.running}/{agent.queue.blocked}</span><span>{agent.runs.length}</span><span>{agent.outputs.length}</span><span className="row-actions"><button className="btn dark small" disabled={!agent.automations.length} onClick={(e) => { e.stopPropagation(); setSelectedId(agent.id); if (agent.automations.length === 1) void handleAction(agent, "run_agent"); }}>{agentRunLabel(agent)}</button><button className="btn ghost small" onClick={(e) => { e.stopPropagation(); setSelectedId(agent.id); }}>Details</button></span></div>)}</section>}

      {!loading && tab === "goals" && <section className="goals-board"><div className="goals-board-head"><div><h2>Current goals</h2><p className="muted">A goal is the outcome. The first thing shown is Required Actions: the real work agents or humans must perform. Progress is calculated from completed required actions. Tools/access/data and planning steps are supporting analysis.</p></div></div><div className="ops-grid">{agents.filter((agent) => (agent.goals || []).length).map((agent) => <article className="ops-card goal-agent-card" key={agent.id}><div className="goal-agent-head"><h3>{agent.name}</h3><button className="btn ghost small" onClick={() => setGoalAgent(agent)}>Add goal</button></div>{(agent.goals || []).map((goal) => <GoalCard key={goal.id} goal={goal} onRunAction={(g, a) => handleGoalAction(agent, g, a, 'running', true)} onDoneAction={(g, a) => handleGoalAction(agent, g, a, 'done')} />)}</article>)}{!agents.some((agent) => (agent.goals || []).length) && <div className="empty">No active goals yet. Create one to make agent work measurable and visible.</div>}</div></section>}

      {!loading && tab === "queues" && <section className="ops-grid">{agents.map((agent) => <article className="ops-card" key={agent.id} onClick={() => setSelectedId(agent.id)}><div><span className={`tag ${agent.status}`}>{agent.status}</span><h3>{agent.name}</h3></div><div className="queue-pills"><span>Queued {agent.queue.queued}</span><span>Running {agent.queue.running}</span><span>Blocked {agent.queue.blocked}</span><span>Done {agent.queue.done}</span><span>Failed {agent.queue.failed}</span></div>{agent.tasks.slice(0, 3).map((t) => <MiniRow key={t.id} title={t.title} meta={`${t.status} · ${t.updated_at || "—"}`} />)}{!agent.tasks.length && <p className="muted">No assigned work yet.</p>}</article>)}</section>}

      {!loading && tab === "flows" && <section className="flow-grid">{data.flows.map((flow) => <article className="flow-card" key={flow.id}><span className={`tag ${flow.status}`}>{flow.status}</span><h3>{flow.name}</h3><small className="muted">Trigger: {flow.trigger || "configured"}</small><div className="flow-steps">{flow.steps.map((step, i) => <div key={`${flow.id}-${i}`} className="flow-step"><b>{step.label}<small>{step.agent ? agents.find((a) => a.id === step.agent)?.name || step.agent : `Approval: ${step.approval}`}</small></b><span>{i < flow.steps.length - 1 ? "↓" : step.status}</span></div>)}</div><p>{flow.gate}</p></article>)}</section>}

      {!loading && tab === "runs" && <section className="ops-grid">{agents.map((agent) => <article className="ops-card" key={agent.id}><h3>{agent.name}</h3>{agent.runs.slice(0, 4).map((r) => <MiniRow key={r.id} title={r.title || r.automation_name || r.id} meta={`${r.status} · ${r.started_at || "—"} · ${fmtNum(r.tokens || 0)} tokens`} />)}{!agent.runs.length && <p className="muted">No runs mapped.</p>}</article>)}</section>}

      {!loading && tab === "outputs" && <section className="ops-grid">{agents.map((agent) => <article className="ops-card" key={agent.id}><h3>{agent.name}</h3>{agent.outputs.slice(0, 4).map((o, i) => <MiniRow key={o.id || o.path || i} title={o.name} meta={`${o.status || o.type || "output"} · ${o.updated_at || "—"}`} body={o.preview} />)}{!agent.outputs.length && <p className="muted">No outputs mapped.</p>}</article>)}</section>}

      {!loading && tab === "permissions" && <section className="permission-grid">{agents.map((agent) => <article key={agent.id}><h3>{agent.name}</h3><span className={`tag ${agent.mode}`}>{agent.mode}</span><div className="chip-row">{agent.tools.map((tool) => <span key={tool}>{tool}</span>)}</div>{agent.permissions.map((permission) => <p key={permission}>• {permission}</p>)}</article>)}</section>}

      {!loading && tab === "health" && <section className="health-grid">{agents.map((agent) => <article key={agent.id} className={`health-card ${agent.status}`}><div><span className={`status-dot ${agent.status}`} /><b>{agent.name}</b></div><p>{agent.status === "failed" ? "Failure signal detected in tasks or automation status." : agent.status === "blocked" ? "Blocked/high-risk item needs review." : agent.status === "attention" ? "Review queue has pending output." : agent.status === "active" ? "Enabled workflows or running work detected." : "No urgent signal detected."}</p><small>Last activity: {agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "No recent activity"}</small><div className="org-action-row"><button className="btn ghost" onClick={() => void handleAction(agent, "run_health_check")}>Check</button><button className="btn ghost" onClick={() => setSelectedId(agent.id)}>Details</button></div></article>)}</section>}

      {selected && <DetailDrawer agent={selected} agents={agents} onClose={() => setSelectedId(null)} onAction={handleAction} onCreateGoal={setGoalAgent} onApproveReview={handleApproveReview} onGoalAction={handleGoalAction} approvingId={approvingId} actionFeedback={actionFeedback} />}
      {goalAgent && <GoalModal agent={goalAgent} onClose={() => setGoalAgent(null)} onCreated={() => { setGoalAgent(null); void load(); setTab("goals"); }} />}
    </div>
  );
}
