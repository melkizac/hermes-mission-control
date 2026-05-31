import { useEffect, useState } from "react";
import { useStore } from "../services/store";
import { Roster } from "../components/Roster";
import { ChatThread } from "../components/ChatThread";
import { ContextPanel } from "../components/ContextPanel";

export function Agents() {
  const { selected, loading } = useStore();
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return (
    <div className="mc agents-drawer-first">
      <Roster />
      {selected ? (
        <>
          <ChatThread agent={selected} onOpenDetails={() => setDetailsOpen(true)} />
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
