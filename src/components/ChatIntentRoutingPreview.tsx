import type { ChatIntentDecision, ChatIntentPreview } from "../services/chatIntentRouter";
import type { ViewKey } from "../types";

type ChatIntentRoutingPreviewProps = {
  preview: ChatIntentPreview;
  decision: ChatIntentDecision;
  sending: boolean;
  onProceed?: () => void;
  onEdit?: () => void;
  onOpen?: (target?: ViewKey) => void;
};

function contextLine(decision: ChatIntentDecision) {
  const matched = decision.matchedContext;
  const parts = [
    matched.projectName || matched.projectId ? `Project: ${matched.projectName || matched.projectId}` : null,
    matched.missionTitle || matched.missionId ? `Mission: ${matched.missionTitle || matched.missionId}` : null,
    matched.taskTitle || matched.taskId ? `Task: ${matched.taskTitle || matched.taskId}` : null,
    matched.approvalTitle || matched.approvalId ? `Approval: ${matched.approvalTitle || matched.approvalId}` : null,
    matched.routineTitle || matched.routineId ? `Routine: ${matched.routineTitle || matched.routineId}` : null,
    matched.workflowTitle || matched.workflowId ? `Workflow: ${matched.workflowTitle || matched.workflowId}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No exact Mission Control object matched yet.";
}

function nextActionLabel(decision: ChatIntentDecision) {
  switch (decision.nextAction) {
    case "ask_clarifying_question":
      return "Ask for a clearer target before acting.";
    case "show_mission_proposal":
      return "Prepare a mission or goal proposal.";
    case "update_existing_work":
      return "Update or continue existing work.";
    case "proceed":
    default:
      return "Proceed as a one-time Chat request.";
  }
}

export function ChatIntentRoutingPreview({ preview, decision, sending, onProceed, onEdit }: ChatIntentRoutingPreviewProps) {
  return (
    <article className={`chat-intent-preview ${preview.kind}`} aria-label="Mission Control routing preview">
      <div className="chat-intent-preview-head">
        <span className="chat-intent-preview-kicker">Route preview</span>
        <span className={`chat-intent-preview-confidence ${preview.confidence}`}>{preview.confidence} confidence</span>
      </div>
      <div className="chat-intent-preview-body">
        <h2>{preview.title}</h2>
        <p>{preview.detail}</p>
        <dl className="chat-intent-preview-context">
          <div><dt>Context</dt><dd>{contextLine(decision)}</dd></div>
          <div><dt>Next</dt><dd>{nextActionLabel(decision)}</dd></div>
        </dl>
        {preview.suggestedQuestion && <p className="chat-intent-preview-question">{preview.suggestedQuestion}</p>}
      </div>
      {(!sending || !preview.canProceed) && (
        <div className="chat-intent-preview-actions">
          {preview.canProceed && onProceed && <button className="btn small" type="button" onClick={onProceed}>{preview.primaryAction}</button>}
          {onEdit && <button className="ghost tiny" type="button" onClick={onEdit}>{preview.secondaryAction || "Edit request"}</button>}
        </div>
      )}
    </article>
  );
}
