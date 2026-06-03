import { useMemo, useState } from "react";
import { useStore } from "../services/store";
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

function sessionLabel(session?: ProjectChatSession) {
  if (!session) return "All sessions";
  return session.title.replace(/\s+/g, " ").trim().slice(0, 54) || session.id.slice(0, 12);
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
}

export function Roster({
  projectChats,
  selectedProjectId = "all",
  selectedSessionId = "all",
  onProjectChange,
  onSessionChange,
  projectChatError,
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

  return (
    <div className="roster">
      <div className="rhead">
        <h2>Agent</h2>
      </div>

      <div className="left-chat-scope" aria-label="Project chat organization controls">
        <div className="glabel">Chat sessions</div>
        <label>
          <span>Project</span>
          <select value={selectedProjectId} onChange={(e) => onProjectChange?.(e.target.value)}>
            <option value="all">Global Command Chat</option>
            {(projectChats?.projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.sessions}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Session</span>
          <select value={selectedSessionId} onChange={(e) => onSessionChange?.(e.target.value)}>
            <option value="all">All sessions</option>
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
            : selectedSession
              ? `${selectedSession.project_name} · ${selectedSession.source}`
              : selectedProjectId === "all"
                ? `${projectChats?.summary.sessions ?? 0} sessions across projects`
                : `${activeProject?.name ?? "Project"} · ${projectSessions.length} sessions`}
        </div>
      </div>

      <div className="seg">
        {(["all", "active", "idle", "offline"] as Filter[]).map((f) => (
          <button
            key={f}
            className={"chip" + (filter === f ? " on" : "")}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : statusMeta[f].label.split(" ")[0]}{" "}
            <span className="n">{counts[f]}</span>
          </button>
        ))}
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
      <span className="av" style={{ background: agent.color }}>
        {agent.initials}
      </span>
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
