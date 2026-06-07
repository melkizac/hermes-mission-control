import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon";
import type { Agent, WorkerTranscriptEntry, WorkerTranscriptResponse } from "../types";

async function fetchWorkerTranscript(agentId: string): Promise<WorkerTranscriptResponse> {
  const url = `${window.location.protocol}//${window.location.host}/api/agents/${encodeURIComponent(agentId)}/worker-transcript?limit=260`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load worker transcript");
  return data as WorkerTranscriptResponse;
}

function entryStatusClass(status?: string) {
  const s = (status || "info").toLowerCase();
  if (["running", "queued", "working"].includes(s)) return "running";
  if (["done", "ok", "completed"].includes(s)) return "done";
  if (["error", "failed", "blocked"].includes(s)) return "error";
  return "info";
}

function entryKindLabel(entry: WorkerTranscriptEntry) {
  if (entry.type === "tool-call") return "Tool call";
  if (entry.type === "tool-result") return "Tool result";
  if (entry.type === "processing") return "Processing";
  if (entry.type === "activity") return "Activity";
  if (entry.role === "user") return "User";
  if (entry.role === "agent" || entry.role === "assistant") return "Agent";
  return "System";
}

function transcriptText(entry: WorkerTranscriptEntry) {
  const text = entry.text?.trim();
  if (text) return text;
  if (entry.toolCalls?.length) return `${entry.toolCalls.length} tool call(s) requested.`;
  return "No text payload recorded for this row.";
}

function copyTranscript(entries: WorkerTranscriptEntry[]) {
  const text = entries
    .map((entry) => `[${entry.at || "—"}] ${entryKindLabel(entry)} · ${entry.title}\n${transcriptText(entry)}`)
    .join("\n\n");
  return navigator.clipboard?.writeText(text);
}

export function WorkerTranscriptDrawer({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const [data, setData] = useState<WorkerTranscriptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "tools">("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void fetchWorkerTranscript(agent.id)
        .then((next) => {
          if (!alive) return;
          setData(next);
          setError(null);
        })
        .catch((err) => {
          if (!alive) return;
          setError(err instanceof Error ? err.message : "Could not load worker transcript");
        });
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [agent.id]);

  const entries = useMemo(() => {
    const all = data?.entries ?? [];
    if (filter === "active") return all.filter((entry) => entry.status === "running" || entry.type === "processing");
    if (filter === "tools") return all.filter((entry) => entry.type === "tool-call" || entry.type === "tool-result");
    return all;
  }, [data?.entries, filter]);

  const activeCount = data?.summary?.active ?? agent.processingRequests?.length ?? 0;

  return (
    <aside className="ctx agent-detail-drawer worker-transcript-drawer" aria-label={`Worker log and transcript for ${agent.name}`}>
      <div className="ctx-head agent-drawer-head worker-log-head">
        <div>
          <div className="sec-l tight">Worker log / transcript</div>
          <div className="ctx-title">{agent.name}</div>
          <div className="ctx-sub">
            {activeCount ? `${activeCount} active request${activeCount === 1 ? "" : "s"}` : "No active worker request"} · refreshed every 5s
          </div>
        </div>
        <button className="agent-drawer-close" onClick={onClose} title="Close worker log" aria-label="Close worker log">
          ×
        </button>
      </div>

      <div className="worker-log-toolbar">
        <div className="view-switch compact" role="tablist" aria-label="Worker transcript filter">
          {(["all", "active", "tools"] as const).map((key) => (
            <button key={key} className={filter === key ? "on" : ""} onClick={() => setFilter(key)} type="button">
              {key === "all" ? "All" : key === "active" ? "Active" : "Tools"}
            </button>
          ))}
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => {
            void copyTranscript(entries).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            });
          }}
          disabled={!entries.length}
        >
          <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="worker-log-summary">
        <div><b>{data?.summary?.entries ?? "—"}</b><span>rows</span></div>
        <div><b>{data?.summary?.toolEvents ?? "—"}</b><span>tool events</span></div>
        <div><b>{data?.summary?.sessions ?? "—"}</b><span>sessions</span></div>
      </div>

      {error && <div className="senderror worker-log-error">{error}</div>}

      <div className="ctxbody worker-log-body scroll">
        {!data && !error && <div className="empty">Loading worker transcript…</div>}
        {data && entries.length === 0 && <div className="empty">No rows match this filter yet.</div>}
        {entries.map((entry) => (
          <article className={`worker-log-row ${entryStatusClass(entry.status)}`} key={entry.id}>
            <div className="worker-log-marker" aria-hidden="true" />
            <div className="worker-log-content">
              <div className="worker-log-meta">
                <span>{entryKindLabel(entry)}</span>
                <em>{entry.at || "—"}</em>
              </div>
              <div className="worker-log-title">
                <b>{entry.title || entryKindLabel(entry)}</b>
                {entry.status && <small>{entry.status}</small>}
              </div>
              <pre>{transcriptText(entry)}</pre>
              <div className="worker-log-foot">
                {entry.source && <span>{entry.source}</span>}
                {entry.sessionTitle && <span>{entry.sessionTitle}</span>}
                {entry.requestId && <span className="mono">{entry.requestId}</span>}
                {entry.tokens ? <span>{entry.tokens} tokens</span> : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
