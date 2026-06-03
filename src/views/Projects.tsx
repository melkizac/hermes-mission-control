import { useEffect, useMemo, useState } from "react";
import type { ProjectOperatingLink, ProjectRecord } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";

const client = new HttpHermesClient();
type Tab = "overview" | "operations" | "knowledge" | "activity" | "sessions";

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "good" | "bad" }) {
  return <div className={`project-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function linkLabel(item: ProjectOperatingLink) {
  return item.name || item.title || item.id || "Untitled";
}

function LinkList({ title, empty, items, meta }: { title: string; empty: string; items?: ProjectOperatingLink[]; meta?: (item: ProjectOperatingLink) => string }) {
  return <div className="project-operating-block"><div className="project-section-head"><b>{title}</b><span>{items?.length ?? 0}</span></div>{(items || []).map((item) => <div className="project-op-row" key={`${title}-${item.id || linkLabel(item)}`}><b>{linkLabel(item)}</b><small>{meta?.(item) || [item.status, item.source, item.category].filter(Boolean).join(" · ") || "linked"}</small>{item.detail && <p>{item.detail}</p>}</div>)}{!(items || []).length && <p className="muted">{empty}</p>}</div>;
}

export function Projects() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, open_actions: 0, blocked: 0, knowledge: 0, workspaces: 0 });
  const [kinds, setKinds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await client.listProjects({ q, kind });
      setProjects(data.projects);
      setSummary(data.summary);
      setKinds(data.kinds);
      setError(data.error || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, kind]);

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

  return (
    <div className="projects-page scroll">
      <header className="projects-hero">
        <div>
          <span className="stub-tag">PROJECT HUB</span>
          <h1>Projects & Workspaces</h1>
          <p>Context cockpit for initiatives, workspaces, wiki project notes, Kanban actions, recent sessions, and source artifacts.</p>
        </div>
        <div className="projects-control">
          <span>Workspace Control</span>
          <b>{selected?.name || "Select project"}</b>
          <button className="btn dark" onClick={() => void load()}>Refresh</button>
        </div>
      </header>

      <section className="project-metrics">
        <Metric label="Portfolio" value={summary.total} sub="detected projects" />
        <Metric label="Active" value={summary.active} sub="live contexts" tone="good" />
        <Metric label="Open Actions" value={summary.open_actions} sub="Kanban linked" />
        <Metric label="Risk Watch" value={summary.blocked} sub="blocked actions" tone={summary.blocked ? "bad" : "good"} />
        <Metric label="Knowledge" value={summary.knowledge} sub="linked notes" />
        <Metric label="Workspaces" value={summary.workspaces} sub="filesystem roots" />
      </section>

      <section className="projects-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects, paths, tags, summaries…" />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All workspace types</option>
          {kinds.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span>{loading ? "Loading…" : `${projects.length} contexts shown`}</span>
      </section>
      {error && <div className="task-error">{error}</div>}
      {notice && <div className="task-notice">{notice}</div>}

      <section className="projects-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.id} onClick={() => openProject(project)}>
            <div className="project-card-top">
              <div><span className="project-kind">{project.kind}</span><h3>{project.name}</h3></div>
              <span className={`project-status ${project.status}`}>{project.status}</span>
            </div>
            <p>{project.summary || "No summary yet. Add wiki notes, Kanban tasks, or workspace artifacts to enrich this context."}</p>
            <div className="project-pulse">
              <div><span>Health</span><b>{project.health}%</b></div>
              <div><span>Progress</span><b>{project.progress}%</b></div>
            </div>
            <div className="project-bars"><i style={{ width: pct(project.health) }} /><em style={{ width: pct(project.progress) }} /></div>
            <div className="project-chips">
              <span>{(project.source_contexts?.length || 1) > 1 ? `${project.source_contexts?.length} contexts` : project.source}</span>
              <span>{project.actions.open + project.actions.running} open</span>
              <span>{project.knowledge.length} notes</span>
              <span>{project.artifacts.length} artifacts</span>
              <span>{project.operating_counts?.agents ?? project.agents?.length ?? 0} agents</span>
              <span>{project.operating_counts?.automations ?? project.automations?.length ?? 0} routines</span>
            </div>
            <div className="project-path">{project.path || "No workspace path linked"}</div>
          </article>
        ))}
        {!loading && projects.length === 0 && <div className="project-empty">No projects matched. Try clearing the filters or adding project notes/tasks.</div>}
      </section>

      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelectedId(null)}>
          <aside className="project-detail-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelectedId(null)}>×</button>
            <span className="stub-tag">WORKSPACE DETAIL</span>
            <h2>{selected.name}</h2>
            <p>{selected.summary}</p>
            <div className="project-detail-kv">
              <div><span>Status</span><b>{selected.status}</b></div>
              <div><span>Kind</span><b>{selected.kind}</b></div>
              <div><span>Source</span><b>{selected.source}</b></div>
              <div><span>Updated</span><b>{formatSingaporeTime(selected.updated_at)}</b></div>
            </div>
            <div className="project-ops-summary">
              <div><b>{selected.operating_counts?.agents ?? selected.agents?.length ?? 0}</b><span>Agents</span></div>
              <div><b>{selected.operating_counts?.automations ?? selected.automations?.length ?? 0}</b><span>Routines</span></div>
              <div><b>{selected.operating_counts?.goals ?? selected.goals?.length ?? 0}</b><span>Goals</span></div>
              <div><b>{selected.operating_counts?.skills ?? selected.skills?.length ?? 0}</b><span>Skills</span></div>
              <div><b>{selected.operating_counts?.bottlenecks ?? selected.human_bottlenecks?.length ?? 0}</b><span>Bottlenecks</span></div>
            </div>
            <div className="project-action-row">
              <button className="btn dark" disabled={busy === `brief:${selected.id}`} onClick={() => void generateBrief(selected)}>{busy === `brief:${selected.id}` ? "Briefing…" : "Generate Brief"}</button>
              <button className="btn primary" disabled={busy === `task:${selected.id}`} onClick={() => void createProjectTask(selected)}>{busy === `task:${selected.id}` ? "Creating…" : "Create Next Task"}</button>
            </div>
            <div className="project-tabs">
              {(["overview", "operations", "knowledge", "activity", "sessions"] as Tab[]).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
            </div>

            {tab === "overview" && <div className="project-tab-panel">
              <div className="project-focus-card"><b>Project pulse</b><div className="project-bigbar"><i style={{ width: pct(selected.health) }} /></div><p>Health {selected.health}% · progress {selected.progress}% · {selected.actions.open + selected.actions.running} active actions · {selected.actions.blocked} blocked.</p></div>
              <div className="quick-access">
                <div><b>{selected.actions.open}</b><span>Open</span></div><div><b>{selected.actions.running}</b><span>Running</span></div><div><b>{selected.actions.done}</b><span>Done</span></div><div><b>{selected.risks.length}</b><span>Risks</span></div>
              </div>
              <label>Workspace path</label><code>{selected.path || "—"}</code>
              <label>Linked contexts</label>
              <div className="project-source-contexts">
                {(selected.source_contexts?.length ? selected.source_contexts : [{ kind: selected.kind, source: selected.source, name: selected.name, path: selected.path }]).map((ctx, index) => <div key={`${ctx.id || ctx.path || ctx.name}-${index}`}><b>{ctx.kind || "context"}</b><span>{ctx.source || "unknown"}</span><small>{ctx.path || ctx.name || "—"}</small></div>)}
              </div>
              <label>Tags</label><div className="project-chips">{(selected.tags.length ? selected.tags : ["untagged"]).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>}

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

            {tab === "sessions" && <div className="project-tab-panel listy">
              {selected.sessions.map((item) => <div key={item.id}><b>{item.title}</b><span>{item.source} · {item.model} · {formatSingaporeTime(item.started_at)}</span><small>{item.messages} messages · {item.tools} tools · {item.tokens.toLocaleString()} tokens</small></div>)}
              {!selected.sessions.length && <p>No sessions linked to this project yet.</p>}
            </div>}
          </aside>
        </div>
      )}
    </div>
  );
}
