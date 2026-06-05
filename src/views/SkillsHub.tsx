import { useEffect, useMemo, useState } from "react";
import type { SkillFileResponse, SkillHubRecord, SkillsHubResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import hermesSkillIcon from "../assets/hermes-skill-icon.png";
import openclawSkillIcon from "../assets/openclaw-skill-icon.png";

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
            Inventory across Hermes, OpenClaw, and shared SKILL.md files. Search capabilities, inspect source labels and routing evidence, and open dense details in a right-side drawer.
          </p>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh skills hub" title="Refresh skills hub" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Total" value={summary?.total ?? skills.length} sub="All skill sources" />
        <Metric label="Hermes" value={summary?.hermes ?? summary?.user ?? 0} sub="Hermes-owned skills" />
        <Metric label="OpenClaw" value={summary?.openclaw ?? 0} sub="OpenClaw-only skills" />
        <Metric label="Shared" value={summary?.shared ?? 0} sub="Runtime-neutral skills" tone="good" />
      </section>

      <section className="skills-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="skill name, description, tag, model…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Skills view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
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
          <div className="skill-card-badges">
            <SourceLogo source={skill.source} />
            <EnabledIcon enabled={skill.enabled} />
          </div>
        </div>
        <div className="skill-title-row">
          <h2>{skill.name}</h2>
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

function SourceLogo({ source }: { source: string }) {
  const normalized = source.toLowerCase();
  const label = source || "Skill source";
  if (normalized === "openclaw") {
    return (
      <span className="skill-source-logo openclaw" title="OpenClaw" aria-label="OpenClaw source">
        <img src={openclawSkillIcon} alt="" aria-hidden="true" />
      </span>
    );
  }
  if (normalized === "shared") {
    return (
      <span className="skill-source-logo shared" title="Shared" aria-label="Shared skill source">
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="17" cy="24" r="8" />
          <circle cx="31" cy="24" r="8" />
          <path d="M23 24h2" />
          <path d="M15 16c3-6 15-6 18 0" />
          <path d="M15 32c3 6 15 6 18 0" />
        </svg>
      </span>
    );
  }
  return (
    <span className="skill-source-logo hermes" title={label} aria-label={`${label} source`}>
      <img src={hermesSkillIcon} alt="" aria-hidden="true" />
    </span>
  );
}

function EnabledIcon({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`skill-enabled-icon ${enabled ? "on" : "off"}`}
      title={enabled ? "Enabled" : "Disabled"}
      aria-label={enabled ? "Enabled" : "Disabled"}
    >
      {enabled ? "✓" : "—"}
    </span>
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
  const [file, setFile] = useState<SkillFileResponse | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setFileError(null);
    setFileLoading(true);
    client.getSkillFile(skill.id)
      .then((next) => {
        if (!cancelled) setFile(next);
      })
      .catch((err) => {
        if (!cancelled) setFileError(err instanceof Error ? err.message : "Unable to read SKILL.md");
      })
      .finally(() => {
        if (!cancelled) setFileLoading(false);
      });
    return () => { cancelled = true; };
  }, [skill.id]);

  return (
    <SlideOverDrawer
      title={skill.name}
      subtitle={<span className="mono">{skill.id}</span>}
      eyebrow={skill.readiness}
      statusClassName="tag good"
      onClose={onClose}
      closeLabel="Close skill details"
      ariaLabel="Skill details"
      tabs={["overview", "routing", "source"] as const}
      activeTab={tab}
      onTabChange={setTab}
      className="skill-detail skill-detail-drawer"
    >
      {tab === "overview" && (
        <>
          <div className="skill-kv">
            <Info label="Category" value={skill.category} />
            <Info label="Source" value={skill.source} />
            <Info label="Editable" value={skill.editable ? "Yes" : "No"} />
            <Info label="Version" value={skill.version} />
            <Info label="Author" value={skill.author} />
            <Info label="Updated" value={formatSingaporeTime(skill.updated_at)} />
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
          <RoutingBlock title="Routines" rows={skill.used_by_automations} empty="No routine currently declares this skill." />
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
            <div className="skill-section-heading">
              <h3>Full SKILL.md</h3>
              <small>{file ? `${compact(file.size)} bytes · ${formatSingaporeTime(file.updated_at)}` : "Read from filesystem"}</small>
            </div>
            {fileLoading && <div className="empty">Reading SKILL.md…</div>}
            {fileError && <div className="skills-error">{fileError}</div>}
            {!fileLoading && !fileError && <pre className="skill-file-full">{file?.content ?? skill.preview}</pre>}
          </section>
        </>
      )}
    </SlideOverDrawer>
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
