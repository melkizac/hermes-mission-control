import type { Approval, BoardTask, ProjectRecord } from "../types";

export type ChatIntentType =
  | "new_goal"
  | "continue_mission"
  | "update_task"
  | "approval_response"
  | "resolve_blocker"
  | "modify_routine"
  | "create_one_time_task"
  | "status_query"
  | "evidence_query"
  | "ambiguous";

export type ChatIntentConfidence = "high" | "medium" | "low";
export type ChatIntentNextAction =
  | "proceed"
  | "ask_clarifying_question"
  | "show_mission_proposal"
  | "update_existing_work";

export type ChatIntentPreviewKind =
  | "starting_new_goal"
  | "linked_existing_mission"
  | "possible_match_found"
  | "needs_clarification"
  | "approval_response_detected"
  | "routine_workflow_change_detected";

export interface ChatIntentPreview {
  kind: ChatIntentPreviewKind;
  title: string;
  detail: string;
  confidence: ChatIntentConfidence;
  canProceed: boolean;
  suggestedQuestion?: string;
  primaryAction: string;
  secondaryAction?: string;
}

export interface ChatMissionContext {
  id: string;
  title: string;
  status?: string;
}

export interface ChatRoutineContext {
  id: string;
  title: string;
  status?: string;
}

export interface ChatWorkflowContext {
  id: string;
  title: string;
  status?: string;
}

export interface ChatIntentMatchedContext {
  projectId?: string | null;
  projectName?: string | null;
  missionId?: string | null;
  missionTitle?: string | null;
  taskId?: string | null;
  taskTitle?: string | null;
  routineId?: string | null;
  routineTitle?: string | null;
  workflowId?: string | null;
  workflowTitle?: string | null;
  approvalId?: string | null;
  approvalTitle?: string | null;
}

export interface ChatIntentDecision {
  intentType: ChatIntentType;
  matchedContext: ChatIntentMatchedContext;
  confidence: ChatIntentConfidence;
  nextAction: ChatIntentNextAction;
  reason: string;
}

export interface RouteChatIntentInput {
  instruction: string;
  selectedProject?: ProjectRecord | null;
  selectedMission?: ChatMissionContext | null;
  visibleMissions?: ChatMissionContext[];
  tasks?: BoardTask[];
  approvals?: Approval[];
  routines?: ChatRoutineContext[];
  workflows?: ChatWorkflowContext[];
}

const ROUTING_EXAMPLES = [
  "Do this",
  "Continue that",
  "Make it weekly",
  "Approve it",
  "Show me proof",
  "Start a new goal",
];

function includesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function simpleMatchId(instruction: string, prefix: string) {
  const match = instruction.match(new RegExp(`${prefix}[-_:#\\s]*([a-z0-9][a-z0-9._-]{2,})`, "i"));
  return match?.[1] ?? null;
}

function normalizedIncludes(instruction: string, value?: string | null, minPrefix = 8) {
  if (!value) return false;
  const needle = value.toLowerCase().trim();
  if (needle.length < 3) return false;
  const lower = instruction.toLowerCase();
  return lower.includes(needle) || (needle.length >= minPrefix && lower.includes(needle.slice(0, Math.min(needle.length, 42))));
}

function taskTitle(task: BoardTask) {
  return task.mission_result?.workItem?.title || task.title || task.id;
}

function findReferencedTask(instruction: string, tasks: BoardTask[] = []) {
  const explicitId = simpleMatchId(instruction, "task") || simpleMatchId(instruction, "card") || simpleMatchId(instruction, "ticket");
  if (explicitId) {
    const byId = tasks.find((task) => task.id.toLowerCase().includes(explicitId.toLowerCase()));
    if (byId) return byId;
  }
  return tasks.find((task) => normalizedIncludes(instruction, task.id, 4) || normalizedIncludes(instruction, taskTitle(task))) ?? null;
}

function findReferencedApproval(instruction: string, approvals: Approval[] = []) {
  const explicitId = simpleMatchId(instruction, "approval");
  if (explicitId) {
    const byId = approvals.find((approval) => approval.id.toLowerCase().includes(explicitId.toLowerCase()));
    if (byId) return byId;
  }
  return approvals.find((approval) => normalizedIncludes(instruction, approval.id, 4) || normalizedIncludes(instruction, approval.detail)) ?? null;
}

function findReferencedRoutine(instruction: string, routines: ChatRoutineContext[] = []) {
  const explicitId = simpleMatchId(instruction, "routine") || simpleMatchId(instruction, "automation");
  if (explicitId) {
    const byId = routines.find((routine) => routine.id.toLowerCase().includes(explicitId.toLowerCase()));
    if (byId) return byId;
  }
  return routines.find((routine) => normalizedIncludes(instruction, routine.id, 4) || normalizedIncludes(instruction, routine.title)) ?? null;
}

function findReferencedWorkflow(instruction: string, workflows: ChatWorkflowContext[] = []) {
  const explicitId = simpleMatchId(instruction, "workflow") || simpleMatchId(instruction, "playbook") || simpleMatchId(instruction, "sop");
  if (explicitId) {
    const byId = workflows.find((workflow) => workflow.id.toLowerCase().includes(explicitId.toLowerCase()));
    if (byId) return byId;
  }
  return workflows.find((workflow) => normalizedIncludes(instruction, workflow.id, 4) || normalizedIncludes(instruction, workflow.title)) ?? null;
}

function baseContext(
  input: RouteChatIntentInput,
  task?: BoardTask | null,
  approval?: Approval | null,
  routine?: ChatRoutineContext | null,
  workflow?: ChatWorkflowContext | null,
): ChatIntentMatchedContext {
  return {
    projectId: input.selectedProject?.id ?? task?.tenant ?? null,
    projectName: input.selectedProject?.name ?? null,
    missionId: input.selectedMission?.id ?? task?.mission_result?.workItem?.id ?? null,
    missionTitle: input.selectedMission?.title ?? task?.mission_result?.workItem?.title ?? null,
    taskId: task?.id ?? null,
    taskTitle: task ? taskTitle(task) : null,
    routineId: routine?.id ?? simpleMatchId(input.instruction, "routine") ?? simpleMatchId(input.instruction, "automation"),
    routineTitle: routine?.title ?? null,
    workflowId: workflow?.id ?? simpleMatchId(input.instruction, "workflow") ?? simpleMatchId(input.instruction, "playbook"),
    workflowTitle: workflow?.title ?? null,
    approvalId: approval?.id ?? simpleMatchId(input.instruction, "approval"),
    approvalTitle: approval?.detail ?? null,
  };
}

function hasSelectedWork(input: RouteChatIntentInput) {
  return Boolean(input.selectedMission || input.selectedProject || (input.visibleMissions?.length ?? 0) > 0);
}

function hasMatchedContext(matched: ChatIntentMatchedContext) {
  return Boolean(matched.projectId || matched.missionId || matched.taskId || matched.routineId || matched.workflowId || matched.approvalId);
}

function decision(
  intentType: ChatIntentType,
  matchedContext: ChatIntentMatchedContext,
  confidence: ChatIntentConfidence,
  nextAction: ChatIntentNextAction,
  reason: string,
): ChatIntentDecision {
  return { intentType, matchedContext, confidence, nextAction, reason };
}

export function routeChatIntent(input: RouteChatIntentInput): ChatIntentDecision {
  const raw = input.instruction.trim();
  const text = raw.toLowerCase();
  const referencedTask = findReferencedTask(raw, input.tasks);
  const referencedApproval = findReferencedApproval(raw, input.approvals);
  const referencedRoutine = findReferencedRoutine(raw, input.routines);
  const referencedWorkflow = findReferencedWorkflow(raw, input.workflows);
  const matched = baseContext(input, referencedTask, referencedApproval, referencedRoutine, referencedWorkflow);
  const hasContext = hasSelectedWork(input) || Boolean(referencedTask || referencedApproval || referencedRoutine || referencedWorkflow);
  const isTerseReference = (/^(do|continue|proceed|resume|carry on|next|make|approve|reject|show)\b/.test(text) || /^(can|could|would)\s+you\s+(do|continue|proceed|resume|make|approve|reject|show)\b/.test(text)) && /\b(this|that|it|latest|same|one)\b/.test(text);

  if (!raw) {
    return decision("ambiguous", matched, "low", "ask_clarifying_question", "No instruction text was provided.");
  }

  if (includesAny(text, [/\b(approve|approved|reject|rejected|changes requested|looks good|go ahead)\b/, /\bship it\b/])) {
    return decision(
      "approval_response",
      matched,
      referencedApproval || hasContext ? "high" : "medium",
      referencedApproval || hasContext ? "update_existing_work" : "ask_clarifying_question",
      referencedApproval ? "User appears to be answering a specific approval gate." : "User appears to be answering an approval gate or giving/revoking permission.",
    );
  }

  if (includesAny(text, [/\b(proof|evidence|source|sources|receipt|trace|audit|show me what|show me proof)\b/])) {
    return decision(
      "evidence_query",
      matched,
      hasContext ? "high" : "medium",
      hasContext ? "proceed" : "ask_clarifying_question",
      "User is asking for proof, evidence, or audit trail for work.",
    );
  }

  if (includesAny(text, [/\b(status|progress|where are we|what happened|what is happening|update me|latest)\b/])) {
    return decision(
      "status_query",
      matched,
      hasContext ? "high" : "medium",
      hasContext ? "proceed" : "ask_clarifying_question",
      "User is asking for current state or progress.",
    );
  }

  if (includesAny(text, [/\b(blocker|blocked|unblock|stuck|access issue|permission issue|fix access|resolve)\b/])) {
    return decision(
      "resolve_blocker",
      matched,
      hasContext ? "high" : "medium",
      hasContext ? "update_existing_work" : "ask_clarifying_question",
      "User is trying to clear or investigate a blocker.",
    );
  }

  if (includesAny(text, [/\b(weekly|daily|monthly|recurring|schedule|scheduled|routine|automation|workflow|playbook|template|operating loop|sop|recurring workflow|every\s+(day|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/])) {
    return decision(
      "modify_routine",
      matched,
      hasContext || referencedRoutine || referencedWorkflow ? "high" : "medium",
      hasContext || referencedRoutine || referencedWorkflow ? "update_existing_work" : "show_mission_proposal",
      referencedWorkflow ? "User is referencing an existing workflow or playbook." : "User is creating or changing a recurring routine/workflow.",
    );
  }

  if (includesAny(text, [/\b(start|create|open|new|launch)\b.*\b(goal|mission|project|initiative)\b/, /\b(goal|mission)\b.*\b(start|create|new|launch)\b/])) {
    return decision(
      "new_goal",
      matched,
      input.selectedProject ? "high" : "medium",
      "show_mission_proposal",
      "User is asking Mission Control to start a new mission/goal.",
    );
  }

  if (referencedTask || includesAny(text, [/\b(task|card|todo|ticket|mark done|done|update)\b/])) {
    return decision(
      "update_task",
      matched,
      referencedTask || input.selectedMission ? "high" : "medium",
      referencedTask || input.selectedMission ? "update_existing_work" : "ask_clarifying_question",
      "User appears to be updating a task/card or task-linked mission.",
    );
  }

  if (includesAny(text, [/\b(continue|resume|proceed|carry on|next step|keep going)\b/])) {
    return decision(
      "continue_mission",
      matched,
      hasContext ? "high" : "low",
      hasContext ? "update_existing_work" : "ask_clarifying_question",
      hasContext ? "User wants Melkizac to continue selected or recently visible work." : "Continuation request lacks a selected mission/project context.",
    );
  }

  if (isTerseReference && !hasContext) {
    return decision("ambiguous", matched, "low", "ask_clarifying_question", "Terse pronoun-based command needs a project, mission, task, routine, or approval target.");
  }

  return decision(
    "create_one_time_task",
    matched,
    input.selectedProject ? "high" : "medium",
    "proceed",
    "Default universal-input route: treat as a one-time task unless Melkizac links it to existing work from deeper context.",
  );
}

export function buildChatIntentPreview(decisionValue: ChatIntentDecision): ChatIntentPreview {
  const matched = decisionValue.matchedContext;
  const hasContext = hasMatchedContext(matched);
  const contextLabel = matched.taskTitle || matched.missionTitle || matched.approvalTitle || matched.routineTitle || matched.workflowTitle || matched.projectName || matched.taskId || matched.missionId || matched.approvalId || matched.routineId || matched.workflowId || matched.projectId;

  if (decisionValue.intentType === "approval_response") {
    return {
      kind: "approval_response_detected",
      title: "Approval response detected",
      detail: contextLabel ? `I will link this response to ${contextLabel}.` : "I detected approval language but no exact approval target.",
      confidence: decisionValue.confidence,
      canProceed: Boolean(contextLabel),
      suggestedQuestion: contextLabel ? undefined : "Which approval should I apply that decision to?",
      primaryAction: contextLabel ? "Send to Melkizac" : "Clarify approval",
      secondaryAction: "Edit request",
    };
  }

  if (decisionValue.nextAction === "ask_clarifying_question" && !hasContext) {
    const suggestedQuestion = decisionValue.intentType === "modify_routine"
      ? "Which routine, workflow, or task should I change?"
      : "Which project, mission, task, routine, or approval do you mean?";
    return {
      kind: "needs_clarification",
      title: "Needs clarification",
      detail: "I need a target before routing this safely.",
      confidence: decisionValue.confidence,
      canProceed: false,
      suggestedQuestion,
      primaryAction: "Clarify in chat",
      secondaryAction: "Edit request",
    };
  }

  if (decisionValue.intentType === "modify_routine") {
    return {
      kind: "routine_workflow_change_detected",
      title: "Routine or workflow change detected",
      detail: contextLabel ? `I will link this to ${contextLabel}.` : "I will treat this as creating or changing an operating routine/workflow.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send to Melkizac",
      secondaryAction: "Edit request",
    };
  }

  if (decisionValue.intentType === "new_goal") {
    return {
      kind: "starting_new_goal",
      title: "Starting a new goal",
      detail: contextLabel ? `I will start this under ${contextLabel}.` : "I will route this as a new goal or mission proposal.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Start goal",
      secondaryAction: "Edit request",
    };
  }

  if (hasContext && ["continue_mission", "update_task", "resolve_blocker", "status_query", "evidence_query"].includes(decisionValue.intentType)) {
    return {
      kind: decisionValue.confidence === "medium" ? "possible_match_found" : "linked_existing_mission",
      title: decisionValue.confidence === "medium" ? "Possible match found" : "Linked to existing work",
      detail: `I will route this with context from ${contextLabel}.`,
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send with context",
      secondaryAction: "Edit request",
    };
  }

  if (decisionValue.confidence === "medium" && hasContext) {
    return {
      kind: "possible_match_found",
      title: "Possible match found",
      detail: `I found related context: ${contextLabel}.`,
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send with context",
      secondaryAction: "Edit request",
    };
  }

  return {
    kind: "possible_match_found",
    title: "Ready to route",
    detail: contextLabel ? `I will include ${contextLabel} as context.` : "I will route this as a one-time task for Melkizac.",
    confidence: decisionValue.confidence,
    canProceed: true,
    primaryAction: "Send to Melkizac",
    secondaryAction: "Edit request",
  };
}

export function serializeChatIntentDecision(decisionValue: ChatIntentDecision) {
  return [
    `Intent Type: ${decisionValue.intentType}`,
    `Confidence: ${decisionValue.confidence}`,
    `Next Action: ${decisionValue.nextAction}`,
    `Matched Project: ${decisionValue.matchedContext.projectName || decisionValue.matchedContext.projectId || "none"}`,
    `Matched Mission: ${decisionValue.matchedContext.missionTitle || decisionValue.matchedContext.missionId || "none"}`,
    `Matched Task: ${decisionValue.matchedContext.taskTitle || decisionValue.matchedContext.taskId || "none"}`,
    `Matched Routine: ${decisionValue.matchedContext.routineTitle || decisionValue.matchedContext.routineId || "none"}`,
    `Matched Workflow: ${decisionValue.matchedContext.workflowTitle || decisionValue.matchedContext.workflowId || "none"}`,
    `Matched Approval: ${decisionValue.matchedContext.approvalTitle || decisionValue.matchedContext.approvalId || "none"}`,
    `Selected Project Scope: ${decisionValue.matchedContext.projectName || decisionValue.matchedContext.projectId || "none"}`,
    "UI Policy: Mission Control may show a compact routing preview before/while sending; treat it as user-facing routing evidence, not as final truth.",
    "Clarification Policy: If confidence is low or the route is unsafe/ambiguous, ask the user in chat before acting.",
    "Project Scope: The selected Project is the user-declared context for this Chat message.",
    `Reason: ${decisionValue.reason}`,
    `Example Coverage: ${ROUTING_EXAMPLES.join("; ")}`,
  ].join("\n");
}
