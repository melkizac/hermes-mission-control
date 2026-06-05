import { useEffect, useMemo, useState } from "react";
import type { SecondBrainItem, SecondBrainResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { formatSingaporeTime } from "../utils/time";
import { Icon } from "../components/Icon";

const client = new HttpHermesClient();
type Tab = "overview" | "wiki" | "raw" | "schema" | "index" | "health";

type Detail =
  | { kind: "item"; item: SecondBrainItem }
  | { kind: "doc"; title: string; path: string; updated_at: string; preview: string };

function Metric({ label, value, sub, tone }: { label: string; value: string | number; sub: string; tone?: "good" | "warn" }) {
  return <div className={`brain-metric ${tone || ""}`}><span>{label}</span><b>{value}</b><small>{sub}</small></div>;
}

function markdownSnippet(text?: string) {
  return (text || "").replace(/^---[\s\S]*?---\s*/m, "").trim();
}

function BrainCard({ item, onOpen }: { item: SecondBrainItem; onOpen: (item: SecondBrainItem) => void }) {
  return (
    <article className="brain-card" onClick={() => onOpen(item)}>
      <div className="brain-card-top">
        <span className={`brain-layer ${item.layer}`}>{item.layer === "raw" ? "raw source" : item.section}</span>
        {item.immutable && <span className="brain-immutable">immutable</span>}
      </div>
      <h3>{item.title}</h3>
      <p>{item.summary || "No summary preview available yet."}</p>
      <div className="brain-card-meta">
        <span>{formatSingaporeTime(item.updated_at)}</span>
        <span>{item.links.length} links</span>
        <span>{Math.round(item.size / 1024)} KB</span>
      </div>
      <code>{item.relative_path}</code>
    </article>
  );
}

export function SecondBrain() {
  const [data, setData] = useState<SecondBrainResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [q, setQ] = useState("");
  const [section, setSection] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.getSecondBrain({ q, section });
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load second brain");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, section]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setDetail(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wikiBySection = useMemo(() => {
    const groups = new Map<string, SecondBrainItem[]>();
    for (const item of data?.wiki || []) {
      const bucket = groups.get(item.section) || [];
      bucket.push(item);
      groups.set(item.section, bucket);
    }
    return Array.from(groups.entries());
  }, [data]);

  if (!data && loading) {
    return <div className="second-brain-page scroll"><div className="task-error">Loading Second Brain…</div></div>;
  }

  const summary = data?.summary;
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "wiki", label: "Wiki" },
    { key: "raw", label: "Raw Sources" },
    { key: "schema", label: "Schema" },
    { key: "index", label: "Index & Log" },
    { key: "health", label: "Health" },
  ];

  return (
    <div className="second-brain-page scroll">
      <header className="brain-hero">
        <div>
          <span className="stub-tag">KARPATHY-STYLE LLM WIKI</span>
          <h1>Second Brain</h1>
          <p>{summary?.description || "Raw sources, maintained markdown wiki, schema rules, index, and log."}</p>
        </div>
        <div className="brain-path-card">
          <span>Vault root</span>
          <code>{data?.root || "—"}</code>
          <button className="task-icon-action dark" aria-label="Refresh second brain" title="Refresh second brain" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="brain-metrics">
        <Metric label="Wiki Pages" value={summary?.wiki_pages ?? 0} sub="compiled markdown" tone="good" />
        <Metric label="Raw Sources" value={summary?.raw_sources ?? 0} sub="immutable inputs" />
        <Metric label="Sections" value={summary?.sections ?? 0} sub="wiki/source groups" />
        <Metric label="Log Entries" value={summary?.log_entries ?? 0} sub="ingests + updates" />
        <Metric label="Health" value={summary?.health || "—"} sub="schema/index/log" tone={summary?.health === "healthy" ? "good" : "warn"} />
        <Metric label="Updated" value={summary?.last_updated?.split(" ")[0] || "—"} sub={summary?.last_updated || "last change"} />
      </section>

      <section className="brain-filters">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search wiki pages, raw sources, paths, summaries…" />
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {(data?.sections || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <span>{loading ? "Loading…" : `${(data?.wiki.length || 0) + (data?.raw_sources.length || 0)} items shown`}</span>
      </section>
      {error && <div className="task-error">{error}</div>}

      <div className="brain-tabs">
        {tabs.map((item) => <button key={item.key} className={tab === item.key ? "on" : ""} onClick={() => setTab(item.key)}>{item.label}</button>)}
      </div>

      {tab === "overview" && <section className="brain-overview-grid">
        {data?.command_center && (
          <article className="brain-command" onClick={() => setDetail({ kind: "item", item: data.command_center! })}>
            <span className="stub-tag">COMMAND CENTER</span>
            <h2>{data.command_center.title}</h2>
            <p>{data.command_center.summary}</p>
            <code>{data.command_center.relative_path}</code>
          </article>
        )}
        <article className="brain-principle">
          <b>LLM Wiki operating model</b>
          <p>Raw sources stay immutable. The LLM maintains the compiled wiki, cross-references, index, log, and schema-guided workflows so knowledge compounds instead of being rediscovered like plain RAG.</p>
        </article>
        <article className="brain-principle">
          <b>Latest log entries</b>
          {(data?.log.entries || []).slice(0, 5).map((entry) => <div className="brain-log-row" key={entry.title}><span>{entry.title}</span><small>{entry.summary}</small></div>)}
        </article>
      </section>}

      {tab === "wiki" && <section className="brain-section-list">
        {wikiBySection.map(([name, items]) => <div key={name}><h2>{name}</h2><div className="brain-grid">{items.map((item) => <BrainCard key={item.id} item={item} onOpen={(next) => setDetail({ kind: "item", item: next })} />)}</div></div>)}
      </section>}

      {tab === "raw" && <section>
        <div className="brain-note"><b>Immutable source layer.</b> Raw files are source-of-truth inputs. Agents read them, then update wiki pages — raw files are not edited from Mission Control.</div>
        <div className="brain-grid">{(data?.raw_sources || []).map((item) => <BrainCard key={item.id} item={item} onOpen={(next) => setDetail({ kind: "item", item: next })} />)}</div>
      </section>}

      {tab === "schema" && <section className="brain-doc-card" onClick={() => data && setDetail({ kind: "doc", title: "Workflow / Schema", path: data.schema.path, updated_at: data.schema.updated_at, preview: data.schema.preview })}>
        <span className="stub-tag">SCHEMA LAYER</span><h2>Workflow rules</h2><p>The schema tells the LLM how to ingest, query, lint, name files, link pages, and maintain the KB.</p><code>{data?.schema.path}</code><pre>{markdownSnippet(data?.schema.preview).slice(0, 1400)}</pre>
      </section>}

      {tab === "index" && <section className="brain-two-col">
        <article className="brain-doc-card" onClick={() => data && setDetail({ kind: "doc", title: "Wiki Index", path: data.index.path, updated_at: data.index.updated_at, preview: data.index.preview })}><span className="stub-tag">INDEX</span><h2>index.md</h2><code>{data?.index.path}</code><pre>{markdownSnippet(data?.index.preview).slice(0, 1100)}</pre></article>
        <article className="brain-doc-card" onClick={() => data && setDetail({ kind: "doc", title: "Wiki Log", path: data.log.path, updated_at: data.log.updated_at, preview: data.log.preview })}><span className="stub-tag">LOG</span><h2>log.md</h2><code>{data?.log.path}</code>{(data?.log.entries || []).slice(0, 8).map((entry) => <div className="brain-log-row" key={entry.title}><span>{entry.title}</span><small>{entry.summary}</small></div>)}</article>
      </section>}

      {tab === "health" && <section className="brain-health-list">
        {(data?.health.checks || []).map((check) => <article key={check.label} className={check.ok ? "ok" : "bad"}><b>{check.ok ? "✓" : "!"} {check.label}</b><span>{check.detail}</span></article>)}
      </section>}

      {detail && <div className="drawer-backdrop" onClick={() => setDetail(null)}>
        <aside className="brain-detail-drawer" onClick={(e) => e.stopPropagation()}>
          <button className="drawer-close" onClick={() => setDetail(null)}>×</button>
          <span className="stub-tag">{detail.kind === "item" ? detail.item.layer : "DOCUMENT"}</span>
          <h2>{detail.kind === "item" ? detail.item.title : detail.title}</h2>
          <p>{detail.kind === "item" ? detail.item.summary : "Read-only markdown preview."}</p>
          <div className="brain-detail-kv">
            <div><span>Updated</span><b>{formatSingaporeTime(detail.kind === "item" ? detail.item.updated_at : detail.updated_at)}</b></div>
            {detail.kind === "item" && <div><span>Section</span><b>{detail.item.section}</b></div>}
            {detail.kind === "item" && <div><span>Links</span><b>{detail.item.links.length}</b></div>}
            {detail.kind === "item" && <div><span>Mode</span><b>{detail.item.immutable ? "immutable" : "LLM-maintained"}</b></div>}
          </div>
          <label>Path</label><code>{detail.kind === "item" ? detail.item.path : detail.path}</code>
          {detail.kind === "item" && detail.item.links.length > 0 && <><label>Wikilinks</label><div className="brain-link-chips">{detail.item.links.map((link) => <span key={link}>{link}</span>)}</div></>}
          <label>Markdown preview</label>
          <pre className="brain-preview">{markdownSnippet(detail.kind === "item" ? detail.item.preview : detail.preview)}</pre>
        </aside>
      </div>}
    </div>
  );
}
