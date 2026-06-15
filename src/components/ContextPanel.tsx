import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, AgentRuntimeAssignment, AgentRuntimeSwitcher, CapabilityMatrixCapability, CapabilityMatrixRow, ConfigFile, RouterModel } from "../types";
import { FileEditorDrawer } from "./FileEditorDrawer";
import { AgentDetailDrawerShell, type AgentDrawerTab } from "./AgentDetailDrawerShell";

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
  const [capabilityRow, setCapabilityRow] = useState<CapabilityMatrixRow | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(false);
  const [capabilityMessage, setCapabilityMessage] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const { addSkill, removeSkill, deleteAgent, permissions, getCapabilityMatrix, assignCapability, unassignCapability, getAgentRuntimes, saveAgentRuntime } = useStore();
  const [runtimeSwitcher, setRuntimeSwitcher] = useState<AgentRuntimeSwitcher | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<string>("");
  const [runtimeSaving, setRuntimeSaving] = useState(false);
  const canEditAgent = permissions.canEditGlobalAgents;
  const canEditAgentIdentity = permissions.canEditAgentIdentity;
  const canEditFile = (file: ConfigFile) => canEditAgent || Boolean(file.editable) || (canEditAgentIdentity && file.kind === "soul");

  const onAddSkill = () => {
    if (!canEditAgent) return;
    const name = window.prompt("Skill to install (from Hub or your repo):");
    if (name) void addSkill({ id: Math.random().toString(36).slice(2), name, source: "hub" });
  };

  const loadCapabilityMatrix = async () => {
    setCapabilityLoading(true);
    setCapabilityError(null);
    try {
      const result = await getCapabilityMatrix({ agent: agent.id });
      setCapabilityRow(result.matrix?.[0] ?? null);
    } catch (err) {
      setCapabilityError(err instanceof Error ? err.message : "Unable to load capability matrix");
    } finally {
      setCapabilityLoading(false);
    }
  };

  const loadAgentRuntime = async () => {
    setRuntimeStatus("Loading authorised model assignments…");
    try {
      const data = await getAgentRuntimes();
      setRuntimeSwitcher(data);
      setRuntimeStatus("");
    } catch (err) {
      setRuntimeStatus(err instanceof Error ? err.message : "Unable to load authorised model assignments");
    }
  };

  useEffect(() => {
    if (!collapsed) void loadAgentRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, collapsed]);

  const saveAuthorisedModelAssignment = async (modelId: string) => {
    if (!runtimeSwitcher) return;
    const current = runtimeSwitcher.assignments?.[agent.id];
    if (!current) {
      setRuntimeStatus("This agent is not present in the runtime assignment registry yet.");
      return;
    }
    const selectedModel = runtimeSwitcher.models.find((model) => model.id === modelId);
    if (!selectedModel?.authorized || !selectedModel?.enabled) {
      setRuntimeStatus("Only authorised and enabled models can be assigned to agents.");
      return;
    }
    const next: AgentRuntimeAssignment = { ...current, model_id: modelId, apply_mode: current.apply_mode || "next_session", reasoning: current.reasoning || "balanced" };
    setRuntimeSaving(true);
    setRuntimeStatus(`Saving ${selectedModel.label || selectedModel.model} for ${agent.name}…`);
    try {
      const data = await saveAgentRuntime(agent.id, next);
      setRuntimeSwitcher(data);
      setRuntimeStatus(`Assigned ${selectedModel.label || selectedModel.model}. New sessions use this authorised model; active runs keep their existing runtime.`);
    } catch (err) {
      setRuntimeStatus(err instanceof Error ? err.message : "Model assignment failed");
    } finally {
      setRuntimeSaving(false);
    }
  };

  useEffect(() => {
    if (tab === "profile" || tab === "tools") void loadCapabilityMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id, tab]);

  const onCapabilityAction = async (capability: CapabilityMatrixCapability) => {
    if (!capability.id || !canEditAgent || capability.source !== "registry") return;
    setCapabilityMessage(null);
    setCapabilityError(null);
    try {
      if (capability.assigned) {
        await unassignCapability(capability.id, { agentId: agent.id, agent: { id: agent.id, name: agent.name }, reason: "Unassigned from Agent/Profile capability surface" });
        setCapabilityMessage(`Unassigned ${capability.displayName || capability.name || capability.id}`);
      } else {
        await assignCapability(capability.id, { agentId: agent.id, agent: { id: agent.id, name: agent.name }, reason: "Assigned from Agent/Profile capability surface" });
        setCapabilityMessage(`Assigned ${capability.displayName || capability.name || capability.id}`);
      }
      await loadCapabilityMatrix();
    } catch (err) {
      setCapabilityError(err instanceof Error ? err.message : "Capability assignment failed");
    }
  };

  const workspaceCapabilities = capabilityRow?.capabilities ?? [];
  const runtimeAssignment = runtimeSwitcher?.assignments?.[agent.id];
  const runtimeModels = runtimeSwitcher?.models ?? [];
  const authorizedModels = runtimeModels.filter((model) => model.enabled && model.authorized);
  const assignedModel = runtimeModels.find((model) => model.id === runtimeAssignment?.model_id);

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
  const panelTabs: AgentDrawerTab[] = (["overview", "profile", "identity", "tools", "skills", "output", "tasks"] as Tab[]).map((t) => ({
    id: t,
    label: t === "identity" ? "Identity" : t[0].toUpperCase() + t.slice(1),
    count: t === "identity" ? agent.files.length : t === "tools" ? (agent.tools?.length ?? 0) : t === "skills" ? agent.skills.length : t === "output" ? agent.artifacts.length : t === "tasks" ? agent.tasks.length : undefined,
  }));

  return (
    <AgentDetailDrawerShell
      className={"ctx" + (drawer ? " agent-detail-drawer" : "")}
      title={agent.name}
      avatar={<span className="agent-detail-avatar" style={{ background: agent.color }}>{agent.initials}</span>}
      eyebrow="Selected agent"
      subtitle={`${agentGroupLabel(agent.squad)} · ${agent.id}`}
      tabs={panelTabs}
      activeTab={tab}
      onTabChange={(next) => setTab(next as Tab)}
      onClose={drawer ? onClose : undefined}
      ariaLabel={`Selected agent details for ${agent.name}`}
      bodyClassName="ctxbody scroll"
    >
        {tab === "overview" && (
          <>
            <div className="sec-l">Runtime</div>
            <AgentModelAssignmentControl
              agent={agent}
              assignment={runtimeAssignment}
              assignedModel={assignedModel}
              authorizedModels={authorizedModels}
              saving={runtimeSaving}
              status={runtimeStatus}
              onChange={(modelId) => void saveAuthorisedModelAssignment(modelId)}
            />
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
            <Info k="Provider" v={assignedModel?.provider || agent.profile_details?.model_routing?.provider || "runtime default"} />
            <Info k="Assigned model" v={<span className="mono">{assignedModel?.model || agent.profile_details?.model_routing?.model || agent.model}</span>} />
            <Info k="Toolsets" v={String(agent.profile_details?.toolsets?.length ?? agent.tools?.length ?? 0)} />
            <Info k="Skills" v={String(agent.skills.length)} />
            <Info k="Memory" v={`${agent.profile_details?.memory?.entries ?? 0} entries`} />
            <Info k="Sessions" v={String(agent.profile_details?.sessions?.count ?? agent.sessionCount)} />
            <Info k="Plugins" v={`${agent.profile_details?.plugins?.enabled ?? 0}/${agent.profile_details?.plugins?.total ?? 0} enabled`} />
            <Info k="Routines" v={String(agent.profile_details?.routines?.count ?? agent.tasks.length)} />
            <Info k="Gateway channels" v={`${(agent.profile_details?.gateway?.channels ?? []).filter((c) => c.enabled).length}/${agent.profile_details?.gateway?.channels?.length ?? 0} enabled`} />
            <Info k="Credential scope" v={(agent.profile_details?.environment?.env_files?.length ?? 0) ? `${agent.profile_details?.environment?.env_files?.length} env file(s), values hidden` : "No env file reported"} />

            <div className="sec-l">Workspace capability matrix</div>
            <CapabilityMatrixSummary row={capabilityRow} loading={capabilityLoading} error={capabilityError} message={capabilityMessage} />

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

            <div className="sec-l">Assignable registry capabilities · {workspaceCapabilities.length}</div>
            <CapabilityMatrixSummary row={capabilityRow} loading={capabilityLoading} error={capabilityError} message={capabilityMessage} />
            {workspaceCapabilities.filter((capability) => capability.source === "registry").map((capability) => (
              <CapabilityMatrixCard key={capability.id} capability={capability} canEdit={canEditAgent} onAction={() => void onCapabilityAction(capability)} />
            ))}
            {!capabilityLoading && workspaceCapabilities.filter((capability) => capability.source === "registry").length === 0 && <div className="empty">No assignable registry capabilities found for this profile.</div>}
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
      {editing && <FileEditorDrawer file={editing} onClose={() => setEditing(null)} />}
    </AgentDetailDrawerShell>
  );
}

function CapabilityMatrixSummary({ row, loading, error, message }: { row: CapabilityMatrixRow | null; loading: boolean; error: string | null; message: string | null }) {
  if (loading && !row) return <div className="empty">Loading capability matrix…</div>;
  return (
    <div className="tool-card">
      <div className="tool-card-head">
        <div>
          <div className="fn">Capability assignment governance</div>
          <div className="fd">Agent/Profile surface · no Admin redirect required</div>
        </div>
        {row && <span className="badge b-info">{row.summary.assigned}/{row.summary.total} assigned</span>}
      </div>
      {row ? (
        <div className="tool-cats">
          <span className="tool-chip">Assigned {row.summary.assigned}</span>
          <span className="tool-chip">Inherited {row.summary.inherited ?? 0}</span>
          <span className="tool-chip">Available {row.summary.available}</span>
          <span className="tool-chip">Blocked {row.summary.blocked}</span>
          <span className="tool-chip">Registry {row.summary.registry}</span>
        </div>
      ) : (
        !loading && <p className="tool-desc">No capability matrix row is available for this profile yet.</p>
      )}
      {message && <p className="mini-note hi">{message}</p>}
      {error && <p className="mini-note err">{error}</p>}
    </div>
  );
}

function CapabilityMatrixCard({ capability, canEdit, onAction }: { capability: CapabilityMatrixCapability; canEdit: boolean; onAction: () => void }) {
  const blocked = Boolean(capability.actionableBlocker || (capability.approvalRequired && capability.approvalStatus !== "approved"));
  const label = capability.displayName || capability.name || capability.id;
  const scopeLabel = capability.assignmentScope === "inherited" || capability.inherited ? "inherited" : capability.assigned ? "assigned" : "available";
  return (
    <div className="tool-card">
      <div className="tool-card-head">
        <div>
          <div className="fn">{label}</div>
          <div className="fd">{capability.type || "capability"} · {capability.sourceLabel || capability.source || "runtime"} · {capability.status || "registered"} · {capability.healthState || "unknown"}</div>
        </div>
        <span className={"badge " + (blocked ? "b-wait" : scopeLabel === "assigned" ? "b-work" : scopeLabel === "inherited" ? "b-info" : "b-idle")}>{blocked ? "governed" : scopeLabel}</span>
      </div>
      {capability.description && <p className="tool-desc">{capability.description}</p>}
      <div className="tool-cats">
        {(capability.riskLevels ?? []).map((risk) => <span className="tool-chip" key={risk}>{risk}</span>)}
        {capability.approvalRequired && <span className="tool-chip">approval {capability.approvalStatus || "required"}</span>}
        {capability.assignmentUnit && <span className="tool-chip">unit {capability.assignmentUnit}</span>}
        {scopeLabel === "inherited" && <span className="tool-chip">profile/runtime inherited</span>}
      </div>
      {blocked && <p className="mini-note">{String((capability.actionableBlocker as { message?: unknown } | null)?.message || capability.policyGate || "Governance approval is required before assignment changes.")}</p>}
      {canEdit && capability.source === "registry" ? (
        <button className="btn full" disabled={blocked} onClick={onAction}>{capability.assigned ? "Unassign from this profile" : "Assign to this profile"}</button>
      ) : (
        <div className="mini-note">{capability.source === "registry" ? "Read-only workspace selection." : "Runtime capability reported from profile config."}</div>
      )}
    </div>
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

function modelOptionLabel(model: RouterModel) {
  const auth = model.authorized ? "authorised" : "not authorised";
  return `${model.label || model.model} · ${model.provider}/${model.model} · ${model.tier} · ${auth}`;
}

function AgentModelAssignmentControl({
  agent,
  assignment,
  assignedModel,
  authorizedModels,
  saving,
  status,
  onChange,
}: {
  agent: Agent;
  assignment?: AgentRuntimeAssignment;
  assignedModel?: RouterModel;
  authorizedModels: RouterModel[];
  saving: boolean;
  status: string;
  onChange: (modelId: string) => void;
}) {
  const selectedValue = assignment?.model_id && authorizedModels.some((model) => model.id === assignment.model_id) ? assignment.model_id : "";
  return (
    <div className="agent-model-assignment">
      <label className="agent-model-selector">
        <span>Select authorised model for {agent.name}</span>
        <select value={selectedValue} disabled={saving || authorizedModels.length === 0} onChange={(event) => onChange(event.target.value)}>
          <option value="">{assignedModel && !assignedModel.authorized ? `${assignedModel.label || assignedModel.model} is not authorised` : "Choose authorised model"}</option>
          {authorizedModels.map((model) => <option key={model.id} value={model.id}>{modelOptionLabel(model)}</option>)}
        </select>
      </label>
      <p className="mini-note">
        {assignedModel ? `Current assignment: ${assignedModel.provider}/${assignedModel.model}${assignedModel.authorized ? "" : " · not authorised"}.` : "Current assignment: router default."}
        {" "}Only authorised and enabled models can be assigned to agents.
      </p>
      {status && <div className="mini-note runtime-status-note">{status}</div>}
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
