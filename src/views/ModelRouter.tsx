import { useEffect, useMemo, useState } from "react";
import { InfoTooltip } from "../components/InfoTooltip";

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

const emptyConfig: RouterConfig = { enabled: true, updated_at: "", policy: {}, models: [], summary: { total: 0, enabled: 0, authorized: 0, frontier: 0 } };

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

function authLabel(model: RouterModel) {
  if (!model.enabled) return "disabled";
  if (model.authorized) return "authorised";
  return "not authorised";
}

function ModelEditor({ model, onChange, onRemove }: { model: RouterModel; onChange: (m: RouterModel) => void; onRemove: () => void }) {
  return <article className={`router-model-card ${model.enabled ? "" : "disabled"}`}>
    <div className="router-model-head">
      <div><b>{model.label || model.model}</b><small>{modelSummary(model)}</small></div>
      <span className={`auth-pill ${model.enabled && model.authorized ? "ok" : "missing"}`}>{authLabel(model)}</span>
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
    <div className="router-actions"><label className="toggle-line"><input type="checkbox" checked={model.enabled} onChange={(e) => onChange({ ...model, enabled: e.target.checked })} /> Enabled for agent assignment</label><button className="btn ghost small" onClick={onRemove}>Remove</button></div>
  </article>;
}

export function ModelRouter() {
  const [draft, setDraft] = useState<RouterConfig>(emptyConfig);
  const [instruction, setInstruction] = useState("Plan and execute a client-facing automation feature, split the work into sub-agents, then verify the result and control cost.");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [status, setStatus] = useState<string>("Loading…");
  const [saving, setSaving] = useState(false);

  const authorizedModels = useMemo(() => draft.models.filter((model) => model.enabled && model.authorized), [draft.models]);
  const blockedModels = useMemo(() => draft.models.filter((model) => !model.enabled || !model.authorized), [draft.models]);

  const load = async () => {
    try {
      const data = await request<RouterConfig>("/api/model-router");
      setDraft(JSON.parse(JSON.stringify(data)));
      setStatus("");
    } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { void load(); }, []);

  const save = async () => {
    setSaving(true); setStatus("Saving model allow-list…");
    try {
      const data = await request<RouterConfig>("/api/model-router", { method: "POST", body: JSON.stringify(draft) });
      setDraft(JSON.parse(JSON.stringify(data))); setStatus("Saved. Authorisation status refreshed from server-side env vars. Agent selectors will only show authorised + enabled models.");
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
    setStatus("Added the current Hermes CLI default model to the Mission Control allow-list. Save to authorise it for agent assignment.");
  };

  const hermesActive = draft.hermes_settings?.active;

  return <div className="page router-page">
    <section className="hero router-hero">
      <div>
        <span className="stub-tag">MODEL ROUTER</span>
        <div className="hero-title-with-help"><h1>Authorised models available for agents</h1><InfoTooltip label="About Model Router">Register models, verify server-side authorisation, and control which models may be assigned from each agent detail drawer.</InfoTooltip></div>
        <p>Only authorised and enabled models can be assigned to agents. Secrets stay server-side; this page shows model availability and credential status only.</p>
      </div>
      <button className="btn dark" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save allow-list"}</button>
    </section>

    <section className="metrics-grid router-metrics">
      <div className="metric"><span>Registered</span><b>{draft.summary?.total ?? draft.models.length}</b><small>models in allow-list</small></div>
      <div className="metric"><span>Assignable</span><b>{authorizedModels.length}</b><small>authorised + enabled</small></div>
      <div className="metric"><span>Blocked</span><b>{blockedModels.length}</b><small>disabled or missing credential</small></div>
      <div className="metric"><span>Policy</span><b>{draft.enabled ? "ON" : "OFF"}</b><small>{draft.updated_at ? `saved ${draft.updated_at}` : "auto-selection gate"}</small></div>
    </section>

    {status && <div className="org-warning">{status}</div>}

    <section className="router-panel hermes-cli-panel">
      <div className="section-head">
        <div>
          <h2>Hermes CLI model settings</h2>
          <p>The allow-list reads the active Hermes CLI model from config.yaml and checks authorisation from Hermes .env API keys or auth.json OAuth credentials. Secrets are never shown here.</p>
        </div>
        <button className="btn dark" onClick={addHermesCliModel}>Add current Hermes CLI model</button>
      </div>
      <div className="router-cli-grid">
        <div><span>Current provider</span><b>{hermesActive?.provider || "not set"}</b></div>
        <div><span>Current model</span><b>{hermesActive?.model || "not set"}</b></div>
        <div><span>Credential source</span><b>{hermesActive?.auth_provider_configured ? "Hermes auth" : hermesActive?.credential_env || "not set"}</b></div>
        <div><span>Config</span><b className="mono">{draft.hermes_settings?.config_path || "~/.hermes/config.yaml"}</b></div>
      </div>
      {(draft.hermes_settings?.auth_providers?.length ?? 0) > 0 && <p className="muted">Hermes auth providers detected: {draft.hermes_settings?.auth_providers.join(", ")}</p>}
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Assignable model list</h2><p>These are the models an operator can select in the agent detail drawer. Save changes here, then open an agent and use the model dropdown selector.</p></div><button className="btn ghost" onClick={addModel}>Add model manually</button></div>
      <div className="router-model-grid">{draft.models.map((model, index) => <ModelEditor key={model.id || index} model={model} onChange={(next) => setDraft({ ...draft, models: draft.models.map((m, i) => i === index ? next : m) })} onRemove={() => setDraft({ ...draft, models: draft.models.filter((_, i) => i !== index) })} />)}</div>
      {draft.models.length === 0 && <div className="empty big">No models registered yet. Add the current Hermes CLI model or add one manually.</div>}
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Auto-selection policy</h2><p>Mission Control can still classify task complexity and propose the best authorised model tier, but actual per-agent assignment is now made from each agent detail drawer.</p></div><label className="toggle-line"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Auto-select models for chat routing</label></div>
      <textarea className="policy-textarea" value={String(draft.policy?.goal || "")} onChange={(e) => setDraft({ ...draft, policy: { ...draft.policy, goal: e.target.value } })} />
    </section>

    <section className="router-panel">
      <div className="section-head"><div><h2>Test auto-selection</h2><p>Paste a human instruction and Mission Control will classify complexity, choose a planner model, and assign suitable authorised model tiers to sub-agent steps.</p></div><button className="btn dark" onClick={() => void testRoute()}>Route this task</button></div>
      <textarea className="policy-textarea tall" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
      {plan && <div className="route-plan">
        <div className="route-score"><b>{plan.complexity}</b><span>{plan.complexity_label}</span><small>Planner: {modelSummary(plan.planner_model)}</small></div>
        <div className="route-steps">{plan.steps.map((step) => <div className="route-step" key={step.id}><span>{step.purpose}</span><b>{step.title}</b><small>{modelSummary(step.assigned_model)} · complexity {step.complexity}{step.spawn_subagent ? " · spawn sub-agent" : " · direct"}</small></div>)}</div>
        <p className="muted">{plan.cost_control?.estimated_savings}</p>
      </div>}
    </section>
  </div>;
}
