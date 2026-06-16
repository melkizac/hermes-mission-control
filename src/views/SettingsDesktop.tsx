import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import type { ViewKey } from "../types";
import { Icon } from "../components/Icon";

type Health = { ok: boolean; http_code?: number | null; error?: string | null; status?: Record<string, unknown> };
type Target = { id: string; label: string; description: string; ready: boolean; url?: string };
type WindowsGateway = {
  mode: string;
  name: string;
  configured: boolean;
  url: string;
  token?: string;
  tokenPreview?: string | null;
  tokenSet: boolean;
  approvedFolders: string[];
  recommendedFolders: string[];
  health: Health;
  setup: { localCommand: string; tunnelExamples: string[] };
};
type DesktopGateway = {
  mode: string;
  name: string;
  remoteUrl: string;
  sessionToken: string;
  tokenPreview?: string | null;
  tokenSet: boolean;
  localPort: number;
  service: { name: string; active: string };
  local: Health;
  windows: WindowsGateway;
  targets: Target[];
  desktopSteps: string[];
  notes: string[];
};

type WindowsForm = { url: string; token: string; approvedFolders: string };

type AdminCard = { key: ViewKey | "docs"; title: string; eyebrow: string; body: string };

const adminCards: AdminCard[] = [
  { key: "runtimes", eyebrow: "Runtimes", title: "Runtime Connectors", body: "Connect OpenClaw, NanoClaw, NemoClaw, Codex, Claude Code, and custom agent frameworks." },
  { key: "settings", eyebrow: "Gateway", title: "Desktop / Gateway", body: "Configure VPS desktop gateway, Windows local gateway, approved folders, and execution target." },
  { key: "models", eyebrow: "Models", title: "Models & Rate Limits", body: "Manage authorised AI models, routing metadata, and provider quota remaining in one Settings surface." },
  { key: "skills", eyebrow: "Skills", title: "Skills Library", body: "Review installed skills and capability packs without crowding the operator sidebar." },
  { key: "research-runs", eyebrow: "Research", title: "Research Runs", body: "Structured investigations with sources, findings, confidence, recommendations, and evidence." },
  { key: "costs", eyebrow: "Costs", title: "Usage & Costs", body: "Token spend, model usage, and cost trends for governance and budget checks." },
  { key: "agent-org", eyebrow: "Structure", title: "Agent Org", body: "Manage agent organization, goals, and operating model details." },
  { key: "second-brain", eyebrow: "Knowledge", title: "Second Brain", body: "Inspect knowledge-base health, sources, and search status." },
  { key: "docs", eyebrow: "Help", title: "Docs & Guides", body: "Open Mission Control documentation and operating guides." },
];

async function loadDesktopGateway(): Promise<DesktopGateway> {
  const url = `${window.location.protocol}//${window.location.host}/api/desktop-gateway`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data as DesktopGateway;
}

async function saveWindowsGateway(form: WindowsForm, keepToken: boolean): Promise<WindowsGateway> {
  const res = await fetch("/api/windows-gateway/config", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: form.url.trim(),
      token: form.token.trim(),
      keepToken,
      approvedFolders: form.approvedFolders.split(/\n|\|/).map((x) => x.trim()).filter(Boolean),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || res.statusText);
  return data.windows as WindowsGateway;
}

async function copyText(value: string, label: string, setCopied: (value: string) => void) {
  await navigator.clipboard.writeText(value);
  setCopied(label);
  window.setTimeout(() => setCopied(""), 1800);
}

function statusText(health?: Health) {
  if (!health) return "Loading";
  if (health.ok) return `HTTP ${health.http_code || 200}`;
  return health.error || `HTTP ${health.http_code || "—"}`;
}

export function SettingsDesktop() {
  const { setView } = useStore();
  const [data, setData] = useState<DesktopGateway | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("vps");
  const [form, setForm] = useState<WindowsForm>({ url: "", token: "", approvedFolders: "" });

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const next = await loadDesktopGateway();
      setData(next);
      setForm({
        url: next.windows?.url || "",
        token: "",
        approvedFolders: (next.windows?.approvedFolders || []).join("\n"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSaveWindows() {
    setSaving(true);
    setError("");
    try {
      const windows = await saveWindowsGateway(form, Boolean(data?.windows?.tokenSet && !form.token.trim()));
      setData((prev) => prev ? { ...prev, windows } : prev);
      setForm((prev) => ({ ...prev, token: "", approvedFolders: windows.approvedFolders.join("\n") }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const vpsReady = Boolean(data?.local?.ok && data?.tokenSet && data?.service?.active === "active");
  const windowsReady = Boolean(data?.windows?.configured && data?.windows?.health?.ok);
  const target = useMemo(() => (data?.targets || []).find((x) => x.id === selectedTarget), [data, selectedTarget]);

  return (
    <section className="settings-page scroll">
      <header className="settings-hero">
        <div>
          <span className="eyebrow">Admin & Setup</span>
          <h1>Keep technical setup out of the operator cockpit</h1>
          <p>
            Projects and Task Board now carry the core operating model: projects are operating spaces, goals define desired results, missions/runs move those goals, tasks are individual actions, and evidence proves completion. Workflows and research stay available here as distinct reusable/investigation features instead of a generic Work page.
          </p>
        </div>
        <button className="task-icon-action dark" aria-label={loading ? "Checking gateway" : "Refresh gateway"} title={loading ? "Checking gateway" : "Refresh gateway"} onClick={() => void refresh()} disabled={loading}>
          {loading ? "…" : <Icon name="refresh" size={18} />}
        </button>
      </header>

      <div className="admin-hub-grid">
        {adminCards.map((card) => (
          <button
            key={card.key}
            className={`admin-hub-card ${card.key === "settings" ? "on" : ""}`}
            onClick={() => {
              if (card.key === "docs") window.location.href = "/mission-control-docs";
              else setView(card.key);
            }}
          >
            <span>{card.eyebrow}</span>
            <b>{card.title}</b>
            <small>{card.body}</small>
          </button>
        ))}
      </div>

      <div className="settings-section-title">
        <span className="eyebrow">Desktop / Gateway</span>
        <h2>Choose where Mission Control executes work</h2>
      </div>

      {error && <div className="settings-error">{error}</div>}

      <div className="settings-metrics">
        <div className={`settings-metric ${vpsReady ? "good" : "bad"}`}>
          <span>VPS gateway</span>
          <b>{vpsReady ? "Ready" : "Check"}</b>
          <small>{statusText(data?.local)}</small>
        </div>
        <div className={`settings-metric ${windowsReady ? "good" : "bad"}`}>
          <span>Windows desktop</span>
          <b>{windowsReady ? "Ready" : data?.windows?.configured ? "Offline" : "Not set"}</b>
          <small>{statusText(data?.windows?.health)}</small>
        </div>
        <div className="settings-metric">
          <span>Current target</span>
          <b>{target?.label || "Run on VPS"}</b>
          <small>{target?.description || "Default server runtime"}</small>
        </div>
      </div>

      <div className="settings-targets">
        {(data?.targets || []).map((item) => (
          <button key={item.id} className={`settings-target ${selectedTarget === item.id ? "on" : ""}`} onClick={() => setSelectedTarget(item.id)}>
            <b>{item.label}</b>
            <span>{item.ready ? "Ready" : "Needs setup"}</span>
            <p>{item.description}</p>
          </button>
        ))}
      </div>

      <div className="settings-grid">
        <article className="settings-panel settings-span-7">
          <div className="settings-panel-head">
            <div><span>🖥️</span><span>VPS gateway for Hermes Desktop</span></div>
            {copied && <small>{copied} copied</small>}
          </div>

          <label className="settings-copy-row">
            <span>Remote URL</span>
            <code>{data?.remoteUrl || "Loading…"}</code>
            <button className="btn" disabled={!data?.remoteUrl} onClick={() => data?.remoteUrl && copyText(data.remoteUrl, "VPS URL", setCopied)}>Copy</button>
          </label>

          <label className="settings-copy-row">
            <span>Session token</span>
            <code>{data?.sessionToken || "Loading…"}</code>
            <button className="btn" disabled={!data?.sessionToken} onClick={() => data?.sessionToken && copyText(data.sessionToken, "VPS token", setCopied)}>Copy</button>
          </label>

          <div className="settings-actions">
            <a className="btn dark" href={data?.remoteUrl || "/desktop-gateway"} target="_blank" rel="noreferrer">Open VPS backend</a>
          </div>
        </article>

        <article className="settings-panel settings-span-5">
          <div className="settings-panel-head"><div><span>✅</span><span>Mode guide</span></div></div>
          <ol className="settings-steps">
            {(data?.desktopSteps || []).map((step) => <li key={step}>{step}</li>)}
          </ol>
        </article>

        <article className="settings-panel settings-span-7">
          <div className="settings-panel-head"><div><span>🪟</span><span>Windows Desktop local gateway</span></div></div>
          <label className="settings-field">
            <span>Reachable Windows gateway URL</span>
            <input value={form.url} onChange={(e) => setForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="http://windows-tailnet-name:9119 or http://127.0.0.1:19119" />
          </label>
          <label className="settings-field">
            <span>Windows gateway session token</span>
            <input type="password" value={form.token} onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))} placeholder={data?.windows?.tokenSet ? `Stored ${data.windows.tokenPreview}; leave blank to keep` : "Paste token from Windows Hermes dashboard"} />
          </label>
          <label className="settings-field">
            <span>Approved Windows folders</span>
            <textarea value={form.approvedFolders} onChange={(e) => setForm((prev) => ({ ...prev, approvedFolders: e.target.value }))} placeholder={(data?.windows?.recommendedFolders || []).join("\n")} />
          </label>
          <div className="settings-actions">
            <button className="btn dark" onClick={() => void onSaveWindows()} disabled={saving}>{saving ? "Saving…" : "Save & test Windows gateway"}</button>
          </div>
        </article>

        <article className="settings-panel settings-span-5">
          <div className="settings-panel-head"><div><span>🔐</span><span>Windows setup contract</span></div></div>
          <div className="settings-kv one-col">
            <div><span>Local Windows command</span><b>{data?.windows?.setup?.localCommand || "hermes dashboard --tui"}</b></div>
            <div><span>Token</span><b>{data?.windows?.tokenPreview || "not stored"}</b></div>
            <div><span>Approved folders</span><b>{data?.windows?.approvedFolders?.length || 0} folder(s)</b></div>
          </div>
          <ul className="settings-notes">
            {(data?.windows?.setup?.tunnelExamples || []).map((note) => <li key={note}>{note}</li>)}
          </ul>
        </article>

        <article className="settings-panel settings-span-7">
          <div className="settings-panel-head"><div><span>⌁</span><span>Live health</span></div></div>
          <div className="settings-kv">
            <div><span>VPS upstream</span><b>127.0.0.1:{data?.localPort || 9119}</b></div>
            <div><span>VPS WebSocket</span><b>/desktop-gateway/api/ws?token=…</b></div>
            <div><span>Windows URL</span><b>{data?.windows?.url || "not configured"}</b></div>
            <div><span>Windows status</span><b>{statusText(data?.windows?.health)}</b></div>
          </div>
          <pre>{JSON.stringify({ vps: data?.local?.status || data?.local, windows: data?.windows?.health }, null, 2)}</pre>
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
