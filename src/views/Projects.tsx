import { useEffect, useMemo, useState } from "react";
import type { GuardPolicy, ProjectOperatingLink, ProjectRecord, ProjectRiskItem, ProjectSessionItem } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { queryCacheEventName } from "../services/queryCache";
import { formatSingaporeTime } from "../utils/time";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

const client = new HttpHermesClient();
type Tab = "overview" | "workflow" | "operations" | "knowledge" | "activity" | "chats";

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

function count(project: ProjectRecord, key: string, fallback?: unknown[]) {
  const value = project.operating_counts?.[key];
  return typeof value === "number" ? value : fallback?.length ?? 0;
}

function activeActionCount(project: ProjectRecord) {
  return (project.actions?.open || 0) + (project.actions?.running || 0);
}

function topRisk(risks: ProjectRiskItem[]) {
  return risks?.[0]?.label || "No risk signal";
}

function primaryNextAction(project: ProjectRecord) {
  return project.next_actions?.[0] || project.human_bottlenecks?.[0]?.title || project.tasks?.find((item) => item.status !== "done")?.title || "Open project detail to inspect context.";
}

function recency(project: ProjectRecord) {
  if (project.activity?.[0]?.at) return `Latest: ${formatSingaporeTime(project.activity[0].at)}`;
  if (project.updated_at) return `Updated: ${formatSingaporeTime(project.updated_at)}`;
  return "No recent signal";
}

function chatLinkLabel(item: ProjectSessionItem) {
  if (item.link_source === "canonical") return "Canonical";
  if (item.link_source === "suggested" || item.link_source === "heuristic") return "Suggested";
  return item.link_source || "Unlinked";
}

function chatConfidence(item: ProjectSessionItem) {
  if (item.link_source === "canonical") return "100%";
  if (typeof item.confidence === "number") return `${Math.round(item.confidence * 100)}%`;
  if (typeof item.project_score === "number") return `${Math.min(95, Math.max(10, item.project_score * 10))}%`;
  return "—";
}

function copySessionLink(item: ProjectSessionItem) {
  const text = `hmc://chat/${item.id}`;
  if (navigator?.clipboard?.writeText) void navigator.clipboard.writeText(text);
}

function ProjectChatRow({ item, project, busy, onConfirm, onUnlink }: { item: ProjectSessionItem; project: ProjectRecord; busy: string | null; onConfirm: (item: ProjectSessionItem) => void; onUnlink: (item: ProjectSessionItem) => void }) {
  const canonical = item.link_source === "canonical";
  const busyKey = `${project.id}:${item.id}`;
  return (
    <div className="project-chat-row">
      <div className="project-chat-main">
        <b>{item.title}</b>
        <span>{item.origin || item.source} · {item.model} · {formatSingaporeTime(item.started_at)}</span>
        <small>{item.messages} messages · {item.tools} tools · {item.tokens.toLocaleString()} tokens</small>
        {item.summary && <p>{item.summary}</p>}
      </div>
      <div className="project-chat-meta">
        <span className={`tag ${canonical ? "good" : "muted"}`}>{chatLinkLabel(item)}</span>
        <small>{item.relationship_type || "discussion"} · confidence {chatConfidence(item)}</small>
        <small>{canonical ? `linked by ${item.linked_by || "operator"}` : "review before adding to project memory"}</small>
        <div className="project-chat-actions">
          <button className="btn ghost" onClick={() => copySessionLink(item)}>Copy link</button>
          {!canonical && <button className="btn dark" disabled={busy === `confirm:${busyKey}`} onClick={() => onConfirm(item)}>{busy === `confirm:${busyKey}` ? "Approving…" : "Approve"}</button>}
          {canonical && <button className="btn ghost danger-lite" disabled={busy === `unlink:${busyKey}`} onClick={() => onUnlink(item)}>{busy === `unlink:${busyKey}` ? "Unlinking…" : "Unlink"}</button>}
        </div>
      </div>
    </div>
  );
}

function projectGuardList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,\n]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function projectGuardField(policy: GuardPolicy | null | undefined, snake: keyof GuardPolicy, camel: keyof GuardPolicy, fallback = "—") {
  if (!policy) return fallback;
  const value = policy[snake] ?? policy[camel];
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined || value === null || value === "" ? fallback : String(value);
}

function ProjectGuardPolicyPanel({ policy }: { policy?: GuardPolicy | null }) {
  if (!policy) return null;
  const allowed = projectGuardList(policy.allowed_edit_paths ?? policy.allowedEditPaths);
  const evidence = projectGuardList(policy.evidence_required ?? policy.evidenceRequired);
  return (
    <div className="guard-policy-panel project-guard-panel" aria-label="Project guard mode policy">
      <div className="guard-policy-head">
        <div><span className="stub-tag">GUARD MODE</span><h3>{projectGuardField(policy, "mode", "mode", "advisory")} project rails</h3></div>
        <span className={`guard-mode-badge ${policy.freeze ? "frozen" : "advisory"}`}>{policy.freeze ? "Frozen" : "Advisory"}</span>
      </div>
      <div className="guard-policy-grid">
        <div><span>Destructive warning</span><b>{projectGuardField(policy, "destructive_command_warning_level", "destructiveCommandWarningLevel", "medium")}</b></div>
        <div><span>Checkpoint</span><b>{projectGuardField(policy, "checkpoint_mode", "checkpointMode", "not specified")}</b></div>
        <div><span>Safe start</span><b>{policy.safe_start_required || policy.safeStartRequired ? "required" : "standard"}</b></div>
        <div><span>Rollback</span><b>{projectGuardField(policy, "rollback_artifact_path", "rollbackArtifactPath", "not specified")}</b></div>
      </div>
      {allowed.length > 0 && <div className="guard-path-list"><span>Allowed edit paths</span>{allowed.map((item) => <code key={item}>{item}</code>)}</div>}
      {evidence.length > 0 && <div className="guard-evidence-list">{evidence.map((item) => <span key={item}>{item}</span>)}</div>}
    </div>
  );
}

function ProjectWorkflowPanel({ project }: { project: ProjectRecord }) {
  const tasks = project.tasks ?? [];
  const current = tasks.find((item) => !["done", "archived"].includes(String(item.status || ""))) ?? tasks[0];
  const phase = current?.status || (project.actions?.running ? "running" : project.actions?.open ? "open" : project.status);
  const nextAction = primaryNextAction(project);
  return (
    <div className="project-workflow-panel" aria-label="Project workflow evidence cockpit">
      <div className="release-lane-overview compact">
        <div className="release-lane-head"><div><span className="stub-tag">Workflow surface</span><h3>Current phase and evidence lane</h3></div><span>{phase || "active"}</span></div>
        <div className="project-workflow-steps">
          {tasks.slice(0, 7).map((task) => <div className={`release-phase-pill ${task.status || "pending"}`} key={task.id || task.title}><b>{task.title || task.name || "Task"}</b><small>{task.status || "pending"}</small></div>)}
          {!tasks.length && <div className="empty">No Task Board cards linked yet.</div>}
        </div>
      </div>
      <div className="project-important-details">
        <div><span>Project</span><b>{project.id}</b></div>
        <div><span>Current phase</span><b>{current?.title || phase || "No active task"}</b></div>
        <div><span>Next action</span><b>{nextAction}</b></div>
        <div><span>Evidence sources</span><b>{project.knowledge.length} notes · {project.artifacts.length} artifacts · {tasks.length} tasks</b></div>
      </div>
      <ProjectGuardPolicyPanel policy={project.guard_policy || project.guardPolicy} />
      <LinkList title="Evidence-linked Task Board cards" empty="No linked workflow tasks yet." items={tasks} meta={(item) => `${item.status || "queued"} · ${item.assignee || "unassigned"}`} />
      <LinkList title="Artifacts and notes" empty="No project artifacts attached yet." items={[...project.knowledge, ...project.artifacts].map((item: any) => ({ id: item.path || item.title || item.name, title: item.title || item.name, status: item.type || item.kind || "evidence", detail: item.path }))} meta={(item) => `${item.status || "evidence"}${item.detail ? ` · ${item.detail}` : ""}`} />
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "good" | "bad" }) {
  return <div className={`project-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function ProjectStat({ label, value }: { label: string; value: string | number }) {
  return <div><b>{value}</b><span>{label}</span></div>;
}

function ProjectActionCounts({ project }: { project: ProjectRecord }) {
  return (
    <div className="project-action-counts" aria-label={`${project.name} action counts`}>
      <ProjectStat label="Open" value={project.actions?.open || 0} />
      <ProjectStat label="Running" value={project.actions?.running || 0} />
      <ProjectStat label="Blocked" value={project.actions?.blocked || 0} />
      <ProjectStat label="Done" value={project.actions?.done || 0} />
    </div>
  );
}

function linkLabel(item: ProjectOperatingLink) {
  return item.name || item.title || item.id || "Untitled";
}

function LinkList({ title, empty, items, meta }: { title: string; empty: string; items?: ProjectOperatingLink[]; meta?: (item: ProjectOperatingLink) => string }) {
  return <div className="project-operating-block"><div className="project-section-head"><b>{title}</b><span>{items?.length ?? 0}</span></div>{(items || []).map((item) => <div className="project-op-row" key={`${title}-${item.id || linkLabel(item)}`}><b>{linkLabel(item)}</b><small>{meta?.(item) || [item.status, item.source, item.category].filter(Boolean).join(" · ") || "linked"}</small>{item.detail && <p>{item.detail}</p>}</div>)}{!(items || []).length && <p className="muted">{empty}</p>}</div>;
}

function ProjectCard({ project, onOpen }: { project: ProjectRecord; onOpen: (project: ProjectRecord) => void }) {
  const actions = activeActionCount(project);
  const bottlenecks = count(project, "bottlenecks", project.human_bottlenecks);
  const agents = count(project, "agents", project.agents);
  const routines = count(project, "automations", project.automations);
  const contexts = project.source_contexts?.length || 1;

  return (
    <article className="project-card professional" onClick={() => onOpen(project)}>
      <div className="project-card-top">
        <div className="project-title-block">
          <span className="project-kind">Project</span>
          <h3>{project.name}</h3>
          <small>{project.portfolio_group || "Operations"}</small>
        </div>
        <span className={`project-status ${project.status}`}>{project.status}</span>
      </div>

      <p className="project-card-summary">{project.summary || "No summary yet. Add wiki notes, Kanban tasks, or workspace artifacts to enrich this context."}</p>

      <div className="project-scoreboard" aria-label={`${project.name} project health and progress`}>
        <div>
          <span>Health</span>
          <b>{project.health}%</b>
        </div>
        <div>
          <span>Progress</span>
          <b>{project.progress}%</b>
        </div>
      </div>
      <div className="project-bars"><i style={{ width: pct(project.health) }} /><em style={{ width: pct(project.progress) }} /></div>

      <div className="project-intelligence-grid">
        <ProjectStat label="Open Work" value={actions} />
        <ProjectStat label="Agents" value={agents} />
        <ProjectStat label="Routines" value={routines} />
        <ProjectStat label="Evidence" value={(project.knowledge?.length || 0) + (project.artifacts?.length || 0)} />
      </div>
      <ProjectActionCounts project={project} />

      <div className="project-card-detail-strip">
        <div>
          <span>Next best action</span>
          <b>{primaryNextAction(project)}</b>
        </div>
        <div>
          <span>Needs attention</span>
          <b className={bottlenecks || project.actions.blocked ? "attention" : ""}>{bottlenecks || project.actions.blocked ? `${bottlenecks + project.actions.blocked} attention item${bottlenecks + project.actions.blocked === 1 ? "" : "s"}` : topRisk(project.risks)}</b>
        </div>
      </div>

      <div className="project-card-footer">
        <span>{contexts} context{contexts === 1 ? "" : "s"}</span>
        <span>{project.workspace_count || project.workspaces?.length || 0} linked workspace{(project.workspace_count || project.workspaces?.length || 0) === 1 ? "" : "s"}</span>
        <span>{recency(project)}</span>
      </div>
    </article>
  );
}

export function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, open_actions: 0, blocked: 0, knowledge: 0, workspaces: 0 });
  const [q, setQ] = useState("");
  const [chatQ, setChatQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (mode: "initial" | "manual" | "event" = "initial") => {
    const previousRefreshMode = window.__hmcRefreshMode;
    try {
      window.__hmcRefreshMode = mode;
      setLoading(true);
      const data = await client.listProjects({ q });
      setProjects(data.projects);
      setSummary(data.summary);
      setError(data.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects");
    } finally {
      window.__hmcRefreshMode = previousRefreshMode;
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onQueryCacheUpdated = () => void load("event");
    window.addEventListener(queryCacheEventName(), onQueryCacheUpdated);
    return () => window.removeEventListener(queryCacheEventName(), onQueryCacheUpdated);
  }, [q]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = useMemo(() => projects.find((project) => project.id === selectedId) || null, [projects, selectedId]);

  const openProject = (project: ProjectRecord) => {
    setSelectedId(project.id);
    setTab("overview");
    setBrief(null);
    setNotice(null);
    setChatQ("");
  };

  const generateBrief = async (project: ProjectRecord) => {
    setBusy(`brief:${project.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await client.getProjectBrief(project.id);
      if (!result.ok) throw new Error(result.error || "Unable to generate brief");
      setBrief(result.brief_markdown || "");
      setTab("operations");
      setNotice(`Generated operating brief for ${project.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate brief");
    } finally {
      setBusy(null);
    }
  };

  const createProjectTask = async (project: ProjectRecord) => {
    setBusy(`task:${project.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await client.createProjectTask(project.id, { title: project.next_actions?.[0] || `Next action for ${project.name}` });
      if (!result.ok) throw new Error(result.error || "Unable to create project task");
      setNotice(`Created project-scoped task: ${result.task?.title || project.name}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create project task");
    } finally {
      setBusy(null);
    }
  };

  const filteredChats = useMemo(() => {
    const needle = chatQ.trim().toLowerCase();
    if (!selected) return [];
    return (selected.sessions || []).filter((item) => {
      if (!needle) return true;
      return [item.title, item.summary, item.origin, item.source, item.relationship_type, item.link_source, item.linked_by]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [selected, chatQ]);

  const confirmProjectChat = async (project: ProjectRecord, item: ProjectSessionItem) => {
    setBusy(`confirm:${project.id}:${item.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await client.confirmProjectChatSuggestion({ project_id: project.id, session_id: item.id, relationship_type: item.relationship_type || "discussion", summary: item.summary || "" });
      if (!result.ok) throw new Error(result.error || "Unable to approve chat link");
      setNotice(`Approved chat link for ${project.name}.`);
      await load("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve chat link");
    } finally {
      setBusy(null);
    }
  };

  const unlinkProjectChat = async (project: ProjectRecord, item: ProjectSessionItem) => {
    setBusy(`unlink:${project.id}:${item.id}`);
    setError(null);
    setNotice(null);
    try {
      const result = await client.unlinkProjectChat({ project_id: project.id, session_id: item.id });
      if (!result.ok) throw new Error(result.error || "Unable to unlink chat");
      setNotice(`Unlinked chat from ${project.name}.`);
      await load("manual");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to unlink chat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="projects-page scroll">
      <header className="projects-hero professional">
        <div>
          <span className="stub-tag">PROJECT HUB</span>
          <div className="hero-title-with-help">
            <h1>Projects</h1>
            <InfoTooltip label="About Projects">Operator view for each initiative: what it is, what needs attention, who is working on it, and what Melkizac should do next.</InfoTooltip>
          </div>
        </div>
        <div className="projects-control projects-control-refresh-only">
          <button className="task-icon-action dark" aria-label="Refresh projects" title="Refresh projects" onClick={() => void load("manual")}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="project-metrics">
        <Metric label="Projects" value={summary.total} sub="real initiatives" />
        <Metric label="Active" value={summary.active} sub="live project contexts" tone="good" />
        <Metric label="Open Work" value={summary.open_actions} sub="actions in motion" />
        <Metric label="Needs Attention" value={summary.blocked} sub="blocked actions" tone={summary.blocked ? "bad" : "good"} />
        <Metric label="Evidence / Notes" value={summary.knowledge} sub="linked knowledge" />
        <Metric label="Linked Workspaces" value={summary.workspaces} sub="workspace roots" />
      </section>

      <section className="projects-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, paths, tags, summaries…" />
        <span>{loading ? "Loading…" : `${projects.length} project${projects.length === 1 ? "" : "s"} shown`}</span>
      </section>
      {error && <div className="task-error">{error}</div>}
      {notice && <div className="task-notice">{notice}</div>}

      <section className="projects-grid professional">
        {projects.map((project) => <ProjectCard key={project.id} project={project} onOpen={openProject} />)}
        {!loading && projects.length === 0 && <div className="project-empty">No projects matched. Try clearing the filters or adding project notes/tasks.</div>}
      </section>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="project-detail-drawer professional" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedId(null)}>×</button>
            <div className="project-drawer-hero">
              <span className="stub-tag">PROJECT DETAIL</span>
              <h2>{selected.name}</h2>
              <p>{selected.summary || "No summary yet. Add project notes, activity, or tasks to enrich this cockpit."}</p>
              <div className="project-drawer-badges">
                <span className={`project-status ${selected.status}`}>{selected.status}</span>
                <span>{selected.portfolio_group || "Operations"}</span>
              </div>
            </div>

            <div className="project-detail-kv">
              <div><span>Status</span><b>{selected.status}</b></div>
              <div><span>Type</span><b>{selected.kind || "Project"}</b></div>
              <div><span>Updated</span><b>{formatSingaporeTime(selected.updated_at)}</b></div>
            </div>

            <div className="project-ops-summary professional">
              <ProjectStat label="Agents" value={count(selected, "agents", selected.agents)} />
              <ProjectStat label="Routines" value={count(selected, "automations", selected.automations)} />
              <ProjectStat label="Goals" value={count(selected, "goals", selected.goals)} />
              <ProjectStat label="Skills" value={count(selected, "skills", selected.skills)} />
              <ProjectStat label="Bottlenecks" value={count(selected, "bottlenecks", selected.human_bottlenecks)} />
            </div>

            <div className="project-action-row">
              <button className="btn dark" disabled={busy === `brief:${selected.id}`} onClick={() => void generateBrief(selected)}>{busy === `brief:${selected.id}` ? "Briefing…" : "Generate Brief"}</button>
              <button className="btn primary" disabled={busy === `task:${selected.id}`} onClick={() => void createProjectTask(selected)}>{busy === `task:${selected.id}` ? "Creating…" : "Create Next Task"}</button>
            </div>

            <div className="project-tabs">
              {(["overview", "workflow", "operations", "knowledge", "activity", "chats"] as Tab[]).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
            </div>

            {tab === "overview" && <div className="project-tab-panel project-overview-panel">
              <div className="project-focus-card professional"><div className="project-section-head"><b>Project status</b><span>health + progress</span></div><div className="project-bigbar"><i style={{ width: pct(selected.health) }} /></div><p>Health {selected.health}% · progress {selected.progress}% · {activeActionCount(selected)} active work item{activeActionCount(selected) === 1 ? "" : "s"} · {selected.actions.blocked} blocked.</p></div>
              <div className="quick-access professional">
                <ProjectStat label="Open" value={selected.actions.open} />
                <ProjectStat label="Running" value={selected.actions.running} />
                <ProjectStat label="Blocked" value={selected.actions.blocked} />
                <ProjectStat label="Done" value={selected.actions.done} />
              </div>
              <div className="project-important-details">
                <div><span>Next best action</span><b>{primaryNextAction(selected)}</b></div>
                <div><span>Needs attention</span><b>{topRisk(selected.risks)}</b></div>
                <div><span>Evidence / notes</span><b>{selected.knowledge.length} notes · {selected.artifacts.length} artifacts</b></div>
                <div><span>Latest activity</span><b>{recency(selected)}</b></div>
              </div>
              <ProjectGuardPolicyPanel policy={selected.guard_policy || selected.guardPolicy} />
              <label>Workspace</label><code>{selected.path || "—"}</code>
              <label>Tags</label><div className="project-chips">{(selected.tags.length ? selected.tags : ["untagged"]).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>}

            {tab === "workflow" && <div className="project-tab-panel project-workflow-tab"><ProjectWorkflowPanel project={selected} /></div>}

            {tab === "operations" && <div className="project-tab-panel project-operating-panel">
              <div className="project-section-head"><b>Next actions</b><span>operator-ready</span></div>
              <ol className="project-next-actions">{(selected.next_actions || []).map((action) => <li key={action}>{action}</li>)}</ol>
              <LinkList title="Human bottlenecks" empty="No human-only blockers detected." items={selected.human_bottlenecks} meta={(item) => `${item.kind || "item"} · ${item.status || "pending"} · ${item.owner || "owner unknown"}`} />
              <LinkList title="Agents" empty="No owning/supporting agents linked yet." items={selected.agents} meta={(item) => `${item.role || "digital coworker"} · ${item.mode || "mode n/a"}`} />
              <LinkList title="Routines" empty="No recurring routines linked yet." items={selected.automations} meta={(item) => `${item.enabled ? "enabled" : "paused"} · ${item.status || "unknown"} · ${item.schedule || "manual"}`} />
              <LinkList title="Goals" empty="No active GOALs linked yet." items={selected.goals} meta={(item) => `${item.status || "active"} · ${item.progress ?? 0}% · ${item.agent_name || item.agent_id || "agent"}`} />
              <LinkList title="Task Board" empty="No tasks linked yet." items={selected.tasks} meta={(item) => `${item.status || "queued"} · ${item.assignee || "unassigned"}`} />
              <LinkList title="Skills" empty="No skill playbooks linked yet." items={selected.skills} meta={(item) => `${item.category || "skill"} · ${item.source || "local"} · ${item.readiness || "ready"}`} />
              {brief && <div className="project-brief"><div className="project-section-head"><b>Generated brief</b><span>copy into agent/task</span></div><pre>{brief}</pre></div>}
            </div>}

            {tab === "knowledge" && <div className="project-tab-panel listy">
              {selected.knowledge.map((item) => <div key={item.path}><b>{item.title}</b><span>{item.type} · {formatSingaporeTime(item.updated_at)}</span><code>{item.path}</code></div>)}
              {selected.artifacts.map((item) => <div key={item.path}><b>{item.name}</b><span>{item.kind} · {formatSingaporeTime(item.updated_at)}</span><code>{item.path}</code></div>)}
              {!selected.knowledge.length && !selected.artifacts.length && <p>No linked notes or artifacts yet.</p>}
            </div>}

            {tab === "activity" && <div className="project-tab-panel listy">
              {selected.activity.map((item, index) => <div key={`${item.id || item.title}-${index}`}><b>{item.title}</b><span>{item.kind} · {item.status} · {formatSingaporeTime(item.at)}</span></div>)}
              {!selected.activity.length && <p>No recent project activity yet.</p>}
            </div>}

            {tab === "chats" && <div className="project-tab-panel project-chats-panel">
              <div className="project-section-head">
                <b>Project Chats</b>
                <span>{selected.sessions.length} linked/suggested human chat{selected.sessions.length === 1 ? "" : "s"}</span>
              </div>
              <div className="project-chat-controls">
                <input value={chatQ} onChange={(event) => setChatQ(event.target.value)} placeholder="Search project chats by title, origin, relationship…" />
                <span>{filteredChats.filter((item) => item.link_source === "canonical").length} canonical · {filteredChats.filter((item) => item.link_source !== "canonical").length} suggested</span>
              </div>
              <p className="project-chat-policy">Human conversations can be linked to multiple projects. Suggested links come from deterministic project aliases, domains, repos, task IDs, and transcript/title signals. Automation and worker executions stay in Activity/Runs.</p>
              <div className="project-chat-list">
                {filteredChats.map((item) => <ProjectChatRow key={`${item.project_id || selected.id}:${item.id}:${item.link_source}`} item={item} project={selected} busy={busy} onConfirm={(chat) => void confirmProjectChat(selected, chat)} onUnlink={(chat) => void unlinkProjectChat(selected, chat)} />)}
              </div>
              {!selected.sessions.length && <p>No human chats linked to this project yet. Automation and worker executions appear under Activity as runs/evidence.</p>}
              {selected.sessions.length > 0 && filteredChats.length === 0 && <p>No project chats matched this search.</p>}
            </div>}
          </aside>
        </div>
      )}
    </div>
  );
}
