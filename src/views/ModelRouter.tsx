import { useEffect, useMemo, useState } from "react";
import { InfoTooltip } from "../components/InfoTooltip";
import type { CostsResponse, ModelUsageWindow } from "../types";

type RouterModel = {
  id: string;
  label: string;
  provider: string;
  model: string;
  tier: string;
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
};

type AgentRuntimeAccount = {
  id: string;
  label: string;
  email_hint?: string;
  provider: string;
  credential_env?: string;
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
  agents: Array<{ id: string; name: string; squad?: string; status?: string }>;
  assignments: Record<string, AgentRuntimeAssignment>;
  audit: Array<Record<string, unknown>>;
  summary: { accounts: number; configured_accounts: number; agents: number; assigned: number };
  error?: string;
};

type ModelUsageLimit = NonNullable<CostsResponse["model_usage"]>;

type AdminConsoleModelCard = {
  account: AgentRuntimeAccount;
  model?: RouterModel;
  assignedAgents: Array<{ id: string; name: string }>;
};

const emptyConfig: RouterConfig = { enabled: true, updated_at: "", policy: {}, models: [], summary: { total: 0, enabled: 0, authorized: 0, frontier: 0 } };
const emptyRuntime: AgentRuntimeSwitcher = { ok: true, accounts: [], models: [], agents: [], assignments: {}, audit: [], summary: { accounts: 0, configured_accounts: 0, agents: 0, assigned: 0 } };

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

function pctLabel(value?: number | null) {
  if (value === undefined || value === null || !Number.isFinite(Number(value))) return "—";
  return `${Math.round(Math.max(0, Math.min(100, Number(value))))}%`;
}

function remainingPct(window?: ModelUsageWindow) {
  const explicit = window?.remaining_percent === undefined || window?.remaining_percent === null ? NaN : Number(window.remaining_percent);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  return null;
}

function UsageLimitRow({ window, available = true }: { window?: ModelUsageWindow; available?: boolean }) {
  const remaining = remainingPct(window);
  const label = remaining === null ? "—" : pctLabel(remaining);
  const windowLabel = window?.label || "Rate limit";
  return (
    <div className="usage-limit-row usage-limit-compact router-usage-row">
      <div className="usage-limit-main usage-limit-grid">
        <b>{windowLabel}</b>
        <strong>{label}</strong>
        <span>{window?.reset_label || "—"}</span>
      </div>
      <div className="usage-limit-progress" aria-label={`${windowLabel} has ${label} remaining`}>
        <i className={available && remaining !== null ? "" : "unavailable"} style={{ width: `${available && remaining !== null ? remaining : 0}%` }} />
      </div>
      <div className="usage-limit-meta">
        <span>{remaining === null ? "provider quota unavailable" : `${label} remaining`}</span>
        <span>{window?.reset_label ? `resets ${window.reset_label}` : "reset unavailable"}</span>
      </div>
    </div>
  );
}

function findUsageForModel(model: RouterModel | undefined, rows: ModelUsageLimit[]) {
  if (!model) return undefined;
  const keys = new Set([model.model, model.id, `${model.provider}/${model.model}`].map((x) => String(x || "").trim()).filter(Boolean));
  return rows.find((usage) => {
    const ids = [usage.selected_model, ...(usage.models || []), ...(usage.aliases || [])].map((x) => String(x || "").trim());
    return ids.some((id) => keys.has(id));
  });
}

function modelForAccount(account: AgentRuntimeAccount, runtime: AgentRuntimeSwitcher) {
  const assignment = Object.values(runtime.assignments || {}).find((item) => item.account_id === account.id);
  const assignedModel = runtime.models.find((model) => model.id === assignment?.model_id);
  if (assignedModel) return assignedModel;
  return runtime.models.find((model) => model.provider === account.provider && model.enabled) || runtime.models[0];
}

function providerModelLabel(account: AgentRuntimeAccount, model?: RouterModel) {
  const provider = model?.provider || account.provider || "provider";
  const modelId = model?.model || "model not assigned";
  return `${provider}/${modelId}`;
}

function AccountModelCard({ card, usage }: { card: AdminConsoleModelCard; usage?: ModelUsageLimit }) {
  const { account, model, assignedAgents } = card;
  const ready = Boolean(account.configured || account.provider === "openai-codex");
  return <article className={`router-model-card admin-console-model-card ${ready ? "" : "disabled"}`}>
    <div className="router-model-head">
      <div>
        <b>{account.label}</b>
        <small>{providerModelLabel(account, model)} · credential / quota bucket</small>
      </div>
      <span className={`auth-pill ${ready ? "ok" : "missing"}`}>{ready ? "authorised account" : "credential missing"}</span>
    </div>
    <div className="router-cli-grid compact">
      <div><span>Credential/account</span><b>{account.label}</b></div>
      <div><span>Provider</span><b>{account.provider || model?.provider || "—"}</b></div>
      <div><span>Model</span><b>{model?.model || "—"}</b></div>
      <div><span>Quota owner</span><b>{account.billing_owner || "—"}</b></div>
    </div>
    <p className="muted">Separate Codex authorisation/quota bucket. This is not a separate model ID; both current Codex accounts run the same main model when assigned.</p>
    {model && <div className="runtime-account-meta"><span>{tierLabel(model.tier)}</span><span>{model.enabled ? "enabled for routing" : "routing disabled"}</span><span>{model.secret_status || "Hermes auth"}</span></div>}
    <div className={`router-model-usage ${usage && usage.available !== false && !usage.error ? "" : "unavailable"}`}>
      {usage?.error && <p>{usage.error}</p>}
      <UsageLimitRow window={usage?.daily} available={Boolean(usage && usage.available !== false && !usage.error)} />
      <UsageLimitRow window={usage?.weekly} available={Boolean(usage && usage.available !== false && !usage.error)} />
    </div>
    <div className="runtime-account-meta"><span>{assignedAgents.length ? `${assignedAgents.map((agent) => agent.name).join(", ")} assigned` : "No agent assigned"}</span></div>
  </article>;
}

export function ModelRouter() {
  const [draft, setDraft] = useState<RouterConfig>(emptyConfig);
  const [runtime, setRuntime] = useState<AgentRuntimeSwitcher>(emptyRuntime);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [instruction, setInstruction] = useState("Plan and execute a client-facing automation feature, split the work into sub-agents, then verify the result and control cost.");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [saving, setSaving] = useState(false);

  const adminConsoleCards = useMemo<AdminConsoleModelCard[]>(() => {
    return runtime.accounts.map((account) => {
      const model = modelForAccount(account, runtime);
      const assignedAgents = Object.values(runtime.assignments || {})
        .filter((assignment) => assignment.account_id === account.id)
        .map((assignment) => runtime.agents.find((agent) => agent.id === assignment.agent_id))
        .filter((agent): agent is { id: string; name: string } => Boolean(agent));
      return { account, model, assignedAgents };
    });
  }, [runtime]);

  const uniqueAdminModels = useMemo(() => new Set(adminConsoleCards.map((card) => providerModelLabel(card.account, card.model)).filter(Boolean)), [adminConsoleCards]);
  const usageModels = costs?.model_usage_models?.length ? costs.model_usage_models : costs?.model_usage ? [costs.model_usage] : [];

  const load = async () => {
    try {
      const [data, runtimeData, costData] = await Promise.all([
        request<RouterConfig>("/api/model-router"),
        request<AgentRuntimeSwitcher>("/api/agent-runtimes"),
        request<CostsResponse>("/api/costs?days=30"),
      ]);
      setDraft(JSON.parse(JSON.stringify(data)));
      setRuntime(runtimeData);
      setCosts(costData);
      setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true); setStatus("Saving routing policy…");
    try {
      const allowedModelIds = new Set(adminConsoleCards.map((card) => card.model?.id).filter(Boolean));
      const adminConsoleModelsOnly = draft.models.filter((model) => allowedModelIds.has(model.id));
      const data = await request<RouterConfig>("/api/model-router", { method: "POST", body: JSON.stringify({ ...draft, models: adminConsoleModelsOnly }) });
      setDraft(JSON.parse(JSON.stringify(data))); setStatus("Saved. Model allow-list now only contains models referenced by the Hermes Admin Console runtime accounts.");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const testRoute = async () => {
    setStatus("Analysing task complexity and selecting from Admin Console models…");
    try {
      const data = await request<RoutePlan>("/api/model-router/route", { method: "POST", body: JSON.stringify({ instruction }) });
      setPlan(data); setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  };

  return <div className="page router-page">
    <section className="hero router-hero">
      <div>
        <span className="stub-tag">SETTINGS · MODELS</span>
        <div className="hero-title-with-help"><h1>Models & rate limits</h1><InfoTooltip label="About Models & rate limits">This page mirrors the Hermes Admin Console runtime accounts. It separates Codex quota buckets by authorised account while showing the actual provider/model pair assigned to each account.</InfoTooltip></div>
        <p>Melkizac/default and Andrej/dev-ops are separated by Codex credential/quota bucket, not by model ID. Both currently run <b>openai-codex/gpt-5.5</b>; new DevOps Builder sessions route through <b>codex-Melverick</b>.</p>
      </div>
      <button className="btn dark" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Admin Console allow-list"}</button>
    </section>

    <section className="metrics-grid router-metrics">
      <div className="metric"><span>Codex accounts</span><b>{adminConsoleCards.length}</b><small>authorised quota buckets from Admin Console</small></div>
      <div className="metric"><span>Unique model IDs</span><b>{uniqueAdminModels.size}</b><small>{Array.from(uniqueAdminModels).join(", ") || "none assigned"}</small></div>
      <div className="metric"><span>Agents routed</span><b>{runtime.summary.assigned || 0}</b><small>new sessions use assigned account/model</small></div>
      <div className="metric"><span>Hidden from page</span><b>{Math.max(0, (draft.models?.length || 0) - uniqueAdminModels.size)}</b><small>models not listed in Admin Console</small></div>
    </section>

    {status && <div className="org-warning">{status}</div>}

    <section className="router-panel hermes-cli-panel">
      <div className="section-head">
        <div>
          <h2>Hermes Admin Console source of truth</h2>
          <p>Only runtime accounts listed by the Hermes Admin Console are shown below. Model rows that exist only in the legacy router registry are intentionally hidden from this Settings page.</p>
        </div>
        <button className="btn ghost" onClick={() => void load()}>Refresh Admin Console state</button>
      </div>
      <div className="router-cli-grid">
        <div><span>Melkizac/default</span><b>Codex-Nexius</b></div>
        <div><span>Andrej/dev-ops</span><b>codex-Melverick</b></div>
        <div><span>Provider</span><b>openai-codex</b></div>
        <div><span>Main model</span><b>gpt-5.5</b></div>
      </div>
      <p className="muted">Separation is by authorised Codex account / quota bucket. HMC runtime routing assigns Andrej / DevOps Builder to codex-Melverick for new sessions.</p>
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Authorised Codex accounts & rate limits</h2><p>These cards are generated from <code>/api/agent-runtimes</code>, not from legacy router-only models. Unlisted models are not rendered.</p></div></div>
      <div className="router-model-grid">
        {adminConsoleCards.map((card) => <AccountModelCard key={card.account.id} card={card} usage={findUsageForModel(card.model, usageModels)} />)}
      </div>
      {adminConsoleCards.length === 0 && <div className="empty big">No Hermes Admin Console runtime accounts found.</div>}
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Auto-selection policy</h2><p>Mission Control can still classify task complexity and route against the Admin Console allow-list. Account/quota selection comes from each agent runtime assignment.</p></div><label className="toggle-line"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Auto-select models for chat routing</label></div>
      <textarea className="policy-textarea" value={String(draft.policy?.goal || "")} onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, goal: e.target.value } })} />
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Test auto-selection</h2><p>Paste a human instruction and Mission Control will classify complexity using the saved Admin Console model allow-list.</p></div><button className="btn dark" onClick={() => void testRoute()}>Route this task</button></div>
      <textarea className="policy-textarea tall" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      {plan && <div className="route-plan">
        <div className="route-score"><b>{plan.complexity}</b><span>{plan.complexity_label}</span><small>Planner: {modelSummary(plan.planner_model)}</small></div>
        <div className="route-steps">{plan.steps.map((step) => <div className="route-step" key={step.id}><span>{step.purpose}</span><b>{step.title}</b><small>{modelSummary(step.assigned_model)} · complexity {step.complexity}{step.spawn_subagent ? " · spawn sub-agent" : " · direct"}</small></div>)}</div>
        <p className="muted">{plan.cost_control?.estimated_savings}</p>
      </div>}
    </section>
  </div>;
}
