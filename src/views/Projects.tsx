import { useEffect, useMemo, useState } from "react";
import type { ProjectRecord } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";

const client = new HttpHermesClient();
type Tab = "overview" | "knowledge" | "activity" | "sessions";

function pct(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "good" | "bad" }) {
  return <div className={`project-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
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
              <span>{project.source}</span>
              <span>{project.actions.open + project.actions.running} open</span>
              <span>{project.knowledge.length} notes</span>
              <span>{project.artifacts.length} artifacts</span>
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
              <div><span>Updated</span><b>{selected.updated_at}</b></div>
            </div>
            <div className="project-tabs">
              {(["overview", "knowledge", "activity", "sessions"] as Tab[]).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
            </div>

            {tab === "overview" && <div className="project-tab-panel">
              <div className="project-focus-card"><b>Project pulse</b><div className="project-bigbar"><i style={{ width: pct(selected.health) }} /></div><p>Health {selected.health}% · progress {selected.progress}% · {selected.actions.open + selected.actions.running} active actions · {selected.actions.blocked} blocked.</p></div>
              <div className="quick-access">
                <div><b>{selected.actions.open}</b><span>Open</span></div><div><b>{selected.actions.running}</b><span>Running</span></div><div><b>{selected.actions.done}</b><span>Done</span></div><div><b>{selected.risks.length}</b><span>Risks</span></div>
              </div>
              <label>Workspace path</label><code>{selected.path || "—"}</code>
              <label>Tags</label><div className="project-chips">{(selected.tags.length ? selected.tags : ["untagged"]).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>}

            {tab === "knowledge" && <div className="project-tab-panel listy">
              {selected.knowledge.map((item) => <div key={item.path}><b>{item.title}</b><span>{item.type} · {item.updated_at}</span><code>{item.path}</code></div>)}
              {selected.artifacts.map((item) => <div key={item.path}><b>{item.name}</b><span>{item.kind} · {item.updated_at}</span><code>{item.path}</code></div>)}
              {!selected.knowledge.length && !selected.artifacts.length && <p>No linked notes or artifacts yet.</p>}
            </div>}

            {tab === "activity" && <div className="project-tab-panel listy">
              {selected.activity.map((item, index) => <div key={`${item.id || item.title}-${index}`}><b>{item.title}</b><span>{item.kind} · {item.status} · {item.at}</span></div>)}
              {!selected.activity.length && <p>No recent project activity yet.</p>}
            </div>}

            {tab === "sessions" && <div className="project-tab-panel listy">
              {selected.sessions.map((item) => <div key={item.id}><b>{item.title}</b><span>{item.source} · {item.model} · {item.started_at}</span><small>{item.messages} messages · {item.tools} tools · {item.tokens.toLocaleString()} tokens</small></div>)}
              {!selected.sessions.length && <p>No sessions linked to this project yet.</p>}
            </div>}
          </aside>
        </div>
      )}
    </div>
  );
}
