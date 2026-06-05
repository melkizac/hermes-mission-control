import { useMemo, useState } from "react";
import type { Agent, ToolCapability } from "../types";
import { useStore } from "../services/store";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";

type ToolRecord = ToolCapability & {
  agents: Agent[];
  enabledAgents: number;
};

type ToolTab = "overview" | "agents" | "samples";
type ViewMode = "cards" | "list";

function toolKey(tool: ToolCapability) {
  return tool.id || tool.name;
}

function cap(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

export function ToolsHub() {
  const { agents, loading } = useStore();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<ToolTab>("overview");

  const records = useMemo(() => {
    const byId = new Map<string, ToolRecord>();
    agents.forEach((agent) => {
      (agent.tools ?? []).forEach((tool) => {
        const id = toolKey(tool);
        const existing = byId.get(id);
        if (existing) {
          existing.agents.push(agent);
          if (tool.enabled !== false) existing.enabledAgents += 1;
          return;
        }
        byId.set(id, {
          ...tool,
          id,
          agents: [agent],
          enabledAgents: tool.enabled === false ? 0 : 1,
        });
      });
    });
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [agents]);

  const sources = useMemo(() => Array.from(new Set(records.map((item) => item.source || "profile config"))).sort(), [records]);
  const kinds = useMemo(() => Array.from(new Set(records.map((item) => item.kind || "toolset"))).sort(), [records]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return records.filter((item) => {
      const haystack = [
        item.name,
        item.id,
        item.description,
        item.source,
        item.kind,
        ...(item.sampleTools ?? []),
        ...(item.categories ?? []).map((cat) => cat.name),
        ...item.agents.map((agent) => agent.name),
      ].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!source || (item.source || "profile config") === source) && (!kind || (item.kind || "toolset") === kind);
    });
  }, [records, q, source, kind]);

  const selectedTool = useMemo(() => records.find((item) => item.id === selected), [records, selected]);
  const totalToolCalls = records.reduce((sum, item) => sum + (item.toolCount ?? 0), 0);
  const enabledRecords = records.filter((item) => item.enabledAgents > 0).length;
  const categoryCount = new Set(records.flatMap((item) => (item.categories ?? []).map((cat) => cat.id))).size;

  const openTool = (tool: ToolRecord) => {
    setSelected(tool.id);
    setTab("overview");
  };

  return (
    <div className="skills-page tools-page skills-drawer-first scroll">
      <header className="skills-hero">
        <div>
          <span className="stub-tag">TOOL REGISTRY</span>
          <h1>Tools</h1>
          <p>
            System-wide view of executable agent capabilities. This aggregates the real tool capabilities reported by each Hermes profile so setup and governance stay visible outside the Agent drawer.
          </p>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh tools hub" title="Refresh tools hub" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Toolsets" value={records.length} sub="Capability groups" />
        <Metric label="Enabled" value={enabledRecords} sub="Available to agents" tone="good" />
        <Metric label="Tools" value={totalToolCalls} sub="Executable functions" />
        <Metric label="Categories" value={categoryCount} sub="Capability areas" />
      </section>

      <section className="skills-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="toolset, tool name, category, agent…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Tools view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
        <label>
          <span>Kind</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">All kinds</option>
            {kinds.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">All sources</option>
            {sources.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="skills-filter-note">Tools are executable capabilities from Hermes toolsets; Skills remain reusable procedures/playbooks. Agent assignment comes from the live /api/agents payload.</div>
      </section>

      {viewMode === "cards" ? (
        <section className="tools-grid skills-grid-full">
          <div className="skills-panel-head">
            <span>Executable capability cards</span>
            <small>{loading ? "Loading…" : `${filtered.length} shown`}</small>
          </div>
          {filtered.map((tool) => <ToolCard key={tool.id} tool={tool} active={tool.id === selectedTool?.id} onSelect={() => openTool(tool)} />)}
          {!loading && filtered.length === 0 && <div className="empty big">No tools matched this filter.</div>}
        </section>
      ) : (
        <section className="ops-list tools-list-view">
          <div className="ops-list-head"><span>Executable capability list</span><small>{loading ? "Loading…" : `${filtered.length} shown`}</small></div>
          {filtered.map((tool) => <ToolListRow key={tool.id} tool={tool} active={tool.id === selectedTool?.id} onSelect={() => openTool(tool)} />)}
          {!loading && filtered.length === 0 && <div className="empty big">No tools matched this filter.</div>}
        </section>
      )}

      {selectedTool && <ToolDrawer tool={selectedTool} tab={tab} setTab={setTab} onClose={() => setSelected(null)} />}
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

function ToolCard({ tool, active, onSelect }: { tool: ToolRecord; active: boolean; onSelect: () => void }) {
  return (
    <article className={`tool-registry-card skill-card ${active ? "on" : ""}`}>
      <button className="skill-card-main" onClick={onSelect}>
        <div className="skill-card-top">
          <div className="skill-card-badges">
            <span className={`skill-enabled-icon ${tool.enabledAgents > 0 ? "on" : "off"}`}>{tool.enabledAgents > 0 ? "✓" : "—"}</span>
          </div>
          <span className="tag muted">{tool.kind || "toolset"}</span>
        </div>
        <div className="skill-title-row"><h2>{tool.name}</h2></div>
        <p>{tool.description || "No description reported for this capability."}</p>
        <div className="skill-chips">
          <span>{tool.source || "profile config"}</span>
          <span>{tool.agents.length} agent{tool.agents.length === 1 ? "" : "s"}</span>
          <span>{tool.enabledAgents} enabled</span>
        </div>
        <div className="skill-triplet">
          <Mini label="Tools" value={tool.toolCount ?? "—"} />
          <Mini label="Categories" value={tool.categories?.length ?? 0} />
          <Mini label="Agents" value={tool.agents.length} />
        </div>
      </button>
    </article>
  );
}

function ToolListRow({ tool, active, onSelect }: { tool: ToolRecord; active: boolean; onSelect: () => void }) {
  return (
    <button className={`ops-row tools-list-row ${active ? "on" : ""}`} onClick={onSelect}>
      <div className="ops-row-main">
        <div className="ops-row-top">
          <b>{tool.name}</b>
          <span className={`tag ${tool.enabledAgents > 0 ? "good" : "muted"}`}>{tool.enabledAgents > 0 ? "Enabled" : "Disabled"}</span>
        </div>
        <p>{tool.description || "No description reported."}</p>
        <small className="mono">{tool.id}</small>
      </div>
      <div className="ops-row-meta">
        <span>{tool.toolCount ?? 0} tools</span>
        <small>{tool.kind || "toolset"} · {tool.source || "profile config"}</small>
        <em>{tool.agents.length} agent{tool.agents.length === 1 ? "" : "s"} · {tool.categories?.length ?? 0} categories</em>
      </div>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div><b>{value}</b><span>{label}</span></div>
  );
}

function ToolDrawer({ tool, tab, setTab, onClose }: { tool: ToolRecord; tab: ToolTab; setTab: (tab: ToolTab) => void; onClose: () => void }) {
  return (
    <SlideOverDrawer title={tool.name} subtitle={`${tool.kind || "toolset"} · ${tool.source || "profile config"}`} onClose={onClose} className="tool-drawer">
      <div className="tabs drawer-tabs">
        {(["overview", "agents", "samples"] as ToolTab[]).map((item) => (
          <button key={item} className={tab === item ? "tab on" : "tab"} onClick={() => setTab(item)}>{cap(item)}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="drawer-section-list">
          <div className="tool-card drawer-tool-card">
            <div className="tool-card-head">
              <div>
                <div className="fn">{tool.name}</div>
                <div className="fd">{tool.enabledAgents > 0 ? "Enabled somewhere" : "Not enabled"} · {tool.agents.length} agent profiles</div>
              </div>
              <span className="badge b-info">{tool.toolCount ?? 0} tools</span>
            </div>
            <p className="tool-desc">{tool.description || "No description reported for this capability."}</p>
            <div className="tool-cats">
              {(tool.categories ?? []).map((cat) => <span className="tool-chip" key={cat.id}>{cat.name}{typeof cat.count === "number" ? ` ${cat.count}` : ""}</span>)}
            </div>
          </div>
          <Info label="Capability ID" value={tool.id} mono />
          <Info label="Kind" value={tool.kind || "toolset"} />
          <Info label="Source" value={tool.source || "profile config"} />
        </div>
      )}

      {tab === "agents" && (
        <div className="drawer-section-list">
          {tool.agents.map((agent) => (
            <div className="filerow" key={agent.id}>
              <div className="fic" style={{ background: agent.color }}>{agent.initials}</div>
              <div>
                <div className="fn">{agent.name}</div>
                <div className="fd">{agent.squad} · {agent.profilePath}</div>
              </div>
              <span className={`badge ${agent.status === "offline" ? "b-err" : "b-info"}`}>{agent.statusLabel || agent.status}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "samples" && (
        <div className="drawer-section-list">
          {(tool.sampleTools ?? []).length > 0 ? <div className="tool-samples mono large">{(tool.sampleTools ?? []).join(", ")}</div> : <div className="empty big">No sample tool names reported.</div>}
        </div>
      )}
    </SlideOverDrawer>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="kv"><span>{label}</span><b className={mono ? "mono" : ""}>{value}</b></div>
  );
}
