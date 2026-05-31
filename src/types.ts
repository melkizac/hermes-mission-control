// Core domain types for Hermes Mission Control.
// An "agent" maps to a Hermes profile (an isolated HERMES_HOME).
// A "task" maps to a gateway session/job. "Output" = workspace artifacts.

export type AgentStatus = "working" | "waiting" | "idle" | "error" | "offline";

export interface Skill {
  id: string;
  name: string;
  category?: string;
  source?: string; // e.g. "hub", "custom-repo"
}

export type ConfigKind = "soul" | "memory" | "agents" | "config" | "other";

export interface ConfigFile {
  name: string; // SOUL.md, MEMORY.md, AGENTS.md, config.yaml
  label: string; // human description
  kind: ConfigKind;
  content: string;
  sizeBytes: number;
  updatedAt: string;
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
}

export interface ToolCall {
  skill: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  text?: string;
  toolCall?: ToolCall;
  artifact?: Artifact;
  insight?: string;
  at: string;
}

export type TaskStatus = "queued" | "running" | "blocked" | "done" | "error";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  updatedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  squad: string;
  initials: string;
  color: string;
  model: string;
  status: AgentStatus;
  activity: string;
  lastActive: string;
  profilePath: string; // ~/.hermes/<id>
  uptime: string;
  sessionCount: number;
  skills: Skill[];
  files: ConfigFile[];
  messages: Message[];
  artifacts: Artifact[];
  tasks: Task[];
  insightSummary?: string;
  insightStatus?: string;
}

export interface Approval {
  id: string;
  agentId: string;
  agentName: string;
  kind: string;
  detail: string;
  createdAt: string;
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
}

export interface AutomationsResponse {
  automations: AutomationRoutine[];
  summary: {
    total: number;
    enabled: number;
    paused: number;
    error: number;
    no_agent: number;
  };
  states: string[];
  error?: string;
}

export interface AutomationActionResponse {
  ok: boolean;
  action?: string;
  job_id?: string;
  stdout?: string;
  stderr?: string;
  returncode?: number;
  error?: string;
}

export type BoardStatus = "queued" | "running" | "blocked" | "done" | "error";

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
  result: string;
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

export interface BoardResponse {
  tasks: BoardTask[];
  lanes: Record<BoardStatus, BoardTask[]>;
  summary: {
    total: number;
    queued: number;
    running: number;
    blocked: number;
    done: number;
    error: number;
    assignees: string[];
  };
  statuses: BoardStatus[];
}

export interface BoardTaskMutationResponse {
  ok: boolean;
  task?: BoardTask;
  comment?: BoardComment & { task_id: string };
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

export interface SkillsHubResponse {
  skills: SkillHubRecord[];
  summary: {
    total: number;
    editable: number;
    plugin: number;
    user: number;
    assigned: number;
  };
  categories: string[];
  sources: string[];
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
  actions: ProjectActionsSummary;
  risks: ProjectRiskItem[];
  knowledge: ProjectKnowledgeItem[];
  sessions: ProjectSessionItem[];
  artifacts: ProjectArtifactItem[];
  workspaces: Array<{ name?: string; path?: string }>;
  activity: ProjectActivityItem[];
  tags: string[];
  workspace_count: number;
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

export type ViewKey =
  | "mission"
  | "agents"
  | "projects"
  | "board"
  | "skills"
  | "approvals"
  | "automations"
  | "audit"
  | "costs"
  | "settings";
