import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import type { BoardResponse, WorkflowLibraryResponse, ProjectsResponse, ResearchRunsResponse, ViewKey } from "../types";

async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, { credentials: "include", headers: { Accept: "application/json" } });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

type WorkTile = {
  title: string;
  detail: string;
  target: ViewKey;
  metric?: string | number;
  action: string;
};

export function WorkHub() {
  const { setView } = useStore();
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowLibraryResponse | null>(null);
  const [projects, setProjects] = useState<ProjectsResponse | null>(null);
  const [research, setResearch] = useState<ResearchRunsResponse | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      safe<BoardResponse | null>("/api/task-board", null),
      safe<WorkflowLibraryResponse | null>("/api/workflows", null),
      safe<ProjectsResponse | null>("/api/projects", null),
      safe<ResearchRunsResponse | null>("/api/research-runs", null),
    ]).then(([nextBoard, nextWorkflows, nextProjects, nextResearch]) => {
      if (!alive) return;
      setBoard(nextBoard);
      setWorkflows(nextWorkflows);
      setProjects(nextProjects);
      setResearch(nextResearch);
    });
    return () => { alive = false; };
  }, []);

  const tiles: WorkTile[] = [
    { title: "Start New Work", detail: "Use the manual front door when chat needs structured inputs or routing preview.", target: "delegate-work", metric: "Ask", action: "Delegate work" },
    { title: "Open Work", detail: "Tasks, blockers, and work that still needs movement.", target: "board", metric: board?.summary.queued ?? board?.tasks?.length ?? "—", action: "Open board" },
    { title: "Running Work", detail: "Active agent work and live operator-tracked jobs.", target: "board", metric: board?.summary.running ?? 0, action: "Track running" },
    { title: "Completed Work", detail: "Finished work with result drawers, artifacts, and proof.", target: "board", metric: board?.summary.done ?? 0, action: "Review results" },
    { title: "Playbooks", detail: "Reusable SME workflows that chat can recommend and launch.", target: "workflow-library", metric: workflows?.workflows?.length ?? workflows?.summary?.total ?? "—", action: "Browse playbooks" },
    { title: "Projects / Context", detail: "Business initiatives, linked workspaces, and operating context.", target: "projects", metric: projects?.projects?.length ?? projects?.summary?.total ?? "—", action: "Open projects" },
    { title: "Research / Deep Work", detail: "Parallel research runs, synthesis lanes, and final recommendations.", target: "research-runs", metric: research?.runs?.length ?? research?.summary?.total ?? "—", action: "Open research" },
  ];

  return (
    <div className="simplified-hub scroll">
      <div className="hub-hero">
        <span className="eyebrow">Work hub</span>
        <h1>Work</h1>
        <p>All open, running, completed, planned, and research work in one non-technical workspace.</p>
        <button className="btn" onClick={() => setView("delegate-work")}>Start work manually</button>
      </div>
      <section className="hub-grid" aria-label="Work sections">
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
