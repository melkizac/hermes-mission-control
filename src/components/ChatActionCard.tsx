import type { ViewKey } from "../types";

export type ChatActionCardType =
  | "proposed_mission"
  | "running_mission"
  | "approval_required"
  | "blocked_mission"
  | "completed_mission"
  | "routine_suggested"
  | "task_created"
  | "workflow_suggested"
  | "browser_running"
  | "evidence_ready"
  | "connection_needed"
  | "human_action_needed"
  | "research_to_deliverable";

type ChatActionCardProps = {
  type: ChatActionCardType;
  title: string;
  detail: string;
  status?: string;
  risk?: string;
  target?: ViewKey;
  primaryAction?: string;
  secondaryAction?: string;
  onOpen?: (target?: ViewKey) => void;
};

const labels: Record<ChatActionCardType, string> = {
  proposed_mission: "Mission proposed",
  running_mission: "Mission running",
  approval_required: "Approval required",
  blocked_mission: "Blocked",
  completed_mission: "Completed",
  routine_suggested: "Routine suggested",
  task_created: "Task created",
  workflow_suggested: "Playbook suggested",
  browser_running: "Browser running",
  evidence_ready: "Evidence ready",
  connection_needed: "Connection needed",
  human_action_needed: "Human action needed",
  research_to_deliverable: "Research-to-Deliverable",
};

export function ChatActionCard({
  type,
  title,
  detail,
  status,
  risk,
  target,
  primaryAction = "Open",
  secondaryAction,
  onOpen,
}: ChatActionCardProps) {
  return (
    <article className={`chat-action-card ${type}`} data-card-type={type}>
      <div className="chat-action-card-head">
        <span className="chat-card-kicker">{labels[type]}</span>
        {status && <span className="chat-card-status">{status}</span>}
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {risk && <small className="chat-card-risk">Risk: {risk}</small>}
      {onOpen && (
        <div className="chat-card-actions">
          <button className="btn small" onClick={() => onOpen(target)}>{primaryAction}</button>
          {secondaryAction && <button className="ghost small" onClick={() => onOpen(target)}>{secondaryAction}</button>}
        </div>
      )}
    </article>
  );
}
