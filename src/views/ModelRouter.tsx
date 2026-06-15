import { useEffect, useState } from "react";
import { InfoTooltip } from "../components/InfoTooltip";

type ModelTier = "frontier" | "balanced" | "standard" | "economy" | "low_cost" | string;

type RouterModel = {
  id: string;
  label: string;
  provider: string;
  model: string;
  tier: ModelTier;
  enabled: boolean;
  authorized?: boolean;
  credential_env?: string;
  secret_status?: string;
  cost_weight?: number;
  best_for?: string[];
  notes?: string;
};

type HermesSettings = {
  config_path: string;
  env_path: string;
  auth_path: string;
  active: { provider: string; model: string; base_url?: string; credential_env?: string; auth_provider_configured?: boolean };
  auth_providers: string[];
  provider_options: string[];
};

type RouterConfig = {
  enabled: boolean;
  updated_at: string;
  policy: Record<string, unknown>;
  models: RouterModel[];
  summary: { total: number; enabled: number; authorized: number; frontier: number };
  hermes_settings?: HermesSettings;
  error?: string;
};

type RoutePlan = {
  ok: boolean;
  complexity: number;
  complexity_label: string;
  planner_model?: RouterModel | null;
  steps: Array<{ id: string; purpose: string; title: string; complexity: number; assigned_model?: RouterModel | null; spawn_subagent: boolean }>;
  cost_control?: { estimated_savings?: string; frontier_only_for?: string };
  registry_summary?: RouterConfig["summary"];
};

type AgentRuntimeAccount = {
  id: string;
  label: string;
  email_hint?: string;
  provider: string;
  credential_env: string;
  billing_owner?: string;
  notes?: string;
  configured?: boolean;
  secret_status?: string;
};

type AgentRuntimeAssignment = {
  agent_id: string;
  account_id: string;
  model_id: string;
  reasoning: string;
  apply_mode: string;
  updated_at?: string;
  updated_by?: string;
  note?: string;
};

type AgentRuntimeSwitcher = {
  ok: boolean;
  updated_at?: string;
  accounts: AgentRuntimeAccount[];
  models: RouterModel[];
  agents: Array<{ id: string; name: string; squad?: string; status?: string; processingRequests?: string[] }>;
  assignments: Record<string, AgentRuntimeAssignment>;
  audit: Array<{ id: string; agent_id: string; from_account?: string; to_account?: string; from_model?: string; to_model?: string; account_label?: string; model_label?: string; apply_mode?: string; changed_by?: string; timestamp?: string }>;
  summary: { accounts: number; configured_accounts: number; agents: number; assigned: number };
  error?: string;
};

const emptyConfig: RouterConfig = { enabled: true, updated_at: "", policy: {}, models: [], summary: { total: 0, enabled: 0, authorized: 0, frontier: 0 } };
const emptyRuntimeSwitcher: AgentRuntimeSwitcher = { ok: true, accounts: [], models: [], agents: [], assignments: {}, audit: [], summary: { accounts: 0, configured_accounts: 0, agents: 0, assigned: 0 } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : res.statusText);
  return data as T;
}

function tierLabel(tier: string) {
  if (tier === "frontier") return "Frontier reasoning";
  if (tier === "balanced" || tier === "standard") return "Balanced worker";
  if (tier === "economy" || tier === "low_cost") return "Low-cost worker";
  return tier || "custom";
}

function modelSummary(model?: RouterModel | null) {
  if (!model) return "No enabled model";
  return `${model.provider}/${model.model} · ${tierLabel(model.tier)} · cost weight ${model.cost_weight || 1}`;
}

function byId<T extends { id: string }>(items: T[], id?: string) {
  return items.find((item) => item.id === id);
}

function accountLabel(account?: AgentRuntimeAccount) {
  if (!account) return "No account";
  return `${account.label}${account.email_hint ? ` · ${account.email_hint}` : ""}`;
}

function assignmentWarnings(agent: AgentRuntimeSwitcher["agents"][number], account?: AgentRuntimeAccount) {
  const warnings: string[] = [];
  if (!account?.configured) warnings.push("credential missing");
  if ((agent.processingRequests || []).length > 0) warnings.push("active run continues on previous runtime");
  return warnings;
}

function providerCredentialEnv(provider: string) {
  const mapping: Record<string, string> = {
    openrouter: "OPENROUTER_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    nous: "NOUS_API_KEY",
    google: "GOOGLE_API_KEY",
    gemini: "GEMINI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    xai: "XAI_API_KEY",
    "openai-codex": "",
  };
  return mapping[provider.toLowerCase()] ?? "";
}

function ModelEditor({ model, onChange, onRemove }: { model: RouterModel; onChange: (m: RouterModel) => void; onRemove: () => void }) {
  return <article className={`router-model-card ${model.enabled ? "" : "disabled"}`}>
    <div className="router-model-head">
      <div><b>{model.label || model.model}</b><small>{modelSummary(model)}</small></div>
      <span className={`auth-pill ${model.authorized ? "ok" : "missing"}`}>{model.authorized ? "authorised" : "missing key"}</span>
    </div>
    <div className="router-grid-form">
      <label>Label<input value={model.label || ""} onChange={(e) => onChange({ ...model, label: e.target.value })} /></label>
      <label>Provider<input value={model.provider || ""} onChange={(e) => onChange({ ...model, provider: e.target.value })} /></label>
      <label>Model ID<input value={model.model || ""} onChange={(e) => onChange({ ...model, model: e.target.value })} /></label>
      <label>Tier<select value={model.tier || "economy"} onChange={(e) => onChange({ ...model, tier: e.target.value })}><option value="frontier">frontier</option><option value="balanced">balanced</option><option value="economy">economy</option><option value="standard">standard</option><option value="low_cost">low_cost</option></select></label>
      <label>Credential env var<input value={model.credential_env || ""} onChange={(e) => onChange({ ...model, credential_env: e.target.value.toUpperCase() })} placeholder="OPENAI_API_KEY" /></label>
      <label>Cost weight<input type="number" min={1} max={100} value={model.cost_weight || 1} onChange={(e) => onChange({ ...model, cost_weight: Number(e.target.value) })} /></label>
    </div>
    <label className="wide-label">Best for<input value={(model.best_for || []).join(", ")} onChange={(e) => onChange({ ...model, best_for: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="planning, strategy, extraction" /></label>
    <label className="wide-label">Notes<textarea value={model.notes || ""} onChange={(e) => onChange({ ...model, notes: e.target.value })} /></label>
    <div className="router-actions"><label className="toggle-line"><input type="checkbox" checked={model.enabled} onChange={(e) => onChange({ ...model, enabled: e.target.checked })} /> Enabled for routing</label><button className="btn ghost small" onClick={onRemove}>Remove</button></div>
  </article>;
}

export function ModelRouter() {
  const [draft, setDraft] = useState<RouterConfig>(emptyConfig);
  const [runtimeSwitcher, setRuntimeSwitcher] = useState<AgentRuntimeSwitcher>(emptyRuntimeSwitcher);
  const [runtimeSaving, setRuntimeSaving] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("Plan and execute a client-facing automation feature, split the work into sub-agents, then verify the result and control cost.");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [saving, setSaving] = useState(false);

  const loadRuntimeSwitcher = async () => {
    const data = await request<AgentRuntimeSwitcher>("/api/agent-runtimes");
    setRuntimeSwitcher(data);
    return data;
  };

  const load = async () => {
    try {
      const [data] = await Promise.all([request<RouterConfig>("/api/model-router"), loadRuntimeSwitcher()]);
      setDraft(JSON.parse(JSON.stringify(data))); setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true); setStatus("Saving model routing policy…");
    try {
      const data = await request<RouterConfig>("/api/model-router", { method: "POST", body: JSON.stringify(draft) });
      setDraft(JSON.parse(JSON.stringify(data))); setStatus("Saved. Authorisation status refreshed from server-side env vars.");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const testRoute = async () => {
    setStatus("Analysing task complexity and selecting models…");
    try {
      const data = await request<RoutePlan>("/api/model-router/route", { method: "POST", body: JSON.stringify({ instruction }) });
      setPlan(data); setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  };

  const saveAgentRuntime = async (agentId: string, patch: Partial<AgentRuntimeAssignment>) => {
    const current = runtimeSwitcher.assignments[agentId];
    if (!current) return;
    const next = { ...current, ...patch };
    setRuntimeSaving(agentId);
    setStatus(`Saving runtime for ${agentId}…`);
    try {
      const data = await request<AgentRuntimeSwitcher>(`/api/agent-runtimes/${encodeURIComponent(agentId)}`, { method: "POST", body: JSON.stringify(next) });
      setRuntimeSwitcher(data);
      setStatus("Runtime switch saved. Existing active runs continue unchanged; new sessions use the selected account/model.");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setRuntimeSaving(null); }
  };

  const addModel = () => {
    const n = draft.models.length + 1;
    setDraft({ ...draft, models: [...draft.models, { id: `custom-${Date.now()}`, label: `Custom model ${n}`, provider: "openrouter", model: "provider/model-id", tier: "economy", enabled: true, credential_env: "OPENROUTER_API_KEY", cost_weight: 1, best_for: ["simple_qa"], notes: "" }] });
  };

  const addHermesCliModel = () => {
    const active = draft.hermes_settings?.active;
    if (!active?.provider || !active?.model) {
      setStatus("No active Hermes CLI model found. Set one with `hermes model` or `hermes config set model.provider/model.default` first.");
      return;
    }
    const id = `${active.provider}-${active.model}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || `hermes-cli-${Date.now()}`;
    const existingIndex = draft.models.findIndex((m) => m.id === id || (m.provider === active.provider && m.model === active.model));
    const model: RouterModel = {
      id,
      label: `Hermes CLI default · ${active.model}`,
      provider: active.provider,
      model: active.model,
      tier: "frontier",
      enabled: true,
      credential_env: active.credential_env || providerCredentialEnv(active.provider),
      cost_weight: 8,
      best_for: ["planning", "strategy", "complex_reasoning", "verification"],
      notes: `Imported from Hermes CLI config at ${draft.hermes_settings?.config_path}. Authorisation is checked from Hermes .env/API keys or auth.json OAuth credentials.`,
    };
    setDraft({ ...draft, models: existingIndex >= 0 ? draft.models.map((m, i) => i === existingIndex ? { ...m, ...model } : m) : [...draft.models, model] });
    setStatus("Added the current Hermes CLI default model to the Mission Control allow-list. Save to authorise it for routing.");
  };

  const hermesActive = draft.hermes_settings?.active;
  const runtimeModels = runtimeSwitcher.models.length ? runtimeSwitcher.models : draft.models;
  const configuredAccounts = runtimeSwitcher.accounts.filter((account) => account.configured).length;

  return <div className="page router-page">
    <section className="hero router-hero">
      <div>
        <span className="stub-tag">MODEL ROUTER</span>
        <div className="hero-title-with-help"><h1>Cost-aware AI Model Router</h1><InfoTooltip label="About Model Router">Register available models, check authorisation, and let Mission Control decide which model tier should handle planning, execution, verification, and sub-agent work.</InfoTooltip></div>
      </div>
      <button className="btn dark" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save routing policy"}</button>
    </section>

    <section className="metrics-grid router-metrics">
      <div className="metric"><span>Registered</span><b>{draft.summary?.total ?? draft.models.length}</b><small>models in registry</small></div>
      <div className="metric"><span>AI Accounts</span><b>{configuredAccounts}/{runtimeSwitcher.accounts.length || 2}</b><small>company + personal credential status</small></div>
      <div className="metric"><span>Agents routed</span><b>{runtimeSwitcher.summary.assigned || 0}</b><small>per-agent account/model choices</small></div>
      <div className="metric"><span>Policy</span><b>{draft.enabled ? "ON" : "OFF"}</b><small>{draft.updated_at ? `saved ${draft.updated_at}` : "auto-selection gate"}</small></div>
    </section>

    {status && <div className="org-warning">{status}</div>}

    <section className="router-panel agent-runtime-switcher-panel">
      <div className="section-head">
        <div>
          <div className="section-title-with-help"><h2>Agent runtime switcher</h2><InfoTooltip label="About agent runtime switching">Choose whether each agent should use the Nexius Labs company account or Melverick personal account, then pair it with an authorised model. Secrets stay server-side; active runs keep their original runtime.</InfoTooltip></div>
        </div>
        <button className="btn ghost" onClick={() => void loadRuntimeSwitcher()}>Refresh runtime status</button>
      </div>

      <div className="account-card-grid">
        {runtimeSwitcher.accounts.map((account) => <article className="account-runtime-card" key={account.id}>
          <div className="router-model-head">
            <div><b>{account.label}</b><small>{account.email_hint} · {account.billing_owner || "billing owner unset"}</small></div>
            <span className={`auth-pill ${account.configured ? "ok" : "missing"}`}>{account.configured ? "configured" : "missing key"}</span>
          </div>
          <div className="runtime-account-meta"><span>{account.provider}</span><span>{account.credential_env}</span></div>
          {account.notes && <p className="muted">{account.notes}</p>}
        </article>)}
      </div>

      <div className="agent-runtime-grid">
        {runtimeSwitcher.agents.map((agent) => {
          const assignment = runtimeSwitcher.assignments[agent.id];
          const account = byId(runtimeSwitcher.accounts, assignment?.account_id);
          const model = byId(runtimeModels, assignment?.model_id);
          const warnings = assignmentWarnings(agent, account);
          return <article className="agent-runtime-card" key={agent.id}>
            <div className="router-model-head">
              <div><b>{agent.name}</b><small>{agent.squad || agent.id} · current: {accountLabel(account)} / {model?.model || "no model"}</small></div>
              <span className={`auth-pill ${warnings.length ? "missing" : "ok"}`}>{warnings[0] || "ready"}</span>
            </div>
            <div className="router-grid-form runtime-assignment-form">
              <label>AI Account<select value={assignment?.account_id || ""} onChange={(e) => void saveAgentRuntime(agent.id, { account_id: e.target.value })} disabled={runtimeSaving === agent.id}>{runtimeSwitcher.accounts.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.email_hint}</option>)}</select></label>
              <label>Model<select value={assignment?.model_id || ""} onChange={(e) => void saveAgentRuntime(agent.id, { model_id: e.target.value })} disabled={runtimeSaving === agent.id}>{runtimeModels.map((item) => <option key={item.id} value={item.id}>{item.label || item.model} · {item.model}</option>)}</select></label>
              <label>Reasoning<select value={assignment?.reasoning || "balanced"} onChange={(e) => void saveAgentRuntime(agent.id, { reasoning: e.target.value })} disabled={runtimeSaving === agent.id}><option value="fast">fast</option><option value="balanced">balanced</option><option value="high">high</option><option value="deep">deep</option></select></label>
              <label>Apply<select value={assignment?.apply_mode || "next_session"} onChange={(e) => void saveAgentRuntime(agent.id, { apply_mode: e.target.value })} disabled={runtimeSaving === agent.id}><option value="next_session">new sessions only</option><option value="after_reset">after reset</option><option value="force_restart">force restart required</option></select></label>
            </div>
            <p className="muted">{runtimeSaving === agent.id ? "Saving…" : assignment?.updated_at ? `Updated ${assignment.updated_at} by ${assignment.updated_by || "operator"}` : "Default route. Save a change to create an audit entry."}</p>
          </article>;
        })}
        {runtimeSwitcher.agents.length === 0 && <div className="empty big">No agents available for runtime switching.</div>}
      </div>

      {runtimeSwitcher.audit.length > 0 && <details className="runtime-audit-log">
        <summary>Recent runtime switch audit log</summary>
        <div className="route-steps">{runtimeSwitcher.audit.slice(-8).reverse().map((event) => <div className="route-step" key={event.id}><span>{event.timestamp}</span><b>{event.agent_id}: {event.account_label} / {event.model_label}</b><small>{event.changed_by} · {event.apply_mode}</small></div>)}</div>
      </details>}
    </section>

    <section className="router-panel hermes-cli-panel">
      <div className="section-head">
        <div>
          <h2>Hermes CLI model settings</h2>
          <p>This is the allow-list interface for models Mission Control may use. It reads the active Hermes CLI model from config.yaml and checks authorisation from Hermes .env API keys or auth.json OAuth credentials. Secrets are never shown here.</p>
        </div>
        <button className="btn dark" onClick={addHermesCliModel}>Add current Hermes CLI model</button>
      </div>
      <div className="router-cli-grid">
        <div><span>Current provider</span><b>{hermesActive?.provider || "not set"}</b></div>
        <div><span>Current model</span><b>{hermesActive?.model || "not set"}</b></div>
        <div><span>Credential source</span><b>{hermesActive?.auth_provider_configured ? "Hermes auth" : hermesActive?.credential_env || "not set"}</b></div>
        <div><span>Config</span><b className="mono">{draft.hermes_settings?.config_path || "~/.hermes/config.yaml"}</b></div>
      </div>
      <p className="muted">To add or change a provider at the Hermes level, use `hermes model`, `hermes auth add PROVIDER`, or `hermes config set model.provider/model.default`. Then reload this page and add it to the Mission Control allow-list.</p>
      {(draft.hermes_settings?.auth_providers?.length ?? 0) > 0 && <p className="muted">Hermes auth providers detected: {draft.hermes_settings?.auth_providers.join(", ")}</p>}
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Routing policy</h2><p>The main agent uses frontier models for decomposition, strategy, complex reasoning and final review; lower-cost workers handle simple execution, formatting, extraction, and classification.</p></div><label className="toggle-line"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Auto-select models</label></div>
      <textarea className="policy-textarea" value={String(draft.policy?.goal || "")} onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, goal: e.target.value } })} />
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Model allow-list + authorisation</h2><p>Only enabled models in this allow-list appear in chat model selection or router decisions. Mission Control marks a model authorised when the matching Hermes CLI API key/env var or OAuth credential exists server-side.</p></div><button className="btn ghost" onClick={addModel}>Add model manually</button></div>
      <div className="router-model-grid">{draft.models.map((model, index) => <ModelEditor key={model.id || index} model={model} onChange={(next) => setDraft({ ...draft, models: draft.models.map((m, i) => i === index ? next : m) })} onRemove={() => setDraft({ ...draft, models: draft.models.filter((_, i) => i !== index) })} />)}</div>
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Test auto-selection</h2><p>Paste a human instruction and Mission Control will classify complexity, choose a planner model, and assign suitable model tiers to sub-agent steps.</p></div><button className="btn dark" onClick={() => void testRoute()}>Route this task</button></div>
      <textarea className="policy-textarea tall" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      {plan && <div className="route-plan">
        <div className="route-score"><b>{plan.complexity}</b><span>{plan.complexity_label}</span><small>Planner: {modelSummary(plan.planner_model)}</small></div>
        <div className="route-steps">{plan.steps.map((step) => <div className="route-step" key={step.id}><span>{step.purpose}</span><b>{step.title}</b><small>{modelSummary(step.assigned_model)} · complexity {step.complexity}{step.spawn_subagent ? " · spawn sub-agent" : " · direct"}</small></div>)}</div>
        <p className="muted">{plan.cost_control?.estimated_savings}</p>
      </div>}
    </section>
  </div>;
}
