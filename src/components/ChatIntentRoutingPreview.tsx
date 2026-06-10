import { ChatActionCard } from "./ChatActionCard";
import type { ChatIntentDecision, ChatIntentPreview } from "../services/chatIntentRouter";

export type ChatIntentRoutingActionId =
  | "send_to_agent"
  | "create_task"
  | "create_project_task"
  | "create_project"
  | "start_research_deliverable"
  | "launch_workflow"
  | "recommend_routine"
  | "create_routine_draft"
  | "clarify";

export type ChatIntentRoutingAction = {
  id: ChatIntentRoutingActionId;
  label: string;
  detail: string;
  kind: "primary" | "secondary" | "safe";
  disabled?: boolean;
};

type ChatIntentRoutingPreviewProps = {
  preview: ChatIntentPreview;
  decision: ChatIntentDecision;
  sending: boolean;
  actions?: ChatIntentRoutingAction[];
  actionBusy?: ChatIntentRoutingActionId | null;
  actionMessage?: string | null;
  actionError?: string | null;
  onAction?: (action: ChatIntentRoutingActionId) => void;
  onEdit?: () => void;
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

function routeTypeLabel(decision: ChatIntentDecision) {
  if (decision.intentType === "research_to_deliverable") return "research-to-deliverable";
  return decision.intentType.replace(/_/g, " ");
}

function researchCardDetail(preview: ChatIntentPreview) {
  const research = preview.researchDeliverable;
  if (!research) return preview.detail;
  return [
    `Detected intent: ${research.label}`,
    `Project: ${research.project}`,
    `Outputs: ${research.outputs.join(", ")}`,
    `Sources: ${research.sources}`,
  ].join("\n");
}


function plannerList(items?: string[]) {
  if (!items?.length) return ["Not required for this route"];
  return items;
}

function routerPlannerSections(preview: ChatIntentPreview, decision: ChatIntentDecision) {
  const planner = preview.planner ?? decision.matchedContext.planner;
  return [
    { label: "Tools", items: plannerList(planner?.tools ?? decision.matchedContext.toolsRequired) },
    { label: "Skills", items: plannerList(planner?.skills ?? decision.matchedContext.skillsRequired) },
    { label: "Data", items: plannerList(planner?.data ?? decision.matchedContext.dataRequired) },
    { label: "Access", items: plannerList(planner?.access ?? decision.matchedContext.accessRequired) },
    { label: "Mission Control capabilities", items: plannerList(planner?.capabilities ?? decision.matchedContext.missionControlCapabilities) },
  ];
}

function routerEvidenceItems(decision: ChatIntentDecision) {
  const matched = decision.matchedContext;
  return [
    matched.toolsRequired?.length ? `Tools: ${matched.toolsRequired.join(", ")}` : "Tools: none declared",
    matched.skillsRequired?.length ? `Skills: ${matched.skillsRequired.join(", ")}` : "Skills: none declared",
    `Evidence: ${matched.evidenceRequired === false ? "not required for reply-only route" : "required before work is marked complete"}`,
    `Approval: ${matched.approvalRequired ? `Approval Gate required — ${matched.approvalPolicy?.reasons.join("; ") || "human review required"}` : matched.approvalPolicy?.internalDraftAutoProceed ? "internal draft can proceed without Approval Gate" : "normal Mission Control policy"}`,
  ];
}

function safetyLine(decision: ChatIntentDecision, preview: ChatIntentPreview) {
  if (!preview.canProceed || decision.confidence === "low") return "Clarify first — no side effects are enabled for this route.";
  if (decision.intentType === "modify_routine") return "Safe action only: create a routine recommendation task; installing schedules still needs review.";
  if (decision.matchedContext.workflowId) return "Safe action: queue a workflow launch task with normal Mission Control gates.";
  return "Safe action: create or link Task Board work; external/destructive actions remain approval-gated.";
}

export function ChatIntentRoutingPreview({
  preview,
  decision,
  sending,
  actions = [],
  actionBusy,
  actionMessage,
  actionError,
  onAction,
  onEdit,
}: ChatIntentRoutingPreviewProps) {
  return (
    <article className={`chat-intent-preview ${preview.kind}`} aria-label="Mission Control router recommendation">
      <div className="chat-intent-preview-head">
        <span className="chat-intent-preview-kicker">Router recommendation</span>
        <span className={`chat-intent-preview-confidence ${preview.confidence}`}>{preview.confidence} confidence</span>
      </div>
      <div className="chat-intent-preview-body">
        {preview.researchDeliverable ? (
          <ChatActionCard
            type="research_to_deliverable"
            title={preview.title}
            detail={researchCardDetail(preview)}
            status={preview.researchDeliverable.status}
            risk={preview.researchDeliverable.safety}
            primaryAction={preview.primaryAction}
            secondaryAction={preview.secondaryAction}
          />
        ) : (
          <>
            <h2>{preview.title}</h2>
            <p>{preview.detail}</p>
          </>
        )}
        <dl className="chat-intent-preview-context">
          <div><dt>Route</dt><dd>{routeTypeLabel(decision)}</dd></div>
          <div><dt>Context</dt><dd>{contextLine(decision)}</dd></div>
          <div><dt>Next</dt><dd>{nextActionLabel(decision)}</dd></div>
          <div><dt>Safety</dt><dd>{safetyLine(decision, preview)}</dd></div>
        </dl>
        <section className="chat-intent-planner" aria-label="Tools, skills, data, and access planner">
          <strong>Execution planner</strong>
          <div className="chat-intent-planner-grid">
            {routerPlannerSections(preview, decision).map((section) => (
              <div key={section.label}>
                <span>{section.label}</span>
                <ul>
                  {section.items.map((item) => <li key={`${section.label}-${item}`}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </section>
        <div className="chat-intent-evidence-checklist" aria-label="Router evidence checklist">
          <strong>Evidence checklist</strong>
          <ul>
            {routerEvidenceItems(decision).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        {preview.suggestedQuestion && <p className="chat-intent-preview-question">{preview.suggestedQuestion}</p>}
      </div>
      {(actions.length > 0 || onEdit) && (
        <div className="chat-intent-preview-actions" aria-label="Router action controls">
          {actions.map((action) => (
            <button
              key={action.id}
              className={`chat-intent-action ${action.kind}`}
              type="button"
              onClick={() => onAction?.(action.id)}
              disabled={sending || action.disabled || Boolean(actionBusy)}
              title={action.detail}
            >
              <strong>{actionBusy === action.id ? "Working…" : action.label}</strong>
              <span>{action.detail}</span>
            </button>
          ))}
          {onEdit && <button className="chat-intent-action secondary" type="button" onClick={onEdit} disabled={sending || Boolean(actionBusy)}><strong>{preview.secondaryAction || "Edit request"}</strong><span>Return to the composer</span></button>}
        </div>
      )}
      {actionMessage && <p className="chat-intent-action-message success">{actionMessage}</p>}
      {actionError && <p className="chat-intent-action-message error">{actionError}</p>}
    </article>
  );
}
