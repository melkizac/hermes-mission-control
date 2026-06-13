import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRecord, RuntimeRegistryResponse } from "../types";
import { HttpHermesClient } from "../services/httpHermesClient";
import { Icon } from "../components/Icon";
import { InfoTooltip } from "../components/InfoTooltip";

const client = new HttpHermesClient();

type RuntimeDrawerTab = "overview" | "actions" | "advanced";
type RuntimePageTab = "overview" | "connected" | "tokens" | "events" | "advanced";

function statusTone(status: string) {
  if (status === "online") return "good";
  if (status === "offline") return "bad";
  return "warn";
}

function readinessLabel(runtime: RuntimeRecord) {
  const flags = [];
  if (runtime.readiness.representable) flags.push("representable");
  if (runtime.readiness.monitorable) flags.push("monitorable");
  if (runtime.readiness.controllable) flags.push("controllable");
  return flags.join(" · ") || "not connected";
}

function evidencePreview(runtime: RuntimeRecord) {
  const ev = runtime.evidence ?? {};
  if (typeof ev.version === "string" && ev.version !== "unknown") return `version ${ev.version}`;
  if (typeof ev.command === "string") return ev.command;
  if (typeof ev.home === "string") return ev.home;
  return runtime.type.replaceAll("_", " ");
}

function runtimeMeta(runtime: RuntimeRecord) {
  const ev = runtime.evidence ?? {};
  const rows: Array<{ label: string; value: string }> = [];
  if (typeof ev.version === "string" && ev.version !== "unknown") rows.push({ label: "Version", value: ev.version });
  if (typeof ev.command === "string") rows.push({ label: "Command", value: ev.command });
  if (typeof ev.service === "string") rows.push({ label: "Service", value: ev.service });
  if (typeof ev.port === "string" || typeof ev.port === "number") rows.push({ label: "Port", value: String(ev.port) });
  if (typeof ev.home === "string") rows.push({ label: "Home", value: ev.home });
  if (typeof ev.auth === "string") rows.push({ label: "Auth", value: ev.auth });
  return rows.slice(0, 4);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(parsed));
}

export function Runtimes() {
  const [data, setData] = useState<RuntimeRegistryResponse | null>(null);
  const [connectors, setConnectors] = useState<RuntimeConnectorResponse | null>(null);
  const [newToken, setNewToken] = useState<RuntimeConnectorTokenResponse | null>(null);
  const [tokenLabel, setTokenLabel] = useState("Friend OpenClaw / NanoClaw connector");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<RuntimeDrawerTab>("overview");
  const [pageTab, setPageTab] = useState<RuntimePageTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const next = await client.listRuntimes({ q });
      const connectorNext = await client.listRuntimeConnectors();
      setData(next);
      setConnectors(connectorNext);
      setError(next.error ?? connectorNext.error ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load runtime connectors");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  const runtimes = data?.runtimes ?? [];
  const remoteRuntimes = connectors?.runtimes ?? [];
  const allRuntimeCards = useMemo(() => {
    const seen = new Set<string>();
    return [...remoteRuntimes, ...runtimes].filter((runtime) => {
      if (seen.has(runtime.id)) return false;
      seen.add(runtime.id);
      return true;
    });
  }, [remoteRuntimes, runtimes]);
  const summary = data?.summary;
  const selectedRuntime = useMemo(() => allRuntimeCards.find((runtime) => runtime.id === selected), [allRuntimeCards, selected]);
  const onlineConnected = remoteRuntimes.filter((runtime) => runtime.status === "online").length;
  const blockedCount = allRuntimeCards.filter((runtime) => runtime.status === "offline" || runtime.status === "degraded").length;

  const openRuntime = (runtime: RuntimeRecord) => {
    setSelected(runtime.id);
    setDrawerTab("overview");
  };

  const createConnector = async () => {
    try {
      setError(null);
      const result = await client.createRuntimeConnectorToken({
        label: tokenLabel,
        allowed_types: ["openclaw", "nanoclaw", "nemoclaw", "codex", "claude-code", "custom"],
      });
      setNewToken(result);
      setPageTab("tokens");
      const connectorNext = await client.listRuntimeConnectors();
      setConnectors(connectorNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create connector token");
    }
  };

  const revokeConnector = async (id: string) => {
    try {
      setError(null);
      await client.revokeRuntimeConnectorToken(id);
      const connectorNext = await client.listRuntimeConnectors();
      setConnectors(connectorNext);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke connector token");
    }
  };

  const installSnippet = newToken ? connectorSnippet(newToken) : null;

  return (
    <div className="runtimes-page skills-page skills-drawer-first scroll">
      <header className="skills-hero runtimes-hero">
        <div>
          <span className="stub-tag">RUNTIME CONNECTORS</span>
          <div className="hero-title-with-help">
            <h1>Runtime Connectors</h1>
            <InfoTooltip label="About runtime connectors">
              Connect Hermes Desktop, OpenClaw, NanoClaw, NemoClaw, Codex, Claude Code, and custom worker backends into one Mission Control view. The primary path is Connector V2: token, register, heartbeat, event stream.
            </InfoTooltip>
          </div>
        </div>
        <div className="task-hero-actions">
          <button className="task-icon-action dark" aria-label="Refresh runtimes" title="Refresh runtimes" onClick={() => void load()}>
            <Icon name="refresh" size={18} />
          </button>
        </div>
      </header>

      <section className="skills-metrics">
        <Metric label="Connected" value={connectors?.summary.connected ?? remoteRuntimes.length} sub={`${onlineConnected || connectors?.summary.online || 0} online now`} tone="good" />
        <Metric label="Connector tokens" value={connectors?.summary.tokens ?? 0} sub={`${connectors?.summary.active_tokens ?? 0} active`} />
        <Metric label="Monitorable" value={summary?.monitorable ?? 0} sub="Evidence sources found" />
        <Metric label="Needs attention" value={blockedCount} sub="Offline or degraded" tone={blockedCount ? "bad" : undefined} />
      </section>

      <section className="skills-filters runtimes-filters">
        <div className="filter-search-with-view">
          <label>
            <span>Search</span>
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Hermes Desktop, OpenClaw, Codex, Claude, NanoClaw…" />
          </label>
        </div>
        <div className="runtime-tabbar" role="tablist" aria-label="Runtime connector sections">
          <TabButton id="overview" tab={pageTab} setTab={setPageTab}>Overview</TabButton>
          <TabButton id="connected" tab={pageTab} setTab={setPageTab}>Connected Runtimes</TabButton>
          <TabButton id="tokens" tab={pageTab} setTab={setPageTab}>Connector Tokens</TabButton>
          <TabButton id="events" tab={pageTab} setTab={setPageTab}>Events</TabButton>
          <TabButton id="advanced" tab={pageTab} setTab={setPageTab}>Advanced</TabButton>
        </div>
      </section>

      {error && <div className="skills-error">{error}</div>}

      {(pageTab === "overview" || pageTab === "tokens") && (
        <section className="runtime-connect-panel runtime-v2-primary">
          <div className="runtime-connect-copy">
            <span className="stub-tag">RUNTIME CONNECTOR V2</span>
            <h2>Create a connector token and let a local or external runtime register itself.</h2>
            <div className="form-help"><InfoTooltip label="About Connector V2">This is now the primary Runtime Connectors workflow. Use it for Hermes Desktop/Windows bridges, OpenClaw-family runtimes, Codex, Claude Code, or a custom agent. Raw adapter evidence stays in Advanced so the daily view remains operator-clean.</InfoTooltip></div>
            <div className="runtime-connect-form">
              <input value={tokenLabel} onChange={(event) => setTokenLabel(event.target.value)} placeholder="Connector label" />
              <button className="btn dark" onClick={() => void createConnector()}>Create connector token</button>
            </div>
          </div>
          <div className="runtime-connect-status">
            <Metric label="Tokens" value={connectors?.summary.tokens ?? 0} sub={`${connectors?.summary.active_tokens ?? 0} active`} />
            <Metric label="Remote runtimes" value={connectors?.summary.connected ?? 0} sub={`${connectors?.summary.online ?? 0} online`} tone="good" />
          </div>
          {newToken && installSnippet && (
            <div className="connector-secret-box">
              <b>Copy this now — token is shown once.</b>
              <code>{newToken.secret}</code>
              <pre>{installSnippet}</pre>
            </div>
          )}
        </section>
      )}

      {pageTab === "overview" && (
        <section className="runtime-overview-grid">
          <article className="runtime-overview-card primary">
            <span>Operator view</span>
            <h2>Runtime health without raw adapter noise.</h2>
            <InfoTooltip label="About runtime tabs">Use the tabs to move from the decision layer to inventory, token control, event history, and raw adapter evidence only when needed.</InfoTooltip>
            <div className="runtime-checks">
              <b>Visible by default</b>
              <span>Connected runtimes, status, safe actions, last update, and registration health.</span>
              <b>Hidden until Advanced</b>
              <span>Raw evidence JSON, process hints, config paths, and adapter implementation details.</span>
            </div>
          </article>
          <article className="runtime-overview-card">
            <span>Connector flow</span>
            <ol>
              <li>Create a one-time token.</li>
              <li>Runtime registers with a framework and capabilities.</li>
              <li>Runtime heartbeats every 30-60 seconds.</li>
              <li>Events/log summaries appear in Mission Control.</li>
            </ol>
          </article>
          <article className="runtime-overview-card">
            <span>Current readiness</span>
            <div className="runtime-readiness-stack">
              <ReadinessLine label="Representable" value={summary?.total ?? runtimes.length} total={summary?.total ?? runtimes.length} />
              <ReadinessLine label="Monitorable" value={summary?.monitorable ?? 0} total={summary?.total ?? runtimes.length} />
              <ReadinessLine label="Controllable" value={summary?.controllable ?? 0} total={summary?.total ?? runtimes.length} />
            </div>
          </article>
        </section>
      )}

      {(pageTab === "overview" || pageTab === "connected") && (
        <section className="skills-grid skills-grid-full runtimes-grid">
          <div className="skills-panel-head">
            <span>Connected runtimes</span>
            <small>{loading ? "Loading…" : `${allRuntimeCards.length} shown · updated ${data?.updated_at ?? "—"}`}</small>
          </div>
          {allRuntimeCards.map((runtime) => (
            <article key={runtime.id} className={`skill-card runtime-card ${runtime.id === selectedRuntime?.id ? "on" : ""}`}>
              <button className="skill-card-main" onClick={() => openRuntime(runtime)}>
                <div className="skill-card-top">
                  <div className="skill-icon">⇄</div>
                  <span className={`tag ${statusTone(runtime.status)}`}>{runtime.status}</span>
                </div>
                <div className="skill-title-row">
                  <h2>{runtime.name}</h2>
                  <span className="tag muted">{runtime.type.replaceAll("_", " ")}</span>
                </div>
                <p>{runtime.summary}</p>
                <div className="runtime-card-meta">
                  {runtimeMeta(runtime).map((row) => <span key={`${runtime.id}-${row.label}`}><b>{row.label}</b>{row.value}</span>)}
                  {runtimeMeta(runtime).length === 0 && <span><b>Evidence</b>{evidencePreview(runtime)}</span>}
                </div>
                <div className="skill-chips">
                  <span>{readinessLabel(runtime)}</span>
                  <span>{runtime.safe_actions.length} safe actions</span>
                  <span>Updated {formatDate(runtime.updated_at)}</span>
                </div>
              </button>
            </article>
          ))}
          {!loading && allRuntimeCards.length === 0 && <div className="empty big">No runtimes matched this filter.</div>}
        </section>
      )}

      {pageTab === "tokens" && (
        <section className="runtime-section-card">
          <div className="skills-panel-head">
            <span>Connector tokens</span>
            <small>Revoke tokens that should no longer register runtimes.</small>
          </div>
          <div className="connector-list runtime-list-full">
            {(connectors?.tokens ?? []).map((token) => (
              <div className="connector-row" key={token.id}>
                <div>
                  <b>{token.label}</b>
                  <span>{token.id} · {token.status} · {token.allowed_types.join(", ")}</span>
                  <span>Created {formatDate(token.created_at)} · Last used {formatDate(token.last_used_at)}</span>
                </div>
                {token.status === "active" && <button className="btn ghost" onClick={() => void revokeConnector(token.id)}>Revoke</button>}
              </div>
            ))}
            {(connectors?.tokens ?? []).length === 0 && <p className="muted-copy">No connector tokens yet. Create one above to connect a local or external runtime.</p>}
          </div>
        </section>
      )}

      {pageTab === "events" && (
        <section className="runtime-section-card">
          <div className="skills-panel-head">
            <span>Connector events</span>
            <small>{(connectors?.events ?? []).length} recent events from registered runtimes.</small>
          </div>
          <div className="connector-list runtime-list-full">
            {(connectors?.events ?? []).map((event) => (
              <div className="connector-row runtime-event-row" key={event.id}>
                <div>
                  <b>{event.title}</b>
                  <span>{event.severity} · {event.kind} · {event.external_runtime_id} · {formatDate(event.created_at)}</span>
                  {event.body && <p>{event.body}</p>}
                </div>
              </div>
            ))}
            {(connectors?.events ?? []).length === 0 && <p className="muted-copy">No external runtime events yet. Once a runtime registers and sends heartbeats/events, they appear here.</p>}
          </div>
        </section>
      )}

      {pageTab === "advanced" && (
        <section className="runtime-section-card runtime-advanced">
          <div className="skills-panel-head">
            <span>Advanced adapter evidence</span>
            <small>Raw fields moved here for troubleshooting and audit.</small>
          </div>
          <div className="runtime-advanced-grid">
            {allRuntimeCards.map((runtime) => (
              <article key={runtime.id} className="runtime-advanced-card">
                <div>
                  <span className={`tag ${statusTone(runtime.status)}`}>{runtime.status}</span>
                  <h3>{runtime.name}</h3>
                  <p>{runtime.id} · {runtime.type}</p>
                </div>
                <pre className="runtime-evidence">{JSON.stringify(runtime.evidence, null, 2)}</pre>
              </article>
            ))}
            {!loading && allRuntimeCards.length === 0 && <div className="empty big">No advanced runtime evidence available.</div>}
          </div>
        </section>
      )}

      {selectedRuntime && (
        <RuntimeDrawer runtime={selectedRuntime} tab={drawerTab} setTab={setDrawerTab} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: number | string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className={`skills-metric ${tone ?? ""}`}>
      <span>{label}</span>
      <b>{value}</b>
      <small>{sub}</small>
    </div>
  );
}

function TabButton({ id, tab, setTab, children }: { id: RuntimePageTab; tab: RuntimePageTab; setTab: (tab: RuntimePageTab) => void; children: ReactNode }) {
  return <button className={tab === id ? "on" : ""} onClick={() => setTab(id)} role="tab" aria-selected={tab === id}>{children}</button>;
}

function ReadinessLine({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="readiness-line">
      <div><b>{label}</b><span>{value}/{total}</span></div>
      <i><em style={{ width: `${pct}%` }} /></i>
    </div>
  );
}

function connectorSnippet(token: RuntimeConnectorTokenResponse) {
  const register = token.connect.register_url;
  const heartbeat = token.connect.heartbeat_url;
  const events = token.connect.events_url;
  return `# 1) Register the runtime\ncurl -s -H 'Authorization: Bearer ${token.secret}' -H 'Content-Type: application/json' \\\n  -d '{"framework":"openclaw","runtime_id":"friend-openclaw","name":"Friend OpenClaw","owner":"friend","capabilities":{"controllable":false},"evidence":{"note":"registered from local agent"}}' \\\n  ${register}\n\n# 2) Send heartbeat every 30-60 seconds\ncurl -s -H 'Authorization: Bearer ${token.secret}' -H 'Content-Type: application/json' \\\n  -d '{"runtime_id":"openclaw-friend-openclaw-${token.token.id}","status":"online","evidence":{"jobs_running":0}}' \\\n  ${heartbeat}\n\n# 3) Send events/log summaries\ncurl -s -H 'Authorization: Bearer ${token.secret}' -H 'Content-Type: application/json' \\\n  -d '{"runtime_id":"openclaw-friend-openclaw-${token.token.id}","kind":"status","severity":"info","title":"OpenClaw connector online"}' \\\n  ${events}`;
}

function RuntimeDrawer({ runtime, tab, setTab, onClose }: { runtime: RuntimeRecord; tab: RuntimeDrawerTab; setTab: (tab: RuntimeDrawerTab) => void; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="skill-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-top">
          <div>
            <span className={`tag ${statusTone(runtime.status)}`}>{runtime.status}</span>
            <h2>{runtime.name}</h2>
            <p>{runtime.summary}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close runtime detail">×</button>
        </div>
        <div className="drawer-tabs">
          <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview</button>
          <button className={tab === "actions" ? "on" : ""} onClick={() => setTab("actions")}>Safe actions</button>
          <button className={tab === "advanced" ? "on" : ""} onClick={() => setTab("advanced")}>Advanced</button>
        </div>
        {tab === "overview" && (
          <div className="drawer-section">
            <h3>Readiness</h3>
            <div className="skill-route-list">
              <span>Representable: {runtime.readiness.representable ? "yes" : "no"}</span>
              <span>Monitorable: {runtime.readiness.monitorable ? "yes" : "no"}</span>
              <span>Controllable: {runtime.readiness.controllable ? "yes" : "no"}</span>
            </div>
            <h3>Adapter summary</h3>
            <div className="settings-kv one-col">
              <div><span>Runtime ID</span><b>{runtime.id}</b></div>
              <div><span>Framework</span><b>{runtime.type.replaceAll("_", " ")}</b></div>
              <div><span>Updated</span><b>{formatDate(runtime.updated_at)}</b></div>
              <div><span>Evidence preview</span><b>{evidencePreview(runtime)}</b></div>
            </div>
          </div>
        )}
        {tab === "actions" && (
          <div className="drawer-section">
            <h3>Allowed V1 actions</h3>
            <div className="skill-route-list">
              {runtime.safe_actions.map((action) => <span key={action}>{action.replaceAll("_", " ")}</span>)}
              {runtime.safe_actions.length === 0 && <span>No safe actions exposed.</span>}
            </div>
            <p className="muted-copy">Trigger/pause/resume controls should only be added after the backend can verify scope, approval policy, workdir, and runtime identity.</p>
          </div>
        )}
        {tab === "advanced" && (
          <div className="drawer-section">
            <h3>Raw adapter evidence</h3>
            <pre className="runtime-evidence">{JSON.stringify(runtime.evidence, null, 2)}</pre>
          </div>
        )}
      </aside>
    </div>
  );
}
