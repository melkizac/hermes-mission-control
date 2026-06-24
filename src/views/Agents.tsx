import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { ChatThread } from "../components/ChatThread";
import { ContextPanel } from "../components/ContextPanel";
import { WorkerTranscriptDrawer } from "../components/WorkerTranscriptDrawer";
import { cachedJsonRequest } from "../services/queryCache";
import type { Agent, ModelUsageLimitSummary, ModelUsageWindow, ProjectChatResponse } from "../types";

async function fetchProjectChats(): Promise<ProjectChatResponse> {
  return cachedJsonRequest(
    "chat-page:project-chats",
    async () => {
      const res = await fetch(`${window.location.protocol}//${window.location.host}/api/project-chats`, { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load project chats");
      return data as ProjectChatResponse;
    },
    { staleAfterMs: 60_000 },
  );
}

function scheduleProgressiveHydration(callback: () => void) {
  let cancelled = false;
  let idleId: number | null = null;
  const frameId = window.requestAnimationFrame(() => {
    const run = () => {
      if (!cancelled) callback();
    };
    const requestIdle = window.requestIdleCallback as ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined;
    if (requestIdle) {
      idleId = requestIdle(run, { timeout: 1200 });
    } else {
      window.setTimeout(run, 120);
    }
  });
  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameId);
    if (idleId !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
  };
}


type AgentRateLimitsResponse = {
  ok?: boolean;
  agent?: { id: string; name: string; profile?: string; model?: string };
  model_usage?: ModelUsageLimitSummary;
  error?: string;
};

async function fetchAgentRateLimits(agentId: string): Promise<AgentRateLimitsResponse> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/agents/${encodeURIComponent(agentId)}/rate-limits`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load agent rate limits");
  return data as AgentRateLimitsResponse;
}

function pctLabel(value?: number) {
  return `${Math.round(Number(value ?? 0))}%`;
}

function remainingPct(window?: ModelUsageWindow) {
  const explicit = Number(window?.remaining_percent);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const used = Math.max(0, Math.min(100, Number(window?.percent_used ?? 0)));
  return Math.max(0, 100 - used);
}

function RateLimitMiniRow({ window }: { window: ModelUsageWindow }) {
  const remaining = remainingPct(window);
  return (
    <div className="agent-rate-limit-row">
      <b>{window.label}</b>
      <strong>{pctLabel(remaining)}</strong>
      <span>{window.reset_label || "—"}</span>
    </div>
  );
}

function AgentRateLimitsDrawer({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [data, setData] = useState<AgentRateLimitsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAgentRateLimits(agent.id)
      .then((next) => {
        if (!alive) return;
        setData(next);
        setError(next.error ?? null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load agent rate limits");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [agent.id]);

  const usage = data?.model_usage;
  const displayAgent = data?.agent ?? { id: agent.id, name: agent.name, model: agent.model };

  return (
    <aside className="agent-drawer rate-limits-drawer">
      <header>
        <div>
          <span className="eyebrow">AGENT MODEL</span>
          <h2>Rate limits</h2>
          <p>{displayAgent.name} — {displayAgent.model || agent.model || "Default model"}</p>
        </div>
        <button className="iconbtn" onClick={onClose} aria-label="Close agent rate limits"><span>×</span></button>
      </header>
      {error && <div className="cost-error">{error}</div>}
      <section className="agent-rate-limit-card" aria-busy={loading}>
        {loading && <div className="empty big">Loading rate limits…</div>}
        {!loading && usage && (
          <>
            <RateLimitMiniRow window={usage.daily} />
            <RateLimitMiniRow window={usage.weekly} />
            <div className="agent-rate-limit-meta">
              <span>Assigned model</span>
              <b>{displayAgent.model || usage.selected_model || "—"}</b>
              <span>Source</span>
              <b>{usage.source || "Provider quota snapshot"}</b>
            </div>
          </>
        )}
        {!loading && !usage && !error && <div className="empty big">No rate limit data is available for this agent yet.</div>}
      </section>
    </aside>
  );
}

export function Agents() {
  const { selected, loading } = useStore();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [workerLogOpen, setWorkerLogOpen] = useState(false);
  const [rateLimitsOpen, setRateLimitsOpen] = useState(false);
  const [projectChats, setProjectChats] = useState<ProjectChatResponse | null>(null);
  const selectedProjectId = "all";
  const selectedSessionId = "all";

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailsOpen(false);
        setWorkerLogOpen(false);
        setRateLimitsOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    let alive = true;
    const cancelHydration = scheduleProgressiveHydration(() => {
      if (!alive) return;
      void fetchProjectChats()
        .then((data) => {
          if (!alive) return;
          setProjectChats(data);
        })
        .catch((err) => {
          console.warn("Could not load project chats", err);
        });
    });
    return () => {
      alive = false;
      cancelHydration();
    };
  }, [selected?.id, selected?.sessionCount]);

  return (
    <div className="mc agents-drawer-first agents-no-roster" data-deeplink-target="agent-chat">
      {selected ? (
        <>
          <ChatThread
            agent={selected}
            onOpenDetails={() => {
              setWorkerLogOpen(false);
              setRateLimitsOpen(false);
              setDetailsOpen(true);
            }}
            onOpenWorkerLog={() => {
              setDetailsOpen(false);
              setRateLimitsOpen(false);
              setWorkerLogOpen(true);
            }}
            onOpenRateLimits={() => {
              setDetailsOpen(false);
              setWorkerLogOpen(false);
              setRateLimitsOpen(true);
            }}
            projectChats={projectChats}
            selectedProjectId={selectedProjectId}
            selectedSessionId={selectedSessionId}
          />
          {detailsOpen && (
            <div className="agent-drawer-layer" role="dialog" aria-modal="true" aria-label="Selected agent details">
              <button className="agent-drawer-scrim" aria-label="Close selected agent details" onClick={() => setDetailsOpen(false)} />
              <ContextPanel agent={selected} drawer onClose={() => setDetailsOpen(false)} />
            </div>
          )}
          {workerLogOpen && (
            <div className="agent-drawer-layer worker-log-layer" role="dialog" aria-modal="true" aria-label="Selected agent log and transcript">
              <button className="agent-drawer-scrim" aria-label="Close selected agent log" onClick={() => setWorkerLogOpen(false)} />
              <WorkerTranscriptDrawer agent={selected} onClose={() => setWorkerLogOpen(false)} />
            </div>
          )}
          {rateLimitsOpen && (
            <div className="agent-drawer-layer rate-limits-layer" role="dialog" aria-modal="true" aria-label="Selected agent rate limits">
              <button className="agent-drawer-scrim" aria-label="Close selected agent rate limits" onClick={() => setRateLimitsOpen(false)} />
              <AgentRateLimitsDrawer agent={selected} onClose={() => setRateLimitsOpen(false)} />
            </div>
          )}
        </>
      ) : (
        <div className="center mc-empty">
          {loading ? "Loading agents…" : "Select an active profile from the left rail to begin."}
        </div>
      )}
    </div>
  );
}
