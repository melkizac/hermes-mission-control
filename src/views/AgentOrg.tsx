import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { formatSingaporeShort } from "../utils/time";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";
import { ContextPanel } from "../components/ContextPanel";
import { useStore } from "../services/store";
import type { Agent, AgentHandoff, ConfigFile, RunTreePayload } from "../types";
import { useRealtimeRefresh, type RefreshMode } from "../hooks/useRealtimeRefresh";
import { cachedJsonRequest } from "../services/queryCache";

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
  identity_docs?: Array<{ name: string; label?: string; kind?: string; updated_at?: string; scope?: string; editable?: boolean; preview?: string; content?: string; size_bytes?: number }>;
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

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: string }) {
  return <div className={`org-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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

function agentContactEmail(agent: OrgAgent) {
  const profile = (agent.profile || agent.id || "agent").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  return `${profile || "agent"}@mission-control.local`;
}

function agentHealthScore(agent: OrgAgent) {
  const issues = agentIssueCount(agent);
  if (agent.status === "failed") return 45;
  if (agent.status === "blocked") return 62;
  if (agent.status === "attention") return 74;
  return Math.max(82, 98 - issues * 6);
}

function agentJoinedLine(agent: OrgAgent) {
  const activity = agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "no recent run";
  return `Last active ${activity} · ${agentHealthScore(agent)}%`;
}

function AgentHoverIcon({ label, children }: { label: string; children: string }) {
  return <span className="org-hover-icon" aria-label={label} title={label}>{children}</span>;
}

function NodeCard({ agent, selected, avatarUrl, onClick, onAvatarFile }: { agent: OrgAgent; selected: boolean; avatarUrl?: string; onClick: () => void; onAvatarFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const openWork = (agent.queue?.queued || 0) + (agent.queue?.running || 0) + (agent.queue?.blocked || 0) + (agent.queue?.failed || 0);
  const automationCount = agent.automation_count ?? agent.automations.length;
  const inboxCount = agent.inbox_count ?? agent.inbox.length;
  const skillCount = agent.skills_detail.length || agent.skills.length;
  const email = agentContactEmail(agent);
  const peopleCount = Math.max(1, automationCount + openWork + inboxCount);
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
      <div className="org-node-hover-details org-hover-profile-card" aria-hidden="true">
        <div className="org-hover-banner" />
        <div className="org-hover-body">
          <div className="org-hover-avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{initials(agent.name)}</span>}</div>
          <button className="org-hover-menu" type="button" tabIndex={-1} aria-label="More actions">⋮</button>
          <div className="org-hover-title-row"><b>{agent.name}</b><span aria-label={`${peopleCount} active signals`}>♧ {peopleCount}</span></div>
          <p className="org-hover-role">{agent.role}</p>
          <p className="org-hover-joined">{agentJoinedLine(agent)}</p>
          <p className="org-hover-email">{email}</p>
          <div className="org-hover-icons" aria-label="Agent capability shortcuts">
            <AgentHoverIcon label={`${automationCount} routines`}>☘</AgentHoverIcon>
            <AgentHoverIcon label={`${skillCount} skills`}>✦</AgentHoverIcon>
            <AgentHoverIcon label={`${agent.tools.length} tools`}>⌘</AgentHoverIcon>
            <AgentHoverIcon label={`${openWork} queued or running items`}>▣</AgentHoverIcon>
            <AgentHoverIcon label={`${inboxCount} approval gates`}>◆</AgentHoverIcon>
            <AgentHoverIcon label={agent.runtime || "Hermes runtime"}>↗</AgentHoverIcon>
          </div>
        </div>
        <div className="org-hover-teams"><b>Teams</b><span>{agent.profile || "default"}, {agent.type || "workflow_agent"}</span></div>
      </div>
    </article>
  );
}

function orgStatusToAgentStatus(status: AgentStatus): Agent["status"] {
  return status === "failed" ? "error" : status === "blocked" || status === "attention" ? "waiting" : status === "active" ? "active" : "idle";
}

function orgIdentityDocsToFiles(agent: OrgAgent): ConfigFile[] {
  const docs = agent.profile_details?.identity_docs || [];
  const files = docs.map((doc): ConfigFile => ({
    name: doc.name,
    label: doc.label || doc.kind || "identity file",
    kind: doc.kind === "memory" || doc.kind === "agents" || doc.kind === "config" || doc.kind === "soul" ? doc.kind : "other",
    content: doc.content ?? doc.preview ?? "",
    sizeBytes: doc.size_bytes || new Blob([doc.content ?? doc.preview ?? ""]).size,
    updatedAt: doc.updated_at || "—",
    scope: doc.scope || "profile",
    editable: doc.editable,
  }));
  if (files.length) return files;
  const fallback = `${agent.role}. ${agent.summary || "No registry summary provided yet."}`;
  return [{
    name: "Registry identity.md",
    label: `No SOUL.md, identity.md, USER.md, AGENTS.md, or CLAUDE.md file reported for ${agent.profile || "default"}`,
    kind: "soul",
    content: fallback,
    sizeBytes: fallback.length,
    updatedAt: "—",
    scope: "registry",
    editable: false,
  }];
}

function orgAgentToContextAgent(agent: OrgAgent): Agent {
  const profileId = agent.profile || agent.id || "default";
  const skillDetails: SkillDetail[] = agent.skills_detail.length ? agent.skills_detail : agent.skills.map((name) => ({ name }));
  const mappedTasks: Agent["tasks"] = agent.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status as Agent["tasks"][number]["status"],
    updatedAt: task.updated_at || "—",
  }));
  const mappedArtifacts: Agent["artifacts"] = agent.outputs.map((output, index) => ({
    id: output.id || output.path || `${agent.id}-output-${index}`,
    filename: output.name,
    path: output.path || "",
    mime: output.type || "text/plain",
    sizeBytes: new Blob([output.preview || output.name]).size,
    preview: output.preview || output.status || output.type,
    createdAt: output.updated_at || "—",
  }));
  return {
    id: agent.id,
    name: agent.name,
    squad: agent.role,
    initials: initials(agent.name),
    color: "var(--accent, #111827)",
    model: agent.profile_details?.model_routing?.model || agent.runtime || "runtime default",
    status: orgStatusToAgentStatus(agent.status),
    availability: agent.status === "active" ? "online" : "offline",
    activityState: agent.status === "active" ? "active" : "sleeping",
    statusLabel: agent.status,
    statusDetail: agent.summary || agent.role,
    activity: agent.summary || agent.role,
    lastActive: agent.lastActivity ? formatSingaporeShort(agent.lastActivity) : "no recent run",
    profilePath: agent.profile_details?.profile_path || `~/.hermes/profiles/${profileId}`,
    uptime: agent.mode,
    sessionCount: agent.profile_details?.sessions?.count ?? agent.runs.length,
    skills: skillDetails.map((skill, index) => ({ id: `${agent.id}-skill-${skill.name}-${index}`, name: skill.name, category: skill.category || skill.source || "profile", source: skill.source })),
    tools: agent.tools.map((tool) => ({ id: tool, name: tool, kind: "toolset", source: "Agent Org registry", enabled: true })),
    files: orgIdentityDocsToFiles(agent),
    messages: [],
    artifacts: mappedArtifacts,
    tasks: mappedTasks,
    detailLoaded: agent.detailLoaded,
    detailEndpoint: agent.detailEndpoint,
    insightSummary: agent.summary || agent.role,
    insightStatus: agent.active_goal?.status || agent.status,
    profile_details: agent.profile_details,
    handoffs: agent.handoffs,
    handoff_summary: agent.handoff_summary,
  };
}

function DetailDrawer({ agent, onClose }: { agent: OrgAgent; onClose: () => void }) {
  const { select } = useStore();
  const contextAgent = useMemo(() => orgAgentToContextAgent(agent), [agent]);
  useEffect(() => {
    select(agent.id);
  }, [agent.id, select]);
  return (
    <div className="agent-drawer-layer org-agent-drawer-layer" role="dialog" aria-modal="true" aria-label={`Agent Org details for ${agent.name}`}>
      <button className="agent-drawer-scrim" aria-label={`Close ${agent.name} details`} onClick={onClose} />
      <ContextPanel agent={contextAgent} drawer onClose={onClose} />
    </div>
  );
}


export function AgentOrg() {
  const [data, setData] = useState<AgentOrgResponse>(emptyOrg);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [agentAvatars, setAgentAvatars] = useState<Record<string, string>>({});
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
  }, [selectedId, selected?.id, selected?.detailLoaded]);

  const chief = agents.find((a) => a.id === "chief-operator") || agents[0];
  const childNodes = useMemo(() => agents.filter((n) => (n.reportsTo ?? n.reports_to) === (chief?.id || "chief-operator")), [agents, chief]);
  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("Could not read profile picture"));
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarFile(agent: OrgAgent, file: File) {
    if (!file.type.startsWith("image/")) {
      setNotice("Profile pictures must be image files.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (!dataUrl) throw new Error("Could not read profile picture");
      const result = await request<{ ok?: boolean; avatar_url?: string; error?: string }>(`/api/agent-org/agents/${encodeURIComponent(agent.id)}/avatar`, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, mime: file.type, sizeBytes: file.size, data: dataUrl }),
      });
      const avatarUrl = result.avatar_url;
      if (!avatarUrl) throw new Error(result.error || "Profile picture save did not return a URL");
      setAgentAvatars((current) => ({ ...current, [agent.id]: avatarUrl }));
      setData((current) => ({
        ...current,
        agents: current.agents.map((item) => (item.id === agent.id ? { ...item, avatar_url: avatarUrl } : item)),
      }));
      const cachedDetail = detailCache.current.get(agent.id);
      if (cachedDetail) detailCache.current.set(agent.id, { ...cachedDetail, avatar_url: avatarUrl });
      setNotice(`Saved profile picture for ${agent.name}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save profile picture");
    }
  }

  return (
    <div className="agent-org-page scroll">
      <header className="org-hero projects-hero professional">
        <div>
          <span className="stub-tag">AI WORKFORCE</span>
          <div className="hero-title-with-help">
            <h1>Agent Org</h1>
            <InfoTooltip label="About Agent Org">Operational control plane for Melverick's digital coworkers. The diagram shows who owns what; click an agent card for the detail drawer, hover for quick context, and click the avatar area to add or change a profile image.{data.registry_path ? ` Registry: ${data.registry_path} · Generated ${data.health.generated_at}` : ""}</InfoTooltip>
          </div>
        </div>
        <div className="org-hero-actions projects-control projects-control-refresh-only"><button className="task-icon-action dark" aria-label="Refresh agent org" title="Refresh agent org" disabled={refreshState.refreshing} onClick={() => void refreshState.refresh("manual")}><Icon name="refresh" size={18} /></button></div>
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

      {selected && <DetailDrawer agent={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
