import { useMemo, useState } from "react";
import type { Agent, ToolCapability } from "../types";
import { useStore } from "../services/store";
import { SlideOverDrawer } from "../components/SlideOverDrawer";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

type ToolRecord = ToolCapability & {
  agents: Agent[];
  enabledAgents: number;
};

type ToolTab = "overview" | "agents" | "tools";
type ViewMode = "cards" | "list";

function toolKey(tool: ToolCapability) {
  return tool.id || tool.name;
}

function cap(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : "—";
}

function displayType(value?: string) {
  const raw = String(value || "tool").toLowerCase();
  if (raw === "mcp-server") return "MCP server";
  if (raw === "cli-tool") return "CLI tool";
  if (raw === "toolset") return "Toolset";
  return cap(raw.replace(/-/g, " "));
}

function displaySource(value?: string) {
  const raw = String(value || "config.yaml").toLowerCase();
  if (raw.includes("openclaw")) return "OpenClaw";
  if (raw.includes("shared")) return "Shared";
  if (raw.includes("mission control") || raw.includes("user") || raw.includes("mcp_servers")) return "User";
  if (raw.includes("config.yaml") || raw.includes("profile config") || raw.includes("hermes")) return "Hermes";
  return cap(String(value || "Hermes"));
}

export function ToolsHub() {
  const { agents, loading } = useStore();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [kind, setKind] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<ToolTab>("overview");
  const [installOpen, setInstallOpen] = useState(false);
  const [installKind, setInstallKind] = useState<"mcp" | "cli">("mcp");
  const [toolName, setToolName] = useState("");
  const [toolCommand, setToolCommand] = useState("npx");
  const [toolArgs, setToolArgs] = useState("-y ");
  const [toolUrl, setToolUrl] = useState("");
  const [toolDescription, setToolDescription] = useState("");
  const [installStatus, setInstallStatus] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

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

  const visibleRecords = useMemo(() => records.filter((item) => item.kind !== "toolset" && item.name !== "Full Hermes CLI tools" && item.id !== "hermes-cli"), [records]);
  const sources = useMemo(() => Array.from(new Set(visibleRecords.map((item) => displaySource(item.source)))).sort(), [visibleRecords]);
  const kinds = useMemo(() => Array.from(new Set(visibleRecords.map((item) => displayType(item.kind)))).sort(), [visibleRecords]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return visibleRecords.filter((item) => {
      const itemSource = displaySource(item.source);
      const itemKind = displayType(item.kind);
      const haystack = [
        item.name,
        item.id,
        item.description,
        itemSource,
        itemKind,
        item.source,
        item.kind,
        item.toolName,
        item.parentToolsetId,
        item.parentToolsetName,
        item.assignmentUnit,
        ...(item.sampleTools ?? []),
        ...(item.toolNames ?? []),
        ...(item.categories ?? []).map((cat) => cat.name),
        ...item.agents.map((agent) => agent.name),
      ].join(" ").toLowerCase();
      return (!needle || haystack.includes(needle)) && (!source || itemSource === source) && (!kind || itemKind === kind);
    });
  }, [visibleRecords, q, source, kind]);

  const selectedTool = useMemo(() => visibleRecords.find((item) => item.id === selected), [visibleRecords, selected]);
  const individualTools = visibleRecords.filter((item) => item.kind === "tool");
  const totalToolCalls = individualTools.length || visibleRecords.length;
  const enabledRecords = filtered.filter((item) => item.enabledAgents > 0).length;
  const categoryCount = new Set(visibleRecords.flatMap((item) => (item.categories ?? []).map((cat) => cat.id))).size;

  const openTool = (tool: ToolRecord) => {
    setSelected(tool.id);
    setTab("overview");
  };

  const installTool = async () => {
    setInstalling(true);
    setInstallStatus(null);
    try {
      const body = installKind === "mcp"
        ? { kind: "mcp", name: toolName, command: toolUrl.trim() ? undefined : toolCommand, args: toolUrl.trim() ? undefined : toolArgs, url: toolUrl.trim() || undefined, description: toolDescription }
        : { kind: "cli", name: toolName, command: toolCommand, description: toolDescription, installCommand: toolArgs };
      const res = await fetch("/api/tools/install", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || res.statusText);
      setInstallStatus(payload.restart_required ? "Installed. Restart Hermes to discover MCP tools." : "Installed in Mission Control registry.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setInstallStatus(err instanceof Error ? err.message : "Unable to install tool");
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="skills-page tools-page skills-drawer-first scroll">
      <header className="skills-hero">
        <div>
          <span className="stub-tag">TOOL REGISTRY</span>
          <div className="hero-title-with-help">
            <h1>Tools</h1>
            <InfoTooltip label="About Tools">
              Mission Control lists each executable tool as an assignment-ready capability. Use Type and Source to see whether a capability comes from Hermes, User-installed integrations, or another connected runtime.
            </InfoTooltip>
          </div>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh tools hub" title="Refresh tools hub" onClick={() => window.location.reload()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Tools" value={totalToolCalls} sub="Assignment-ready functions" />
        <Metric label="Enabled" value={enabledRecords} sub="Shown in current filter" tone="good" />
        <Metric label="Sources" value={sources.length} sub="Hermes, User, and runtimes" />
        <Metric label="Categories" value={categoryCount} sub="Capability areas" />
      </section>

      <section className="skills-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="tool name, type, source, category, agent…" />
          </label>
          <div className="view-switch filter-view-switch" aria-label="Tools view mode">
            <button className={viewMode === "cards" ? "on" : ""} onClick={() => setViewMode("cards")}>Cards</button>
            <button className={viewMode === "list" ? "on" : ""} onClick={() => setViewMode("list")}>List</button>
          </div>
        </div>
        <label>
          <span>Type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="">All types</option>
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
        <InfoTooltip className="filter-help" label="About tool filters">
          Tool cards show executable capabilities only. Source labels identify whether each tool is from Hermes, User-installed integrations, or another connected runtime.
        </InfoTooltip>
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

      {installOpen && (
        <div className="drawer-scrim" onClick={() => setInstallOpen(false)}>
          <div className="modal install-modal" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-head"><b>Install MCP / CLI tool</b><button className="iconbtn" onClick={() => setInstallOpen(false)}>×</button></div>
            <div className="modal-body install-form">
              <label className="field"><span>Type</span><select value={installKind} onChange={(event) => setInstallKind(event.target.value as "mcp" | "cli")}><option value="mcp">MCP server</option><option value="cli">CLI tool</option></select></label>
              <label className="field"><span>Name</span><input value={toolName} onChange={(event) => setToolName(event.target.value)} placeholder="time, github, filesystem" /></label>
              {installKind === "mcp" && <label className="field"><span>HTTP URL (optional)</span><input value={toolUrl} onChange={(event) => setToolUrl(event.target.value)} placeholder="https://example.com/mcp — leave blank for stdio" /></label>}
              <label className="field"><span>{installKind === "mcp" ? "Command" : "Executable command"}</span><input value={toolCommand} onChange={(event) => setToolCommand(event.target.value)} placeholder={installKind === "mcp" ? "npx or uvx" : "gh, linear, custom-cli"} disabled={installKind === "mcp" && Boolean(toolUrl.trim())} /></label>
              <label className="field"><span>{installKind === "mcp" ? "Args" : "Install / setup note"}</span><textarea value={toolArgs} onChange={(event) => setToolArgs(event.target.value)} rows={4} placeholder={installKind === "mcp" ? "-y @modelcontextprotocol/server-time" : "npm install -g … / pipx install …"} /></label>
              <label className="field"><span>Description</span><input value={toolDescription} onChange={(event) => setToolDescription(event.target.value)} placeholder="What this tool enables" /></label>
              <InfoTooltip className="form-help" label="About tool installs">
                MCP installs update ~/.hermes/config.yaml under mcp_servers and require a Hermes restart before discovered tools appear. CLI installs are registered for operators without running arbitrary shell commands.
              </InfoTooltip>
              {installStatus && <div className="skills-error install-status">{installStatus}</div>}
            </div>
            <div className="drawer-foot"><button className="btn" onClick={() => setInstallOpen(false)}>Close</button><button className="btn dark" disabled={installing || !toolName.trim() || (!toolUrl.trim() && !toolCommand.trim())} onClick={() => void installTool()}>{installing ? "Installing…" : "Install"}</button></div>
          </div>
        </div>
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
          <span className="tag muted">{displayType(tool.kind)}</span>
        </div>
        <div className="skill-title-row"><h2>{tool.name}</h2></div>
        <p>{tool.description || "No description reported for this capability."}</p>
        <div className="skill-chips">
          <span>Type: {displayType(tool.kind)}</span>
          <span>Source: {displaySource(tool.source)}</span>
          <span>{tool.agents.length} agent{tool.agents.length === 1 ? "" : "s"}</span>
          <span>{tool.enabledAgents} enabled</span>
        </div>
        <div className="skill-triplet">
          <Mini label={tool.kind === "tool" ? "Assign as" : "Tools"} value={tool.assignmentUnit || tool.toolName || tool.toolCount || "—"} />
          <Mini label="Category" value={tool.categories?.[0]?.name ?? (tool.categories?.length ?? 0)} />
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
        <small className="mono">{tool.kind === "tool" ? (tool.toolName || tool.id) : tool.id}</small>
      </div>
      <div className="ops-row-meta">
        <span>{tool.toolCount ?? 0} tools</span>
        <small>{displayType(tool.kind)} · Source: {displaySource(tool.source)}</small>
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
    <SlideOverDrawer title={tool.name} subtitle={`${displayType(tool.kind)} · Source: ${displaySource(tool.source)}`} onClose={onClose} className="tool-drawer">
      <div className="tabs drawer-tabs">
        {(["overview", "agents", "tools"] as ToolTab[]).map((item) => (
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
          {tool.assignmentUnit && <Info label="Assignment key" value={tool.assignmentUnit} mono />}
          <Info label="Type" value={displayType(tool.kind)} />
          <Info label="Source" value={displaySource(tool.source)} />
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

      {tab === "tools" && (
        <div className="drawer-section-list">
          {tool.kind === "tool" ? (
            <div className="tool-samples mono large">{tool.toolName || tool.assignmentUnit || tool.id.replace(/^tool:/, "")}</div>
          ) : (tool.toolNames ?? tool.sampleTools ?? []).length > 0 ? (
            <div className="individual-tool-list">
              {(tool.toolNames ?? tool.sampleTools ?? []).map((name) => (
                <span className="individual-tool-chip mono" key={name}>{name}</span>
              ))}
            </div>
          ) : (
            <div className="empty big">No individual tool names reported.</div>
          )}
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
