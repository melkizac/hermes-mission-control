import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import type { AutomationsResponse, BoardResponse, BrowserSessionsResponse, ViewKey } from "../types";
import { InfoTooltip } from "../components/InfoTooltip";

type SessionRow = { id: string; title?: string; source?: string };

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

type EvidenceTile = {
  title: string;
  detail: string;
  target: ViewKey;
  metric?: string | number;
  action: string;
};

export function EvidenceHub() {
  const { setView } = useStore();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [browser, setBrowser] = useState<BrowserSessionsResponse | null>(null);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [automations, setAutomations] = useState<AutomationsResponse | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      safe<SessionRow[]>("/api/sessions", []),
      safe<BrowserSessionsResponse | null>("/api/browser-sessions", null),
      safe<BoardResponse | null>("/api/task-board", null),
      safe<AutomationsResponse | null>("/api/automations", null),
    ]).then(([nextSessions, nextBrowser, nextBoard, nextAutomations]) => {
      if (!alive) return;
      setSessions(nextSessions);
      setBrowser(nextBrowser);
      setBoard(nextBoard);
      setAutomations(nextAutomations);
    });
    return () => { alive = false; };
  }, []);

  const tiles: EvidenceTile[] = [
    { title: "Recent proof", detail: "Latest completed outputs, summaries, and agent-produced artifacts.", target: "automations", metric: automations?.automations?.flatMap((a) => a.recent_outputs ?? []).length ?? "—", action: "Review outputs" },
    { title: "Browser evidence", detail: "Screenshots, current/final URLs, browser activity, and no-submit boundaries.", target: "browser-ops", metric: browser?.sessions?.length ?? "—", action: "Open browser proof" },
    { title: "Task results", detail: "Task result drawers with evidence timelines, artifacts, and next actions.", target: "board", metric: board?.summary.done ?? 0, action: "Open task results" },
    { title: "Run traces", detail: "Audit history across agents, tools, sessions, and channel sources.", target: "audit", metric: sessions.length, action: "Open audit trail" },
    { title: "Screenshots and files", detail: "Generated files, browser screenshots, reports, and linked artifacts.", target: "automations", metric: "Proof", action: "Open artifacts" },
  ];

  return (
    <div className="simplified-hub evidence-hub scroll">
      <div className="hub-hero">
        <span className="eyebrow">Results & Proof</span>
        <div className="hero-title-with-help">
          <h1>Evidence</h1>
          <InfoTooltip label="About Evidence">Proof of what agents did: screenshots, final links, task results, run traces, and generated artifacts.</InfoTooltip>
        </div>
        <button className="btn" onClick={() => setView("audit")}>Open detailed audit</button>
      </div>
      <section className="hub-grid" aria-label="Evidence sections">
        {tiles.map((tile) => (
          <button className="hub-card" key={tile.title} onClick={() => setView(tile.target)}>
            <span>{tile.title}</span>
            <b>{tile.metric}</b>
            <p>{tile.detail}</p>
            <em>{tile.action} →</em>
          </button>
        ))}
      </section>
    </div>
  );
}
