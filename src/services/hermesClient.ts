import type { Agent, AgentRuntimeAssignment, AgentRuntimeSwitcher, AgentHandoffMutationResponse, AgentHandoffResponse, Approval, Attachment, BrowserConnectorMutationResponse, BrowserConnectorProbeResponse, BrowserConnectorsResponse, BrowserSession, BrowserSessionsResponse, BrowserRuntimeEventIngestRequest, BrowserRuntimeEventIngestResponse, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionPayload, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardStatus, BoardTaskMutationResponse, CapabilityAssignmentMutationResponse, CapabilityMatrixResponse, ConfigFile, CostsResponse, DelegateWorkContextResponse, DelegateWorkMutationResponse, DesktopGatewayStatus, FunnelTargetDetailResponse, FunnelTargetMutationResponse, FunnelTargetsResponse, InboxAction, InboxMutationResponse, InboxResponse, InboxStatus, Message, MissionControlMe, ModelRoutingSelection, MemoryContextResponse, OperatorLinkPreviewResponse, PluginsHubResponse, ProjectBriefResponse, ProjectChatResponse, ProjectsResponse, ReplyContext, ResearchRunsResponse, ResearchRunCreateRequest, ResearchRunCreateResponse, RouterConfig, RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRegistryResponse, SecondBrainGraphResponse, SecondBrainHealthResponse, SecondBrainIndexResponse, SecondBrainNoteResponse, SecondBrainResponse, SecondBrainSearchResponse, Skill, SkillFileResponse, SkillsHubResponse, SpecKitIntakeResponse, TaskResultResponse, WindowsGatewayConfigResponse, WorkflowLaunchResponse, WorkflowLibraryResponse, WorkspaceRunDetailResponse, WorkspaceRunHistoryResponse } from "../types";

/**
 * HermesClient is the ONLY boundary between the UI and the agent runtime.
 *
 * Swap the implementation to talk to a real Hermes install without touching
 * any component. A real client typically composes three sub-clients:
 *
 *   1. Filesystem  — read/write <HERMES_HOME>/SOUL.md, MEMORY.md, AGENTS.md,
 *                    config.yaml and list the skills/ tree per profile.
 *   2. Gateway     — chat sessions, live status, cron/jobs, swarm/Kanban.
 *                    (Confirm whether the gateway exposes HTTP/WS or CLI-only.)
 *   3. CLI wrapper — `hermes profile create/use --clone`, `hermes skills install`.
 *
 * See server/src/hermesAdapter.ts for a backend scaffold of those calls,
 * and INTEGRATION.md for the full wiring guide.
 */
export interface HermesClient {
  getMe(): Promise<MissionControlMe>;
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  uploadAttachment(agentId: string, file: File): Promise<Attachment>;
  sendMessage(agentId: string, text: string, attachments?: Attachment[], options?: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection }): Promise<Message[]>;
  getModelRouter(): Promise<RouterConfig>;
  getAgentRuntimes(): Promise<AgentRuntimeSwitcher>;
  saveAgentRuntime(agentId: string, input: AgentRuntimeAssignment): Promise<AgentRuntimeSwitcher>;
  stopMessage(agentId: string, requestId?: string): Promise<{ ok: boolean; stopped: string[]; count: number }>;
  createAgent(input: { name: string; squad: string; model: string }): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;
  saveConfigFile(agentId: string, file: ConfigFile): Promise<void>;
  addSkill(agentId: string, skill: Skill): Promise<void>;
  removeSkill(agentId: string, skillId: string): Promise<void>;
  listApprovals(): Promise<Approval[]>;
  resolveApproval(id: string, decision: "approve" | "reject"): Promise<void>;
  listInbox(filters?: { q?: string; status?: InboxStatus | "all" | "" }): Promise<InboxResponse>;
  inboxAction(id: string, action: InboxAction): Promise<InboxMutationResponse>;
  updateInboxItem(id: string, input: Partial<{ title: string; description: string; body: string; risk: string; destination: string }>): Promise<InboxMutationResponse>;
  listAuditSessions(filters?: { q?: string; source?: string; runType?: string; limit?: number }): Promise<AuditSessionListResponse>;
  getAuditSession(id: string): Promise<AuditSessionDetailResponse>;
  listAutomations(filters?: { q?: string; state?: string }): Promise<AutomationsResponse>;
  listFunnelTargets(filters?: { q?: string }): Promise<FunnelTargetsResponse>;
  getFunnelTarget(id: string): Promise<FunnelTargetDetailResponse>;
  createFunnelTarget(input: Record<string, unknown>): Promise<FunnelTargetMutationResponse>;
  funnelTargetAction(id: string, action: "enable" | "pause" | "run_now", payload?: Record<string, unknown>): Promise<FunnelTargetMutationResponse>;
  listBrowserConnectors(): Promise<BrowserConnectorsResponse>;
  createBrowserConnector(input: Record<string, unknown>): Promise<BrowserConnectorMutationResponse>;
  browserConnectorAction(id: string, action: "approve" | "dry_run_probe" | "archive_probe" | "enable", payload?: Record<string, unknown>): Promise<BrowserConnectorMutationResponse>;
  browserConnectorProbe(id: string, payload?: Record<string, unknown>): Promise<BrowserConnectorProbeResponse>;
  automationAction(id: string, action: "pause" | "resume" | "run" | "enable_funnel_routine", payload?: AutomationActionPayload): Promise<AutomationActionResponse>;
  enableAutomationRoutine(id: string, payload: AutomationActionPayload): Promise<AutomationActionResponse>;
  listSkills(filters?: { q?: string; category?: string; source?: string }): Promise<SkillsHubResponse>;
  getCapabilityMatrix(filters?: { agent?: string; agentId?: string; q?: string; type?: string; status?: string; risk?: string; health?: string; assigned?: string }): Promise<CapabilityMatrixResponse>;
  assignCapability(capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }): Promise<CapabilityAssignmentMutationResponse>;
  unassignCapability(capabilityId: string, input: { agentId: string; agent?: Record<string, unknown>; reason?: string }): Promise<CapabilityAssignmentMutationResponse>;
  getSkillFile(id: string): Promise<SkillFileResponse>;
  listPlugins(filters?: { q?: string; category?: string; source?: string; status?: string }): Promise<PluginsHubResponse>;
  listRuntimes(filters?: { q?: string }): Promise<RuntimeRegistryResponse>;
  listRuntimeConnectors(): Promise<RuntimeConnectorResponse>;
  createRuntimeConnectorToken(input: { label: string; allowed_types: string[] }): Promise<RuntimeConnectorTokenResponse>;
  revokeRuntimeConnectorToken(id: string): Promise<{ ok: boolean; id: string; status: string }>;
  getDesktopGateway(): Promise<DesktopGatewayStatus>;
  listBrowserSessions(): Promise<BrowserSessionsResponse>;
  ingestBrowserRuntimeEvent(input: BrowserRuntimeEventIngestRequest): Promise<BrowserRuntimeEventIngestResponse>;
  getBrowserSession(id: string): Promise<BrowserSession | undefined>;
  stopBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string }>;
  takeoverBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string; instruction?: string }>;
  listResearchRuns(): Promise<ResearchRunsResponse>;
  listWorkspaceRuns(filters?: { q?: string }): Promise<WorkspaceRunHistoryResponse>;
  getWorkspaceRun(id: string): Promise<WorkspaceRunDetailResponse>;
  createResearchRun(input: ResearchRunCreateRequest): Promise<ResearchRunCreateResponse>;
  saveWindowsGatewayConfig(input: Partial<{ url: string; token: string; keepToken: boolean; approvedFolders: string[] }>): Promise<WindowsGatewayConfigResponse>;
  getCosts(filters?: { days?: number; model?: string }): Promise<CostsResponse>;
  listProjects(filters?: { q?: string; area?: string }): Promise<ProjectsResponse>;
  getDelegateWorkContext(): Promise<DelegateWorkContextResponse>;
  listWorkflows(filters?: { q?: string; category?: string }): Promise<WorkflowLibraryResponse>;
  launchWorkflow(id: string, input: Partial<{ projectId: string; agentId: string; title: string; request: string; targetUrl: string; expected: string; runMode: string; schedule: string; project: string }>): Promise<WorkflowLaunchResponse>;
  planDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string }): Promise<DelegateWorkMutationResponse>;
  createDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string; title?: string }): Promise<DelegateWorkMutationResponse>;
  listProjectChats(filters?: { q?: string; project?: string }): Promise<ProjectChatResponse>;
  getProjectBrief(projectId: string): Promise<ProjectBriefResponse>;
  createProjectTask(projectId: string, input: Partial<{ title: string; body: string; assignee: string; priority: number; skills: string[] }>): Promise<BoardTaskMutationResponse>;
  getSecondBrain(filters?: { q?: string; section?: string }): Promise<SecondBrainResponse>;
  getSecondBrainIndex(filters?: { q?: string; section?: string }): Promise<SecondBrainIndexResponse>;
  searchSecondBrain(filters?: { q?: string; section?: string; limit?: number }): Promise<SecondBrainSearchResponse>;
  getSecondBrainNote(path: string): Promise<SecondBrainNoteResponse>;
  getSecondBrainGraph(): Promise<SecondBrainGraphResponse>;
  getSecondBrainHealth(): Promise<SecondBrainHealthResponse>;
  getMemoryContext(filters?: { q?: string; scope?: string; category?: string }): Promise<MemoryContextResponse>;
  listBoard(filters?: { q?: string; status?: BoardStatus | ""; assignee?: string; project?: string; board?: string }): Promise<BoardResponse>;
  getTaskResult(id: string): Promise<TaskResultResponse>;
  listAgentHandoffs(filters?: { agent?: string; task_id?: string; status?: string }): Promise<AgentHandoffResponse>;
  createAgentHandoff(input: Partial<{ from_agent: string; to_agent: string; task_id: string; objective: string; context: string; requested_output: string; risk: string; status: string; evidence: Array<Record<string, unknown>> }>): Promise<AgentHandoffMutationResponse>;
  updateAgentHandoff(id: string, input: Partial<{ objective: string; context: string; requested_output: string; risk: string; status: string; evidence: Array<Record<string, unknown>> }>): Promise<AgentHandoffMutationResponse>;
  getOperatorLinkPreview(filters?: { task?: string; approval?: string; agent?: string }): Promise<OperatorLinkPreviewResponse>;
  createSpecKitIntake(input: Partial<{ title: string; intent: string; projectId: string; assignee: string; acceptance: string; assumptions: string; priority: number }>): Promise<SpecKitIntakeResponse>;
  createBoardTask(input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; skills: string[] }>): Promise<BoardTaskMutationResponse>;
  updateBoardTask(id: string, input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; result: string; skills: string[] }>): Promise<BoardTaskMutationResponse>;
  addBoardComment(id: string, body: string): Promise<BoardTaskMutationResponse>;
  deleteBoardTask(id: string): Promise<{ ok: boolean }>;
}
