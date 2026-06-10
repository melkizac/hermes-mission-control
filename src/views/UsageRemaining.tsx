import { useEffect, useState } from "react";
import type { CostsResponse, ModelUsageWindow } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";

const client = new HttpHermesClient();

function pctLabel(value?: number) {
  return `${Math.round(Number(value ?? 0))}%`;
}

function remainingPct(window: ModelUsageWindow) {
  const rawExplicit = window.remaining_percent;
  const explicit = rawExplicit === undefined || rawExplicit === null ? NaN : Number(rawExplicit);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  return null;
}

function UsageLimitRow({ window, available = true }: { window: ModelUsageWindow; available?: boolean }) {
  const remaining = remainingPct(window);
  const label = remaining === null ? "—" : pctLabel(remaining);
  return (
    <div className="usage-limit-row usage-limit-compact">
      <div className="usage-limit-main usage-limit-grid">
        <b>{window.label}</b>
        <strong>{label}</strong>
        <span>{window.reset_label || "—"}</span>
      </div>
      <div className="usage-limit-progress" aria-label={`${window.label} has ${label} remaining`}>
        <i className={available && remaining !== null ? "" : "unavailable"} style={{ width: `${available && remaining !== null ? remaining : 0}%` }} />
      </div>
      <div className="usage-limit-meta">
        <span>{remaining === null ? "provider quota unavailable" : `${label} remaining`}</span>
        <span>{window.reset_label ? `resets ${window.reset_label}` : "reset unavailable"}</span>
      </div>
    </div>
  );
}

function ModelRateLimitCard({ usage }: { usage: NonNullable<CostsResponse["model_usage"]> }) {
  const available = usage.available !== false && !usage.error;
  return (
    <article className={`usage-card usage-model-card ${available ? "" : "usage-unavailable"}`}>
      <div className="usage-card-head">
        <div>
          <span>{usage.selected ? "Selected model" : "Model"}</span>
          <b>{usage.selected_model || "—"}</b>
        </div>
        <small>{usage.source || "Provider rate-limit snapshot"}</small>
      </div>
      {available ? (
        <div className="usage-limit-list">
          {usage.aliases?.length ? (
            <div className="usage-model-aliases">
              Melkizac model id: <b>{usage.aliases.join(", ")}</b>
            </div>
          ) : null}
          <UsageLimitRow window={usage.daily} available={available} />
          <UsageLimitRow window={usage.weekly} available={available} />
        </div>
      ) : (
        <div className="usage-unavailable-copy">
          {usage.error || "Provider rate-limit snapshot is not connected for this model yet."}
        </div>
      )}
    </article>
  );
}

export function UsageRemaining() {
  const { uiMode } = useStore();
  const [selectedModel, setSelectedModel] = useState("");
  const [data, setData] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        const next = await client.getCosts({ days: 30, model: selectedModel || undefined });
        if (!alive) return;
        setData(next);
        setError(next.error ?? null);
        if (!selectedModel && next.model_usage?.selected_model) setSelectedModel(next.model_usage.selected_model);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Unable to load rate limits");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [selectedModel]);

  const usage = data?.model_usage;
  const usageModels = data?.model_usage_models?.length ? data.model_usage_models : usage ? [usage] : [];
  const models = usage?.models?.length ? usage.models : selectedModel ? [selectedModel] : [];

  return (
    <div className="usage-page scroll">
      <header className="usage-hero">
        <div>
          <span className="stub-tag">RATE LIMITS</span>
          <h1>Rate limits</h1>
          <p>Workspace model entitlement view for the selected model. Admin cost analytics stay in Admin → Costs / Usage.</p>
        </div>
        {uiMode === "admin" ? (
          <label className="usage-model-select">
            <span>Selected model</span>
            <select value={selectedModel || usage?.selected_model || ""} onChange={(event) => setSelectedModel(event.target.value)}>
              {models.map((model) => <option key={model} value={model}>{model}</option>)}
              {!models.length && <option value="">Rate limits loading…</option>}
            </select>
          </label>
        ) : (
          <div className="usage-model-select usage-model-static">
            <span>Main model</span>
            <b>{usage?.selected_model || selectedModel || "—"}</b>
          </div>
        )}
      </header>

      {error && <div className="cost-error">{error}</div>}

      <section className="usage-model-grid" aria-busy={loading}>
        {usageModels.length ? (
          usageModels.map((item) => <ModelRateLimitCard key={item.selected_model || item.source} usage={item} />)
        ) : (
          <article className="usage-card">
            <div className="empty big">No provider rate-limit data is available yet.</div>
          </article>
        )}
      </section>
    </div>
  );
}
