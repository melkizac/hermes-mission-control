import { useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, ConfigFile } from "../types";
import { FileEditorDrawer } from "./FileEditorDrawer";

type Tab = "overview" | "identity" | "skills" | "output" | "tasks";

const taskStatusCls: Record<string, string> = {
  running: "b-work",
  blocked: "b-wait",
  queued: "b-idle",
  done: "b-work",
  error: "b-err",
};

export function ContextPanel({
  agent,
  collapsed,
  onToggle,
  drawer,
  onClose,
}: {
  agent: Agent;
  collapsed?: boolean;
  onToggle?: () => void;
  drawer?: boolean;
  onClose?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState<ConfigFile | null>(null);
  const { addSkill, removeSkill, deleteAgent } = useStore();

  const onAddSkill = () => {
    const name = window.prompt("Skill to install (from Hub or your repo):");
    if (name) void addSkill({ id: Math.random().toString(36).slice(2), name, source: "hub" });
  };

  if (collapsed) {
    return (
      <aside className="ctx ctx-collapsed" aria-label="Collapsed selected agent details">
        <button className="ctx-toggle vertical" onClick={onToggle} title="Expand selected agent details">
          ⟨
        </button>
        <div className="ctx-mini-av" style={{ background: agent.color }}>
          {agent.initials}
        </div>
        <div className="ctx-mini-label">Agent details</div>
      </aside>
    );
  }

  const identityFiles = agent.files.filter((f) => ["soul", "memory", "agents", "config"].includes(f.kind));
  const otherFiles = agent.files.filter((f) => !identityFiles.includes(f));
  const skillsByCategory = agent.skills.reduce<Record<string, typeof agent.skills>>((acc, skill) => {
    const key = skill.category || "uncategorized";
    acc[key] = [...(acc[key] ?? []), skill];
    return acc;
  }, {});

  return (
    <aside className={"ctx" + (drawer ? " agent-detail-drawer" : "")} aria-label={`Selected agent details for ${agent.name}`}>
      <div className="ctx-head agent-drawer-head">
        <div>
          <div className="sec-l tight">Selected agent</div>
          <div className="ctx-title">{agent.name}</div>
          <div className="ctx-sub">
            {agent.squad} · {agent.id}
          </div>
        </div>
        {drawer ? (
          <button className="agent-drawer-close" onClick={onClose} title="Close selected agent details" aria-label="Close selected agent details">
            ×
          </button>
        ) : (
          <button className="ctx-toggle" onClick={onToggle} title="Collapse selected agent details">
            ⟩
          </button>
        )}
      </div>

      <div className="tabs tabs-wrap">
        {(["overview", "identity", "skills", "output", "tasks"] as Tab[]).map((t) => (
          <button key={t} className={"tab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "identity" ? "Identity" : t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="ctxbody scroll">
        {tab === "overview" && (
          <>
            <div className="agent-brief">
              <span className="av" style={{ background: agent.color }}>
                {agent.initials}
              </span>
              <div>
                <b>{agent.name}</b>
                <p>{agent.activity}</p>
              </div>
            </div>

            <div className="sec-l">Runtime</div>
            <Info k="Model" v={<span className="mono">{agent.model}</span>} />
            <Info k="Profile" v={<span className="mono">{agent.profilePath}</span>} />
            <Info k="Status" v={<span className={agent.status === "working" ? "hi" : ""}>{cap(agent.status)}</span>} />
            <Info k="Uptime" v={agent.uptime} />
            <Info k="Sessions" v={String(agent.sessionCount)} />
            <Info k="Last active" v={agent.lastActive} />

            <div className="detail-stats">
              <div>
                <b>{identityFiles.length}</b>
                <span>identity files</span>
              </div>
              <div>
                <b>{agent.skills.length}</b>
                <span>assigned skills</span>
              </div>
              <div>
                <b>{agent.tasks.length}</b>
                <span>tasks</span>
              </div>
            </div>

            <div className="sec-l">Identity files</div>
            {identityFiles.slice(0, 5).map((f) => (
              <FileRow key={f.name} file={f} onOpen={() => setEditing(f)} />
            ))}
            {identityFiles.length === 0 && <div className="empty">No identity files found for this profile.</div>}

            <div className="sec-l">Skills · {agent.skills.length}</div>
            <div className="skills">
              {agent.skills.slice(0, 16).map((s) => (
                <span className="skill" key={s.id}>
                  {s.name}
                  <span className="x" onClick={() => void removeSkill(s.id)} title="Remove">
                    ×
                  </span>
                </span>
              ))}
              <span className="skill add" onClick={onAddSkill}>
                + Add skill
              </span>
            </div>
            {agent.skills.length > 16 && <div className="mini-note">+ {agent.skills.length - 16} more skills in the Skills tab.</div>}

            <div className="sec-l">AI insights</div>
            <div className="aicard">
              <div className="h">✦ Current task</div>
              <p>{agent.insightSummary}</p>
              {agent.insightStatus && (
                <div className="st">
                  Status <b>{agent.insightStatus}</b>
                </div>
              )}
            </div>

            <button className="danger" onClick={() => confirmDelete(agent, deleteAgent)}>
              Delete agent…
            </button>
          </>
        )}

        {tab === "identity" && (
          <>
            <div className="sec-l">Identity and profile files · {agent.files.length}</div>
            {agent.files.map((f) => (
              <FileRow key={f.name} file={f} onOpen={() => setEditing(f)} />
            ))}
            {otherFiles.length > 0 && <div className="mini-note">Includes {otherFiles.length} supporting profile file(s).</div>}
          </>
        )}

        {tab === "skills" && (
          <>
            <div className="sec-l">Skills assigned to this agent · {agent.skills.length}</div>
            {Object.entries(skillsByCategory).map(([category, skills]) => (
              <div className="skill-group" key={category}>
                <div className="skill-group-head">
                  {category} <span>{skills.length}</span>
                </div>
                <div className="skills detail-skills">
                  {skills.map((s) => (
                    <span className="skill" key={s.id} title={s.source ?? "local"}>
                      {s.name}
                      {s.source && <em>{s.source}</em>}
                      <span className="x" onClick={() => void removeSkill(s.id)} title="Remove">
                        ×
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {agent.skills.length === 0 && <div className="empty">No skills assigned to this profile.</div>}
            <button className="btn full" onClick={onAddSkill}>
              + Add skill
            </button>
          </>
        )}

        {tab === "output" && (
          <>
            <div className="sec-l">Workspace · {agent.profilePath}/workspace</div>
            {agent.artifacts.length === 0 && <div className="empty">No output yet.</div>}
            {agent.artifacts.map((a) => (
              <div className="filerow" key={a.id}>
                <div className="fic">▦</div>
                <div>
                  <div className="fn">{a.filename}</div>
                  <div className="fd">
                    {a.preview ?? a.mime} · {Math.round(a.sizeBytes / 1000)} KB
                  </div>
                </div>
                <div className="acts">
                  <span title="Open">
                    <Icon name="download" size={14} />
                  </span>
                </div>
              </div>
            ))}
            <div className="sec-l">Latest preview</div>
            <div className="canvasprev">
              {agent.artifacts[0]?.preview ?? "Select an artifact to preview it here."}
            </div>
          </>
        )}

        {tab === "tasks" && (
          <>
            <div className="sec-l">Tasks · {agent.tasks.length}</div>
            {agent.tasks.length === 0 && <div className="empty">No tasks.</div>}
            {agent.tasks.map((t) => (
              <div className="taskrow" key={t.id}>
                <div>
                  <div className="fn" style={{ fontFamily: "inherit" }}>
                    {t.title}
                  </div>
                  <div className="fd">{t.updatedAt}</div>
                </div>
                <span className={"badge " + (taskStatusCls[t.status] ?? "b-idle")}>{t.status}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {editing && <FileEditorDrawer file={editing} onClose={() => setEditing(null)} />}
    </aside>
  );
}

function FileRow({ file, onOpen }: { file: ConfigFile; onOpen: () => void }) {
  return (
    <div className="filerow" onClick={onOpen}>
      <div className="fic">{fileGlyph(file.kind)}</div>
      <div>
        <div className="fn">{file.name}</div>
        <div className="fd">
          {file.label} · {file.updatedAt} · {Math.round(file.sizeBytes / 1000)} KB
        </div>
      </div>
      <div className="acts">
        <span title="Edit">
          <Icon name="edit" size={14} />
        </span>
        <span title="Download">
          <Icon name="download" size={14} />
        </span>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="info">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

function fileGlyph(kind: string) {
  return kind === "soul" ? "◆" : kind === "memory" ? "☷" : kind === "agents" ? "⌗" : "⚙";
}

function confirmDelete(agent: Agent, del: (id: string) => Promise<void>) {
  if (window.confirm(`Archive agent "${agent.name}"? Its profile config is kept (soft delete).`)) {
    void del(agent.id);
  }
}
