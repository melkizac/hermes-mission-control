import { useState } from "react";
import { useStore } from "../services/store";
import { Icon } from "./Icon";

const squads = ["Operations", "Comms", "Research", "Finance", "Creative"];

export function NewAgentModal({ onClose }: { onClose: () => void }) {
  const { createAgent } = useStore();
  const [name, setName] = useState("");
  const [squad, setSquad] = useState(squads[0]);
  const [model, setModel] = useState("claude-opus-4-8");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await createAgent({ name: name.trim(), squad, model });
    setBusy(false);
    onClose();
  };

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="fn" style={{ fontSize: 15 }}>
            New agent
          </div>
          <button className="iconbtn" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orion" autoFocus />
          </label>
          <label className="field">
            <span>Agent Group</span>
            <select value={squad} onChange={(e) => setSquad(e.target.value)}>
              {squads.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} className="mono" />
          </label>
          <p className="hint">
            Creates a new Hermes profile at <span className="mono">~/.hermes/{name.toLowerCase().replace(/\s+/g, "-") || "…"}</span> with
            starter SOUL.md, MEMORY.md, AGENTS.md and config.yaml.
          </p>
        </div>
        <div className="drawer-foot">
          <span />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn dark" disabled={!name.trim() || busy} onClick={submit}>
              {busy ? "Creating…" : "Create agent"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
