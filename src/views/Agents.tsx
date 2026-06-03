import { useEffect, useMemo, useState } from "react";
import { useStore } from "../services/store";
import { Roster } from "../components/Roster";
import { ChatThread } from "../components/ChatThread";
import { ContextPanel } from "../components/ContextPanel";
import type { ProjectChatResponse } from "../types";

async function fetchProjectChats(): Promise<ProjectChatResponse> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}/api/project-chats`, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Failed to load project chat sessions");
  return data as ProjectChatResponse;
}

export function Agents() {
  const { selected, loading } = useStore();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [projectChats, setProjectChats] = useState<ProjectChatResponse | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedSessionId, setSelectedSessionId] = useState("all");
  const [projectChatError, setProjectChatError] = useState<string | null>(null);

  const projectSessions = useMemo(
    () => (projectChats?.sessions ?? []).filter((session) => selectedProjectId === "all" || session.project_id === selectedProjectId),
    [projectChats, selectedProjectId],
  );

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchProjectChats()
      .then((data) => {
        if (!alive) return;
        setProjectChats(data);
        setProjectChatError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setProjectChatError(err instanceof Error ? err.message : "Could not load project sessions");
      });
    return () => {
      alive = false;
    };
  }, [selected?.id, selected?.sessionCount]);

  useEffect(() => {
    setSelectedSessionId("all");
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedSessionId !== "all" && !projectSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId("all");
    }
  }, [projectSessions, selectedSessionId]);

  return (
    <div className="mc agents-drawer-first">
      <Roster
        projectChats={projectChats}
        selectedProjectId={selectedProjectId}
        selectedSessionId={selectedSessionId}
        onProjectChange={setSelectedProjectId}
        onSessionChange={setSelectedSessionId}
        projectChatError={projectChatError}
      />
      {selected ? (
        <>
          <ChatThread
            agent={selected}
            onOpenDetails={() => setDetailsOpen(true)}
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
        </>
      ) : (
        <div className="center mc-empty">
          {loading ? "Loading agents…" : "Select an agent from the roster to begin."}
        </div>
      )}
    </div>
  );
}
