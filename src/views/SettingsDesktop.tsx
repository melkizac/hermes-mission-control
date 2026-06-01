import { useEffect, useState } from "react";

type DesktopGateway = {
  mode: string;
  name: string;
  remoteUrl: string;
  sessionToken: string;
  tokenPreview?: string | null;
  tokenSet: boolean;
  localPort: number;
  service: { name: string; active: string };
  local: { ok: boolean; http_code?: number | null; error?: string | null; status?: Record<string, unknown> };
  desktopSteps: string[];
  notes: string[];
};

async function loadDesktopGateway(): Promise<DesktopGateway> {
  const url = `${window.location.protocol}//${window.location.host}/api/desktop-gateway`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as DesktopGateway;
}

async function copyText(value: string, label: string, setCopied: (value: string) => void) {
  await navigator.clipboard.writeText(value);
  setCopied(label);
  window.setTimeout(() => setCopied(""), 1800);
}

export function SettingsDesktop() {
  const [data, setData] = useState<DesktopGateway | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setData(await loadDesktopGateway());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const healthy = Boolean(data?.local?.ok && data?.tokenSet && data?.service?.active === "active");

  return (
    <section className="settings-page scroll">
      <header className="settings-hero">
        <div>
          <span className="eyebrow">Hermes Desktop integration</span>
          <h1>Connect Mission Control to the Windows desktop app</h1>
          <p>
            Mission Control now exposes a Hermes dashboard/TUI backend that Hermes Desktop can use in Remote gateway mode. This turns the desktop app into a rich console for this VPS Hermes runtime while Mission Control remains the orchestration cockpit.
          </p>
        </div>
        <button className="btn" onClick={() => void refresh()} disabled={loading}>
          Refresh {loading ? "Checking…" : "Refresh"}
        </button>
      </header>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-metrics">
        <div className={`settings-metric ${healthy ? "good" : "bad"}`}>
          <span>Remote gateway</span>
          <b>{healthy ? "Ready" : "Check"}</b>
          <small>{data?.local?.ok ? `HTTP ${data.local.http_code}` : data?.local?.error || "Loading status"}</small>
        </div>
        <div className="settings-metric">
          <span>Systemd service</span>
          <b>{data?.service?.active || "—"}</b>
          <small>{data?.service?.name || "hermes-desktop-gateway.service"}</small>
        </div>
        <div className="settings-metric">
          <span>Execution target</span>
          <b>VPS</b>
          <small>Remote desktop mode controls this Hermes server</small>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-panel settings-span-7">
          <div className="settings-panel-head">
            <div><span>🖥️</span><span>Paste into Hermes Desktop</span></div>
            {copied && <small>{copied} copied</small>}
          </div>

          <label className="settings-copy-row">
            <span>Remote URL</span>
            <code>{data?.remoteUrl || "Loading…"}</code>
            <button className="btn" disabled={!data?.remoteUrl} onClick={() => data?.remoteUrl && copyText(data.remoteUrl, "Remote URL", setCopied)}>Copy</button>
          </label>

          <label className="settings-copy-row">
            <span>Session token</span>
            <code>{data?.sessionToken || "Loading…"}</code>
            <button className="btn" disabled={!data?.sessionToken} onClick={() => data?.sessionToken && copyText(data.sessionToken, "Token", setCopied)}>Copy</button>
          </label>

          <div className="settings-actions">
            <a className="btn dark" href={data?.remoteUrl || "/desktop-gateway"} target="_blank" rel="noreferrer">Open remote backend</a>
          </div>
        </article>

        <article className="settings-panel settings-span-5">
          <div className="settings-panel-head"><div><span>✅</span><span>Desktop setup steps</span></div></div>
          <ol className="settings-steps">
            {(data?.desktopSteps || []).map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>

        <article className="settings-panel settings-span-7">
          <div className="settings-panel-head"><div><span>⌁</span><span>Connection contract</span></div></div>
          <div className="settings-kv">
            <div><span>Base route</span><b>/desktop-gateway</b></div>
            <div><span>Local upstream</span><b>127.0.0.1:{data?.localPort || 9119}</b></div>
            <div><span>WebSocket path</span><b>/desktop-gateway/api/ws?token=…</b></div>
            <div><span>Token</span><b>{data?.tokenPreview || "not set"}</b></div>
          </div>
          <pre>{JSON.stringify(data?.local?.status || data?.local || {}, null, 2)}</pre>
        </article>

        <article className="settings-panel settings-span-5">
          <div className="settings-panel-head"><div><span>✅</span><span>Operating notes</span></div></div>
          <ul className="settings-notes">
            {(data?.notes || []).map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>
      </div>
    </section>
  );
}
