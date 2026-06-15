// Core domain types for Hermes Mission Control.
// An "agent" maps to a Hermes profile (an isolated HERMES_HOME).
// A "task" maps to a gateway session/job. "Output" = workspace artifacts.

export type AgentStatus = "active" | "idle" | "degraded" | "offline" | "working" | "waiting" | "error";

export interface Skill {
  id: string;
  name: string;
  category?: string;
  source?: string; // e.g. "hub", "custom-repo"
}

export interface ToolCategory {
  id: string;
  name: string;
  count?: number;
}

export interface ToolCapability {
  id: string;
  name: string;
  kind?: "toolset" | "platform" | "tool" | string;
  source?: string;
  enabled?: boolean;
  description?: string;
  toolCount?: number | null;
  sampleTools?: string[];
  toolNames?: string[];
  categories?: ToolCategory[];
  toolName?: string;
  parentToolsetId?: string;
  parentToolsetName?: string;
  assignmentUnit?: string;
}

export type ConfigKind = "soul" | "memory" | "agents" | "config" | "other";

export interface ConfigFile {
  name: string; // SOUL.md, MEMORY.md, AGENTS.md, config.yaml
  label: string; // human description
  kind: ConfigKind;
  content: string;
  sizeBytes: number;
  updatedAt: string;
  scope?: "profile" | "workspace-agent" | string;
  editable?: boolean;
}

export type MessageRole = "user" | "agent" | "system";

export interface Artifact {
  id: string;
  filename: string;
  path: string;
  mime: string;
  sizeBytes: number;
  preview?: string;
  createdAt: string;
  url?: string;
  downloadUrl?: string;
  previewUrl?: string;
  version?: string;
  qaStatus?: string;
  driveUrl?: string;
}

export type WorkItemKind = "task" | "goal" | "run" | "approval" | "intake" | "workflow";
export type RiskLevel = "safe" | "approval-required" | "external-facing" | "destructive" | "account-sensitive";
export type MissionArtifactKind = "file" | "link" | "screenshot" | "report" | "diff" | "message" | "dataset" | "note";
export type EvidenceKind = "source" | "tool-call" | "session" | "screenshot" | "file" | "log" | "approval" | "human-note" | "api-response" | "qa-result" | "render-preview";
export type EvidenceGateType = "command_output" | "build_test_log" | "api_response" | "screenshot" | "file_artifact" | "approval_note" | "session_link" | string;
export type EvidenceGateStatus = "not-required" | "passed" | "blocked" | string;
export type PhaseCheckpointStatus = "pending" | "in_progress" | "passed" | "blocked" | "failed";
export type HmcWorkflowPhase = "hmc-plan" | "hmc-build" | "hmc-review" | "hmc-qa" | "hmc-ship" | "hmc-canary" | "hmc-retro";
export type HmcWorkflowEvidenceStatus = "pending" | "running" | "passed" | "blocked" | "failed" | "skipped" | string;

export interface HmcWorkflowEvidenceCommand {
  command: string;
  status: HmcWorkflowEvidenceStatus;
  summary?: string;
  log_path?: string | null;
  logPath?: string | null;
}

export interface HmcWorkflowEvidenceCheck {
  type: string;
  status: HmcWorkflowEvidenceStatus;
  summary: string;
  url?: string | null;
  path?: string | null;
}

export interface HmcWorkflowEvidenceApproval {
  required: boolean;
  status: "not-required" | "pending" | "approved" | "rejected" | "changes-requested" | HmcWorkflowEvidenceStatus;
  reason?: string;
  source?: string | null;
}

export interface HmcWorkflowEvidence {
  schema: "hmc.workflow_evidence.v1" | string;
  project_id?: string;
  projectId?: string;
  tenant?: string;
  task_id?: string;
  taskId?: string;
  phase: HmcWorkflowPhase | string;
  status: HmcWorkflowEvidenceStatus;
  summary: string;
  created_at?: string;
  createdAt?: string;
  created_by?: string;
  createdBy?: string;
  branch?: string | null;
  commit?: string | null;
  workspace_path?: string | null;
  workspacePath?: string | null;
  deploy_target?: string | null;
  deployTarget?: string | null;
  health_check?: string | null;
  healthCheck?: string | null;
  browser_proof?: string | null;
  browserProof?: string | null;
  docs_impact?: string | null;
  docsImpact?: string | null;
  rollback?: string | null;
  rollback_note?: string | null;
  rollbackNote?: string | null;
  review?: string | Record<string, unknown> | null;
  build?: string | Record<string, unknown> | null;
  tests?: Array<string | Record<string, unknown>> | Record<string, unknown> | null;
  artifacts?: Array<Record<string, unknown>>;
  commands?: HmcWorkflowEvidenceCommand[];
  checks?: HmcWorkflowEvidenceCheck[];
  risks?: Array<string | Record<string, unknown>>;
  approval?: HmcWorkflowEvidenceApproval;
}


export interface GuardPolicy {
  mode?: "advisory" | "enforced" | "frozen" | string;
  scope?: string;
  allowed_edit_paths?: string[];
  allowedEditPaths?: string[];
  destructive_command_warning_level?: "low" | "medium" | "high" | "critical" | string;
  destructiveCommandWarningLevel?: "low" | "medium" | "high" | "critical" | string;
  checkpoint_mode?: string;
  checkpointMode?: string;
  rollback_artifact_path?: string;
  rollbackArtifactPath?: string;
  freeze?: boolean;
  advisory_enforcement?: boolean;
  advisoryEnforcement?: boolean;
  safe_start_required?: boolean;
  safeStartRequired?: boolean;
  dirty_repo_policy?: string;
  dirtyRepoPolicy?: string;
  evidence_required?: string[];
  evidenceRequired?: string[];
}

export interface WorkItemRef {
  id: string;
  kind: WorkItemKind;
  title: string;
  projectId?: string | null;
  projectName?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  status?: string;
  url?: string;
}

export interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  type?: string;
  title: string;
  summary?: string;
  source: string;
  sourceId?: string | null;
  path?: string | null;
  url?: string | null;
  createdAt: string;
  created_at?: string;
  redacted?: boolean;
  redactionStatus?: string;
  confidence?: "low" | "medium" | "high" | string;
  reference?: string | null;
  taskId?: string | null;
  runId?: string | null;
  artifactId?: string | null;
  verificationStatus?: string | null;
  checks?: string[];
}

export interface MissionArtifact {
  id: string;
  kind: MissionArtifactKind;
  title: string;
  summary?: string;
  filename?: string;
  path?: string | null;
  url?: string | null;
  downloadUrl?: string | null;
  previewUrl?: string | null;
  driveUrl?: string | null;
  mime?: string;
  sizeBytes?: number;
  preview?: string;
  version?: string;
  qaStatus?: "not-run" | "pending" | "passed" | "failed" | "blocked" | string;
  format?: "pptx" | "docx" | "pdf" | "markdown" | "drive" | string;
  createdAt: string;
  createdBy?: string;
  evidenceIds?: string[];
}

export interface ApprovalGate {
  id: string;
  title: string;
  risk: RiskLevel;
  status: "not-required" | "pending" | "approved" | "rejected" | "changes-requested";
  reason: string;
  requestedBy?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  sourceRef?: WorkItemRef;
}

export interface EvidenceGateChecklistItem {
  type: EvidenceGateType;
  label: string;
  satisfied: boolean;
}

export interface EvidenceGateState {
  required: boolean;
  requiredTypes: EvidenceGateType[];
  satisfiedTypes: EvidenceGateType[];
  missingTypes: EvidenceGateType[];
  status: EvidenceGateStatus;
  completionBlocked: boolean;
  checklist: EvidenceGateChecklistItem[];
  acceptedTypes: EvidenceGateType[];
  summary: string;
}

export interface MissionResult {
  id: string;
  workItem: WorkItemRef;
  summary: string;
  status: "draft" | "completed" | "blocked" | "failed";
  artifacts: MissionArtifact[];
  evidence: EvidenceRecord[];
  approvalGates: ApprovalGate[];
  evidenceGate: EvidenceGateState;
  nextActions: string[];
  model?: string;
  costUsd?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface PhaseCheckpoint {
  id: string;
  phase: string;
  title: string;
  status: PhaseCheckpointStatus;
  dependencies: Array<{ id: string; label: string; status: PhaseCheckpointStatus }>;
  tests: Array<{ command: string; status: PhaseCheckpointStatus; output?: string }>;
  evidence: EvidenceRecord[];
  completedAt?: string | null;
  nextPhase?: string | null;
}

export interface ProjectMasterInstructions {
  projectId: string;
  projectName: string;
  objective: string;
  masterInstructions: string;
  workspacePath?: string | null;
  linkedSkills: string[];
  linkedAgents: Array<{ id: string; name: string }>;
  riskDefaults: RiskLevel[];
  updatedAt: string;
}

export interface DelegateWorkPlan {
  id: string;
  title: string;
  userRequest: string;
  projectId: string;
  projectName: string;
  agentId: string;
  agentName: string;
  workItem: WorkItemRef;
  risk: RiskLevel;
  riskLabel: string;
  approvalRequired: boolean;
  routingReason: string;
  masterInstructions: ProjectMasterInstructions;
  promptPreview: string;
  taskBody: string;
  nextActions: string[];
  evidence: EvidenceRecord[];
}

export interface DelegateWorkContextResponse {
  projects: ProjectRecord[];
  agents: Array<{ id: string; name: string; status?: string }>;
  masterInstructions: ProjectMasterInstructions[];
  defaultProjectId?: string | null;
  riskLevels: RiskLevel[];
  error?: string;
}

export interface DelegateWorkMutationResponse {
  ok: boolean;
  plan?: DelegateWorkPlan;
  task?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  owner: string;
  summary: string;
  evidenceRequired: string[];
  approvalRequired?: boolean;
}

export interface BrowserConnectorReadinessItem {
  label: string;
  status: "ready" | "blocked" | "warning" | string;
  detail?: string | null;
}

export interface BrowserConnectorConfig {
  id: string;
  type: "browserbase" | "desktop-browser" | "windows-gateway" | string;
  label: string;
  baseUrl?: string | null;
  credentials?: Record<string, string>;
  enabled: boolean;
  approvalStatus: string;
  approval?: Record<string, unknown>;
  dryRun?: { status: string; checkedAt?: string; noSubmit?: boolean; summary?: string };
  lastProbe?: {
    id?: string;
    status: string;
    checkedAt?: string;
    targetUrl?: string;
    finalUrl?: string;
    domain?: string;
    screenshotPath?: string | null;
    formsDetected?: number;
    submitCandidates?: number;
    noSubmit?: boolean;
    browserActivityUrl?: string;
    summary?: string;
    archived?: boolean;
    archivedAt?: string;
    archivedBy?: string;
    archiveReason?: string;
  };
  probeHistory?: Array<NonNullable<BrowserConnectorConfig["lastProbe"]>>;
  noSubmit: boolean;
  safeTargetRequired: boolean;
  accountSensitiveAllowed?: boolean;
  readinessChecklist: BrowserConnectorReadinessItem[];
  updatedAt?: string | null;
}

export interface BrowserConnectorsResponse {
  connectors: BrowserConnectorConfig[];
  summary: { total: number; approved: number; enabled: number; needs_approval: number };
  productionPolicy?: {
    enablementStatus: string;
    noSubmit: boolean;
    safeTargetRequired: boolean;
    accountSensitiveAllowed: boolean;
    blockedActions: string;
    accountSensitiveStatus: string;
    operatorDecisionRequired: boolean;
    summary: string;
  };
  browserTrackCompletion?: {
    currentPhase: string;
    readyForSupervisedDryRuns: boolean;
    readyForAccountSensitive: boolean;
    summary: string;
    checklist: BrowserConnectorReadinessItem[];
    nextActions: string[];
  };
  demo?: boolean;
  error?: string;
}

export interface BrowserConnectorMutationResponse {
  ok: boolean;
  connector?: BrowserConnectorConfig;
  action?: string;
  created?: boolean;
  demo?: boolean;
  message?: string;
  error?: string;
}

export interface BrowserConnectorProbeResponse {
  ok: boolean;
  dryRun?: boolean;
  connector?: BrowserConnectorConfig;
  sessionId?: string;
  browserActivityUrl?: string;
  screenshotPath?: string | null;
  summary?: Record<string, unknown>;
  demo?: boolean;
  message?: string;
  error?: string;
}

export interface FunnelRunStatus {
  status: string;
  lastRunAt?: string | null;
  summary?: string;
}

export interface FunnelEvidenceHistoryItem {
  title: string;
  path?: string | null;
  url?: string | null;
  summary?: string | null;
  createdAt?: string | null;
}

export interface FunnelConnectorReadinessItem {
  label: string;
  status: "ready" | "blocked" | "warning" | string;
  detail?: string | null;
}

export interface RoutineBinding {
  enabled: boolean;
  latestRunStatus: FunnelRunStatus;
  evidenceHistory: FunnelEvidenceHistoryItem[];
}

export interface PackagedWorkflowRoutine {
  id?: string | null;
  name: string;
  label?: string;
  workflow_template_id?: string;
  workflowName?: string;
  schedule?: string;
  schedule_kind?: string;
  enabled?: boolean;
  status?: string;
  state?: string;
  next_run_at?: string;
  next_run_relative?: string;
  last_run_at?: string;
  last_status?: string;
  prompt_preview?: string;
  taskBoardTenant?: string;
  assignee?: string;
  sourceOfTruth?: string;
  sequence?: number;
}

export interface WorkflowTaskMaterialization {
  enabled: boolean;
  taskBoardTenant: string;
  assignee: string;
  statuses: string[];
  sourceOfTruth: string;
}

export interface PackagedWorkflow {
  id: string;
  name: string;
  category: string;
  summary: string;
  idealFor: string;
  projectId?: string | null;
  projectName?: string | null;
  agentId: string;
  agentName: string;
  risk: RiskLevel;
  skills: string[];
  steps: WorkflowStep[];
  evidence: EvidenceRecord[];
  artifacts: MissionArtifact[];
  approvalGates: ApprovalGate[];
  nextActions: string[];
  launchPrompt: string;
  launchDefaults?: { noSubmit?: boolean; safeTargetRequired?: boolean; runMode?: string; scheduleMode?: string; schedule?: string; targetUrl?: string };
  routines?: PackagedWorkflowRoutine[];
  taskMaterialization?: WorkflowTaskMaterialization;
  routineBinding?: RoutineBinding;
  updatedAt: string;
}

export interface WorkflowLibraryResponse {
  workflows: PackagedWorkflow[];
  categories: string[];
  summary: { total: number; approval_required: number; skills_linked: number; evidence_ready: number };
  error?: string;
}

export interface WorkflowLaunchResponse {
  ok: boolean;
  workflow?: PackagedWorkflow;
  plan?: DelegateWorkPlan;
  task?: Record<string, unknown>;
  tasks?: Record<string, unknown>[];
  routine?: Record<string, unknown>;
  mission_result?: MissionResult | null;
  error?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  path: string;
  mime: string;
  sizeBytes: number;
  createdAt: string;
  preview?: string;
  url?: string;
}

export interface ToolCall {
  skill: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface ReplyContext {
  id: string;
  role: MessageRole;
  author: string;
  text: string;
  at?: string;
}

export interface ModelRoutingSelection {
  mode: "auto" | "manual";
  modelId?: string;
}

export interface RouterModel {
  id: string;
  label: string;
  provider: string;
  model: string;
  tier: string;
  enabled: boolean;
  authorized?: boolean;
  credential_env?: string;
  secret_status?: string;
  cost_weight?: number;
  best_for?: string[];
  notes?: string;
}

export interface RouterConfig {
  enabled: boolean;
  updated_at: string;
  policy: Record<string, unknown>;
  models: RouterModel[];
  summary: { total: number; enabled: number; authorized: number; frontier: number };
  error?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text?: string;
  replyTo?: ReplyContext;
  attachments?: Attachment[];
  toolCall?: ToolCall;
  artifact?: Artifact;
  insight?: string;
  at: string;
  ts?: number;
  source?: string;
  sessionId?: string;
  projectId?: string;
  projectName?: string;
  requestId?: string;
}

export interface WorkerTranscriptEntry {
  id: string;
  type: "message" | "tool-call" | "tool-result" | "processing" | "activity" | "system" | string;
  role: "user" | "agent" | "assistant" | "tool" | "system" | string;
  title: string;
  text?: string;
  at?: string;
  ts?: number;
  source?: string;
  sessionId?: string;
  sessionTitle?: string;
  requestId?: string;
  toolName?: string;
  toolCalls?: Array<Record<string, unknown>>;
  tokens?: number;
  finishReason?: string;
  status?: string;
  jobId?: string;
  jobName?: string;
  actor?: string;
}

export interface WorkerTranscriptResponse {
  agentId: string;
  generatedAt: string;
  active: WorkerTranscriptEntry[];
  entries: WorkerTranscriptEntry[];
  sessions: Array<{ id: string; title: string; source?: string; model?: string; started_at?: string }>;
  summary: { entries: number; active: number; toolEvents: number; sessions: number };
  error?: string;
}

export interface ProjectChatSession {
  id: string;
  title: string;
  project_id: string;
  project_name: string;
  source: string;
  model: string;
  started_at: string;
  messages: number;
  tools: number;
  tokens: number;
  relationship_type?: string;
  summary?: string;
  linked_by?: string;
  linked_at?: string;
  link_source?: "canonical" | "heuristic" | string;
  project_owner?: string;
  project_status?: string;
  kanban_tenant?: string;
  kanban_board?: string;
  project_score?: number;
}

export interface ProjectChatResponse {
  projects: Array<{ id: string; name: string; sessions: number; owner?: string; status?: string; kanban_tenant?: string; kanban_board?: string }>;
  sessions: ProjectChatSession[];
  summary: { projects: number; sessions: number; canonical_links?: number; heuristic_links?: number };
  error?: string;
}

export type TaskStatus = "queued" | "running" | "blocked" | "done" | "error";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface ProfileRuntimeDetails {
  profile_id: string;
  profile_path: string;
  identity?: { name?: string; source?: string };
  model_routing?: { provider?: string; model?: string };
  toolsets?: string[];
  memory?: { entries: number; files: Array<{ name: string; entries: number; updated_at?: string }>; redacted_or_sensitive_mentions?: number };
  sessions?: { count: number; recent?: Array<Record<string, unknown>> };
  plugins?: { enabled: number; total: number; items: Array<{ id: string; name: string; category?: string; status?: string; source?: string }>; error?: string };
  gateway?: { channels: Array<{ id: string; enabled: boolean; source?: string }>; webhooks_configured?: number };
  environment?: { env_files: Array<{ name: string; status: string; variable_count: number; sensitive_count: number }>; policy: string };
  routines?: { count: number; items?: Array<Record<string, unknown>> };
  config_files?: Array<{ name: string; kind?: string; updated_at?: string }>;
}

export interface AgentHandoff {
  id: string;
  from_agent: string;
  to_agent: string;
  task_id?: string | null;
  objective: string;
  context?: string | null;
  requested_output: string;
  risk: "low" | "medium" | "high" | "critical" | string;
  status: "requested" | "accepted" | "in_progress" | "blocked" | "completed" | "failed" | "cancelled" | string;
  evidence?: Array<Record<string, unknown>>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentHandoffSummary {
  sent: number;
  received: number;
  open: number;
  blocked: number;
}

export interface AgentHandoffResponse {
  ok: boolean;
  handoffs: AgentHandoff[];
  summary?: { total: number; open: number; completed: number; blocked: number; high_risk: number };
  statuses?: string[];
  error?: string;
}

export interface AgentHandoffMutationResponse {
  ok: boolean;
  handoff?: AgentHandoff;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  squad: string;
  initials: string;
  color: string;
  model: string;
  status: AgentStatus;
  availability?: "online" | "degraded" | "offline" | string;
  activityState?: "active" | "sleeping" | "partial" | "disconnected" | string;
  statusLabel?: string;
  statusDetail?: string;
  statusEvidence?: Record<string, boolean | number | string>;
  activity: string;
  lastActive: string;
  profilePath: string; // ~/.hermes/<id>
  uptime: string;
  sessionCount: number;
  skills: Skill[];
  tools?: ToolCapability[];
  files: ConfigFile[];
  messages: Message[];
  processingRequests?: string[];
  processingRequestDetails?: Array<{ id: string; agent_id?: string; started_at?: number }>;
  artifacts: Artifact[];
  tasks: Task[];
  detailLoaded?: boolean;
  detailEndpoint?: string;
  transcriptEndpoint?: string;
  insightSummary?: string;
  insightStatus?: string;
  profile_details?: ProfileRuntimeDetails;
  handoffs?: AgentHandoff[];
  handoff_summary?: AgentHandoffSummary;
}

export interface Approval {
  id: string;
  agentId: string;
  agentName: string;
  kind: string;
  detail: string;
  createdAt: string;
}

export interface MissionControlUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user" | "viewer" | string;
  status: string;
}

export interface MissionControlWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface MissionControlMe {
  ok: boolean;
  user: MissionControlUser;
  workspace: MissionControlWorkspace;
  hermes_profile?: {
    id: string;
    owner_user_id: string;
    profile_name: string;
    display_name: string;
    status: string;
    profile_path?: string;
    created_at?: number | string;
    updated_at?: number | string;
  } | null;
  runtime?: {
    id: string;
    user_id: string;
    profile_id: string;
    kind: string;
    status: string;
    container_name?: string;
    image?: string;
    host_home?: string;
    container_home?: string;
    last_error?: string;
    created_at?: number | string;
    updated_at?: number | string;
  } | null;
  agent_access?: {
    role?: string;
    can_select?: boolean;
    can_assign_to_own_projects?: boolean;
    can_assign_to_users?: boolean;
    can_edit_global_definition?: boolean;
    can_manage_runtime?: boolean;
  } | null;
}

export interface AuditSession {
  id: string;
  title: string;
  source: string;
  model: string;
  started_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  status: string;
  end_reason?: string | null;
  message_count: number;
  tool_call_count: number;
  api_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  actual_cost_usd?: number | null;
  cost_status?: string | null;
  cost_source?: string | null;
  billing_provider?: string | null;
  preview: string;
}

export interface AuditMessage {
  id: string;
  role: string;
  content: string;
  tool_call_id?: string | null;
  tool_name?: string | null;
  tool_calls?: Array<{ id?: string | null; name?: string | null }>;
  timestamp: string;
  token_count: number;
  finish_reason?: string | null;
  observed?: boolean;
}

export interface AuditSummary {
  total: number;
  running: number;
  tool_calls: number;
  tokens: number;
  estimated_cost_usd: number;
}

export interface AuditSessionListResponse {
  sessions: AuditSession[];
  sources: string[];
  summary: AuditSummary;
  error?: string;
}

export interface AuditSessionDetailResponse {
  session: AuditSession;
  messages: AuditMessage[];
}

export interface AutomationRun {
  id: string;
  title: string;
  started_at: string;
  ended_at?: string | null;
  status: string;
  message_count: number;
  tool_call_count: number;
  tokens: number;
  estimated_cost_usd: number;
}

export interface AutomationOutput {
  path: string;
  name: string;
  updated_at: string;
  preview: string;
}

export interface AutomationRoutine {
  id: string;
  name: string;
  enabled: boolean;
  state: string;
  status: string;
  schedule: string;
  schedule_kind: string;
  next_run_at: string;
  next_run_relative: string;
  last_run_at: string;
  last_run_relative: string;
  last_status: string;
  last_error?: string | null;
  deliver: string;
  origin?: string | null;
  skills: string[];
  skill_count: number;
  enabled_toolsets: string[];
  model?: string | null;
  provider?: string | null;
  script?: string | null;
  no_agent: boolean;
  context_from: string[];
  workdir?: string | null;
  profile: string;
  repeat_times?: number | null;
  repeat_completed: number;
  created_at: string;
  prompt_preview: string;
  recent_runs: AutomationRun[];
  recent_outputs: AutomationOutput[];
  run_count: number;
  workflow_template_id?: string;
  workflowName?: string;
  taskBoardTenant?: string;
  assignee?: string;
  sourceOfTruth?: string;
  targetUrl?: string;
  noSubmit?: boolean;
  safeTargetRequired?: boolean;
  latestRunStatus?: FunnelRunStatus;
  evidenceHistory?: FunnelEvidenceHistoryItem[];
  routine_type?: "platform" | "workspace" | "personal";
  workspace_id?: string | null;
  owner_user_id?: string | null;
  runtime_id?: string | null;
  agent_id?: string | null;
  agent_class?: string | null;
  connector_dependencies?: Array<{ connector_id: string; action: string }>;
  approval_policy_dependency?: Record<string, unknown>;
  quota_impact?: Record<string, unknown>;
  quota_policy?: Record<string, unknown>;
  run_status?: string;
  last_run?: {
    id: string;
    status: string;
    reason?: string;
    approval_request_id?: string | null;
    browser_evidence?: Record<string, unknown>;
    research_run?: Record<string, unknown>;
    run_detail_url?: string;
    started_at?: string;
    completed_at?: string | null;
  } | null;
  run_detail_url?: string | null;
}

export interface AutomationsResponse {
  automations: AutomationRoutine[];
  summary: {
    total: number;
    enabled: number;
    paused: number;
    error: number;
    no_agent: number;
    governed?: number;
    platform?: number;
    workspace?: number;
    personal?: number;
  };
  states: string[];
  workflow_routines?: AutomationRoutine[];
  routine_summary?: Record<string, number>;
  error?: string;
}

export interface AutomationActionPayload {
  action?: "pause" | "resume" | "run" | "enable_funnel_routine";
  routine?: Partial<AutomationRoutine> & Record<string, unknown>;
  approved?: boolean;
  approvedBy?: string;
  note?: string;
}

export interface AutomationActionResponse {
  ok: boolean;
  action?: string;
  job_id?: string;
  job?: Record<string, unknown>;
  target?: FunnelTarget;
  stdout?: string;
  stderr?: string;
  returncode?: number;
  error?: string;
}

export interface FunnelTarget {
  id: string;
  label: string;
  url: string;
  targetUrl: string;
  project: string;
  expected: string;
  schedule: string;
  noSubmit: boolean;
  safeTargetRequired: boolean;
  approvalStatus: "approved" | "needs-review" | string;
  approval?: { status: string; approvedBy?: string | null; approvedAt?: string | null; note?: string | null };
  routineId: string;
  routineEnabled: boolean;
  latestRunStatus?: FunnelRunStatus;
  evidenceHistory?: FunnelEvidenceHistoryItem[];
  latestScreenshot?: { title?: string; path?: string | null; url?: string | null; createdAt?: string | null } | null;
  browserActivityUrl?: string | null;
  taskResultUrl?: string | null;
  finalUrl?: string | null;
  approvalHistory?: Array<{ status: string; approvedBy?: string | null; approvedAt?: string | null; note?: string | null }>;
  connectorReadiness?: FunnelConnectorReadinessItem[];
  runNowConfirmation?: { dryRunConfirmed: boolean; confirmedBy?: string | null; confirmedAt?: string | null; mode?: string | null };
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FunnelTargetsResponse {
  targets: FunnelTarget[];
  summary: { total: number; approved: number; enabled: number; needs_review: number };
  demo?: boolean;
  error?: string;
}

export interface FunnelTargetDetailResponse {
  ok: boolean;
  target?: FunnelTarget;
  demo?: boolean;
  error?: string;
}

export interface FunnelTargetMutationResponse {
  ok: boolean;
  demo?: boolean;
  created?: boolean;
  action?: string;
  target?: FunnelTarget;
  job?: Record<string, unknown>;
  message?: string;
  error?: string;
}

export type BoardStatus = "triage" | "todo" | "scheduled" | "ready" | "running" | "blocked" | "error" | "review" | "done";

export interface BoardComment {
  id: number | null;
  author: string;
  body: string;
  created_at: string;
}

export interface BoardEvent {
  id: number | null;
  kind: string;
  payload: unknown;
  created_at: string;
  run_id?: number | null;
}

export interface BoardRun {
  id: number;
  profile?: string | null;
  step_key?: string | null;
  status: string;
  started_at: string;
  ended_at?: string | null;
  outcome?: string | null;
  summary?: string;
  error?: string;
}

export interface RunTreeVerification {
  status: "pending" | "running" | "passed" | "failed" | "blocked" | string;
  blocked: boolean;
  blockers?: string[];
  reason?: string;
  required_for_completion?: boolean;
}

export interface RunTreeRunNode {
  id: string;
  run_id?: number | string | null;
  task_id?: string;
  parent_id?: string;
  agent?: string | null;
  model?: string | null;
  toolsets?: string[];
  step_key?: string | null;
  status: string;
  outcome?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  output?: string;
  verification?: RunTreeVerification;
}

export interface RunTreeTaskNode {
  id: string;
  task_id: string;
  title: string;
  subtask?: boolean;
  agent?: string | null;
  parent_task_ids?: string[];
  child_task_ids?: string[];
  model?: string | null;
  toolsets?: string[];
  step_key?: string | null;
  status: string;
  output?: string;
  verification: RunTreeVerification;
  runs: RunTreeRunNode[];
  children: RunTreeTaskNode[];
}

export interface RunTreePayload {
  root?: RunTreeTaskNode | null;
  summary: {
    total_tasks: number;
    total_runs: number;
    blocked_nodes: number;
    status: string;
    completion_blocked: boolean;
    blocking_reasons?: string[];
  };
  verification?: RunTreeVerification;
}

export interface BoardTaskResultDetails {
  status?: string | null;
  summary?: string | Record<string, unknown>;
  objective?: string;
  workflow_type?: string;
  workflowType?: string;
  artifact?: string | null;
  blockers?: string[];
  verification?: Record<string, string>;
  access_needed?: string;
  sources?: Array<Record<string, unknown>>;
  outputs?: Array<Record<string, unknown>>;
  stages?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
  requirements?: Record<string, unknown>;
  artifacts?: MissionArtifact[];
  evidence?: EvidenceRecord[];
  evidence_gate?: EvidenceGateState;
  evidenceGate?: EvidenceGateState;
  approval_gates?: ApprovalGate[];
  next_actions?: string[];
  needs_human?: boolean;
  needsHuman?: boolean;
  approval_policy?: Record<string, unknown>;
  approvalPolicy?: Record<string, unknown>;
  guard_policy?: GuardPolicy;
  guardPolicy?: GuardPolicy;
  workflow_evidence?: HmcWorkflowEvidence[] | HmcWorkflowEvidence;
  workflowEvidence?: HmcWorkflowEvidence[] | HmcWorkflowEvidence;
  hmc_workflow_evidence?: HmcWorkflowEvidence[] | HmcWorkflowEvidence;
}

export interface TaskResultResponse {
  ok: boolean;
  task?: BoardTask;
  mission_result?: MissionResult | null;
  run_tree?: RunTreePayload | null;
  agent_handoffs?: AgentHandoff[];
  error?: string;
}

export interface BoardTask {
  id: string;
  title: string;
  body: string;
  assignee: string;
  status: BoardStatus;
  raw_status: string;
  priority: number;
  priority_label: "low" | "medium" | "high" | "critical";
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  workspace_kind: string;
  workspace_path?: string | null;
  branch_name?: string | null;
  tenant?: string | null;
  board_id?: string;
  board_slug?: string;
  board_label?: string;
  board_is_default?: boolean;
  result: string;
  result_details?: BoardTaskResultDetails | null;
  guard_policy?: GuardPolicy | null;
  guardPolicy?: GuardPolicy | null;
  mission_result?: MissionResult | null;
  run_tree?: RunTreePayload | null;
  agent_handoffs?: AgentHandoff[];
  session_id?: string | null;
  current_run_id?: number | null;
  workflow_template_id?: string | null;
  current_step_key?: string | null;
  skills: string[];
  model_override?: string | null;
  consecutive_failures: number;
  last_failure_error: string;
  comments: BoardComment[];
  events: BoardEvent[];
  runs: BoardRun[];
  children: string[];
  parents: string[];
}

export interface KanbanBoardInfo {
  id: string;
  slug: string;
  label: string;
  is_default: boolean;
}

export interface KanbanBoardWarning {
  board?: string;
  status: string;
  reason: string;
}

export interface BoardResponse {
  tasks: BoardTask[];
  lanes: Record<BoardStatus, BoardTask[]>;
  summary: {
    total: number;
    triage: number;
    todo: number;
    scheduled: number;
    ready: number;
    running: number;
    blocked: number;
    error: number;
    review: number;
    done: number;
    assignees: string[];
    projects: string[];
    boards?: string[];
  };
  statuses: BoardStatus[];
  projects: string[];
  boards?: KanbanBoardInfo[];
  board_errors?: KanbanBoardWarning[];
  warnings?: KanbanBoardWarning[];
}

export interface BoardTaskMutationResponse {
  ok: boolean;
  task?: BoardTask;
  comment?: BoardComment & { task_id: string };
  error?: string;
}

export interface OperatorLinkPreview {
  title: string;
  risk: string;
  agent: string;
  action: string;
  open: string;
  text: string;
}

export interface OperatorLinkPreviewResponse {
  ok: boolean;
  task?: OperatorLinkPreview;
  approval?: OperatorLinkPreview;
  agent?: OperatorLinkPreview;
  examples?: OperatorLinkPreview[];
  error?: string;
}

export interface SkillHubRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  source: string;
  editable: boolean;
  enabled: boolean;
  path: string;
  skill_dir: string;
  profile: string;
  version: string;
  author: string;
  tags: string[];
  related_skills: string[];
  updated_at: string;
  readiness: string;
  model: string;
  preview: string;
  used_by_agents: string[];
  used_by_automations: string[];
  used_by_tasks: string[];
  used_by_count: number;
}

export interface SkillFileResponse {
  id: string;
  name: string;
  path: string;
  skill_dir: string;
  content: string;
  size: number;
  updated_at: string;
}

export interface SkillsHubResponse {
  skills: SkillHubRecord[];
  summary: {
    total: number;
    editable: number;
    hermes?: number;
    openclaw?: number;
    shared?: number;
    plugin: number;
    user: number;
    assigned: number;
  };
  categories: string[];
  sources: string[];
  error?: string;
}

export interface MemoryContextEntry {
  id: string;
  scope: "user" | "memory";
  scope_label: string;
  category: string;
  title: string;
  text: string;
  raw: string;
  source_path: string;
  source_label: string;
  line_start: number;
  updated_at: string;
  redacted: boolean;
  tags: string[];
}

export interface MemoryContextResponse {
  entries: MemoryContextEntry[];
  summary: {
    total: number;
    user: number;
    memory: number;
    redacted: number;
    categories: number;
  };
  categories: string[];
  category_counts: { category: string; count: number }[];
  sources: string[];
  policy: {
    summary: string;
    recommended_controls: string[];
  };
  error?: string;
}

export interface PluginHubRecord {
  id: string;
  name: string;
  category: string;
  status: string;
  enabled: boolean;
  version: string;
  description: string;
  source: string;
}

export interface PluginsHubResponse {
  plugins: PluginHubRecord[];
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    bundled: number;
    user: number;
    categories: number;
  };
  categories: string[];
  sources: string[];
  statuses: string[];
  error?: string;
}

export interface CostPeriodSummary {
  sessions: number;
  cost: number;
  tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
  tool_calls: number;
  api_calls?: number;
}

export interface CostBreakdownRow extends CostPeriodSummary {
  model?: string;
  source?: string;
  label?: string;
  agent_class?: string;
  workspace_id?: string;
  user_id?: string;
  provider?: string;
}

export interface CostUsageRecord {
  id?: string;
  routine_id?: string;
  workspace_id?: string;
  runtime_id?: string;
  user_id?: string;
  role_id?: string;
  agent_id?: string;
  agent_class?: string;
  connector_id?: string;
  run_type?: string;
  model?: string;
  provider?: string;
  routine_type?: string;
  research_depth?: string;
  tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  reasoning_tokens?: number;
  cost?: number;
  estimated_cost_usd?: number;
  browser_minutes?: number;
  browser_actions?: number;
  browser_sessions?: number;
  file_extraction_count?: number;
  file_extraction_size_bytes?: number;
  status?: string;
  started_at?: string | number;
}

export interface ResearchUsageSummary {
  runs: number;
  cost: number;
  tokens: number;
  by_depth: Record<string, { runs: number; cost: number; tokens: number }>;
}

export interface BrowserUsageSummary {
  runs: number;
  minutes: number;
  actions: number;
}

export interface FileExtractionUsageSummary {
  runs: number;
  count: number;
  size_bytes: number;
}

export interface CostDailyRow {
  day: string;
  sessions: number;
  cost: number;
  tokens: number;
  tool_calls: number;
}

export interface CostSessionRecord {
  id: string;
  title: string;
  source: string;
  model: string;
  started_at: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  total_tokens: number;
  tool_call_count: number;
  message_count: number;
  api_call_count: number;
  estimated_cost_usd: number;
  actual_cost_usd?: number | null;
  display_cost_usd: number;
  cost_status?: string | null;
  cost_source?: string | null;
  billing_provider?: string | null;
}

export interface ModelUsageWindow {
  label: string;
  used_seconds: number;
  limit_seconds: number;
  used_hours: number;
  limit_hours: number;
  remaining_seconds: number;
  remaining_hours: number;
  percent_used: number;
  remaining_percent?: number;
  reset_at: string;
  reset_label: string;
}

export interface ModelUsageLimitSummary {
  daily: ModelUsageWindow;
  weekly: ModelUsageWindow;
  selected_model: string;
  models: string[];
  source: string;
  available?: boolean;
  error?: string;
  selected?: boolean;
  aliases?: string[];
  metered_feature?: string;
  additional_model_usages?: ModelUsageLimitSummary[];
}

export interface CostsResponse {
  window_days: number;
  summary: {
    last_24h: CostPeriodSummary;
    last_7d: CostPeriodSummary;
    last_30d: CostPeriodSummary;
    selected: CostPeriodSummary;
    all_time: CostPeriodSummary;
  };
  by_model: CostBreakdownRow[];
  by_source: CostBreakdownRow[];
  daily: CostDailyRow[];
  expensive_sessions: CostSessionRecord[];
  usage_records?: CostUsageRecord[];
  by_agent_class?: CostBreakdownRow[];
  by_workspace?: CostBreakdownRow[];
  by_user?: CostBreakdownRow[];
  by_model_provider?: CostBreakdownRow[];
  research_usage?: ResearchUsageSummary;
  browser_usage?: BrowserUsageSummary;
  file_extraction_usage?: FileExtractionUsageSummary;
  quota_dimensions?: string[];
  model_usage?: ModelUsageLimitSummary;
  model_usage_models?: ModelUsageLimitSummary[];
  error?: string;
}

export interface ProjectActionsSummary {
  open: number;
  running: number;
  blocked: number;
  done: number;
}

export interface ProjectKnowledgeItem {
  title: string;
  path: string;
  type: string;
  updated_at: string;
}

export interface ProjectArtifactItem {
  name: string;
  path: string;
  updated_at: string;
  kind: string;
}

export interface ProjectSessionItem {
  id: string;
  title: string;
  source: string;
  model: string;
  started_at: string;
  messages: number;
  tools: number;
  tokens: number;
  project_id?: string;
  project_name?: string;
  relationship_type?: string;
  summary?: string;
  linked_by?: string;
  linked_at?: string;
  link_source?: string;
}

export interface ProjectActivityItem {
  kind: string;
  title: string;
  status: string;
  at: string;
  id?: string;
}

export interface ProjectRiskItem {
  label: string;
  severity: string;
  count?: number;
}

export interface ProjectOperatingLink {
  id?: string;
  name?: string;
  title?: string;
  status?: string;
  enabled?: boolean;
  schedule?: string;
  next_run_at?: string;
  progress?: number;
  agent_id?: string;
  agent_name?: string;
  role?: string;
  mode?: string;
  category?: string;
  source?: string;
  readiness?: string;
  assignee?: string;
  updated_at?: string;
  owner?: string;
  kind?: string;
  detail?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  kind: string;
  status: string;
  health: number;
  progress: number;
  summary: string;
  path: string;
  source: string;
  updated_at: string;
  portfolio_group?: string;
  source_contexts?: Array<{ id?: string; kind?: string; source?: string; name?: string; path?: string }>;
  actions: ProjectActionsSummary;
  risks: ProjectRiskItem[];
  knowledge: ProjectKnowledgeItem[];
  sessions: ProjectSessionItem[];
  artifacts: ProjectArtifactItem[];
  workspaces: Array<{ name?: string; path?: string }>;
  activity: ProjectActivityItem[];
  tags: string[];
  workspace_count: number;
  guard_policy?: GuardPolicy | null;
  guardPolicy?: GuardPolicy | null;
  tasks?: ProjectOperatingLink[];
  automations?: ProjectOperatingLink[];
  goals?: ProjectOperatingLink[];
  agents?: ProjectOperatingLink[];
  skills?: ProjectOperatingLink[];
  human_bottlenecks?: ProjectOperatingLink[];
  next_actions?: string[];
  operating_counts?: Record<string, number>;
}

export interface ProjectBriefResponse {
  ok: boolean;
  project?: ProjectRecord;
  brief_markdown?: string;
  error?: string;
}

export interface ProjectsResponse {
  projects: ProjectRecord[];
  summary: {
    total: number;
    active: number;
    open_actions: number;
    blocked: number;
    knowledge: number;
    workspaces: number;
  };
  kinds: string[];
  project_areas?: string[];
  sources: string[];
  error?: string;
}

export type InboxStatus = "drafted" | "ready" | "sent" | "rejected";
export type InboxAction = "approve" | "reject" | "ready" | "draft";

export interface InboxItem {
  id: string;
  title: string;
  description: string;
  body: string;
  kind: string;
  status: InboxStatus;
  risk: "low" | "medium" | "high" | "critical" | string;
  source: string;
  source_id?: string | null;
  source_path?: string | null;
  destination: string;
  agent_id: string;
  agent_name: string;
  project_id?: string | null;
  project_name?: string | null;
  task_id?: string | null;
  evidence?: string | null;
  evidence_url?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at?: string | null;
  decision_note?: string | null;
  provenance: string;
  metadata: Record<string, unknown>;
}

export interface InboxResponse {
  items: InboxItem[];
  summary: {
    drafted: number;
    ready: number;
    sent: number;
    rejected: number;
    total: number;
    high_risk: number;
    [key: string]: number;
  };
  statuses: InboxStatus[];
  sources: string[];
  error?: string;
}

export interface InboxMutationResponse {
  ok: boolean;
  action?: InboxAction;
  item?: InboxItem;
  error?: string;
}

export interface SecondBrainItem {
  id: string;
  title: string;
  summary: string;
  path: string;
  relative_path: string;
  section: string;
  layer: "wiki" | "raw" | string;
  updated_at: string;
  size: number;
  links: string[];
  preview: string;
  immutable: boolean;
}

export interface SecondBrainResponse {
  root: string;
  wiki_path: string;
  raw_path: string;
  schema_path: string;
  summary: {
    title: string;
    description: string;
    wiki_pages: number;
    raw_sources: number;
    sections: number;
    log_entries: number;
    last_updated: string;
    health: string;
  };
  sections: string[];
  wiki: SecondBrainItem[];
  raw_sources: SecondBrainItem[];
  schema: { path: string; updated_at: string; preview: string };
  index: { path: string; updated_at: string; preview: string };
  log: { path: string; updated_at: string; preview: string; entries: Array<{ title: string; summary: string }> };
  command_center?: SecondBrainItem | null;
  health: { status: string; checks: Array<{ label: string; ok: boolean; detail: string }> };
}

export interface SecondBrainIndexResponse {
  root: string;
  summary: { wiki_pages: number; raw_sources: number; sections: number; links: number; chunks: number; last_indexed: string; semantic_status: string };
  sections: string[];
  wiki: SecondBrainItem[];
  raw_sources: SecondBrainItem[];
  graph: { nodes: number; edges: number };
  chunks: Array<{ id: string; note_id: string; text: string; embedding_status: string; section: string }>;
  policy: { mode: string; path_safety?: string; redaction?: string };
}

export interface SecondBrainSearchResult {
  id: string;
  title: string;
  relative_path: string;
  section: string;
  layer: string;
  updated_at: string;
  snippet: string;
  score: number;
}

export interface SecondBrainSearchResponse {
  query: string;
  results: SecondBrainSearchResult[];
  summary: { total: number; returned?: number };
  policy: { mode: string };
}

export interface SecondBrainGraphResponse {
  nodes: Array<{ id: string; title: string; section: string; layer: string; summary: string; path: string; relative_path: string; updated_at: string; link_count: number }>;
  edges: Array<{ source: string; target: string; label: string; kind: string }>;
  summary: { nodes: number; edges: number };
  policy?: { mode: string };
}

export interface SecondBrainNoteResponse {
  note: SecondBrainItem & {
    content: string;
    content_truncated?: boolean;
    backlinks: Array<{ title: string; relative_path: string; label: string }>;
    evidence: SecondBrainItem[];
    health: { redacted: boolean; backlinks: number; outbound_links: number };
  };
  context_actions: Array<{ id: string; label: string; status: string }>;
  policy: { mode: string; write_workflows?: string };
  error?: string;
}

export interface SecondBrainHealthResponse {
  health: { status: string; checks: Array<{ label: string; ok: boolean; detail: string }> };
  knowledge_health: { orphan_review: string; stale_notes: string; conflicts: string };
  write_workflows: { status: string; actions: string[] };
  semantic_search: { status: string; chunks: number };
}

export interface RuntimeRecord {
  id: string;
  name: string;
  type: string;
  status: "online" | "degraded" | "offline" | string;
  summary: string;
  readiness: {
    representable: boolean;
    monitorable: boolean;
    controllable: boolean;
  };
  evidence: Record<string, unknown>;
  safe_actions: string[];
  updated_at: string;
}

export interface RuntimeRegistryResponse {
  runtimes: RuntimeRecord[];
  summary: {
    total: number;
    online: number;
    degraded: number;
    offline: number;
    monitorable: number;
    controllable: number;
  };
  updated_at: string;
  error?: string;
}

export interface RuntimeConnectorToken {
  id: string;
  label: string;
  allowed_types: string[];
  status: string;
  created_at: string;
  last_used_at?: string | null;
  expires_at?: string | null;
}

export interface RuntimeConnectorEvent {
  id: number;
  external_runtime_id: string;
  kind: string;
  severity: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface RuntimeConnectorResponse {
  tokens: RuntimeConnectorToken[];
  runtimes: RuntimeRecord[];
  events: RuntimeConnectorEvent[];
  connect: {
    register_url: string;
    heartbeat_url: string;
    events_url: string;
    curl_example?: string;
  };
  summary: {
    tokens: number;
    active_tokens: number;
    connected: number;
    online: number;
  };
  error?: string;
}

export interface RuntimeConnectorTokenResponse {
  ok: boolean;
  token: RuntimeConnectorToken;
  secret: string;
  connect: RuntimeConnectorResponse["connect"];
  warning: string;
  error?: string;
}

export interface GatewayHealthProbe {
  ok: boolean;
  http_code?: number | null;
  error?: string | null;
  status?: Record<string, unknown>;
  preview?: string;
}

export interface DesktopGatewayExecutionTarget {
  id: string;
  label: string;
  description: string;
  ready: boolean;
  url?: string | null;
  executionBoundary: string;
  approvalRequired: boolean;
}

export interface WindowsGatewayStatus {
  mode: string;
  name: string;
  configured: boolean;
  url: string;
  tokenPreview?: string | null;
  tokenSet: boolean;
  approvedFolders: string[];
  health: GatewayHealthProbe;
  recommendedFolders: string[];
  setup: { localCommand: string; tunnelExamples: string[] };
}

export interface DesktopGatewayStatus {
  mode: string;
  name: string;
  remoteUrl: string;
  sessionTokenPreview?: string | null;
  tokenSet: boolean;
  localPort: number;
  service: { name: string; active: string };
  local: GatewayHealthProbe;
  windows: WindowsGatewayStatus;
  targets: DesktopGatewayExecutionTarget[];
  desktopSteps: string[];
  notes: string[];
  readinessSummary: {
    remoteReady: boolean;
    windowsReady: boolean;
    configuredTargets: number;
    readyTargets: number;
    needsAttention: string[];
  };
}

export interface WindowsGatewayConfigResponse {
  ok: boolean;
  windows?: WindowsGatewayStatus;
  error?: string;
}


export interface BrowserActionEvent {
  id: string;
  ts: string;
  title: string;
  summary: string;
  type: "navigation" | "click" | "input" | "screenshot" | "approval" | "stop" | "note" | string;
  risk: RiskLevel;
  approvalRequired: boolean;
  evidenceIds?: string[];
}

export interface BrowserSession {
  id: string;
  title: string;
  status: "active" | "idle" | "blocked" | "stopped" | "completed" | "simulated" | string;
  source?: "simulated" | "runtime-event-bridge" | string;
  agentId?: string | null;
  agentName?: string | null;
  runtimeId: string;
  runtimeLabel: string;
  executionTarget: DesktopGatewayExecutionTarget;
  currentUrl?: string | null;
  currentDomain: string;
  accountSensitive: boolean;
  approvalRequired: boolean;
  approvalReason: string;
  screenshot?: MissionArtifact | null;
  evidence: EvidenceRecord[];
  actionLog: BrowserActionEvent[];
  startedAt: string;
  updatedAt: string;
  stopAvailable: boolean;
  takeoverAvailable: boolean;
  notes: string[];
}

export interface BrowserSessionsResponse {
  sessions: BrowserSession[];
  summary: {
    total: number;
    active: number;
    approvalRequired: number;
    accountSensitive: number;
    screenshots: number;
    liveRuntimeEvents: number;
    windowsReady: boolean;
    needsAttention: string[];
  };
  updatedAt: string;
}

export interface WorkspaceRunContextualAccess {
  surfaces: string[];
  audit_url?: string;
  approval_request_id?: string | null;
  has_browser_evidence: boolean;
  has_research_run: boolean;
  artifact_count: number;
  note?: string;
}

export interface WorkspaceRunRecord {
  id: string;
  routine_id: string;
  routine_name?: string;
  workspace_id?: string | null;
  owner_user_id?: string | null;
  runtime_id?: string | null;
  agent_id?: string | null;
  agent_class?: string | null;
  scope: "personal" | "workspace" | "shared" | string;
  status: string;
  reason?: string;
  approval_request_id?: string | null;
  browser_evidence?: { sessions?: BrowserSession[]; [key: string]: unknown };
  research_run?: Partial<ResearchRun> & { id?: string; title?: string; sources?: Array<Record<string, unknown>>; [key: string]: unknown };
  metadata?: Record<string, unknown>;
  artifacts: MissionArtifact[];
  started_at: string;
  completed_at?: string | null;
  run_detail_url: string;
  contextual_access: WorkspaceRunContextualAccess;
}

export interface WorkspaceRunHistoryResponse {
  ok: boolean;
  runs: WorkspaceRunRecord[];
  summary: { total: number; browser_evidence: number; research_runs: number; artifacts: number };
  contextual_access: { surfaces: string[] };
  error?: string;
}

export interface WorkspaceRunDetailResponse {
  ok: boolean;
  run: WorkspaceRunRecord;
  contextual_access: WorkspaceRunContextualAccess;
  error?: string;
}

export interface BrowserRuntimeEventIngestRequest {
  sessionId: string;
  title?: string;
  status?: string;
  agentId?: string;
  agentName?: string;
  runtimeId?: string;
  runtimeLabel?: string;
  currentUrl?: string;
  currentDomain?: string;
  accountSensitive?: boolean;
  approvalRequired?: boolean;
  approvalReason?: string;
  taskId?: string;
  taskUrl?: string;
  screenshot?: Partial<MissionArtifact>;
  evidence?: EvidenceRecord[];
  action?: Partial<BrowserActionEvent> & { body?: string };
}

export interface BrowserRuntimeEventIngestResponse {
  ok: boolean;
  session?: BrowserSession;
  error?: string;
}

export interface ResearchRunLane {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  status: "queued" | "running" | "completed" | "blocked" | "error" | string;
  focus: string;
  currentStep: string;
  progress: number;
  sourcesReviewed: number;
  evidenceCount: number;
  confidence: "low" | "medium" | "high" | string;
  blocker?: string | null;
  taskId?: string;
  requiresApproval?: boolean;
  updatedAt: string;
}

export interface ResearchSourceCoverage {
  id: string;
  label: string;
  kind: string;
  status: "queued" | "reviewed" | "blocked" | "rejected" | string;
  url?: string | null;
  ownerLaneId?: string | null;
  confidence: "low" | "medium" | "high" | string;
  notes: string;
}

export interface ResearchSynthesisStatus {
  status: "queued" | "drafting" | "ready" | "blocked" | string;
  progress: number;
  leadAgent: string;
  openQuestions: string[];
  recommendation: string;
  updatedAt: string;
}

export interface ResearchRun {
  id: string;
  title: string;
  status: "queued" | "running" | "completed" | "blocked" | string;
  summary: string;
  owner: string;
  risk: RiskLevel | string;
  startedAt: string;
  updatedAt: string;
  lanes: ResearchRunLane[];
  sourceCoverage: ResearchSourceCoverage[];
  synthesis: ResearchSynthesisStatus;
  evidence: EvidenceRecord[];
  finalArtifact: MissionArtifact;
  nextActions: string[];
  taskId?: string;
  taskUrl?: string;
  trackedTaskIds?: string[];
}

export interface CreateResearchRunRequest {
  title: string;
  objective: string;
  projectId?: string;
  lanes: Array<Partial<ResearchRunLane> & { title: string; focus?: string; agentId?: string; agentName?: string; requiresApproval?: boolean }>;
  sources: Array<Partial<ResearchSourceCoverage> & { label: string; kind?: string; notes?: string; ownerLaneId?: string }>;
}

export type ResearchRunCreateRequest = CreateResearchRunRequest;

export interface CreateResearchRunResponse {
  ok: boolean;
  run: ResearchRun;
  task: Task;
  trackedTaskIds: string[];
  taskUrl: string;
  demo?: boolean;
  message?: string;
}

export type ResearchRunCreateResponse = CreateResearchRunResponse;

export interface ResearchRunsResponse {
  runs: ResearchRun[];
  summary: {
    total: number;
    active_lanes: number;
    blocked_lanes: number;
    source_coverage: number;
    evidence_items: number;
    synthesis_ready: number;
  };
  updatedAt: string;
}

export type CapabilityRegistryTab = "installed" | "available" | "intake" | "broken" | "assigned";

export interface CapabilityAssignmentRef {
  id: string;
  name?: string;
  title?: string;
  enabled?: boolean;
  status?: string;
  reason?: string;
}

export interface CapabilityRegistryRecord {
  id: string;
  type: string;
  name?: string;
  displayName?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: string;
  sourceUri?: string | null;
  sourceRef?: string | null;
  sourceLabel?: string | null;
  workspaceId?: string | null;
  runtimeId?: string | null;
  profileId?: string | null;
  ownerKind?: string;
  visibility?: string;
  editable?: boolean;
  enabled?: boolean;
  installMethod?: {
    kind?: string;
    commandPreview?: string;
    configPath?: string;
    requiresRestart?: boolean;
    requiredSecrets?: string[];
    requiredPermissions?: string[];
    wrapperType?: string;
  };
  license?: { name?: string; url?: string | null; allowed?: boolean | null; notes?: string };
  maintenanceSignals?: Record<string, unknown>;
  dependencyWeight?: { level?: string; signals?: Record<string, unknown> };
  runtimeWeight?: { level?: string; signals?: Record<string, unknown> };
  requiredSecrets?: string[];
  suggestedWrapperType?: string;
  smokeTestCommand?: string;
  governance?: {
    riskLevels?: string[];
    primaryRisk?: string;
    approvalRequired?: boolean;
    approvalAuthority?: string;
    approvalStatus?: string;
    policyGate?: string;
    policySummary?: string;
    blockedActions?: string[];
    actionableBlocker?: {
      code?: string;
      message?: string;
      requiredApprover?: string;
      action?: string;
      riskLevels?: string[];
    } | null;
  };
  policyEvidence?: {
    riskLevels?: string[];
    primaryRisk?: string;
    approvalRequired?: boolean;
    approvalAuthority?: string;
    approvalStatus?: string;
    policyGate?: string;
    actionableBlocker?: Record<string, unknown> | null;
  };
  permissions?: string[];
  health?: {
    state?: string;
    checkSummary?: string;
    lastCheckedAt?: string;
    nextCheckDueAt?: string;
    evidenceIds?: string[];
  };
  evidence?: EvidenceRecord[];
  assignment?: {
    assignmentUnit?: string;
    assignedAgents?: CapabilityAssignmentRef[];
    assignedRoutines?: CapabilityAssignmentRef[];
    assignedTasks?: CapabilityAssignmentRef[];
    suggestedAgents?: CapabilityAssignmentRef[];
    usageCount?: number;
  };
  rollback?: { supported?: boolean; disableSteps?: string[]; uninstallSteps?: string[]; restartRequired?: boolean };
  audit?: Array<Record<string, unknown>>;
  auditEvents?: Array<{
    id: string;
    action: string;
    actorId?: string;
    summary?: string;
    createdAt?: string;
    redacted?: boolean;
    evidence?: Record<string, unknown>;
  }>;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string | null;
}

export interface CapabilityIntakeRecord {
  id: string;
  title: string;
  name?: string;
  displayName?: string;
  description?: string;
  category?: string;
  sourceType?: string;
  sourceUri?: string | null;
  sourceRef?: string | null;
  sourceLabel?: string | null;
  workspaceId?: string | null;
  runtimeId?: string | null;
  profileId?: string | null;
  requestedBy?: string;
  status?: string;
  riskLevels?: string[];
  installMethod?: CapabilityRegistryRecord["installMethod"];
  license?: CapabilityRegistryRecord["license"];
  maintenanceSignals?: CapabilityRegistryRecord["maintenanceSignals"];
  dependencyWeight?: CapabilityRegistryRecord["dependencyWeight"];
  runtimeWeight?: CapabilityRegistryRecord["runtimeWeight"];
  requiredSecrets?: string[];
  suggestedWrapperType?: string;
  smokeTestCommand?: string;
  permissions?: string[];
  healthPlan?: Record<string, unknown>;
  evidence?: EvidenceRecord[];
  audit?: CapabilityRegistryRecord["audit"];
  auditEvents?: CapabilityRegistryRecord["auditEvents"];
  assignedAgents?: CapabilityAssignmentRef[];
  rollbackNotes?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CapabilityRegistryResponse {
  ok?: boolean;
  capabilities: CapabilityRegistryRecord[];
  summary: {
    total: number;
    enabled: number;
    assigned: number;
    awaitingApproval: number;
    degraded: number;
    requiringSecrets: number;
  };
  error?: string;
}

export interface CapabilityIntakeResponse {
  ok?: boolean;
  intake: CapabilityIntakeRecord[];
  summary: {
    total: number;
    awaitingApproval: number;
    requiringSecrets: number;
  };
  error?: string;
}

export interface CapabilityAssessmentResponse {
  ok?: boolean;
  assessment: CapabilityIntakeRecord;
  error?: string;
}

export interface CapabilityIntakeMutationResponse {
  ok?: boolean;
  intake: CapabilityIntakeRecord;
  error?: string;
}

export interface CapabilitySandboxResponse {
  ok?: boolean;
  status?: string;
  intake?: CapabilityIntakeRecord;
  sandbox?: Record<string, unknown>;
  error?: string;
}

export interface CapabilityMatrixCapability {
  id: string;
  type?: string;
  name?: string;
  displayName?: string;
  description?: string;
  source?: string;
  sourceLabel?: string;
  status?: string;
  enabled?: boolean;
  assigned?: boolean;
  inherited?: boolean;
  assignmentScope?: "assigned" | "inherited" | "available" | string;
  assignmentUnit?: string;
  assignmentRef?: Record<string, unknown>;
  riskLevels?: string[];
  approvalRequired?: boolean;
  approvalStatus?: string;
  approvalAuthority?: string;
  policyGate?: string;
  actionableBlocker?: Record<string, unknown> | null;
  healthState?: string;
  healthSummary?: string;
  toolCount?: number;
  sampleTools?: string[];
}

export interface CapabilityMatrixRow {
  agent: {
    id: string;
    name?: string;
    squad?: string;
    status?: string;
    profileId?: string;
    profilePath?: string;
    selected?: boolean;
  };
  capabilities: CapabilityMatrixCapability[];
  assigned: CapabilityMatrixCapability[];
  available: CapabilityMatrixCapability[];
  blocked: CapabilityMatrixCapability[];
  summary: {
    total: number;
    assigned: number;
    inherited?: number;
    available: number;
    blocked: number;
    skills: number;
    tools: number;
    registry: number;
  };
}

export interface CapabilityMatrixResponse {
  ok?: boolean;
  matrix: CapabilityMatrixRow[];
  agents?: CapabilityMatrixRow["agent"][];
  summary: {
    agents: number;
    capabilities: number;
    assigned: number;
    inherited?: number;
    blocked: number;
    registry: number;
    skills: number;
    tools: number;
  };
  error?: string;
}

export interface CapabilityAssignmentMutationResponse {
  ok?: boolean;
  action?: "assign" | "unassign";
  capability?: CapabilityRegistryRecord;
  blockedCapability?: Record<string, unknown>;
  nextAction?: string;
  status?: string;
  error?: string;
}

export type ViewKey =
  | "mission"
  | "dashboard"
  | "work"
  | "delegate-work"
  | "workflow-library"
  | "profile"
  | "workspace-preferences"
  | "agents"
  | "agent-voice"
  | "agent-org"
  | "agent-platform-admin"
  | "runtimes"
  | "tools"
  | "capabilities"
  | "plugins"
  | "projects"
  | "files"
  | "evidence"
  | "second-brain"
  | "board"
  | "skills"
  | "memory"
  | "reflections"
  | "approvals"
  | "automations"
  | "audit"
  | "usage"
  | "costs"
  | "models"
  | "users-workspaces"
  | "workspace-runtime-console"
  | "shared-agent-templates"
  | "desktop-gateway"
  | "browser-ops"
  | "research-runs"
  | "approval-policy"
  | "quota"
  | "settings";
