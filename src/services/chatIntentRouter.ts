import type { Approval, BoardTask, ProjectRecord } from "../types";

export type ChatResearchDeliverableSubtype =
  | "learn_topic"
  | "ask_sources"
  | "summarize_sources"
  | "compare_sources"
  | "generate_deck"
  | "generate_report"
  | "generate_proposal"
  | "generate_training_material"
  | "revise_artifact"
  | "add_sources_to_project"
  | "check_project_status";

export type ChatIntentType =
  | "one_time_reply"
  | "kanban_task"
  | "project"
  | "workflow"
  | "routine_recommendation"
  | "clarification"
  | "new_goal"
  | "continue_mission"
  | "update_task"
  | "approval_response"
  | "resolve_blocker"
  | "modify_routine"
  | "research_to_deliverable"
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
  | "routine_workflow_change_detected"
  | "research_to_deliverable_project";

export interface ChatResearchDeliverablePreview {
  subtype: ChatResearchDeliverableSubtype;
  label: string;
  outputs: string[];
  sources: string;
  project: string;
  status: string;
  safety: string;
}

export interface ChatIntentPlanner {
  tools: string[];
  skills: string[];
  data: string[];
  access: string[];
  capabilities: string[];
}

export interface ChatIntentPreview {
  kind: ChatIntentPreviewKind;
  title: string;
  detail: string;
  confidence: ChatIntentConfidence;
  canProceed: boolean;
  suggestedQuestion?: string;
  primaryAction: string;
  secondaryAction?: string;
  researchDeliverable?: ChatResearchDeliverablePreview;
  planner?: ChatIntentPlanner;
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

export interface ChatApprovalPolicy {
  required: boolean;
  risk: "safe" | "approval-required" | "external-facing" | "destructive" | "account-sensitive";
  reasons: string[];
  internalDraftAutoProceed: boolean;
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
  researchSubtype?: ChatResearchDeliverableSubtype | null;
  requestedOutputs?: string[];
  sourceSummary?: string | null;
  toolsRequired?: string[];
  skillsRequired?: string[];
  dataRequired?: string[];
  accessRequired?: string[];
  missionControlCapabilities?: string[];
  evidenceRequired?: boolean;
  approvalRequired?: boolean;
  approvalPolicy?: ChatApprovalPolicy;
  planner?: ChatIntentPlanner;
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function inferApprovalPolicy(text: string, explicit = false): ChatApprovalPolicy {
  const lower = text.toLowerCase();
  const internalDraft = /(draft|prepare|write|generate|create)/.test(lower) && !/(send|publish|post|share|submit|delete|remove|purge|drop|external|public|live)/.test(lower);
  const checks: Array<{ risk: ChatApprovalPolicy["risk"]; reason: string; pattern: RegExp }> = [
    { risk: "external-facing", reason: "External publishing/posting/sending requires an Approval Gate.", pattern: /(publish|post now|post this|send\s+(?:to|it|this)|email\s+(?:to|this)|outbound|publicly|go live|submit\s+(?:to|this)|linkedin profile|tweet|social post)/ },
    { risk: "destructive", reason: "Deletion, purge, removal, or production-destructive work requires an Approval Gate.", pattern: /(delete|destroy|drop|purge|wipe|remove permanently|truncate|production database|live database|dns change)/ },
    { risk: "account-sensitive", reason: "Sensitive provider/account use requires an Approval Gate.", pattern: /(sensitive provider|account-sensitive|live account|credential|oauth|api key|browserbase|stripe|supabase production|google workspace|linkedin account|provider account)/ },
    { risk: "external-facing", reason: "External sharing requires an Approval Gate.", pattern: /(share externally|share with|client-facing|send to client|share to|make public)/ },
  ];
  const reasons: string[] = [];
  let risk: ChatApprovalPolicy["risk"] = "approval-required";
  checks.forEach((check) => {
    if (check.pattern.test(lower)) {
      reasons.push(check.reason);
      if (check.risk === "destructive" || (check.risk === "account-sensitive" && risk !== "destructive") || risk === "approval-required") risk = check.risk;
    }
  });
  if (explicit && reasons.length === 0) reasons.push("Route explicitly marked approval required.");
  const required = reasons.length > 0 || explicit;
  return {
    required,
    risk: required ? risk : "safe",
    reasons: uniqueStrings(reasons),
    internalDraftAutoProceed: internalDraft && !required,
  };
}

function plannerItems(values?: string[]) {
  return uniqueStrings(values ?? []);
}

function inferPlanner(decisionValue: ChatIntentDecision): ChatIntentPlanner {
  const matched = decisionValue.matchedContext;
  const route = decisionValue.intentType;
  const tools = plannerItems(matched.toolsRequired?.length ? matched.toolsRequired : route === "one_time_reply" ? ["session_search"] : ["kanban"]);
  const skills = plannerItems(matched.skillsRequired?.length ? matched.skillsRequired : route.includes("research") || route === "project" ? ["agent-mission-control-ui"] : []);
  const data = plannerItems([
    matched.projectName || matched.projectId ? "Selected Project context" : "Project context confirmation",
    matched.taskTitle || matched.taskId ? "Matched Task Board card" : "",
    matched.routineTitle || matched.routineId ? "Matched Routine configuration" : "",
    matched.workflowTitle || matched.workflowId ? "Matched Workflow definition" : "",
    matched.approvalTitle || matched.approvalId ? "Approval Gate record" : "",
    matched.sourceSummary ? `Source materials: ${matched.sourceSummary}` : "",
    matched.requestedOutputs?.length ? `Requested outputs: ${matched.requestedOutputs.join(", ")}` : "",
    ...(matched.dataRequired ?? []),
  ]);
  const access = plannerItems([
    matched.approvalRequired ? "Approval Gate review before external/scheduled action" : "Normal workspace permissions",
    route === "routine_recommendation" || route === "modify_routine" ? "Routine scheduling permission before enabling" : "",
    route === "workflow" || Boolean(matched.workflowId) ? "Workflow launch permission" : "",
    ...(matched.accessRequired ?? []),
  ]);
  const capabilities = plannerItems([
    route === "one_time_reply" ? "Global Command Chat" : "Task Board",
    matched.projectName || matched.projectId || route === "project" || route === "research_to_deliverable" ? "Projects / Context Hub" : "",
    route === "routine_recommendation" || route === "modify_routine" ? "Routines" : "",
    route === "workflow" || Boolean(matched.workflowId) ? "Workflow Library" : "",
    matched.approvalRequired ? "Approval Gates" : "",
    matched.evidenceRequired === false ? "" : "Audit Log / Evidence",
    ...(matched.missionControlCapabilities ?? []),
  ]);
  return { tools, skills, data, access, capabilities };
}

function withPlanner(preview: ChatIntentPreview, decisionValue: ChatIntentDecision): ChatIntentPreview {
  return { ...preview, planner: decisionValue.matchedContext.planner ?? inferPlanner(decisionValue) };
}

function extractNamedProjectHint(instruction: string) {
  const match = instruction.match(/\b(?:for|under|in|to|into)\s+(?:the\s+)?([a-z0-9][a-z0-9&'’().:_\-/\s]{2,80}?)\s+(?:project|workspace|initiative)\b/i);
  const projectName = match?.[1]?.trim().replace(/[.,;:!?]+$/, "");
  if (!projectName || /^(this|that|the|a|an|existing|current|selected|new)$/i.test(projectName)) return null;
  return projectName;
}

function detectResearchDeliverable(instruction: string, input: RouteChatIntentInput): Pick<ChatIntentMatchedContext, "researchSubtype" | "requestedOutputs" | "sourceSummary"> | null {
  const text = instruction.toLowerCase();
  const hasSourceReference = includesAny(text, [
    /\b(source|sources|uploaded|upload|uploads|file|files|document|documents|doc|docs|pdf|pptx|deck|slides|url|urls|link|links|webpage|article|articles|paper|papers|transcript|video|audio|csv|spreadsheet)\b/,
    /\bfrom\s+(the\s+)?(attached|uploaded|source|sources|files|docs|documents|links|urls)\b/,
  ]);
  const outputs = uniqueStrings([
    includesAny(text, [/\b(pptx|powerpoint|deck|slides?|presentation)\b/]) ? "PPTX deck" : "",
    includesAny(text, [/\b(docx|word doc|briefing|brief|report|write[-\s]?up|whitepaper)\b/]) ? "DOCX briefing" : "",
    includesAny(text, [/\b(proposal|sow|quote)\b/]) ? "Proposal" : "",
    includesAny(text, [/\b(training material|training materials|courseware|lesson plan|workbook|worksheet)\b/]) ? "Training materials" : "",
    includesAny(text, [/\b(summary|summarize|summarise|notes?|citation|citations)\b/]) ? "Citation notes" : "",
  ]);
  let subtype: ChatResearchDeliverableSubtype | null = null;
  if (includesAny(text, [/\b(status|progress|where are we|what happened|latest)\b.*\b(project|deck|report|proposal|sources?|research)\b/, /\b(check|show)\b.*\b(project status|research status|deliverable status)\b/])) subtype = "check_project_status";
  else if (includesAny(text, [/\b(add|attach|upload|include|ingest)\b.*\b(source|sources|file|files|doc|docs|url|link|links)\b/])) subtype = "add_sources_to_project";
  else if (includesAny(text, [/\b(revise|edit|update|refine|change)\b.*\b(deck|slides?|report|proposal|docx|pptx|artifact)\b/])) subtype = "revise_artifact";
  else if (includesAny(text, [/\b(training material|training materials|courseware|lesson plan|workbook|worksheet)\b/])) subtype = "generate_training_material";
  else if (includesAny(text, [/\b(proposal|sow|quote)\b/])) subtype = "generate_proposal";
  else if (includesAny(text, [/\b(pptx|powerpoint|deck|slides?|presentation)\b/])) subtype = "generate_deck";
  else if (includesAny(text, [/\b(report|briefing|brief|docx|write[-\s]?up|whitepaper)\b/])) subtype = "generate_report";
  else if (includesAny(text, [/\b(compare|contrast|difference|differences)\b.*\b(source|sources|docs?|documents?|papers?|articles?)\b/])) subtype = "compare_sources";
  else if (includesAny(text, [/\b(summarize|summarise|summary|extract|synthesize|synthesise)\b.*\b(source|sources|docs?|documents?|files?|papers?|articles?)\b/])) subtype = "summarize_sources";
  else if (includesAny(text, [/\b(question|answer|ask|q&a|qa)\b.*\b(source|sources|docs?|documents?|files?)\b/])) subtype = "ask_sources";
  else if (includesAny(text, [/\b(learn|teach me|explain|study)\b.*\b(topic|from|using|source|sources|docs?|documents?)\b/])) subtype = "learn_topic";

  const deliverableIntent = Boolean(subtype && (hasSourceReference || outputs.length || input.selectedProject));
  if (!deliverableIntent) return null;

  const sourceHints = uniqueStrings([
    hasSourceReference ? "referenced sources" : "",
    includesAny(text, [/\b(uploaded|attached|attachment|attachments)\b/]) ? "uploaded files" : "",
    includesAny(text, [/\b(url|urls|link|links|webpage|article|articles)\b/]) ? "links/URLs" : "",
    includesAny(text, [/\b(video|audio|transcript)\b/]) ? "media/transcripts" : "",
  ]);

  return {
    researchSubtype: subtype,
    requestedOutputs: outputs.length ? outputs : ["Research notes"],
    sourceSummary: sourceHints.length ? sourceHints.join(", ") : null,
  };
}

function researchSubtypeLabel(subtype?: ChatResearchDeliverableSubtype | null) {
  switch (subtype) {
    case "generate_deck": return "Create editable deck from source materials";
    case "generate_report": return "Create editable report or briefing from sources";
    case "generate_proposal": return "Create proposal from research context";
    case "generate_training_material": return "Create training materials from sources";
    case "summarize_sources": return "Summarize source materials";
    case "compare_sources": return "Compare source materials";
    case "ask_sources": return "Answer questions from source materials";
    case "learn_topic": return "Learn a topic from structured sources";
    case "revise_artifact": return "Revise an existing deliverable";
    case "add_sources_to_project": return "Add sources to an existing Project";
    case "check_project_status": return "Check research-to-deliverable Project status";
    default: return "Research-to-Deliverable workflow";
  }
}

function decision(
  intentType: ChatIntentType,
  matchedContext: ChatIntentMatchedContext,
  confidence: ChatIntentConfidence,
  nextAction: ChatIntentNextAction,
  reason: string,
): ChatIntentDecision {
  const baseDecision = { intentType, matchedContext, confidence, nextAction, reason };
  const planner = matchedContext.planner ?? inferPlanner(baseDecision);
  return {
    ...baseDecision,
    matchedContext: {
      ...matchedContext,
      toolsRequired: matchedContext.toolsRequired?.length ? matchedContext.toolsRequired : planner.tools,
      skillsRequired: matchedContext.skillsRequired?.length ? matchedContext.skillsRequired : planner.skills,
      dataRequired: matchedContext.dataRequired?.length ? matchedContext.dataRequired : planner.data,
      accessRequired: matchedContext.accessRequired?.length ? matchedContext.accessRequired : planner.access,
      missionControlCapabilities: matchedContext.missionControlCapabilities?.length ? matchedContext.missionControlCapabilities : planner.capabilities,
      planner,
    },
  };
}

export function routeChatIntent(input: RouteChatIntentInput): ChatIntentDecision {
  const raw = input.instruction.trim();
  const text = raw.toLowerCase();
  const referencedTask = findReferencedTask(raw, input.tasks);
  const referencedApproval = findReferencedApproval(raw, input.approvals);
  const referencedRoutine = findReferencedRoutine(raw, input.routines);
  const referencedWorkflow = findReferencedWorkflow(raw, input.workflows);
  let matched = baseContext(input, referencedTask, referencedApproval, referencedRoutine, referencedWorkflow);
  const namedProjectHint = !matched.projectName ? extractNamedProjectHint(raw) : null;
  if (namedProjectHint) matched = { ...matched, projectName: namedProjectHint };
  const researchDeliverable = detectResearchDeliverable(raw, input);
  if (researchDeliverable) matched = { ...matched, ...researchDeliverable };
  const approvalPolicy = inferApprovalPolicy(raw, Boolean(matched.approvalRequired));
  matched = { ...matched, approvalRequired: approvalPolicy.required, approvalPolicy };
  const hasContext = hasSelectedWork(input) || Boolean(referencedTask || referencedApproval || referencedRoutine || referencedWorkflow);
  const isTerseReference = (/^(do|continue|proceed|resume|carry on|next|make|approve|reject|show)\b/.test(text) || /^(can|could|would)\s+you\s+(do|continue|proceed|resume|make|approve|reject|show)\b/.test(text)) && /\b(this|that|it|latest|same|one)\b/.test(text);

  if (!raw) {
    return decision("ambiguous", matched, "low", "ask_clarifying_question", "No instruction text was provided.");
  }

  if (researchDeliverable) {
    const clearSources = Boolean(researchDeliverable.sourceSummary);
    const clearOutput = (researchDeliverable.requestedOutputs?.length ?? 0) > 0;
    const clearProject = Boolean(input.selectedProject || matched.projectId || matched.projectName);
    const confidence: ChatIntentConfidence = clearProject && (clearSources || clearOutput) ? "high" : clearOutput || clearSources ? "medium" : "low";
    return decision(
      "research_to_deliverable",
      matched,
      confidence,
      confidence === "high" ? "show_mission_proposal" : "ask_clarifying_question",
      confidence === "high"
        ? "Research-to-deliverable request has enough project/output/source context to preview and proceed under normal approval policy."
        : "Research-to-deliverable request needs a project, source, or output confirmation before creating/linking work.",
    );
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

export function confidenceFromScore(score: number | undefined): ChatIntentConfidence {
  if (typeof score !== "number" || Number.isNaN(score)) return "medium";
  if (score >= 0.75) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function buildChatIntentPreview(decisionValue: ChatIntentDecision): ChatIntentPreview {
  const matched = decisionValue.matchedContext;
  const hasContext = hasMatchedContext(matched);
  const contextLabel = matched.taskTitle || matched.missionTitle || matched.approvalTitle || matched.routineTitle || matched.workflowTitle || matched.projectName || matched.taskId || matched.missionId || matched.approvalId || matched.routineId || matched.workflowId || matched.projectId;

  if (decisionValue.intentType === "research_to_deliverable" || Boolean(matched.researchSubtype)) {
    const project = matched.projectName || matched.projectId || "Needs project confirmation";
    const outputs = matched.requestedOutputs?.length ? matched.requestedOutputs : ["Research notes"];
    const sources = matched.sourceSummary || "Needs source confirmation";
    const canProceed = decisionValue.confidence === "high" && Boolean(matched.projectName || matched.projectId);
    return withPlanner({
      kind: "research_to_deliverable_project",
      title: "Research-to-Deliverable Project",
      detail: researchSubtypeLabel(matched.researchSubtype),
      confidence: decisionValue.confidence,
      canProceed,
      suggestedQuestion: canProceed ? undefined : "Which Project should this belong to, and what source materials or outputs should I use?",
      primaryAction: canProceed ? "Review plan" : "Clarify Project/sources",
      secondaryAction: canProceed ? "Open task drawer" : "Edit request",
      researchDeliverable: {
        subtype: matched.researchSubtype ?? "learn_topic",
        label: researchSubtypeLabel(matched.researchSubtype),
        outputs,
        sources,
        project,
        status: canProceed ? "Preparing task plan" : "Waiting for clarification before mutation",
        safety: canProceed
          ? matched.approvalRequired
            ? `Needs Approval Gate: ${matched.approvalPolicy?.reasons[0] || "human approval required before external or sensitive action"}`
            : "High confidence: can create/link Project and queue internal draft work; external sharing remains approval-gated."
          : "Clarify first: no Project, Task Board, or workflow mutation is enabled yet.",
      },
    }, decisionValue);
  }

  if (decisionValue.intentType === "approval_response") {
    return withPlanner({
      kind: "approval_response_detected",
      title: "Approval response detected",
      detail: contextLabel ? `I will link this response to ${contextLabel}.` : "I detected approval language but no exact approval target.",
      confidence: decisionValue.confidence,
      canProceed: Boolean(contextLabel),
      suggestedQuestion: contextLabel ? undefined : "Which approval should I apply that decision to?",
      primaryAction: contextLabel ? "Send to Melkizac" : "Clarify approval",
      secondaryAction: "Edit request",
    }, decisionValue);
  }


  if (decisionValue.intentType === "clarification") {
    return withPlanner({
      kind: "needs_clarification",
      title: "Needs clarification",
      detail: decisionValue.reason || "I need a clearer target before routing this safely.",
      confidence: decisionValue.confidence,
      canProceed: false,
      suggestedQuestion: "What Project, workflow, output, or source material should this use?",
      primaryAction: "Clarify in chat",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  if (decisionValue.intentType === "routine_recommendation") {
    return withPlanner({
      kind: "routine_workflow_change_detected",
      title: "Routine draft recommended",
      detail: "This looks recurring, scheduled, or automation-like. Create a disabled routine draft before anything runs.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Create routine draft",
      secondaryAction: "Reply only",
    }, decisionValue);
  }

  if (decisionValue.intentType === "workflow") {
    return withPlanner({
      kind: "possible_match_found",
      title: "Workflow candidate detected",
      detail: contextLabel ? `I can queue ${contextLabel} with approval gates.` : "I can queue a workflow launch if you confirm the workflow candidate.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Launch workflow",
      secondaryAction: "Reply only",
    }, decisionValue);
  }

  if (decisionValue.intentType === "project") {
    return withPlanner({
      kind: "starting_new_goal",
      title: "Project creation recommended",
      detail: "This looks like multi-step work that should become a Mission Control Project with Task Board evidence.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Create project",
      secondaryAction: "Reply only",
    }, decisionValue);
  }

  if (decisionValue.intentType === "one_time_reply") {
    return withPlanner({
      kind: "possible_match_found",
      title: "Reply-only route",
      detail: "This appears answerable in chat without creating Project, Task Board, workflow, or routine state.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Reply only",
      secondaryAction: "Create Kanban task",
    }, decisionValue);
  }
  if (decisionValue.nextAction === "ask_clarifying_question" && !hasContext) {
    const suggestedQuestion = decisionValue.intentType === "modify_routine"
      ? "Which routine, workflow, or task should I change?"
      : "Which project, mission, task, routine, or approval do you mean?";
    return withPlanner({
      kind: "needs_clarification",
      title: "Needs clarification",
      detail: "I need a target before routing this safely.",
      confidence: decisionValue.confidence,
      canProceed: false,
      suggestedQuestion,
      primaryAction: "Clarify in chat",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  if (decisionValue.intentType === "modify_routine") {
    return withPlanner({
      kind: "routine_workflow_change_detected",
      title: "Routine or workflow change detected",
      detail: contextLabel ? `I will link this to ${contextLabel}.` : "I will treat this as creating or changing an operating routine/workflow.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send to Melkizac",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  if (decisionValue.intentType === "new_goal") {
    return withPlanner({
      kind: "starting_new_goal",
      title: "Starting a new goal",
      detail: contextLabel ? `I will start this under ${contextLabel}.` : "I will route this as a new goal or mission proposal.",
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Start goal",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  if (hasContext && ["continue_mission", "update_task", "resolve_blocker", "status_query", "evidence_query"].includes(decisionValue.intentType)) {
    return withPlanner({
      kind: decisionValue.confidence === "medium" ? "possible_match_found" : "linked_existing_mission",
      title: decisionValue.confidence === "medium" ? "Possible match found" : "Linked to existing work",
      detail: `I will route this with context from ${contextLabel}.`,
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send with context",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  if (decisionValue.confidence === "medium" && hasContext) {
    return withPlanner({
      kind: "possible_match_found",
      title: "Possible match found",
      detail: `I found related context: ${contextLabel}.`,
      confidence: decisionValue.confidence,
      canProceed: true,
      primaryAction: "Send with context",
      secondaryAction: "Edit request",
    }, decisionValue);
  }

  return withPlanner({
    kind: "possible_match_found",
    title: "Ready to route",
    detail: contextLabel ? `I will include ${contextLabel} as context.` : "I will route this as a one-time task for Melkizac.",
    confidence: decisionValue.confidence,
    canProceed: true,
    primaryAction: "Send to Melkizac",
    secondaryAction: "Edit request",
  }, decisionValue);
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
    `Research Subtype: ${decisionValue.matchedContext.researchSubtype || "none"}`,
    `Requested Outputs: ${decisionValue.matchedContext.requestedOutputs?.join(", ") || "none"}`,
    `Source Summary: ${decisionValue.matchedContext.sourceSummary || "none"}`,
    `Tools Required: ${decisionValue.matchedContext.toolsRequired?.join(", ") || "none"}`,
    `Skills Required: ${decisionValue.matchedContext.skillsRequired?.join(", ") || "none"}`,
    `Data Required: ${decisionValue.matchedContext.dataRequired?.join(", ") || decisionValue.matchedContext.planner?.data.join(", ") || "none"}`,
    `Access Required: ${decisionValue.matchedContext.accessRequired?.join(", ") || decisionValue.matchedContext.planner?.access.join(", ") || "none"}`,
    `Mission Control Capabilities: ${decisionValue.matchedContext.missionControlCapabilities?.join(", ") || decisionValue.matchedContext.planner?.capabilities.join(", ") || "none"}`,
    `Evidence Required: ${decisionValue.matchedContext.evidenceRequired === undefined ? "unknown" : String(decisionValue.matchedContext.evidenceRequired)}`,
    `Approval Required: ${decisionValue.matchedContext.approvalRequired === undefined ? "unknown" : String(decisionValue.matchedContext.approvalRequired)}`,
    `Selected Project Scope: ${decisionValue.matchedContext.projectName || decisionValue.matchedContext.projectId || "none"}`,
    "UI Policy: Mission Control may show a compact routing preview before/while sending; treat it as user-facing routing evidence, not as final truth.",
    "Clarification Policy: If confidence is low or the route is unsafe/ambiguous, ask the user in chat before acting.",
    "Project Scope: The selected Project is the user-declared context for this Chat message.",
    `Reason: ${decisionValue.reason}`,
    `Example Coverage: ${ROUTING_EXAMPLES.join("; ")}`,
  ].join("\n");
}
