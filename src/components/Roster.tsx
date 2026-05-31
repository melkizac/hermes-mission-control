import { useMemo, useState } from "react";
import { useStore } from "../services/store";
import type { Agent, AgentStatus } from "../types";


const statusMeta: Record<AgentStatus, { label: string; cls: string; dot: string }> = {
  working: { label: "Working", cls: "b-work", dot: "#15a34a" },
  waiting: { label: "Waiting · Approval", cls: "b-wait", dot: "#e8941b" },
  idle: { label: "Idle", cls: "b-idle", dot: "#aab2bf" },
  error: { label: "Error", cls: "b-err", dot: "#dc4040" },
  offline: { label: "Offline", cls: "b-idle", dot: "#aab2bf" },
};

type Filter = "all" | "working" | "waiting" | "error";

export function Roster() {
  const { agents, selectedId, select } = useStore();
  const [filter, setFilter] = useState<Filter>("all");


  const counts = useMemo(() => {
    const c = { all: agents.length, working: 0, waiting: 0, error: 0 };
    for (const a of agents) {
      if (a.status === "working") c.working++;
      if (a.status === "waiting") c.waiting++;
      if (a.status === "error") c.error++;
    }
    return c;
  }, [agents]);

  const squads = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agents) m.set(a.squad, (m.get(a.squad) ?? 0) + 1);
    return [...m.entries()];
  }, [agents]);

  const visible = agents.filter((a) => filter === "all" || a.status === filter);

  return (
    <div className="roster">
      <div className="rhead">
        <h2>Agent</h2>
      </div>

      <div className="seg">
        {(["all", "working", "waiting", "error"] as Filter[]).map((f) => (
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
        <div className="glabel">Squads</div>
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
          {m.label}
        </span>
      </span>
    </button>
  );
}
