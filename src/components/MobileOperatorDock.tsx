import type { ViewKey } from "../types";
import { Icon } from "./Icon";

export type MobileOperatorAction = {
  id: string;
  label: string;
  detail: string;
  view: ViewKey;
  icon: "bell" | "automations" | "setup" | "plus" | "board" | "agents";
  count?: number | string;
  tone?: "attention" | "live" | "neutral";
};

export const MOBILE_OPERATOR_CORE_LABELS = ["Needs Attention", "Running Now", "Browser Activity", "Delegate Work", "Task Board"];

export function MobileOperatorDock({
  actions,
  attentionCount,
  runningCount,
  onSelect,
}: {
  actions: MobileOperatorAction[];
  attentionCount: number;
  runningCount: number;
  onSelect: (view: ViewKey) => void;
}) {
  return (
    <aside className="mobile-operator-dock" data-testid="mobile-operator-dock" aria-label="Mobile operator quick actions">
      <div className="mobile-operator-summary">
        <div>
          <span>Field operator mode</span>
          <b>{attentionCount} attention · {runningCount} running</b>
        </div>
        <em>Phone-first controls</em>
      </div>
      <div className="mobile-operator-actions">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className={`mobile-operator-action ${action.tone || "neutral"}`}
            data-testid="mobile-operator-action"
            onClick={() => onSelect(action.view)}
          >
            <span className="mobile-operator-icon"><Icon name={action.icon} size={17} /></span>
            <span className="mobile-operator-copy">
              <b>{action.label}</b>
              <small>{action.detail}</small>
            </span>
            {action.count !== undefined ? <em>{action.count}</em> : null}
          </button>
        ))}
      </div>
    </aside>
  );
}
