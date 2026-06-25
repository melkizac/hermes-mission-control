import { useState } from "react";
import { Icon } from "../components/Icon";
import { Automations } from "./Automations";
import { WorkflowLibrary } from "./WorkflowLibrary";

type OperationsTab = "routines" | "workflows";

const operationsTabs: Array<{ id: OperationsTab; label: string; icon: Parameters<typeof Icon>[0]["name"] }> = [
  { id: "routines", label: "Routines", icon: "automations" },
  { id: "workflows", label: "Workflows", icon: "workflow" },
];

export function OperationsHub() {
  const [tab, setTab] = useState<OperationsTab>("routines");

  return (
    <div className="operations-hub-page capability-hub-page scroll">
      <section className="capability-hub-hero">
        <div>
          <span className="eyebrow">OPERATIONS</span>
          <h1>Operations Hub</h1>
          <p>Manage routines and workflow templates from one place.</p>
        </div>
      </section>
      <nav className="capability-hub-tabs" aria-label="Operations sections">
        {operationsTabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "on" : ""}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
          >
            <Icon name={item.icon} size={19} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="operations-hub-panel capability-hub-panel">
        {tab === "routines" && <Automations />}
        {tab === "workflows" && <WorkflowLibrary />}
      </div>
    </div>
  );
}
