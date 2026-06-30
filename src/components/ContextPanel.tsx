import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";
import type { Agent, AgentRuntimeAccount, AgentRuntimeAssignment, AgentRuntimeSwitcher, CapabilityMatrixCapability, CapabilityMatrixRow, ConfigFile, RouterModel } from "../types";
import { FileEditorDrawer } from "./FileEditorDrawer";
import { AgentDetailDrawerShell, type AgentDrawerTab } from "./AgentDetailDrawerShell";
import { AgentAvatar } from "./AgentAvatar";

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

  const saveRuntimeAssignment = async (changes: Partial<AgentRuntimeAssignment & { smoke_test: boolean }>) => {
    if (!runtimeSwitcher) return;
    const current = runtimeSwitcher.assignments?.[agent.id];
    if (!current) {
      setRuntimeStatus("This agent is not present in the runtime assignment registry yet.");
      return;
    }
    const validModelIds = new Set(current.valid_model_ids || []);
    const validAccountIds = new Set(current.valid_account_ids || []);
    const modelPool = runtimeSwitcher.models.filter((model) => model.enabled && model.authorized && (validModelIds.size === 0 || validModelIds.has(model.id)));
    const requestedModel = modelPool.find((model) => model.id === (changes.model_id || current.model_id));
    const fallbackModel = modelPool.find((model) => model.provider === "openai-codex")
      ?? modelPool[0];
    const selectedModel = requestedModel ?? fallbackModel;
    if (!selectedModel) {
      setRuntimeStatus("No authorised Hermes model is available for this agent.");
      return;
    }
    const accountPool = runtimeSwitcher.accounts.filter((account) => (validAccountIds.size === 0 || validAccountIds.has(account.id)) && account.provider === selectedModel.provider);
    const requestedAccount = accountPool.find((account) => account.id === (changes.account_id || current.account_id));
    const selectedAccount = requestedAccount && (!selectedModel.provider || requestedAccount.provider === selectedModel.provider)
      ? requestedAccount
      : accountPool[0];
    if (!selectedAccount) {
      setRuntimeStatus("Choose a Codex account before assigning this runtime.");
      return;
    }
    const next: AgentRuntimeAssignment = {
      ...current,
      account_id: selectedAccount.id,
      model_id: selectedModel.id,
      provider: selectedModel.provider,
      model: selectedModel.model,
      credential_label: changes.credential_label || selectedAccount.auth_label || selectedAccount.label,
      apply_mode: changes.apply_mode || current.apply_mode || "next_session",
      reasoning: current.reasoning || "balanced",
      smoke_test: changes.smoke_test || undefined,
    };
    setRuntimeSaving(true);
    setRuntimeStatus(`Applying ${selectedModel.model} with ${next.credential_label} for ${agent.name}…`);
    try {
      const data = await saveAgentRuntime(agent.id, next);
      setRuntimeSwitcher(data);
      setRuntimeStatus(`Assigned ${selectedModel.provider}/${selectedModel.model} via ${next.credential_label}. ${next.apply_mode === "restart_gateway" ? "Gateway restart was requested." : "New sessions use this credential; active runs keep their existing runtime."}`);
    } catch (err) {
      setRuntimeStatus(err instanceof Error ? err.message : "Runtime credential assignment failed");
    } finally {
      setRuntimeSaving(false);
    }
  };

  useEffect(() => {
    if (tab === "tools") void loadCapabilityMatrix();
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
  const runtimeAccounts = runtimeSwitcher?.accounts ?? [];
  const authorizedModels = runtimeModels.filter((model) => model.enabled && model.authorized);
  const assignedModel = runtimeModels.find((model) => model.id === runtimeAssignment?.model_id);

  if (collapsed) {
    return (
      <aside className="ctx ctx-collapsed" aria-label="Collapsed selected agent details">
        <button className="ctx-toggle vertical" onClick={onToggle} title="Expand selected agent details">
          ⟨
        </button>
        <AgentAvatar agent={agent} className="ctx-mini-av" />
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
      avatar={<AgentAvatar agent={agent} className="agent-detail-avatar" />}
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
            <div className="sec-l">Current state</div>
            <Info k="Status" v={<span className={agent.status === "active" || agent.status === "working" ? "hi" : ""}>{agent.statusLabel || cap(agent.status)}</span>} />
            <Info k="Availability" v={agent.availability || "—"} />
            <Info k="Activity" v={agent.activityState || agent.statusDetail || "—"} />
            <Info k="Sessions" v={String(agent.sessionCount)} />
            <Info k="Last active" v={agent.lastActive} />

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
            <AgentRuntimeAccountControl
              agent={agent}
              assignment={runtimeAssignment}
              assignedModel={assignedModel}
              accounts={runtimeAccounts}
              authorizedModels={authorizedModels}
              saving={runtimeSaving}
              status={runtimeStatus}
              onChange={(next) => void saveRuntimeAssignment(next)}
            />
            <Info k="Profile ID" v={<span className="mono">{agent.profile_details?.profile_id || agent.id}</span>} />
            <Info k="Profile path" v={<span className="mono">{agent.profilePath}</span>} />
            <Info k="Identity" v={agent.profile_details?.identity?.name || agent.name} />
            <Info k="Uptime" v={agent.uptime} />
            <Info k="Memory" v={`${agent.profile_details?.memory?.entries ?? 0} entries`} />
            <Info k="Plugins" v={`${agent.profile_details?.plugins?.enabled ?? 0}/${agent.profile_details?.plugins?.total ?? 0} enabled`} />
            <Info k="Gateway channels" v={`${(agent.profile_details?.gateway?.channels ?? []).filter((c) => c.enabled).length}/${agent.profile_details?.gateway?.channels?.length ?? 0} enabled`} />

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

function downloadConfigFile(file: ConfigFile) {
  const blob = new Blob([file.content ?? ""], { type: file.name.toLowerCase().endsWith(".md") ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name || "agent-profile.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
        {!disabled && <button type="button" title="Edit" aria-label={`Edit ${file.name}`} onClick={(event) => { event.stopPropagation(); onOpen(); }}>
          <Icon name="edit" size={14} />
        </button>}
        <button type="button" title="Download" aria-label={`Download ${file.name}`} onClick={(event) => { event.stopPropagation(); downloadConfigFile(file); }}>
          <Icon name="download" size={14} />
        </button>
      </div>
    </div>
  );
}

function credentialHealthLabel(account?: AgentRuntimeAccount) {
  if (!account) return "missing from this profile";
  if (account.health) return account.health;
  if (account.auth_status) return account.auth_status;
  if (account.configured === false) return "missing from this profile";
  return account.auth_active ? "active for this profile" : "healthy";
}

function isUsableRuntimeAccount(account?: AgentRuntimeAccount) {
  if (!account) return false;
  const health = credentialHealthLabel(account).toLowerCase();
  return !health.includes("dead") && !health.includes("revoked") && !health.includes("missing");
}

function credentialHealthTone(account?: AgentRuntimeAccount) {
  const health = credentialHealthLabel(account).toLowerCase();
  if (!account || health.includes("dead") || health.includes("revoked") || health.includes("missing")) return "bad";
  if (health.includes("rate-limited") || health.includes("expired") || health.includes("warning")) return "warn";
  if (health.includes("active")) return "active";
  return "ok";
}

function runtimeRouteLabel(model?: RouterModel, account?: AgentRuntimeAccount, assignment?: AgentRuntimeAssignment, assignedModel?: RouterModel) {
  const provider = model?.provider || account?.provider || assignedModel?.provider || assignment?.provider || "provider";
  const modelName = model?.model || assignment?.model || assignedModel?.model || "model";
  const credential = assignment?.credential_label || account?.auth_label || account?.label || "credential";
  return `${credential} -> ${provider}/${modelName}`;
}

function AgentRuntimeAccountControl({
  agent,
  assignment,
  assignedModel,
  accounts,
  authorizedModels,
  saving,
  status,
  onChange,
}: {
  agent: Agent;
  assignment?: AgentRuntimeAssignment;
  assignedModel?: RouterModel;
  accounts: AgentRuntimeAccount[];
  authorizedModels: RouterModel[];
  saving: boolean;
  status: string;
  onChange: (changes: Partial<AgentRuntimeAssignment & { smoke_test: boolean }>) => void;
}) {
  const validModelIds = new Set(assignment?.valid_model_ids || []);
  const validAccountIds = new Set(assignment?.valid_account_ids || []);
  const modelMap = new Map<string, RouterModel>();
  for (const model of authorizedModels.length ? authorizedModels : []) {
    if (validModelIds.size > 0 && !validModelIds.has(model.id)) continue;
    const key = `${model.provider || ""}::${model.model || model.id}`;
    if (!modelMap.has(key)) modelMap.set(key, model);
  }
  const modelOptions = Array.from(modelMap.values());
  const selectedModel = modelOptions.find((model) => model.id === assignment?.model_id) || modelOptions[0];
  const accountOptions = accounts.filter((account) => {
    if (validAccountIds.size > 0 && !validAccountIds.has(account.id)) return false;
    if (selectedModel?.provider && account.provider !== selectedModel.provider) return false;
    return isUsableRuntimeAccount(account);
  });
  const selectedAccount = accountOptions.find((account) => account.id === assignment?.account_id) || accountOptions[0];
  const providerLabel = selectedModel?.provider || selectedAccount?.provider || assignedModel?.provider || "runtime provider";
  const modelLabel = selectedModel?.model || assignment?.model || assignedModel?.model || "model";
  const credentialLabel = assignment?.credential_label || selectedAccount?.auth_label || selectedAccount?.label || "credential";
  const modelMeta = [
    selectedModel?.provider,
    selectedModel?.tier,
    selectedModel?.cost_weight ? `cost weight ${selectedModel.cost_weight}` : null,
  ].filter(Boolean).join(" / ");
  const modelBestFor = selectedModel?.best_for?.slice(0, 2).join(", ");
  const accountMeta = [
    selectedAccount?.provider,
    selectedAccount?.auth_type,
    selectedAccount?.billing_owner,
  ].filter(Boolean).join(" / ");
  const accountHealth = credentialHealthLabel(selectedAccount);
  const ready = Boolean(selectedModel && selectedAccount);
  const healthyAccountCount = accountOptions.filter((account) => credentialHealthTone(account) === "ok" || credentialHealthTone(account) === "active").length;
  return (
    <div className="agent-model-assignment credential-routing">
      <div className="runtime-route-summary">
        <div>
          <span>Current route</span>
          <b>{runtimeRouteLabel(selectedModel, selectedAccount, assignment, assignedModel)}</b>
        </div>
        <em className={ready ? "ready" : "blocked"}>{ready ? "Ready" : "Needs setup"}</em>
      </div>
      <label className="agent-model-selector runtime-route-field">
        <span>Model for {agent.name}</span>
        <div className="runtime-select-shell">
          <div className="runtime-select-copy">
            <b>{modelLabel}</b>
            <small>{modelMeta || "No authorised model selected"}</small>
          </div>
        <select
          value={selectedModel?.id || ""}
          disabled={saving || modelOptions.length === 0}
          aria-label={`Model for ${agent.name}`}
          onChange={(event) => onChange({ model_id: event.target.value })}
        >
          <option value="">Choose model</option>
          {modelOptions.map((model) => (
            <option key={model.id} value={model.id}>
              {model.model} · {model.provider}
            </option>
          ))}
        </select>
        </div>
        <div className="credential-health-row">
          <span className={selectedModel?.authorized ? "credential-health active" : "credential-health warn"}>{selectedModel?.authorized ? "Authorized" : "Needs authorization"}</span>
          {modelBestFor && <span className="credential-health">{modelBestFor}</span>}
          {selectedModel?.secret_status && <span className="credential-health">{selectedModel.secret_status}</span>}
        </div>
      </label>
      <label className="agent-model-selector runtime-route-field">
        <span>Codex account for {agent.name}</span>
        <div className="runtime-select-shell">
          <div className="runtime-select-copy">
            <b>{credentialLabel}</b>
            <small>{accountMeta || "No healthy account selected"}</small>
          </div>
        <select
          value={selectedAccount?.id || ""}
          disabled={saving || accountOptions.length === 0}
          aria-label={`Codex account for ${agent.name}`}
          onChange={(event) => {
            const account = accountOptions.find((item) => item.id === event.target.value);
            onChange({ account_id: event.target.value, credential_label: account?.auth_label || account?.label });
          }}
        >
          <option value="">Choose Codex account</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.auth_label || account.label}
            </option>
          ))}
        </select>
        </div>
        <div className="credential-health-row">
          <span className={`credential-health ${credentialHealthTone(selectedAccount)}`}>{accountHealth}</span>
          {selectedAccount?.auth_active && <span className="credential-health active">Connected</span>}
          {accountOptions.length > 1 && <span className="credential-health">{accountOptions.length} profile credentials</span>}
          {accountOptions.length === 1 && healthyAccountCount === 1 && <span className="credential-health">Only profile credential</span>}
        </div>
      </label>
      <p className="mini-note">
        This route uses {credentialLabel} to access {providerLabel}/{modelLabel}. Only credentials that exist in this agent profile and are healthy are shown.
      </p>
      {modelOptions.length === 0 && <p className="mini-note err">No valid model is authorised for this agent profile.</p>}
      {modelOptions.length > 0 && accountOptions.length === 0 && <p className="mini-note err">No selectable credential is available for the selected model provider in this agent profile.</p>}
      <div className="runtime-action-row">
        <button className="btn ghost" type="button" disabled={saving || !selectedModel || !selectedAccount} onClick={() => onChange({ smoke_test: true })}>Run smoke test</button>
        <button className="btn ghost" type="button" disabled={saving || !selectedModel || !selectedAccount} onClick={() => onChange({ apply_mode: "restart_gateway" })}>Apply + restart gateway</button>
      </div>
      {assignment?.smoke_test && assignment.smoke_test !== true && <p className={assignment.smoke_test.ok ? "mini-note hi" : "mini-note err"}>Smoke test: {assignment.smoke_test.ok ? "passed" : assignment.smoke_test.error || "failed"}</p>}
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
