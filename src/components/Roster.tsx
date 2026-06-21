import { useMemo, useState } from "react";
import { formatSingaporeShort } from "../utils/time";
import { useStore } from "../services/store";
import { AgentAvatar } from "./AgentAvatar";
import type { Agent, AgentStatus, ProjectChatResponse, ProjectChatSession } from "../types";

const statusMeta: Record<AgentStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "b-work", dot: "#15a34a" },
  idle: { label: "Idle / sleeping", cls: "b-idle", dot: "#aab2bf" },
  degraded: { label: "Degraded", cls: "b-wait", dot: "#e8941b" },
  offline: { label: "Offline", cls: "b-err", dot: "#dc4040" },
  working: { label: "Active", cls: "b-work", dot: "#15a34a" },
  waiting: { label: "Waiting · Human gate", cls: "b-wait", dot: "#e8941b" },
  error: { label: "Offline", cls: "b-err", dot: "#dc4040" },
};

type Filter = "all" | "active" | "idle" | "offline";

function relationshipLabel(value?: string) {
  const raw = (value || "discussion").replace(/[_-]+/g, " ").trim();
  return raw ? raw.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Discussion";
}

function sessionLabel(session?: ProjectChatSession) {
  if (!session) return "All human chats";
  const title = session.title.replace(/\s+/g, " ").trim() || session.id.slice(0, 12);
  const when = formatSingaporeShort(session.started_at);
  const origin = session.origin || (session.source ? session.source.replace(/_/g, " ") : "chat");
  const relation = relationshipLabel(session.relationship_type);
  const linked = session.link_source === "canonical" ? relation : `${relation} · suggested`;
  return `${title.slice(0, 40)} · ${linked} · ${origin} · ${when}`;
}

function agentGroupLabel(name: string) {
  return name.replace(/channels/gi, (match) => (match[0] === "C" ? "Groups" : "groups"));
}

interface RosterProps {
  projectChats?: ProjectChatResponse | null;
  selectedProjectId?: string;
  selectedSessionId?: string;
  onProjectChange?: (id: string) => void;
  onSessionChange?: (id: string) => void;
  projectChatError?: string | null;
  projectChatsHydrating?: boolean;
}

export function Roster({
  projectChats,
  selectedProjectId = "all",
  selectedSessionId = "all",
  onProjectChange,
  onSessionChange,
  projectChatError,
  projectChatsHydrating = false,
}: RosterProps) {
  const { agents, selectedId, select } = useStore();
  const [filter, setFilter] = useState<Filter>("all");

  const projectSessions = useMemo(
    () => (projectChats?.sessions ?? []).filter((session) => selectedProjectId === "all" || session.project_id === selectedProjectId),
    [projectChats, selectedProjectId],
  );
  const selectedSession = useMemo(() => projectSessions.find((session) => session.id === selectedSessionId), [projectSessions, selectedSessionId]);
  const activeProject = useMemo(() => projectChats?.projects.find((project) => project.id === selectedProjectId), [projectChats, selectedProjectId]);

  const counts = useMemo(() => {
    const c = { all: agents.length, active: 0, idle: 0, degraded: 0, offline: 0 };
    for (const a of agents) {
      const status = a.status === "working" ? "active" : a.status === "error" ? "offline" : a.status;
      if (status === "active") c.active++;
      if (status === "idle") c.idle++;
      if (status === "degraded" || a.status === "waiting") c.degraded++;
      if (status === "offline") c.offline++;
    }
    return c;
  }, [agents]);

  const squads = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agents) {
      const label = agentGroupLabel(a.squad);
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    return [...m.entries()];
  }, [agents]);

  const visible = agents.filter((a) => {
    if (filter === "all") return true;
    const status = a.status === "working" ? "active" : a.status === "error" ? "offline" : a.status === "waiting" ? "degraded" : a.status;
    return status === filter;
  });

  const filterOptions: Array<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "active", label: "Active", count: counts.active },
    { value: "idle", label: "Idle", count: counts.idle },
    { value: "offline", label: "Offline", count: counts.offline },
  ];

  return (
    <div className="roster">
      <div className="rhead">
        <h2>Agent</h2>
        <label className="agent-status-filter">
          <span className="sr-only">Filter agents by status</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter agents by status">
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} {option.count}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="left-chat-scope" aria-label="Project chat organization controls">
        <div className="glabel">Chats</div>
        <label>
          <span>Context</span>
          <select
            value={selectedProjectId}
            onChange={(e) => onProjectChange?.(e.target.value)}
            disabled={projectChatsHydrating && !projectChats}
            aria-busy={projectChatsHydrating && !projectChats}
          >
            <option value="all">General chat · all contexts</option>
            {(projectChats?.projects ?? []).map((project) => {
              const chatCount = project.chats ?? project.sessions;
              return (
                <option key={project.id} value={project.id}>
                  {project.name} · {chatCount ? `${chatCount} ${chatCount === 1 ? "chat" : "chats"}` : "no chats yet"}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          <span>Conversation</span>
          <select
            value={selectedSessionId}
            onChange={(e) => onSessionChange?.(e.target.value)}
            disabled={projectChatsHydrating && !projectChats}
            aria-busy={projectChatsHydrating && !projectChats}
          >
            <option value="all">{projectChatsHydrating && !projectChats ? "Loading saved chats…" : "All human chats"}</option>
            {projectSessions.slice(0, 80).map((session) => (
              <option key={session.id} value={session.id}>
                {sessionLabel(session)}
              </option>
            ))}
          </select>
        </label>
        <div className="left-chat-summary">
          {projectChatError
            ? projectChatError
            : projectChatsHydrating && !projectChats
              ? "Chat context controls are loading in the background — composer is ready now."
            : selectedSession
              ? `${selectedSession.project_name} · ${relationshipLabel(selectedSession.relationship_type)}${selectedSession.summary ? ` · ${selectedSession.summary.slice(0, 90)}` : ""}${selectedSession.linked_by ? ` · linked by ${selectedSession.linked_by}` : ""}`
              : selectedProjectId === "all"
                ? `${projectChats?.summary.chats ?? projectChats?.summary.sessions ?? 0} saved human chats · ${projectChats?.summary.canonical_links ?? 0} canonical links${projectChats?.summary.heuristic_links ? ` · ${projectChats.summary.heuristic_links} suggested` : ""}`
                : `${activeProject?.name ?? "Context"} · ${projectSessions.length} visible chats · ${activeProject?.kanban_tenant ? `tenant ${activeProject.kanban_tenant}` : "canonical context"}`}
        </div>
      </div>

      <div className="group">
        <div className="glabel">Agent Groups</div>
        {squads.map(([name, n]) => (
          <div className="squad" key={name}>
            <span className="ic">◷</span> {name} <span className="c">{n}</span>
          </div>
        ))}
      </div>

      <div className="alist scroll">
        <div className="glabel" style={{ paddingLeft: 0 }}>
          {filter === "all" ? "All agents" : statusMeta[filter].label}
        </div>
        {visible.map((a) => (
          <AgentRow key={a.id} agent={a} active={a.id === selectedId} onClick={() => select(a.id)} />
        ))}
        {visible.length === 0 && <div className="empty">No agents match this filter.</div>}
      </div>
    </div>
  );
}

function AgentRow({ agent, active, onClick }: { agent: Agent; active: boolean; onClick: () => void }) {
  const m = statusMeta[agent.status];
  return (
    <button className={"agent" + (active ? " on" : "")} onClick={onClick}>
      <AgentAvatar agent={agent} />
      <span className="a-main">
        <span className="a-top">
          <span className="a-name">{agent.name}</span>
          <span className="a-time">{agent.lastActive}</span>
        </span>
        <span className="a-sub">{agent.activity}</span>
        <span className={"badge " + m.cls}>
          <span className="sdot" style={{ background: m.dot }} />
          {agent.statusLabel || m.label}
        </span>
      </span>
    </button>
  );
}
