import { useEffect, useMemo, useState } from "react";
import type { SkillHubRecord, SkillsHubResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";

const client = new HttpHermesClient();

type SkillTab = "overview" | "routing" | "source";
type ViewMode = "cards" | "list";

function compact(value: number | undefined | null) {
  return Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

export function SkillsHub() {
  const [data, setData] = useState<SkillsHubResponse | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<SkillTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.listSkills({ q, category, source });
      setData(next);
      setError(next.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load skills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, category, source]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const skills = data?.skills ?? [];
  const summary = data?.summary;
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selected),
    [skills, selected],
  );

  const openSkill = (skill: SkillHubRecord) => {
    setSelected(skill.id);
    setTab("overview");
  };

  return (
    <div className="skills-page skills-drawer-first scroll">
      <header className="skills-hero">
        <div>
          <span className="stub-tag">SKILL LIBRARY</span>
          <h1>Skills Hub</h1>
          <p>
            Real Hermes skill inventory from installed SKILL.md files. Search capabilities, inspect routing evidence, and open dense details in a right-side drawer.
          </p>
        </div>
        <div className="task-hero-actions">
          <div className="view-switch" aria-label="Skills view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
          <button className="btn dark" onClick={() => void load()}>Refresh</button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Total" value={summary?.total ?? skills.length} sub="Installed skills" />
        <Metric label="Editable" value={summary?.editable ?? 0} sub="Local/profile files" />
        <Metric label="Assigned" value={summary?.assigned ?? 0} sub="Agents, routines, tasks" tone="good" />
        <Metric label="User" value={summary?.user ?? 0} sub={`${summary?.plugin ?? 0} plugin`} />
      </section>

      <section className="skills-filters">
        <label>
          <span>Search</span>
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="skill name, description, tag, model…" />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {(data?.categories ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            {(data?.sources ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="skills-filter-note">Assignment evidence combines default channel agents, named profiles, cron routines, and Kanban task skill fields.</div>
      </section>

      {error && <div className="skills-error">{error}</div>}

      {viewMode === "cards" ? (
        <section className="skills-grid skills-grid-full">
          <div className="skills-panel-head">
            <span>Installed capability cards</span>
            <small>{loading ? "Loading…" : `${skills.length} shown`}</small>
          </div>
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              active={skill.id === selectedSkill?.id}
              onSelect={() => openSkill(skill)}
            />
          ))}
          {!loading && skills.length === 0 && <div className="empty big">No skills matched this filter.</div>}
        </section>
      ) : (
        <section className="ops-list skill-list-view">
          <div className="ops-list-head"><span>Installed capability list</span><small>{loading ? "Loading…" : `${skills.length} shown`}</small></div>
          {skills.map((skill) => <SkillListRow key={skill.id} skill={skill} active={skill.id === selectedSkill?.id} onSelect={() => openSkill(skill)} />)}
          {!loading && skills.length === 0 && <div className="empty big">No skills matched this filter.</div>}
        </section>
      )}

      {selectedSkill && (
        <SkillDrawer
          skill={selectedSkill}
          tab={tab}
          setTab={setTab}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`skills-metric ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function SkillCard({ skill, active, onSelect }: { skill: SkillHubRecord; active: boolean; onSelect: () => void }) {
  const routes = skill.used_by_count > 0 ? `${skill.used_by_count} routes` : "Unassigned";
  return (
    <article className={`skill-card ${active ? "on" : ""}`}>
      <button className="skill-card-main" onClick={onSelect}>
        <div className="skill-card-top">
          <div className="skill-icon">✦</div>
          <span className={`tag ${skill.enabled ? "good" : "muted"}`}>{skill.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className="skill-title-row">
          <h2>{skill.name}</h2>
          <span className="tag muted">{skill.source}</span>
        </div>
        <p>{skill.description}</p>
        <div className="skill-chips">
          <span>{skill.category}</span>
          <span>{skill.model}</span>
          <span>{routes}</span>
          {skill.editable && <em>editable</em>}
        </div>
        <div className="skill-triplet">
          <Mini label="Agents" value={skill.used_by_agents.length} />
          <Mini label="Routines" value={skill.used_by_automations.length} />
          <Mini label="Tasks" value={skill.used_by_tasks.length} />
        </div>
      </button>
    </article>
  );
}


function SkillListRow({ skill, active, onSelect }: { skill: SkillHubRecord; active: boolean; onSelect: () => void }) {
  const routes = skill.used_by_count > 0 ? `${skill.used_by_count} routes` : "Unassigned";
  return (
    <button className={`ops-row skill-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="ops-row-main">
        <div className="ops-row-top">
          <b>{skill.name}</b>
          <span className={`tag ${skill.enabled ? "good" : "muted"}`}>{skill.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <p>{skill.description}</p>
        <small className="mono">{skill.id}</small>
      </div>
      <div className="ops-row-meta">
        <span>{skill.source}</span>
        <small>{skill.category} · {skill.model}</small>
        <em>{routes} · {skill.editable ? "editable" : "read-only"}</em>
      </div>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function SkillDrawer({ skill, tab, setTab, onClose }: {
  skill: SkillHubRecord;
  tab: SkillTab;
  setTab: (tab: SkillTab) => void;
  onClose: () => void;
}) {
  return (
    <div className="skill-drawer-layer" role="dialog" aria-modal="true" aria-label="Skill details">
      <button className="skill-drawer-scrim" aria-label="Close skill details" onClick={onClose} />
      <aside className="skill-detail skill-detail-drawer">
        <header className="skill-detail-head skill-drawer-head">
          <div>
            <span className="tag good">{skill.readiness}</span>
            <h2>{skill.name}</h2>
            <p className="mono">{skill.id}</p>
          </div>
          <button className="skill-drawer-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="skill-drawer-tabs">
          {(["overview", "routing", "source"] as SkillTab[]).map((item) => <button key={item} className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{item}</button>)}
        </div>

        {tab === "overview" && (
          <>
            <div className="skill-kv">
              <Info label="Category" value={skill.category} />
              <Info label="Source" value={skill.source} />
              <Info label="Editable" value={skill.editable ? "Yes" : "No"} />
              <Info label="Version" value={skill.version} />
              <Info label="Author" value={skill.author} />
              <Info label="Updated" value={skill.updated_at} />
              <Info label="Model affinity" value={skill.model} />
              <Info label="Routes" value={compact(skill.used_by_count)} />
            </div>
            <section className="skill-section">
              <h3>Description</h3>
              <p>{skill.description}</p>
            </section>
            <section className="skill-section">
              <h3>Tags / related skills</h3>
              <div className="skill-chip-cloud">
                {(skill.tags.length ? skill.tags : ["no tags"]).map((tag) => <span key={tag}>{tag}</span>)}
                {skill.related_skills.map((item) => <em key={item}>{item}</em>)}
              </div>
            </section>
          </>
        )}

        {tab === "routing" && (
          <>
            <RoutingBlock title="Agents / profiles" rows={skill.used_by_agents} empty="No profile/channel assignment detected." />
            <RoutingBlock title="Automations" rows={skill.used_by_automations} empty="No cron routine currently declares this skill." />
            <RoutingBlock title="Task Board" rows={skill.used_by_tasks} empty="No Kanban task currently declares this skill." />
          </>
        )}

        {tab === "source" && (
          <>
            <section className="skill-section">
              <h3>Filesystem</h3>
              <div className="skill-path mono">{skill.path}</div>
              <div className="skill-path mono">{skill.skill_dir}</div>
            </section>
            <section className="skill-section">
              <h3>SKILL.md preview</h3>
              <pre>{skill.preview}</pre>
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="skill-info">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function RoutingBlock({ title, rows, empty }: { title: string; rows: string[]; empty: string }) {
  return (
    <section className="skill-section">
      <h3>{title}</h3>
      {rows.length === 0 && <div className="empty">{empty}</div>}
      {rows.map((row) => <div className="skill-route" key={row}><b>{row}</b></div>)}
    </section>
  );
}
