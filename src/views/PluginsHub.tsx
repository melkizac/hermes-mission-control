import { useEffect, useMemo, useState } from "react";
import type { PluginHubRecord, PluginsHubResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

const client = new HttpHermesClient();

type PluginTab = "overview" | "setup";
type ViewMode = "cards" | "list";

function categoryFor(plugin: PluginHubRecord) {
  if (plugin.category) return plugin.category;
  const [prefix] = plugin.name.split("/");
  return prefix && prefix !== plugin.name ? prefix : "general";
}

function sourceLabel(value?: string) {
  if (!value) return "Source not reported";
  const raw = String(value).toLowerCase();
  if (raw.includes("bundled")) return "Hermes bundled";
  if (raw.includes("user") || raw.includes("git")) return "User installed";
  return value;
}

function statusLabel(plugin: PluginHubRecord) {
  return plugin.enabled ? "Enabled" : plugin.status || "Not enabled";
}

export function PluginsHub() {
  const [data, setData] = useState<PluginsHubResponse | null>(null);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<PluginTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.listPlugins({ q, category, source, status });
      setData(next);
      setError(next.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Hermes plugins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q, category, source, status]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const plugins = data?.plugins ?? [];
  const summary = data?.summary;
  const selectedPlugin = useMemo(() => plugins.find((plugin) => plugin.id === selected), [plugins, selected]);

  const openPlugin = (plugin: PluginHubRecord) => {
    setSelected(plugin.id);
    setTab("overview");
  };

  return (
    <div className="skills-page plugins-page skills-drawer-first scroll">
      <header className="skills-hero">
        <div>
          <span className="stub-tag">HERMES PLUGINS</span>
          <div className="hero-title-with-help">
            <h1>Plugins</h1>
            <InfoTooltip label="About Plugins">
              All Hermes plugins available to use in this workspace. Inspect bundled and user-installed plugin capabilities, enablement state, source, and setup requirements before turning anything on from the Hermes CLI.
            </InfoTooltip>
          </div>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh plugins" title="Refresh plugins" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Total" value={summary?.total ?? plugins.length} sub="Available plugins" />
        <Metric label="Enabled" value={summary?.enabled ?? plugins.filter((p) => p.enabled).length} sub="Loaded by Hermes" tone="good" />
        <Metric label="Bundled" value={summary?.bundled ?? 0} sub="Ships with Hermes" />
        <Metric label="Categories" value={summary?.categories ?? data?.categories.length ?? 0} sub="Capability groups" />
      </section>

      <section className="skills-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="plugin name, description, category…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Plugins view mode">
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
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {(data?.statuses ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            {(data?.sources ?? []).map((item) => <option key={item} value={item}>{sourceLabel(item)}</option>)}
          </select>
        </label>
        <InfoTooltip className="filter-help" label="About plugin inventory">
          Plugin inventory is read from `hermes plugins list --json`. Enable or disable plugins with `hermes plugins enable/disable &lt;name&gt;`; Mission Control shows availability without exposing secrets.
        </InfoTooltip>
      </section>

      {error && <div className="skills-error">{error}</div>}

      {viewMode === "cards" ? (
        <section className="skills-grid skills-grid-full">
          <div className="skills-panel-head">
            <span>Available Hermes plugins</span>
            <small>{loading ? "Loading…" : `${plugins.length} shown`}</small>
          </div>
          {plugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} active={plugin.id === selectedPlugin?.id} onSelect={() => openPlugin(plugin)} />)}
          {!loading && plugins.length === 0 && <div className="empty big">No Hermes plugins matched this filter.</div>}
        </section>
      ) : (
        <section className="ops-list skill-list-view">
          <div className="ops-list-head"><span>Available Hermes plugins</span><small>{loading ? "Loading…" : `${plugins.length} shown`}</small></div>
          {plugins.map((plugin) => <PluginListRow key={plugin.id} plugin={plugin} active={plugin.id === selectedPlugin?.id} onSelect={() => openPlugin(plugin)} />)}
          {!loading && plugins.length === 0 && <div className="empty big">No Hermes plugins matched this filter.</div>}
        </section>
      )}

      {selectedPlugin && <PluginDrawer plugin={selectedPlugin} tab={tab} setTab={setTab} onClose={() => setSelected(null)} />}
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

function PluginCard({ plugin, active, onSelect }: { plugin: PluginHubRecord; active: boolean; onSelect: () => void }) {
  const source = sourceLabel(plugin.source);
  const version = plugin.version || "—";
  return (
    <article className={`skill-card plugin-card ${active ? "on" : ""}`}>
      <button className="skill-card-main" onClick={onSelect}>
        <div className="skill-card-top">
          <div className="skill-card-badges">
            <span className={`skill-enabled-icon ${plugin.enabled ? "on" : "off"}`}>{plugin.enabled ? "✓" : "—"}</span>
          </div>
          <span className="tag muted">{categoryFor(plugin)}</span>
        </div>
        <div className="skill-title-row"><h2>{plugin.name}</h2></div>
        <p>{plugin.description || "No description reported for this plugin."}</p>
        <div className="skill-chips">
          <span>{statusLabel(plugin)}</span>
          <span>Source: {source}</span>
          <span>Version: {version}</span>
        </div>
        <div className="skill-triplet">
          <Mini label="Status" value={statusLabel(plugin)} />
          <Mini label="Source" value={source} />
          <Mini label="Version" value={version} />
        </div>
      </button>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div><b>{value}</b><span>{label}</span></div>
  );
}

function PluginListRow({ plugin, active, onSelect }: { plugin: PluginHubRecord; active: boolean; onSelect: () => void }) {
  return (
    <button className={`ops-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div><strong>{plugin.name}</strong><small>{plugin.description || "No description reported."}</small></div>
      <span className="tag muted">{categoryFor(plugin)}</span>
      <span className={plugin.enabled ? "status-pill ok" : "status-pill idle"}>{statusLabel(plugin)}</span>
      <span className="tag muted">{sourceLabel(plugin.source)}</span>
    </button>
  );
}

function PluginDrawer({ plugin, tab, setTab, onClose }: { plugin: PluginHubRecord; tab: PluginTab; setTab: (tab: PluginTab) => void; onClose: () => void }) {
  return (
    <SlideOverDrawer
      title={plugin.name}
      subtitle={`${categoryFor(plugin)} · ${statusLabel(plugin)} · ${sourceLabel(plugin.source)}`}
      onClose={onClose}
      width="wide"
      tabs={["overview", "setup"]}
      activeTab={tab}
      onTabChange={(next) => setTab(next as PluginTab)}
    >
      {tab === "overview" && (
        <div className="drawer-section stack">
          <p>{plugin.description || "No description reported for this Hermes plugin."}</p>
          <div className="drawer-kv"><span>Name</span><b>{plugin.name}</b></div>
          <div className="drawer-kv"><span>Status</span><b>{statusLabel(plugin)}</b></div>
          <div className="drawer-kv"><span>Category</span><b>{categoryFor(plugin)}</b></div>
          <div className="drawer-kv"><span>Source</span><b>{sourceLabel(plugin.source)}</b></div>
          <div className="drawer-kv"><span>Version</span><b>{plugin.version || "—"}</b></div>
        </div>
      )}
      {tab === "setup" && (
        <div className="drawer-section stack">
          <h3>CLI control</h3>
          <InfoTooltip className="form-help" label="About CLI plugin control">
            Mission Control lists plugin availability. Use the Hermes CLI to change plugin state so the runtime can reload safely.
          </InfoTooltip>
          <pre className="skill-source-pre">{`hermes plugins enable ${plugin.name}\nhermes plugins disable ${plugin.name}\nhermes plugins list --json`}</pre>
          <InfoTooltip className="form-help" label="About plugin reloads">
            Plugin changes may require a fresh Hermes session or gateway restart before capabilities appear in active conversations.
          </InfoTooltip>
        </div>
      )}
    </SlideOverDrawer>
  );
}
