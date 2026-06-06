import { useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, ConfigFile } from "../types";
import { FileEditorDrawer } from "./FileEditorDrawer";

type Tab = "overview" | "profile" | "identity" | "tools" | "skills" | "output" | "tasks";

const taskStatusCls: Record<string, string> = {
  running: "b-work",
  blocked: "b-wait",
  queued: "b-idle",
  done: "b-work",
  error: "b-err",
};

function agentGroupLabel(name: string) {
  return name.replace(/channels/gi, (match) => (match[0] === "C" ? "Groups" : "groups"));
}

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
  const { addSkill, removeSkill, deleteAgent, permissions } = useStore();
  const canEditAgent = permissions.canEditGlobalAgents;
  const canEditAgentIdentity = permissions.canEditAgentIdentity;
  const canEditFile = (file: ConfigFile) => canEditAgent || Boolean(file.editable) || (canEditAgentIdentity && file.kind === "soul");

  const onAddSkill = () => {
    if (!canEditAgent) return;
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
            {agentGroupLabel(agent.squad)} · {agent.id}
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
        {(["overview", "profile", "identity", "tools", "skills", "output", "tasks"] as Tab[]).map((t) => (
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
            <Info k="Status" v={<span className={agent.status === "active" || agent.status === "working" ? "hi" : ""}>{agent.statusLabel || cap(agent.status)}</span>} />
            <Info k="Availability" v={agent.availability || "—"} />
            <Info k="Activity" v={agent.activityState || agent.statusDetail || "—"} />
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
              <FileRow key={`${f.scope || "profile"}-${f.name}`} file={f} disabled={!canEditFile(f)} onOpen={() => { if (canEditFile(f)) setEditing(f); }} />
            ))}
            {identityFiles.length === 0 && <div className="empty">No identity files found for this profile.</div>}

            <div className="sec-l">Skills · {agent.skills.length}</div>
            <div className="skills">
              {agent.skills.slice(0, 16).map((s) => (
                <span className="skill" key={s.id}>
                  {s.name}
                  {canEditAgent && (
                    <span className="x" onClick={() => void removeSkill(s.id)} title="Remove">
                      ×
                    </span>
                  )}
                </span>
              ))}
              {canEditAgent ? (
                <span className="skill add" onClick={onAddSkill}>
                  + Add skill
                </span>
              ) : (
                <span className="skill readonly">Read-only workspace selection</span>
              )}
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

            {canEditAgent && (
              <button className="danger" onClick={() => confirmDelete(agent, deleteAgent)}>
                Delete agent…
              </button>
            )}
          </>
        )}

        {tab === "profile" && (
          <>
            <div className="sec-l">Profile runtime</div>
            <p className="mini-note">Hermes profile = isolated runtime identity/configuration. Secret values are never shown here.</p>
            <Info k="Profile" v={<span className="mono">{agent.profile_details?.profile_id || agent.id}</span>} />
            <Info k="Identity" v={agent.profile_details?.identity?.name || agent.name} />
            <Info k="Provider" v={agent.profile_details?.model_routing?.provider || "runtime default"} />
            <Info k="Model" v={<span className="mono">{agent.profile_details?.model_routing?.model || agent.model}</span>} />
            <Info k="Toolsets" v={String(agent.profile_details?.toolsets?.length ?? agent.tools?.length ?? 0)} />
            <Info k="Skills" v={String(agent.skills.length)} />
            <Info k="Memory" v={`${agent.profile_details?.memory?.entries ?? 0} entries`} />
            <Info k="Sessions" v={String(agent.profile_details?.sessions?.count ?? agent.sessionCount)} />
            <Info k="Plugins" v={`${agent.profile_details?.plugins?.enabled ?? 0}/${agent.profile_details?.plugins?.total ?? 0} enabled`} />
            <Info k="Routines" v={String(agent.profile_details?.routines?.count ?? agent.tasks.length)} />
            <Info k="Gateway channels" v={`${(agent.profile_details?.gateway?.channels ?? []).filter((c) => c.enabled).length}/${agent.profile_details?.gateway?.channels?.length ?? 0} enabled`} />
            <Info k="Credential scope" v={(agent.profile_details?.environment?.env_files?.length ?? 0) ? `${agent.profile_details?.environment?.env_files?.length} env file(s), values hidden` : "No env file reported"} />

            <div className="sec-l">Gateway / channels</div>
            <div className="skills detail-skills">
              {(agent.profile_details?.gateway?.channels ?? []).map((channel) => <span className="skill" key={channel.id}>{channel.id}<em>{channel.enabled ? "enabled" : "disabled"}</em></span>)}
              {!(agent.profile_details?.gateway?.channels ?? []).length && <span className="skill readonly">No configured platform channels found</span>}
            </div>

            <div className="sec-l">Plugins</div>
            <div className="skills detail-skills">
              {(agent.profile_details?.plugins?.items ?? []).map((plugin) => <span className="skill" key={plugin.id}>{plugin.name}<em>{plugin.status || "enabled"}</em></span>)}
              {!(agent.profile_details?.plugins?.items ?? []).length && <span className="skill readonly">No enabled plugins reported</span>}
            </div>

            <div className="sec-l">Memory scope</div>
            {(agent.profile_details?.memory?.files ?? []).map((file) => <Info key={file.name} k={file.name} v={`${file.entries} entries · ${file.updated_at || "—"}`} />)}
            {!(agent.profile_details?.memory?.files ?? []).length && <div className="empty">No profile memory files found.</div>}

            <div className="sec-l">Credential / environment readiness</div>
            {(agent.profile_details?.environment?.env_files ?? []).map((file) => <Info key={file.name} k={file.name} v={`${file.status} · ${file.variable_count} variables · ${file.sensitive_count} sensitive names hidden`} />)}
            {!(agent.profile_details?.environment?.env_files ?? []).length && <div className="empty">No profile env file reported.</div>}
            <p className="mini-note">{agent.profile_details?.environment?.policy || "Names and values are hidden; only readiness counts are shown."}</p>

            <div className="sec-l">Config files</div>
            <div className="skills detail-skills">
              {(agent.profile_details?.config_files ?? []).map((file) => <span className="skill" key={file.name}>{file.name}<em>{file.kind || "config"}</em></span>)}
              {!(agent.profile_details?.config_files ?? []).length && <span className="skill readonly">No profile config files reported</span>}
            </div>
          </>
        )}

        {tab === "identity" && (
          <>
            <div className="sec-l">Identity and profile files · {agent.files.length}</div>
            {agent.files.map((f) => (
              <FileRow key={`${f.scope || "profile"}-${f.name}`} file={f} disabled={!canEditFile(f)} onOpen={() => { if (canEditFile(f)) setEditing(f); }} />
            ))}
            {otherFiles.length > 0 && <div className="mini-note">Includes {otherFiles.length} supporting profile file(s).</div>}
          </>
        )}

        {tab === "tools" && (
          <>
            <div className="sec-l">Tool capabilities · {agent.tools?.length ?? 0}</div>
            {(agent.tools ?? []).map((toolset) => (
              <div className="tool-card" key={toolset.id}>
                <div className="tool-card-head">
                  <div>
                    <div className="fn">{toolset.name}</div>
                    <div className="fd">
                      {toolset.kind ?? "toolset"} · {toolset.source ?? "profile config"} · {toolset.enabled === false ? "disabled" : "enabled"}
                    </div>
                  </div>
                  {typeof toolset.toolCount === "number" && <span className="badge b-info">{toolset.toolCount} tools</span>}
                </div>
                {toolset.description && <p className="tool-desc">{toolset.description}</p>}
                {toolset.categories && toolset.categories.length > 0 && (
                  <div className="tool-cats">
                    {toolset.categories.map((cat) => (
                      <span className="tool-chip" key={cat.id}>
                        {cat.name}{typeof cat.count === "number" ? ` ${cat.count}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {toolset.sampleTools && toolset.sampleTools.length > 0 && (
                  <div className="tool-samples mono">{toolset.sampleTools.join(", ")}</div>
                )}
              </div>
            ))}
            {(!agent.tools || agent.tools.length === 0) && <div className="empty">No tool capabilities reported for this profile.</div>}
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
                      {canEditAgent && (
                        <span className="x" onClick={() => void removeSkill(s.id)} title="Remove">
                          ×
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {agent.skills.length === 0 && <div className="empty">No skills assigned to this profile.</div>}
            {canEditAgent ? (
              <button className="btn full" onClick={onAddSkill}>
                + Add skill
              </button>
            ) : (
              <div className="mini-note">Read-only workspace selection: ask an admin to change this workspace template.</div>
            )}
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

function FileRow({ file, onOpen, disabled }: { file: ConfigFile; onOpen: () => void; disabled?: boolean }) {
  return (
    <div className={"filerow" + (disabled ? " readonly" : "")} onClick={disabled ? undefined : onOpen} aria-disabled={disabled}>
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
