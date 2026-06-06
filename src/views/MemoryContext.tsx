import { useEffect, useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { HttpHermesClient } from "../services/httpHermesClient";
import type { MemoryContextEntry, MemoryContextResponse, SecondBrainGraphResponse, SecondBrainHealthResponse, SecondBrainIndexResponse, SecondBrainItem, SecondBrainNoteResponse } from "../types";

const client = new HttpHermesClient();

type ScopeFilter = "" | "user" | "memory";
type PageTab = "memory" | "knowledge" | "sources" | "workflows" | "graph" | "health";
type DrawerKind = { kind: "memory"; id: string } | { kind: "note"; path: string } | null;
type DrawerTab = "summary" | "source" | "links" | "governance";

function toneForCategory(category: string) {
  const c = category.toLowerCase();
  if (c.includes("identity") || c.includes("preference")) return "good";
  if (c.includes("secret") || c.includes("credential") || c.includes("privacy")) return "bad";
  return "";
}

function categoryLabel(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function notePath(item: SecondBrainItem) {
  return `${item.layer}/${item.relative_path}`;
}

export function MemoryContext() {
  const [memory, setMemory] = useState<MemoryContextResponse | null>(null);
  const [kb, setKb] = useState<SecondBrainIndexResponse | null>(null);
  const [graph, setGraph] = useState<SecondBrainGraphResponse | null>(null);
  const [health, setHealth] = useState<SecondBrainHealthResponse | null>(null);
  const [note, setNote] = useState<SecondBrainNoteResponse | null>(null);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("");
  const [category, setCategory] = useState("");
  const [section, setSection] = useState("");
  const [pageTab, setPageTab] = useState<PageTab>("memory");
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [tab, setTab] = useState<DrawerTab>("summary");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [nextMemory, nextKb, nextGraph, nextHealth] = await Promise.all([
        client.getMemoryContext({ q, scope, category }),
        client.getSecondBrainIndex({ q, section }),
        client.getSecondBrainGraph(),
        client.getSecondBrainHealth(),
      ]);
      setMemory(nextMemory);
      setKb(nextKb);
      setGraph(nextGraph);
      setHealth(nextHealth);
      setError(nextMemory.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load memory and knowledge context");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, scope, category, section]);

  const entries = memory?.entries ?? [];
  const notes = kb?.wiki ?? [];
  const sources = kb?.raw_sources ?? [];
  const selectedMemory = useMemo(() => (drawer?.kind === "memory" ? entries.find((entry) => entry.id === drawer.id) ?? null : null), [entries, drawer]);

  const openMemory = (entry: MemoryContextEntry) => {
    setDrawer({ kind: "memory", id: entry.id });
    setNote(null);
    setTab("summary");
  };

  const openNote = async (item: SecondBrainItem) => {
    const path = notePath(item);
    setDrawer({ kind: "note", path });
    setTab("summary");
    try {
      setNote(await client.getSecondBrainNote(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load note");
    }
  };

  const closeDrawer = () => {
    setDrawer(null);
    setNote(null);
  };

  const currentNote = drawer?.kind === "note" ? note?.note : null;

  return (
    <div className="skills-page memory-page scroll">
      <header className="skills-hero memory-hero">
        <div>
          <span className="stub-tag">MEMORY & CONTEXT</span>
          <h1>Memory & Knowledge Control Panel</h1>
          <p>
            Inspect durable Hermes memory plus Melverick&apos;s Obsidian/Second Brain knowledge base. The KB is read-only, searchable, evidence-aware, path constrained, and prepared for later context injection.
          </p>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh memory and knowledge context" title="Refresh memory and knowledge context" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics memory-metrics">
        <Metric label="Agent memory" value={memory?.summary.total ?? entries.length} sub="Hermes durable facts" />
        <Metric label="KB notes" value={kb?.summary.wiki_pages ?? 0} sub="Obsidian wiki pages" tone="good" />
        <Metric label="Sources" value={kb?.summary.raw_sources ?? 0} sub="Raw evidence files" />
        <Metric label="Graph links" value={graph?.summary.edges ?? kb?.summary.links ?? 0} sub="Wikilink relationships" />
        <Metric label="Chunks" value={kb?.summary.chunks ?? 0} sub="Semantic-search-ready" />
        <Metric label="Health" value={health?.health.status ?? memory?.summary.redacted ?? "—"} sub="KB governance state" tone={health?.health.status === "healthy" ? "good" : undefined} />
      </section>

      <section className="skills-filters memory-filters knowledge-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search memory + second brain</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="SGQR, workflow, company, source evidence…" />
          </label>
        </div>
        <label>
          <span>Memory scope</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
            <option value="">All scopes</option>
            <option value="user">User profile</option>
            <option value="memory">Operational memory</option>
          </select>
        </label>
        <label>
          <span>Memory category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {(memory?.categories ?? []).map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}
          </select>
        </label>
        <label>
          <span>KB section</span>
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">All sections</option>
            {(kb?.sections ?? []).map((item) => <option key={item} value={item}>{categoryLabel(item)}</option>)}
          </select>
        </label>
        <div className="skills-filter-note">Read-only by design: write workflows, note promotion, and context attachment are visible as planned actions until explicit confirmation and audit logging are added.</div>
      </section>

      <nav className="memory-tabs" aria-label="Memory and knowledge tabs">
        {[
          ["memory", "Agent Memory"],
          ["knowledge", "Second Brain"],
          ["sources", "Sources & Evidence"],
          ["workflows", "Workflow Knowledge"],
          ["graph", "Context Graph"],
          ["health", "Knowledge Health"],
        ].map(([key, label]) => <button key={key} className={pageTab === key ? "on" : ""} onClick={() => setPageTab(key as PageTab)}>{label}</button>)}
      </nav>

      {error && <div className="skills-error">{error}</div>}

      {pageTab === "memory" && <MemoryPanel data={memory} entries={entries} loading={loading} category={category} setCategory={setCategory} selectedId={selectedMemory?.id ?? null} openEntry={openMemory} />}
      {pageTab === "knowledge" && <KnowledgePanel notes={notes} loading={loading} openNote={openNote} />}
      {pageTab === "sources" && <SourcesPanel sources={sources} loading={loading} openNote={openNote} />}
      {pageTab === "workflows" && <WorkflowPanel kb={kb} health={health} />}
      {pageTab === "graph" && <GraphPanel graph={graph} />}
      {pageTab === "health" && <HealthPanel health={health} kb={kb} />}

      {selectedMemory && (
        <SlideOverDrawer<DrawerTab>
          title={selectedMemory.title}
          subtitle={selectedMemory.text}
          eyebrow={`${selectedMemory.scope_label} · ${categoryLabel(selectedMemory.category)}`}
          statusClassName={`tag muted memory-scope-${selectedMemory.scope}`}
          onClose={closeDrawer}
          tabs={["summary", "source", "governance"]}
          activeTab={tab}
          onTabChange={setTab}
          width="wide"
          ariaLabel="Memory details"
        >
          {tab === "summary" && <MemorySummary entry={selectedMemory} />}
          {tab === "source" && <MemorySource entry={selectedMemory} />}
          {tab === "governance" && <MemoryGovernance entry={selectedMemory} policy={memory?.policy} />}
        </SlideOverDrawer>
      )}

      {drawer?.kind === "note" && (
        <SlideOverDrawer<DrawerTab>
          title={currentNote?.title ?? "Loading note…"}
          subtitle={currentNote?.summary ?? drawer.path}
          eyebrow={currentNote ? `${categoryLabel(currentNote.section)} · ${currentNote.relative_path}` : drawer.path}
          statusClassName="tag muted memory-scope-memory"
          onClose={closeDrawer}
          tabs={["summary", "source", "links", "governance"]}
          activeTab={tab}
          onTabChange={setTab}
          width="wide"
          ariaLabel="Second brain note details"
        >
          {!currentNote && <div className="empty big">Loading note…</div>}
          {currentNote && tab === "summary" && <NoteSummary note={note!} />}
          {currentNote && tab === "source" && <NoteSource note={note!} />}
          {currentNote && tab === "links" && <NoteLinks note={note!} />}
          {currentNote && tab === "governance" && <NoteGovernance note={note!} />}
        </SlideOverDrawer>
      )}
    </div>
  );
}

function MemoryPanel({ data, entries, loading, category, setCategory, selectedId, openEntry }: { data: MemoryContextResponse | null; entries: MemoryContextEntry[]; loading: boolean; category: string; setCategory: (value: string) => void; selectedId: string | null; openEntry: (entry: MemoryContextEntry) => void }) {
  return (
    <section className="memory-layout">
      <aside className="memory-side-panel">
        <div className="ops-list-head"><span>Category map</span><small>{data?.categories.length ?? 0} groups</small></div>
        <div className="memory-category-list">
          {(data?.category_counts ?? []).map((item) => (
            <button key={item.category} className={category === item.category ? "on" : ""} onClick={() => setCategory(category === item.category ? "" : item.category)}>
              <span>{categoryLabel(item.category)}</span><b>{item.count}</b>
            </button>
          ))}
        </div>
        <div className="memory-governance-note"><b>Safe display policy</b><p>{data?.policy?.summary ?? "Secrets are redacted before display. Memory is shown as evidence, not edited here."}</p></div>
      </aside>
      <section className="ops-list memory-list">
        <div className="ops-list-head"><span>Memory entries</span><small>{loading ? "Loading…" : `${entries.length} shown`}</small></div>
        {entries.map((entry) => <MemoryRow key={entry.id} entry={entry} active={entry.id === selectedId} onSelect={() => openEntry(entry)} />)}
        {!loading && entries.length === 0 && <div className="empty big">No memories matched this filter.</div>}
      </section>
    </section>
  );
}

function KnowledgePanel({ notes, loading, openNote }: { notes: SecondBrainItem[]; loading: boolean; openNote: (item: SecondBrainItem) => void }) {
  return <section className="ops-list memory-list knowledge-list"><div className="ops-list-head"><span>Second Brain wiki</span><small>{loading ? "Loading…" : `${notes.length} notes`}</small></div>{notes.map((item) => <KnowledgeRow key={notePath(item)} item={item} onSelect={() => void openNote(item)} />)}{!loading && notes.length === 0 && <div className="empty big">No KB notes matched this filter.</div>}</section>;
}

function SourcesPanel({ sources, loading, openNote }: { sources: SecondBrainItem[]; loading: boolean; openNote: (item: SecondBrainItem) => void }) {
  return <section className="ops-list memory-list knowledge-list"><div className="ops-list-head"><span>Sources & evidence</span><small>{loading ? "Loading…" : `${sources.length} files`}</small></div>{sources.map((item) => <KnowledgeRow key={notePath(item)} item={item} onSelect={() => void openNote(item)} />)}{!loading && sources.length === 0 && <div className="empty big">No source evidence matched this filter.</div>}</section>;
}

function WorkflowPanel({ kb, health }: { kb: SecondBrainIndexResponse | null; health: SecondBrainHealthResponse | null }) {
  return <section className="memory-enhancement-grid"><InfoCard title="Workflow schema" body="/schema/WORKFLOW.md is indexed as the operational contract for second-brain ingestion, source promotion, and reusable procedures." meta={`${kb?.summary.chunks ?? 0} chunks prepared`} /><InfoCard title="Context injection" body="Attach-to-chat and attach-to-mission are exposed as planned actions in note drawers; execution remains read-only until audit logging lands." meta="Phase 3 scaffold" /><InfoCard title="Write workflows" body={(health?.write_workflows.actions ?? ["add note", "append evidence", "create source page", "promote source facts"]).join(" · ")} meta={health?.write_workflows.status ?? "planned-read-only"} /></section>;
}

function GraphPanel({ graph }: { graph: SecondBrainGraphResponse | null }) {
  return <section className="memory-graph-panel"><div className="ops-list-head"><span>Context graph</span><small>{graph?.summary.nodes ?? 0} nodes · {graph?.summary.edges ?? 0} edges</small></div><div className="memory-graph-grid"><div className="ops-list"><div className="ops-list-head"><span>Nodes</span></div>{(graph?.nodes ?? []).slice(0, 80).map((node) => <div className="memory-graph-node" key={node.id}><b>{node.title}</b><span>{node.relative_path}</span><small>{categoryLabel(node.section)} · {node.link_count} links</small></div>)}</div><div className="ops-list"><div className="ops-list-head"><span>Edges</span></div>{(graph?.edges ?? []).slice(0, 120).map((edge, index) => <div className="memory-graph-edge" key={`${edge.source}-${edge.target}-${index}`}><b>{edge.label}</b><span>{edge.source} → {edge.target}</span></div>)}</div></div></section>;
}

function HealthPanel({ health, kb }: { health: SecondBrainHealthResponse | null; kb: SecondBrainIndexResponse | null }) {
  return <section className="memory-enhancement-grid"><InfoCard title="Semantic search" body={`${kb?.summary.chunks ?? health?.semantic_search.chunks ?? 0} chunks prepared. Embeddings can be added as the next retrieval layer without changing the visible contract.`} meta={kb?.summary.semantic_status ?? health?.semantic_search.status ?? "not indexed"} /><InfoCard title="Knowledge health" body={`Orphans: ${health?.knowledge_health.orphan_review ?? "unknown"}. Stale notes/conflicts are scaffolded for later scoring.`} meta={health?.health.status ?? "unknown"} /><InfoCard title="Read-only governance" body="Path traversal is rejected server-side; likely secrets are redacted; writes require future confirmation and audit logging." meta={kb?.policy.mode ?? "read-only"} />{(health?.health.checks ?? []).map((check) => <InfoCard key={check.label} title={check.label} body={check.detail} meta={check.ok ? "OK" : "Needs attention"} />)}</section>;
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return <div className={`skills-metric ${tone ?? ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function MemoryRow({ entry, active, onSelect }: { entry: MemoryContextEntry; active: boolean; onSelect: () => void }) {
  return <button className={`memory-row ${active ? "on" : ""}`} onClick={onSelect}><div className="memory-row-main"><div className="memory-row-top"><span className={`memory-scope-pill ${entry.scope}`}>{entry.scope_label}</span><span className={`memory-category-pill ${toneForCategory(entry.category)}`}>{categoryLabel(entry.category)}</span>{entry.redacted && <span className="memory-redacted-pill">Redacted</span>}</div><b>{entry.title}</b><p>{entry.text}</p></div><div className="memory-row-meta"><span>{entry.updated_at}</span><small>{entry.source_label}</small></div></button>;
}

function KnowledgeRow({ item, onSelect }: { item: SecondBrainItem; onSelect: () => void }) {
  return <button className="memory-row knowledge-row" onClick={onSelect}><div className="memory-row-main"><div className="memory-row-top"><span className={`memory-scope-pill ${item.layer === "raw" ? "memory" : "user"}`}>{item.layer === "raw" ? "Evidence" : "Wiki"}</span><span className="memory-category-pill good">{categoryLabel(item.section)}</span>{item.links.length > 0 && <span className="memory-redacted-pill">{item.links.length} links</span>}</div><b>{item.title}</b><p>{item.summary || item.preview}</p></div><div className="memory-row-meta"><span>{item.updated_at}</span><small>{notePath(item)}</small></div></button>;
}

function MemorySummary({ entry }: { entry: MemoryContextEntry }) {
  return <div className="memory-drawer-stack"><div className="skill-kv"><Info label="Scope" value={entry.scope_label} /><Info label="Category" value={categoryLabel(entry.category)} /><Info label="Updated" value={entry.updated_at} /><Info label="Source" value={entry.source_label} /></div><section className="skill-section"><h3>Memory text</h3><p>{entry.text}</p></section>{entry.tags.length > 0 && <section className="skill-section"><h3>Detected topics</h3><div className="skill-chip-cloud">{entry.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></section>}</div>;
}

function MemorySource({ entry }: { entry: MemoryContextEntry }) {
  return <div className="memory-drawer-stack"><div className="skill-path">{entry.source_path}:{entry.line_start}</div><section className="skill-section"><h3>Raw redacted source</h3><pre>{entry.raw}</pre></section></div>;
}

function MemoryGovernance({ entry, policy }: { entry: MemoryContextEntry; policy?: MemoryContextResponse["policy"] }) {
  return <div className="memory-drawer-stack"><section className="skill-section"><h3>Why this matters</h3><p>{entry.scope === "user" ? "User profile memory affects tone, preferences, identity assumptions, and safety rules." : "Operational memory affects environment assumptions, project conventions, and recurring workflow behavior."}</p></section><section className="skill-section"><h3>Display policy</h3><p>{policy?.summary ?? "Read-only display with likely secret redaction."}</p></section><section className="skill-section"><h3>Recommended controls</h3><div className="drawer-section-list">{(policy?.recommended_controls ?? ["Request correction", "Request deletion", "Show audit trail"]).map((item) => <div className="skill-route" key={item}><b>{item}</b></div>)}</div></section></div>;
}

function NoteSummary({ note }: { note: SecondBrainNoteResponse }) {
  return <div className="memory-drawer-stack"><div className="skill-kv"><Info label="Section" value={categoryLabel(note.note.section)} /><Info label="Updated" value={note.note.updated_at} /><Info label="Backlinks" value={String(note.note.health.backlinks)} /><Info label="Outbound" value={String(note.note.health.outbound_links)} /></div><section className="skill-section"><h3>Summary</h3><p>{note.note.summary || note.note.preview}</p></section><section className="skill-section"><h3>Context actions</h3><div className="drawer-section-list">{note.context_actions.map((action) => <div className="skill-route" key={action.id}><b>{action.label}</b><span>{action.status}</span></div>)}</div></section></div>;
}

function NoteSource({ note }: { note: SecondBrainNoteResponse }) {
  return <div className="memory-drawer-stack"><div className="skill-path">{note.note.relative_path}</div><section className="skill-section"><h3>Rendered markdown source</h3><pre>{note.note.content}</pre></section></div>;
}

function NoteLinks({ note }: { note: SecondBrainNoteResponse }) {
  return <div className="memory-drawer-stack"><section className="skill-section"><h3>Wikilinks</h3><div className="skill-chip-cloud">{note.note.links.length ? note.note.links.map((link) => <span key={link}>{link}</span>) : <span>No outbound links</span>}</div></section><section className="skill-section"><h3>Backlinks</h3><div className="drawer-section-list">{note.note.backlinks.length ? note.note.backlinks.map((link) => <div className="skill-route" key={`${link.relative_path}-${link.label}`}><b>{link.title}</b><span>{link.relative_path}</span></div>) : <div className="skill-route"><b>No backlinks indexed</b></div>}</div></section><section className="skill-section"><h3>Source evidence</h3><div className="drawer-section-list">{note.note.evidence.length ? note.note.evidence.map((item) => <div className="skill-route" key={item.id}><b>{item.title}</b><span>{item.relative_path}</span></div>) : <div className="skill-route"><b>No raw evidence directly matched yet</b></div>}</div></section></div>;
}

function NoteGovernance({ note }: { note: SecondBrainNoteResponse }) {
  return <div className="memory-drawer-stack"><section className="skill-section"><h3>Knowledge governance</h3><p>Second Brain notes are external knowledge, not compact Hermes memory. Use them as inspectable context/evidence; promote only stable pointers into durable memory.</p></section><section className="skill-section"><h3>Read-only policy</h3><p>{note.policy.write_workflows ?? "Writes are planned but disabled until confirmation and audit logging are implemented."}</p></section><section className="skill-section"><h3>Safety</h3><div className="drawer-section-list"><div className="skill-route"><b>Redacted</b><span>{note.note.health.redacted ? "Likely secret was hidden" : "No likely secret detected"}</span></div><div className="skill-route"><b>Path constrained</b><span>Readback is restricted to the configured second-brain root.</span></div></div></section></div>;
}

function InfoCard({ title, body, meta }: { title: string; body: string; meta: string }) {
  return <article className="memory-info-card"><span>{meta}</span><h3>{title}</h3><p>{body}</p></article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="skill-info"><span>{label}</span><b>{value}</b></div>;
}
