import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";

type DesktopGatewayHealth = {
  remoteUrl?: string;
  tokenSet?: boolean;
  tokenPreview?: string | null;
  service?: { name?: string; active?: string };
  local?: { ok?: boolean; http_code?: number | null; error?: string | null };
};

async function loadDesktopGateway(): Promise<DesktopGatewayHealth> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/desktop-gateway`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as DesktopGatewayHealth;
}

function healthLabel(data: DesktopGatewayHealth | null, error: string) {
  if (error) return "Check gateway";
  if (!data) return "Checking…";
  if (data.local?.ok && data.service?.active === "active") return "Online";
  return "Attention needed";
}

export function HermesDesktopAdmin() {
  const [data, setData] = useState<DesktopGatewayHealth | null>(null);
  const [error, setError] = useState("");
  const [frameKey, setFrameKey] = useState(0);

  async function refresh() {
    setError("");
    try {
      setData(await loadDesktopGateway());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const status = healthLabel(data, error);
  const statusTone = status === "Online" ? "good" : status === "Checking…" ? "warn" : "bad";

  return (
    <section className="hermes-desktop-admin" aria-label="Hermes Desktop admin console">
      <header className="hermes-desktop-admin-bar">
        <div>
          <span className="eyebrow">Admin Console</span>
          <h1>Hermes Desktop</h1>
        </div>
        <div className="hermes-desktop-admin-actions">
          <span className={`hermes-desktop-status ${statusTone}`}>{status}</span>
          {data?.service?.active && <span className="hermes-desktop-meta">service: {data.service.active}</span>}
          {error && <span className="hermes-desktop-error">{error}</span>}
          <button className="task-icon-action dark" aria-label="Refresh Hermes Desktop health" title="Refresh Hermes Desktop health" onClick={() => void refresh()}>
            <Icon name="refresh" size={18} />
          </button>
          <button className="btn ghost small" onClick={() => setFrameKey((value) => value + 1)}>Reload desktop</button>
          <a className="btn dark small" href="/desktop-gateway/" target="_blank" rel="noreferrer">Open full screen</a>
        </div>
      </header>
      <iframe
        key={frameKey}
        className="hermes-desktop-frame"
        src="/desktop-gateway/"
        title="Hermes Desktop"
        allow="clipboard-read; clipboard-write"
      />
    </section>
  );
}
