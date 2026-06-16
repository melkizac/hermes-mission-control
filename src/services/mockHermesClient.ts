import type { Agent, AgentRuntimeAssignment, AgentRuntimeSwitcher, AgentHandoffMutationResponse, AgentHandoffResponse, Approval, Attachment, BrowserConnectorMutationResponse, BrowserConnectorProbeResponse, BrowserConnectorsResponse, BrowserSession, BrowserSessionsResponse, BrowserRuntimeEventIngestRequest, BrowserRuntimeEventIngestResponse, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardTaskMutationResponse, CapabilityAssignmentMutationResponse, CapabilityMatrixResponse, ConfigFile, CostsResponse, DelegateWorkContextResponse, DelegateWorkMutationResponse, DesktopGatewayStatus, FunnelTargetDetailResponse, FunnelTargetMutationResponse, FunnelTargetsResponse, InboxAction, InboxItem, InboxMutationResponse, InboxResponse, Message, MissionControlMe, ModelRoutingSelection, MemoryContextResponse, OperatorLinkPreviewResponse, PluginsHubResponse, ProjectBriefResponse, ProjectChatResponse, ProjectsResponse, ReplyContext, ResearchRunsResponse, CreateResearchRunRequest, CreateResearchRunResponse, RouterConfig, RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRegistryResponse, SecondBrainGraphResponse, SecondBrainHealthResponse, SecondBrainIndexResponse, SecondBrainNoteResponse, SecondBrainResponse, SecondBrainSearchResponse, Skill, SkillsHubResponse, SpecKitIntakeResponse, TaskResultResponse, WindowsGatewayConfigResponse, WorkflowLaunchResponse, WorkflowLibraryResponse, WorkspaceRunDetailResponse, WorkspaceRunHistoryResponse } from "../types";
import type { HermesClient } from "./hermesClient";
import { seedAgents, seedApprovals } from "../data/mockData";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 9);

const colors = ["#0e8f84", "#3b6fe0", "#e8941b", "#7b8494", "#dc4040", "#8b5cf6"];

function mockResearchSourceTask(id = "mock-r2d-sources") {
  const now = "2026-06-08T16:20:00+08:00";
  return {
    id,
    title: "Research-to-deliverable source cockpit fixture",
    body: "Mock project-aware drawer payload with file, URL, video, and audio source states.",
    assignee: "Melkizac",
    status: "queued",
    raw_status: "queued",
    priority: 70,
    priority_label: "high",
    created_by: "mock",
    created_at: now,
    updated_at: now,
    started_at: null,
    completed_at: null,
    workspace_kind: "scratch",
    workspace_path: null,
    branch_name: null,
    tenant: "project:mock-research-to-deliverable",
    result: JSON.stringify({ summary: { current_stage_label: "Sources processing", progress_percent: 42, next_action: "Review source health and reprocess any partial extraction." } }),
    result_details: {
      status: "queued",
      objective: "Generate editable training materials from mixed source types.",
      workflow_type: "research_to_deliverable",
      summary: { current_stage_label: "Sources processing", progress_percent: 42, next_action: "Review source health and reprocess any partial extraction." },
      sources: [
        { id: "src-file-brief", type: "file", title: "SME AI Workforce briefing.pdf", uri: "/uploads/mock/sme-ai-workforce.pdf", processing: { status: "ready", pages: 18 }, citation: { health: "good coverage" }, extractedTextPreview: "The briefing defines AI coworkers, governance controls, and SME adoption patterns.", extractedTextUrl: "/api/mock/sources/src-file-brief/text" },
        { id: "src-url-gov", type: "url", title: "AI governance reference", url: "https://example.com/ai-governance", status: "processing", citationHealth: "pending" },
        { id: "src-video-class", type: "video", title: "Training class recording", uri: "https://video.example/mock-class.mp4", processingStatus: "partial", citation: { health: "partial transcript" }, extracted_text_preview: "Transcript available for the first 24 minutes; speaker labels need cleanup." },
        { id: "src-audio-qna", type: "audio", title: "Customer Q&A audio", uri: "/uploads/mock/customer-qna.m4a", processing: { status: "failed", duration: "31m" }, citation_health: "missing", preview: "Transcription failed: unsupported codec." },
      ],
      outputs: [],
      stages: [
        { id: "intent", label: "Intent understood", status: "done", owner: "Melkizac" },
        { id: "sources", label: "Sources collected", status: "running", owner: "Mission Control" },
        { id: "notes", label: "Research notes", status: "pending", owner: "Content Ops" },
      ],
      settings: { citation_required: true, approval_policy: "internal drafts auto-proceed; external sharing approval-gated" },
      blockers: [], verification: {}, artifacts: [], evidence: [], approval_gates: [], next_actions: ["Reprocess failed audio source", "Confirm URL extraction completes"],
    },
    mission_result: null,
    session_id: null,
    current_run_id: null,
    workflow_template_id: "research_to_deliverable",
    current_step_key: "sources",
    skills: ["agent-mission-control-ui"],
    model_override: null,
    consecutive_failures: 0,
    last_failure_error: "",
    comments: [],
    events: [],
    runs: [],
    children: [],
    parents: [],
  } as any;
}

function mockHmcReleaseTask(id = "mock-hmc-release-evidence") {
  const now = "2026-06-11T17:20:00+08:00";
  const evidence = [
    {
      schema: "hmc.workflow_evidence.v1",
      project_id: "hmc-governed-software-factory",
      tenant: "hmc-governed-software-factory",
      task_id: id,
      phase: "hmc-build",
      status: "passed",
      summary: "Release-lane drawer model implemented with focused build verification.",
      created_at: now,
      created_by: "dev-ops",
      branch: "project/hmc-governed-software-factory",
      commit: "mock-diff",
      workspace_path: "/opt/hermes-mission-control/source",
      artifacts: [{ kind: "diff", path: "src/views/TaskBoard.tsx", title: "Task drawer release lane" }],
      commands: [{ command: "npm run build", status: "passed", summary: "Mock Vite build passed; chunk-size warning only." }],
      checks: [
        { type: "build", status: "passed", summary: "TypeScript and Vite production bundle succeeded." },
        { type: "browser", status: "passed", summary: "Task drawer renders Release lane tab and evidence fields." }
      ],
      approval: { required: true, status: "pending", reason: "Code-changing task awaits review before merge/deploy." },
      docs_impact: "No public docs changed in mock fixture.",
      rollback: "Revert the source diff; no production deploy in mock fixture."
    },
    {
      schema: "hmc.workflow_evidence.v1",
      project_id: "hmc-governed-software-factory",
      tenant: "hmc-governed-software-factory",
      task_id: id,
      phase: "hmc-qa",
      status: "passed",
      summary: "Focused UI smoke confirms the evidence tab model is visible.",
      created_at: "2026-06-11T17:25:00+08:00",
      created_by: "testing-division",
      commands: [{ command: "node scripts/hmc_task_drawer_probe.cjs", status: "passed", summary: "Release lane DOM nodes found; console clean." }],
      checks: [{ type: "browser", status: "passed", summary: "Release lane, fields, raw evidence hierarchy visible in drawer." }],
      health_check: "GET /api/tasks returned 200 in staging smoke.",
      browser_proof: "Release lane tab rendered in Task Board drawer.",
      rollback: "Frontend-only rollback is to restore previous dist backup."
    }
  ];
  return {
    id,
    title: "HMC release lane evidence drawer fixture",
    body: "Sample HMC software-factory card with structured workflow evidence for Build and QA phases.",
    assignee: "dev-ops",
    status: "review",
    raw_status: "review",
    priority: 80,
    priority_label: "critical",
    created_by: "mock",
    created_at: now,
    updated_at: now,
    started_at: null,
    completed_at: null,
    workspace_kind: "dir",
    workspace_path: "/opt/hermes-mission-control/source",
    branch_name: "project/hmc-governed-software-factory",
    tenant: "hmc-governed-software-factory",
    result: "review-required: release lane fixture awaits review",
    result_details: {
      status: "review",
      objective: "Expose release lane and evidence field completeness in the Task Board drawer.",
      workflow_type: "hmc_software_factory",
      guard_policy: {
        mode: "advisory",
        scope: "mock project-task",
        allowed_edit_paths: ["/opt/hermes-mission-control/source/src", "/opt/hermes-mission-control/source/docs", "/opt/hermes-mission-control/app.py"],
        destructive_command_warning_level: "high",
        checkpoint_mode: "git diff + npm run build before review",
        rollback_artifact_path: "docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md#rollback--safety",
        safe_start_required: true,
        advisory_enforcement: true,
        evidence_required: ["allowed edit paths", "checkpoint/build proof", "rollback note"],
      },
      summary: { progress_percent: 62, next_action: "Review the build evidence, then move to QA/Ship when approved." },
      workflow_evidence: evidence,
      approval_gates: [{ id: "mock-review", title: "Code review", risk: "approval-required", status: "pending", reason: "Code-changing task should be reviewed before deploy." }],
      blockers: [], verification: { build: "passed", drawer: "fixture-rendered" }, artifacts: [], evidence: [], next_actions: ["Review implementation", "Run production browser smoke before deploy"],
    },
    mission_result: null,
    session_id: null,
    current_run_id: null,
    workflow_template_id: "hmc_software_factory",
    current_step_key: "hmc-review",
    skills: ["agent-mission-control-ui", "webapp-operations"],
    model_override: null,
    consecutive_failures: 0,
    last_failure_error: "",
    comments: [{ id: 1, author: "dev-ops", created_at: now, body: `workflow-evidence:\n\n\`\`\`json\n${JSON.stringify(evidence[0], null, 2)}\n\`\`\`` }],
    events: [],
    runs: [],
    children: [],
    parents: [],
  } as any;
}

/**
 * MockHermesClient keeps an in-memory copy of the seed data and mutates it.
 * It simulates latency so the UI's loading/optimistic paths are exercised.
 */
export class MockHermesClient implements HermesClient {
  private agents: Agent[] = clone(seedAgents);
  private approvals: Approval[] = clone(seedApprovals);

  async getMe(): Promise<MissionControlMe> {
    await delay(30);
    return {
      ok: true,
      user: { id: "mock-admin", email: "admin@example.local", name: "Mock Admin", role: "admin", status: "active" },
      workspace: { id: "mock-workspace", name: "Mock Workspace", slug: "mock-workspace" },
    };
  }

  async listAgents() {
    await delay();
    return clone(this.agents);
  }

  async getAgent(id: string) {
    await delay(60);
    return clone(this.agents.find((a) => a.id === id));
  }

  async uploadAttachment(agentId: string, file: File): Promise<Attachment> {
    await delay(80);
    return {
      id: uid(),
      filename: file.name,
      path: `/mock/uploads/${agentId}/${file.name}`,
      mime: file.type || "application/octet-stream",
      sizeBytes: file.size,
      createdAt: "now",
      url: URL.createObjectURL(file),
    };
  }

  async sendMessage(agentId: string, text: string, attachments: Attachment[] = [], options: { signal?: AbortSignal; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection } = {}): Promise<Message[]> {
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await delay(120);
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return [];
    const userMsg: Message = { id: uid(), role: "user", text, attachments, replyTo: options.replyTo, at: "now" };
    const reply: Message = {
      id: uid(),
      role: "agent",
      text: `Got it — queuing that now. (Mock reply: wire HermesClient.sendMessage to the gateway session for ${agent.name}.)`,
      at: "now",
    };
    agent.messages.push(userMsg, reply);
    agent.activity = text.slice(0, 48);
    agent.status = "working";
    return [userMsg, reply];
  }

  async getModelRouter(): Promise<RouterConfig> {
    await delay(40);
    return {
      enabled: true,
      updated_at: "mock",
      policy: { goal: "Mock cost-aware model routing" },
      summary: { total: 3, enabled: 3, authorized: 3, frontier: 1 },
      models: [
        { id: "mock-frontier", label: "Mock Frontier", provider: "mock", model: "gpt-5.5", tier: "frontier", enabled: true, authorized: true, credential_env: "MOCK_API_KEY", cost_weight: 10 },
        { id: "mock-balanced", label: "Mock Balanced", provider: "mock", model: "balanced-worker", tier: "balanced", enabled: true, authorized: true, credential_env: "MOCK_API_KEY", cost_weight: 4 },
        { id: "mock-economy", label: "Mock Economy", provider: "mock", model: "economy-worker", tier: "economy", enabled: true, authorized: true, credential_env: "MOCK_API_KEY", cost_weight: 1 },
      ],
    };
  }

  async getAgentRuntimes(): Promise<AgentRuntimeSwitcher> {
    await delay(40);
    const router = await this.getModelRouter();
    const assignments: AgentRuntimeSwitcher["assignments"] = {};
    for (const agent of this.agents) {
      assignments[agent.id] = { agent_id: agent.id, account_id: "mock-account", model_id: router.models[0]?.id || "mock-frontier", reasoning: "balanced", apply_mode: "next_session", updated_at: "mock", updated_by: "mock" };
    }
    return {
      ok: true,
      updated_at: "mock",
      accounts: [{ id: "mock-account", label: "Mock authorised account", provider: "mock", credential_env: "MOCK_API_KEY", configured: true, secret_status: "configured" }],
      models: router.models,
      agents: this.agents.map((agent) => ({ id: agent.id, name: agent.name, squad: agent.squad, status: agent.status, processingRequests: agent.processingRequests })),
      assignments,
      audit: [],
      summary: { accounts: 1, configured_accounts: 1, agents: this.agents.length, assigned: Object.keys(assignments).length },
    };
  }

  async saveAgentRuntime(agentId: string, input: AgentRuntimeAssignment): Promise<AgentRuntimeSwitcher> {
    await delay(40);
    const data = await this.getAgentRuntimes();
    data.assignments[agentId] = { ...input, agent_id: agentId, updated_at: "now", updated_by: "mock" };
    return data;
  }

  async listWorkflows(): Promise<WorkflowLibraryResponse> {
    await delay(40);
    return { workflows: [], categories: [], summary: { total: 0, approval_required: 0, skills_linked: 0, evidence_ready: 0 } };
  }

  async launchWorkflow(): Promise<WorkflowLaunchResponse> {
    await delay(40);
    return { ok: true };
  }

  async listResearchRuns(): Promise<ResearchRunsResponse> {
    await delay(40);
    return {
      runs: [
        {
          id: "research-parallel-visibility-demo",
          title: "ICP and funnel research sprint",
          status: "running",
          summary: "Mock parallel lanes comparing market, client-site, LinkedIn, and evidence synthesis signals.",
          owner: "Melkizac",
          risk: "medium",
          startedAt: "now",
          updatedAt: "now",
          lanes: [
            { id: "lane-market", agentId: "melkizac", agentName: "Melkizac", title: "Market scan", status: "running", focus: "Competitor and ICP claims", currentStep: "Reviewing source credibility", progress: 62, sourcesReviewed: 7, evidenceCount: 3, confidence: "medium", updatedAt: "now" },
            { id: "lane-linkedin", agentId: "content-ops", agentName: "Content Ops Demo", title: "LinkedIn signal lane", status: "completed", focus: "Operator-led post angles", currentStep: "Evidence packaged", progress: 100, sourcesReviewed: 5, evidenceCount: 2, confidence: "high", updatedAt: "now" },
            { id: "lane-client-sites", agentId: "devops-builder", agentName: "DevOps Builder Demo", title: "Client site checks", status: "blocked", focus: "Lead capture and funnel forms", currentStep: "Waiting for approval before form submit", progress: 38, sourcesReviewed: 3, evidenceCount: 1, confidence: "medium", blocker: "Human approval required before submitting a demo form.", updatedAt: "now" },
          ],
          sourceCoverage: [
            { id: "src-competitors", label: "Competitor websites", kind: "web", status: "reviewed", confidence: "medium", notes: "Claims captured and deduplicated.", ownerLaneId: "lane-market" },
            { id: "src-linkedin", label: "LinkedIn operator posts", kind: "social", status: "reviewed", confidence: "high", notes: "High-signal posts mapped to themes.", ownerLaneId: "lane-linkedin" },
            { id: "src-client-sites", label: "Client lead forms", kind: "browser", status: "blocked", confidence: "medium", notes: "Submit/post/send style actions stay approval-gated.", ownerLaneId: "lane-client-sites" },
            { id: "src-audit", label: "Mission Control audit evidence", kind: "internal", status: "reviewed", confidence: "high", notes: "Evidence trail linked to synthesis.", ownerLaneId: "lane-market" },
          ],
          synthesis: { status: "drafting", progress: 72, leadAgent: "Melkizac", openQuestions: ["Which lead form findings need human approval?"], recommendation: "Prioritize governed browser checks and operator-ready evidence before outreach.", updatedAt: "now" },
          evidence: [{ id: "mock-research-evidence", title: "Research lane evidence bundle", kind: "source", source: "mock-research", createdAt: "now", confidence: "medium" }],
          finalArtifact: { id: "mock-final-synthesis", title: "Final synthesis / recommendation evidence", kind: "report", summary: "Final recommendation package will attach citations, screenshots, and link evidence.", createdAt: "now" },
          nextActions: ["Approve blocked browser form check.", "Review synthesis recommendation.", "Open supporting evidence before publishing findings."],
        },
      ],
      summary: { total: 1, active_lanes: 2, blocked_lanes: 1, source_coverage: 4, evidence_items: 1, synthesis_ready: 0 },
      updatedAt: "now",
    };
  }

  async listWorkspaceRuns(): Promise<WorkspaceRunHistoryResponse> {
    await delay(30);
    const run: WorkspaceRunHistoryResponse["runs"][number] = {
      id: "mock-workflow-run-contextual-evidence",
      routine_id: "mock-research-routine",
      routine_name: "Mock governed research routine",
      workspace_id: "mock-workspace",
      owner_user_id: "mock-admin",
      runtime_id: "vps",
      agent_id: "melkizac",
      agent_class: "workspace",
      scope: "workspace",
      status: "completed",
      reason: "Mock contextual run evidence",
      approval_request_id: null,
      browser_evidence: { sessions: [this.mockBrowserSession()] },
      research_run: { id: "research-parallel-visibility-demo", title: "ICP and funnel research sprint" },
      metadata: {},
      artifacts: [{ id: "mock-governed-report", kind: "report", title: "Governed evidence report", summary: "Mock report attached to the governed run detail.", createdAt: "now" }],
      started_at: "now",
      completed_at: "now",
      run_detail_url: "/app?view=audit&run=mock-workflow-run-contextual-evidence",
      contextual_access: {
        surfaces: ["audit", "approval", "costs", "quota", "workspace-runtime-console"],
        audit_url: "/app?view=audit&run=mock-workflow-run-contextual-evidence",
        approval_request_id: null,
        has_browser_evidence: true,
        has_research_run: true,
        artifact_count: 1,
        note: "Browser evidence and research details are contextual run evidence, not standalone Admin menu items.",
      },
    };
    return { ok: true, runs: [run], summary: { total: 1, browser_evidence: 1, research_runs: 1, artifacts: 1 }, contextual_access: { surfaces: run.contextual_access.surfaces } };
  }

  async getWorkspaceRun(id: string): Promise<WorkspaceRunDetailResponse> {
    const history = await this.listWorkspaceRuns();
    const run = history.runs.find((item) => item.id === id) ?? history.runs[0];
    return { ok: true, run, contextual_access: run.contextual_access };
  }

  async createResearchRun(input: CreateResearchRunRequest): Promise<CreateResearchRunResponse> {
    await delay(40);
    const now = "now";
    const lanes = input.lanes.map((lane, index) => ({
      id: lane.id || `mock-lane-${index + 1}`,
      agentId: lane.agentId || "melkizac",
      agentName: lane.agentName || lane.agentId || "Melkizac",
      title: lane.title,
      status: lane.requiresApproval ? "blocked" : "queued",
      focus: lane.focus || "Research lane created from Mission Control.",
      currentStep: "Tracked task created and waiting for lane execution.",
      progress: 0,
      sourcesReviewed: 0,
      evidenceCount: 1,
      confidence: "medium",
      blocker: lane.requiresApproval ? "Approval required before browser submit/post/send/purchase action." : null,
      taskId: `mock-research-task-${index + 1}`,
      requiresApproval: Boolean(lane.requiresApproval),
      updatedAt: now,
    }));
    return {
      ok: true,
      task: { id: "mock-research-parent", title: input.title, body: input.objective, status: "running", assignee: "Melkizac", priority: 45, tenant: input.projectId || "research-runs", comments: [], children: lanes.map((l) => l.taskId || ""), created_by: "research-runs", result_details: {} } as any,
      trackedTaskIds: ["mock-research-parent", ...lanes.map((l) => l.taskId || "")],
      taskUrl: "/app?view=board&task=mock-research-parent",
      run: {
        id: "mock-created-research-run",
        taskId: "mock-research-parent",
        taskUrl: "/app?view=board&task=mock-research-parent",
        trackedTaskIds: ["mock-research-parent", ...lanes.map((l) => l.taskId || "")],
        title: input.title,
        status: "running",
        summary: input.objective,
        owner: "Melkizac",
        risk: lanes.some((l) => l.requiresApproval) ? "approval-required" : "safe",
        startedAt: now,
        updatedAt: now,
        lanes,
        sourceCoverage: input.sources.map((source, index) => ({ id: source.id || `mock-source-${index + 1}`, label: source.label, kind: source.kind || "web", status: "queued", ownerLaneId: source.ownerLaneId || lanes[index % Math.max(1, lanes.length)]?.id, confidence: "medium", notes: source.notes || "Queued for source coverage." })),
        synthesis: { status: "drafting", progress: 5, leadAgent: "Melkizac", openQuestions: ["Which lane has enough evidence for synthesis?"], recommendation: "Collect lane evidence before external action.", updatedAt: now },
        evidence: [{ id: "mock-created-source-plan", kind: "source", title: "Source coverage plan", source: "mock-research-runs", createdAt: now, confidence: "medium" }],
        finalArtifact: { id: "mock-created-final", kind: "report", title: "Final synthesis / recommendation evidence", summary: "Final synthesis will roll up lane evidence.", createdAt: now },
        nextActions: ["Monitor lane tasks on the Task Board", "Review source coverage gaps", "Complete synthesis"],
      },
    };
  }

  async stopMessage() {
    await delay(20);
    return { ok: true, stopped: [], count: 0 };
  }

  private mockBrowserSession(): BrowserSession {
    return {
      id: "mock-browser-session",
      source: "simulated",
      title: "Mock browser checkout review",
      status: "simulated",
      agentId: "melkizac",
      agentName: "Melkizac",
      runtimeId: "vps",
      runtimeLabel: "Run on VPS",
      executionTarget: { id: "vps", label: "Run on VPS", description: "Mock server browser runtime.", ready: true, url: "mock://browser", executionBoundary: "Mock browser runtime only.", approvalRequired: false },
      currentUrl: "https://example.com/review",
      currentDomain: "example.com",
      accountSensitive: true,
      approvalRequired: true,
      approvalReason: "Form submission / account-sensitive page requires operator approval.",
      screenshot: { id: "mock-browser-shot", kind: "screenshot", title: "Latest screenshot", summary: "Mock screenshot evidence.", url: "mock://screenshot", createdAt: "now" },
      evidence: [
        { id: "mock-browser-evidence", kind: "screenshot", title: "Latest screenshot captured", source: "mock-browser", createdAt: "now", confidence: "medium" },
        { id: "mock-browser-final", kind: "screenshot", title: "Final screenshot/link evidence", summary: "Mock final screenshot and link evidence slot.", source: "mock-browser", createdAt: "now", confidence: "medium" },
      ],
      actionLog: [
        { id: "a1", ts: "now", title: "Opened domain", summary: "Navigated to example.com for browser visibility demo.", type: "navigation", risk: "safe", approvalRequired: false },
        { id: "a2", ts: "now", title: "Detected submit action", summary: "Submit/send/purchase-style actions would be gated before execution.", type: "approval", risk: "account-sensitive", approvalRequired: true },
      ],
      startedAt: "now",
      updatedAt: "now",
      stopAvailable: true,
      takeoverAvailable: true,
      notes: ["Windows-local execution is blocked until WINDOWS_HERMES_GATEWAY_URL is configured."],
    };
  }

  async listBrowserSessions(): Promise<BrowserSessionsResponse> {
    await delay(40);
    const session = this.mockBrowserSession();
    return { sessions: [session], summary: { total: 1, active: 0, approvalRequired: 1, accountSensitive: 1, screenshots: 1, liveRuntimeEvents: 0, windowsReady: false, needsAttention: ["Windows-local execution is blocked until WINDOWS_HERMES_GATEWAY_URL is configured."] }, updatedAt: "now" };
  }

  async ingestBrowserRuntimeEvent(input: BrowserRuntimeEventIngestRequest): Promise<BrowserRuntimeEventIngestResponse> {
    await delay(20);
    return { ok: true, session: { ...this.mockBrowserSession(), id: input.sessionId, source: "runtime-event-bridge", title: input.title ?? "Mock runtime event session", status: input.status ?? "active", currentUrl: input.currentUrl ?? "https://example.com", currentDomain: input.currentDomain ?? "example.com" } };
  }

  async getBrowserSession(id: string): Promise<BrowserSession | undefined> {
    await delay(30);
    const session = this.mockBrowserSession();
    return id === session.id ? session : undefined;
  }

  async stopBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string }> {
    await delay(20);
    return { ok: true, id, status: "stopped" };
  }

  async takeoverBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string; instruction?: string }> {
    await delay(20);
    return { ok: true, id, status: "takeover_ready", instruction: "Mock takeover ready." };
  }

  async createAgent(input: { name: string; squad: string; model: string }) {
    await delay();
    const id = input.name.toLowerCase().replace(/\s+/g, "-") || `agent-${uid()}`;
    const initials = input.name.slice(0, 2).toUpperCase();
    const agent: Agent = {
      id,
      name: input.name,
      squad: input.squad,
      initials,
      color: colors[this.agents.length % colors.length],
      model: input.model,
      status: "idle",
      activity: "Idle · just created",
      lastActive: "now",
      profilePath: `~/.hermes/${id}`,
      uptime: "—",
      sessionCount: 0,
      insightSummary: "New profile. Edit SOUL.md to give it an identity, then add skills.",
      insightStatus: "Idle",
      skills: [],
      files: [
        { name: "SOUL.md", label: "identity · slot 1", kind: "soul", content: `# ${input.name} — SOUL\n\nYou are ${input.name}.\n`, sizeBytes: 40, updatedAt: "now" },
        { name: "MEMORY.md", label: "working knowledge", kind: "memory", content: "# MEMORY\n", sizeBytes: 10, updatedAt: "now" },
        { name: "AGENTS.md", label: "project rules", kind: "agents", content: "# AGENTS.md\n", sizeBytes: 12, updatedAt: "now" },
        { name: "config.yaml", label: "runtime · secrets", kind: "config", content: `model: ${input.model}\n`, sizeBytes: 30, updatedAt: "now" },
      ],
      messages: [],
      artifacts: [],
      tasks: [],
    };
    this.agents.push(agent);
    return clone(agent);
  }

  async deleteAgent(id: string) {
    await delay();
    this.agents = this.agents.filter((a) => a.id !== id);
  }

  async saveConfigFile(agentId: string, file: ConfigFile) {
    await delay();
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return;
    const idx = agent.files.findIndex((f) => f.name === file.name);
    const updated = { ...file, sizeBytes: file.content.length, updatedAt: "just now" };
    if (idx >= 0) agent.files[idx] = updated;
    else agent.files.push(updated);
  }

  async addSkill(agentId: string, skill: Skill) {
    await delay();
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return;
    if (!agent.skills.some((s) => s.name === skill.name)) agent.skills.push(skill);
    if (agent.status === "error") {
      agent.status = "idle";
      agent.activity = "Idle · skill installed";
    }
  }

  async removeSkill(agentId: string, skillId: string) {
    await delay();
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return;
    agent.skills = agent.skills.filter((s) => s.id !== skillId);
  }

  async listApprovals() {
    await delay(60);
    return clone(this.approvals);
  }

  async resolveApproval(id: string) {
    await delay();
    this.approvals = this.approvals.filter((a) => a.id !== id);
  }

  async listInbox(): Promise<InboxResponse> {
    await delay(60);
    const items: InboxItem[] = this.approvals.map((ap) => ({
      id: ap.id,
      title: `${ap.kind} from ${ap.agentName}`,
      description: ap.detail,
      body: ap.detail,
      kind: ap.kind,
      status: "drafted",
      risk: "medium",
      source: "mock",
      source_id: ap.agentId,
      source_path: null,
      destination: "mock destination",
      agent_id: ap.agentId,
      agent_name: ap.agentName,
      created_at: ap.createdAt,
      updated_at: ap.createdAt,
      reviewed_at: null,
      decision_note: null,
      provenance: `mock · ${ap.agentName}`,
      metadata: {},
    }));
    return { items, summary: { drafted: items.length, ready: 0, sent: 0, rejected: 0, total: items.length, high_risk: 0 }, statuses: ["drafted", "ready", "sent", "rejected"], sources: ["mock"] };
  }

  async inboxAction(id: string, action: InboxAction): Promise<InboxMutationResponse> {
    await delay();
    this.approvals = this.approvals.filter((a) => a.id !== id || action === "draft");
    return { ok: true, action };
  }

  async updateInboxItem(): Promise<InboxMutationResponse> {
    await delay();
    return { ok: true };
  }

  async listAuditSessions(): Promise<AuditSessionListResponse> {
    await delay(90);
    const sessions = this.agents.flatMap((agent) => agent.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      source: "mock",
      model: agent.model,
      started_at: task.updatedAt,
      ended_at: task.updatedAt,
      duration_seconds: 0,
      status: task.status,
      end_reason: task.status,
      message_count: agent.messages.length,
      tool_call_count: 0,
      api_call_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: 0,
      estimated_cost_usd: 0,
      actual_cost_usd: null,
      cost_status: "mock",
      cost_source: "mock",
      billing_provider: "mock",
      preview: agent.activity,
    })));
    return { sessions, sources: ["mock"], summary: { total: sessions.length, running: 0, tool_calls: 0, tokens: 0, estimated_cost_usd: 0 } };
  }

  async getAuditSession(id: string): Promise<AuditSessionDetailResponse> {
    const list = await this.listAuditSessions();
    const session = list.sessions.find((s) => s.id === id) ?? list.sessions[0];
    return { session, messages: [] };
  }

  async listAutomations(): Promise<AutomationsResponse> {
    await delay(90);
    return {
      automations: [],
      summary: { total: 0, enabled: 0, paused: 0, error: 0, no_agent: 0 },
      states: ["enabled", "paused", "error", "script"],
    };
  }

  async listFunnelTargets(): Promise<FunnelTargetsResponse> {
    await delay(90);
    return { targets: [{ id: "mock-target", label: "Mock public form", url: "https://httpbingo.org/forms/post", targetUrl: "https://httpbingo.org/forms/post", project: "browser-funnel-checks", expected: "lead capture form", schedule: "0 9 * * 1", noSubmit: true, safeTargetRequired: true, approvalStatus: "approved", approval: { status: "approved", approvedBy: "Mock operator" }, routineId: "website-funnel-check-browser-funnel-checks-mock-target", routineEnabled: false, latestRunStatus: { status: "not-run", lastRunAt: null }, evidenceHistory: [], browserActivityUrl: "/app?view=browser-ops&session=mock-target", taskResultUrl: "/app?view=board&task=mock-task", finalUrl: "https://httpbingo.org/forms/post", connectorReadiness: [{ label: "NO_SUBMIT locked", status: "ready", detail: "External submits disabled." }] }], summary: { total: 1, approved: 1, enabled: 0, needs_review: 0 } };
  }

  async getFunnelTarget(id: string): Promise<FunnelTargetDetailResponse> {
    await delay(90);
    const list = await this.listFunnelTargets();
    return { ok: true, target: { ...list.targets[0], id } };
  }

  async createFunnelTarget(): Promise<FunnelTargetMutationResponse> {
    await delay(90);
    const list = await this.listFunnelTargets();
    return { ok: true, created: true, target: list.targets[0] };
  }

  async funnelTargetAction(id: string, action: "enable" | "pause" | "run_now"): Promise<FunnelTargetMutationResponse> {
    await delay(90);
    const list = await this.listFunnelTargets();
    const target = { ...list.targets[0], id, latestRunStatus: { status: action === "run_now" ? "queued-manual-run" : action, lastRunAt: null } };
    return { ok: true, action, target };
  }

  async listBrowserConnectors(): Promise<BrowserConnectorsResponse> {
    await delay(90);
    const connector = { id: "mock-browserbase", type: "browserbase", label: "Mock Browserbase gate", baseUrl: "mock://browserbase", credentials: { apiKey: "[REDACTED]" }, enabled: false, approvalStatus: "needs-approval", noSubmit: true, safeTargetRequired: true, accountSensitiveAllowed: false, readinessChecklist: [{ label: "No real connector is enabled yet", status: "blocked", detail: "Mock connector gate only." }] };
    return { connectors: [connector], summary: { total: 1, approved: 0, enabled: 0, needs_approval: 1 }, productionPolicy: { enablementStatus: "blocked", noSubmit: true, safeTargetRequired: true, accountSensitiveAllowed: false, blockedActions: "submit/post/send/purchase blocked", accountSensitiveStatus: "account-sensitive blocked", operatorDecisionRequired: true, summary: "Production browser connector actions remain blocked; only safe NO_SUBMIT dry-runs are allowed." }, browserTrackCompletion: { currentPhase: "Phase 25", readyForSupervisedDryRuns: true, readyForAccountSensitive: false, summary: "Ready for supervised dry-runs; not ready for account-sensitive autonomy.", checklist: [{ label: "Evidence drill-through", status: "ready", detail: "Mock evidence link available." }, { label: "Production external actions", status: "blocked", detail: "External actions blocked." }], nextActions: ["Review Browser Activity evidence."] } };
  }

  async createBrowserConnector(): Promise<BrowserConnectorMutationResponse> {
    await delay(90);
    const list = await this.listBrowserConnectors();
    return { ok: true, created: true, connector: list.connectors[0] };
  }

  async browserConnectorAction(id: string, action: "approve" | "dry_run_probe" | "archive_probe" | "enable"): Promise<BrowserConnectorMutationResponse> {
    await delay(90);
    const list = await this.listBrowserConnectors();
    const connector = { ...list.connectors[0], id, action, enabled: false };
    return { ok: true, action, connector, message: "Mock connector action simulated; no real connector is enabled." };
  }

  async browserConnectorProbe(id: string): Promise<BrowserConnectorProbeResponse> {
    await delay(90);
    const list = await this.listBrowserConnectors();
    const sessionId = "mock-phase21-desktop-probe";
    const connector = {
      ...list.connectors[0],
      id,
      type: "desktop-browser",
      enabled: false,
      approvalStatus: "approved",
      dryRun: { status: "passed", noSubmit: true, summary: "Mock NO_SUBMIT probe passed." },
      lastProbe: {
        status: "blocked_before_submit",
        targetUrl: "https://httpbingo.org/forms/post",
        finalUrl: "https://httpbingo.org/forms/post",
        domain: "httpbingo.org",
        screenshotPath: "/uploads/mock/phase21.png",
        formsDetected: 1,
        submitCandidates: 1,
        noSubmit: true,
        browserActivityUrl: `/app?view=browser-ops&session=${sessionId}`,
        summary: "Mock dry-run probe stopped before submit.",
      },
    };
    return { ok: true, dryRun: true, connector, sessionId, browserActivityUrl: connector.lastProbe.browserActivityUrl, screenshotPath: connector.lastProbe.screenshotPath, summary: connector.lastProbe, message: "Mock desktop-browser probe simulated with NO_SUBMIT." };
  }

  async automationAction(id: string, action: "pause" | "resume" | "run" | "enable_funnel_routine"): Promise<AutomationActionResponse> {
    await delay(90);
    return { ok: true, job_id: id, action };
  }

  async enableAutomationRoutine(id: string): Promise<AutomationActionResponse> {
    await delay(90);
    return { ok: true, job_id: id, action: "enable_funnel_routine", job: { id, enabled: false, state: "mock-not-created", metadata: { workflow_template_id: "website-funnel-check", noSubmit: true, safeTargetRequired: true } } };
  }

  async listSkills(): Promise<SkillsHubResponse> {
    await delay(90);
    const skills = this.agents.flatMap((agent) => agent.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category || "mock",
      description: `Mock skill assigned to ${agent.name}.`,
      source: skill.source || "mock",
      editable: false,
      enabled: true,
      path: `mock://${skill.id}`,
      skill_dir: `mock://${skill.id}`,
      profile: agent.id,
      version: "—",
      author: "mock",
      tags: [],
      related_skills: [],
      updated_at: "now",
      readiness: "available",
      model: agent.model,
      preview: skill.name,
      used_by_agents: [agent.name],
      used_by_automations: [],
      used_by_tasks: [],
      used_by_count: 1,
    })));
    return { skills, summary: { total: skills.length, editable: 0, plugin: 0, user: skills.length, assigned: skills.length }, categories: ["mock"], sources: ["mock"] };
  }

  async getCapabilityMatrix(filters?: { agent?: string; agentId?: string }): Promise<CapabilityMatrixResponse> {
    await delay(80);
    const requestedAgent = filters?.agent || filters?.agentId;
    const agents = this.agents.filter((agent) => !requestedAgent || agent.id === requestedAgent);
    const matrix = agents.map((agent) => {
      const runtimeCapabilities = [
        ...agent.skills.map((skill) => ({ id: `skill:${skill.id}`, type: "skill", displayName: skill.name, source: skill.source || "profile-skill", sourceLabel: "Profile skill", status: "enabled", enabled: true, assigned: true, inherited: true, assignmentScope: "inherited", assignmentUnit: "procedure", riskLevels: ["read-only"], approvalRequired: false, approvalStatus: "not-required", healthState: "passing" })),
        ...(agent.tools ?? []).map((tool) => ({ id: `tool:${tool.id}`, type: tool.kind || "cli-tool", displayName: tool.name, description: tool.description, source: "profile-config", sourceLabel: "Profile tools", status: tool.enabled === false ? "disabled" : "enabled", enabled: tool.enabled !== false, assigned: true, inherited: true, assignmentScope: "inherited", assignmentUnit: tool.assignmentUnit || "tool", toolCount: tool.toolCount, sampleTools: tool.sampleTools, riskLevels: ["local-write"], approvalRequired: false, approvalStatus: "not-required", healthState: "passing" })),
      ];
      const registryCapabilities = [
        { id: "mock-browser-automation", type: "mcp-server", displayName: "Browser automation", description: "Governed browser operations with approval gates for submit/post/send actions.", source: "registry", sourceLabel: "Registry", status: "available", enabled: true, assigned: false, inherited: false, assignmentScope: "available", assignmentUnit: "mcp-server", riskLevels: ["browser", "external-action"], approvalRequired: true, approvalStatus: "pending", actionableBlocker: { message: "Approval policy must be approved before assignment." }, healthState: "unknown" },
        { id: "mock-github-cli", type: "cli-tool", displayName: "GitHub CLI wrapper", description: "Workspace-safe GitHub operations wrapper.", source: "registry", sourceLabel: "Registry", status: "assigned", enabled: true, assigned: true, inherited: false, assignmentScope: "assigned", assignmentUnit: "cli-wrapper", riskLevels: ["repo-write"], approvalRequired: false, approvalStatus: "not-required", healthState: "passing" },
      ];
      const capabilities = [...runtimeCapabilities, ...registryCapabilities];
      const assigned = capabilities.filter((capability) => capability.assigned);
      const inherited = capabilities.filter((capability) => capability.inherited || capability.assignmentScope === "inherited");
      const blocked = capabilities.filter((capability) => Boolean((capability as { actionableBlocker?: unknown }).actionableBlocker) || (capability.approvalRequired && capability.approvalStatus !== "approved"));
      const available = capabilities.filter((capability) => !capability.assigned);
      return {
        agent: { id: agent.id, name: agent.name, squad: agent.squad, status: agent.status, profileId: agent.profile_details?.profile_id || agent.id, profilePath: agent.profilePath },
        capabilities,
        assigned,
        available,
        blocked,
        summary: { total: capabilities.length, assigned: assigned.length, inherited: inherited.length, available: available.length, blocked: blocked.length, skills: agent.skills.length, tools: agent.tools?.length ?? 0, registry: registryCapabilities.length },
      };
    });
    return { ok: true, matrix, agents: matrix.map((row) => row.agent), summary: { agents: matrix.length, capabilities: matrix.reduce((sum, row) => sum + row.summary.total, 0), assigned: matrix.reduce((sum, row) => sum + row.summary.assigned, 0), inherited: matrix.reduce((sum, row) => sum + (row.summary.inherited ?? 0), 0), blocked: matrix.reduce((sum, row) => sum + row.summary.blocked, 0), registry: matrix.reduce((sum, row) => sum + row.summary.registry, 0), skills: matrix.reduce((sum, row) => sum + row.summary.skills, 0), tools: matrix.reduce((sum, row) => sum + row.summary.tools, 0) } };
  }

  async assignCapability(capabilityId: string): Promise<CapabilityAssignmentMutationResponse> {
    await delay(80);
    if (capabilityId === "mock-browser-automation") return { ok: false, status: "blocked", error: "Approval policy must be approved before assignment." };
    return { ok: true, action: "assign" };
  }

  async unassignCapability(): Promise<CapabilityAssignmentMutationResponse> {
    await delay(80);
    return { ok: true, action: "unassign" };
  }

  async getSkillFile(id: string) {
    await delay(90);
    return {
      id,
      name: id,
      path: `mock://${id}/SKILL.md`,
      skill_dir: `mock://${id}`,
      content: `---\nname: ${id}\ndescription: Mock skill file\n---\n\n# ${id}\n\nThis is the full mock SKILL.md content.`,
      size: 96,
      updated_at: "now",
    };
  }

  async listPlugins(): Promise<PluginsHubResponse> {
    await delay(90);
    const plugins = [
      { id: "web/ddgs", name: "web/ddgs", category: "web", status: "not enabled", enabled: false, version: "1.0.0", description: "DuckDuckGo web search via the ddgs Python package — no API key required.", source: "bundled" },
      { id: "platforms/telegram", name: "platforms/telegram", category: "platforms", status: "enabled", enabled: true, version: "1.0.0", description: "Telegram gateway adapter for Hermes Agent.", source: "bundled" },
      { id: "spotify", name: "spotify", category: "general", status: "not enabled", enabled: false, version: "1.0.0", description: "Native Spotify integration using Spotify Web API + PKCE OAuth.", source: "bundled" },
    ];
    return {
      plugins,
      summary: { total: plugins.length, enabled: 1, disabled: 2, bundled: plugins.length, user: 0, categories: 3 },
      categories: ["general", "platforms", "web"],
      sources: ["bundled"],
      statuses: ["enabled", "not enabled"],
    };
  }

  async listRuntimes(): Promise<RuntimeRegistryResponse> {
    await delay(90);
    const now = "now";
    const runtimes = [
      { id: "hermes", name: "Hermes / Mock", type: "primary_runtime", status: "online", summary: "Mock primary Hermes runtime.", readiness: { representable: true, monitorable: true, controllable: true }, evidence: { mode: "mock", sessions: this.agents.length }, safe_actions: ["route_task_with_approval"], updated_at: now },
      { id: "openclaw", name: "OpenClaw", type: "external_runtime", status: "degraded", summary: "Mock external Claw runtime slot.", readiness: { representable: true, monitorable: true, controllable: false }, evidence: { mode: "mock" }, safe_actions: ["register_runtime"], updated_at: now },
      { id: "codex", name: "Codex CLI / Codex App Projects", type: "coding_cli_runtime", status: "degraded", summary: "Mock Codex adapter readiness.", readiness: { representable: true, monitorable: true, controllable: false }, evidence: { command: "codex", auth_present: true }, safe_actions: ["route_task_with_approval"], updated_at: now },
      { id: "claude-code", name: "Claude Code / Claude Suite Projects", type: "coding_cli_runtime", status: "degraded", summary: "Mock Claude Code adapter readiness.", readiness: { representable: true, monitorable: true, controllable: false }, evidence: { command: "claude", auth_present: true }, safe_actions: ["route_task_with_approval"], updated_at: now },
      { id: "nanoclaw", name: "NanoClaw", type: "future_claw_runtime", status: "offline", summary: "Mock future runtime slot.", readiness: { representable: true, monitorable: false, controllable: false }, evidence: { mode: "mock" }, safe_actions: ["register_runtime"], updated_at: now },
      { id: "nemoclaw", name: "NemoClaw", type: "future_claw_runtime", status: "offline", summary: "Mock future runtime slot.", readiness: { representable: true, monitorable: false, controllable: false }, evidence: { mode: "mock" }, safe_actions: ["register_runtime"], updated_at: now },
    ];
    return { runtimes, summary: { total: runtimes.length, online: 1, degraded: 3, offline: 2, monitorable: 4, controllable: 1 }, updated_at: now };
  }

  async listRuntimeConnectors(): Promise<RuntimeConnectorResponse> {
    await delay(90);
    return {
      tokens: [{ id: "mock-token", label: "Mock friend connector", allowed_types: ["openclaw", "nanoclaw", "nemoclaw"], status: "active", created_at: "now" }],
      runtimes: [],
      events: [],
      connect: { register_url: "https://example.test/api/runtime-connect/register", heartbeat_url: "https://example.test/api/runtime-connect/heartbeat", events_url: "https://example.test/api/runtime-connect/events" },
      summary: { tokens: 1, active_tokens: 1, connected: 0, online: 0 },
    };
  }

  async createRuntimeConnectorToken(input: { label: string; allowed_types: string[] }): Promise<RuntimeConnectorTokenResponse> {
    await delay(90);
    return { ok: true, token: { id: "mock-token-new", label: input.label, allowed_types: input.allowed_types, status: "active", created_at: "now" }, secret: "hmc_rt_mock_secret", connect: { register_url: "https://example.test/api/runtime-connect/register", heartbeat_url: "https://example.test/api/runtime-connect/heartbeat", events_url: "https://example.test/api/runtime-connect/events" }, warning: "Mock token." };
  }

  async revokeRuntimeConnectorToken(id: string): Promise<{ ok: boolean; id: string; status: string }> {
    await delay(90);
    return { ok: true, id, status: "revoked" };
  }

  async getDesktopGateway(): Promise<DesktopGatewayStatus> {
    await delay(90);
    return {
      mode: "remote_gateway",
      name: "Mock Hermes Desktop Remote Gateway",
      remoteUrl: "https://example.test/desktop-gateway",
      sessionTokenPreview: "…mocked",
      tokenSet: true,
      localPort: 9119,
      service: { name: "hermes-desktop-gateway.service", active: "inactive" },
      local: { ok: false, http_code: null, error: "mock dashboard not running" },
      windows: {
        mode: "windows_local_gateway",
        name: "Windows Desktop Local Gateway",
        configured: false,
        url: "",
        tokenPreview: null,
        tokenSet: false,
        approvedFolders: ["C:/MelverickAgentWorkspace"],
        health: { ok: false, http_code: null, error: "not configured" },
        recommendedFolders: ["C:/MelverickAgentWorkspace", "C:/Users/Melverick/Documents"],
        setup: { localCommand: "hermes dashboard --no-open --tui --host 127.0.0.1 --port 9119", tunnelExamples: ["Tailscale: use http://windows-tailnet:9119"] },
      },
      targets: [
        { id: "vps", label: "Run on VPS", description: "Execute on the Mission Control server.", ready: false, url: "https://example.test/desktop-gateway", executionBoundary: "Server/VPS runtime — not the Windows filesystem.", approvalRequired: false },
        { id: "windows", label: "Run on Windows Desktop", description: "Execute through a Windows-local Hermes gateway.", ready: false, url: "", executionBoundary: "Windows-local runtime only after a reachable gateway is configured.", approvalRequired: true },
        { id: "synced", label: "Use synced workspace only", description: "Use shared folders instead of full desktop access.", ready: true, url: "", executionBoundary: "Files already synced to approved workspace folders.", approvalRequired: false },
      ],
      desktopSteps: ["Open Hermes Desktop on Windows.", "Choose Remote gateway or configure a Windows-local gateway."],
      notes: ["VPS mode controls the server, not the Windows filesystem."],
      readinessSummary: { remoteReady: false, windowsReady: false, configuredTargets: 1, readyTargets: 1, needsAttention: ["Start the remote desktop gateway service", "Configure WINDOWS_HERMES_GATEWAY_URL for Windows-local execution"] },
    };
  }

  async saveWindowsGatewayConfig(input: Partial<{ url: string; token: string; keepToken: boolean; approvedFolders: string[] }>): Promise<WindowsGatewayConfigResponse> {
    await delay(90);
    const status = await this.getDesktopGateway();
    return { ok: true, windows: { ...status.windows, configured: Boolean(input.url), url: input.url || "", approvedFolders: input.approvedFolders || status.windows.approvedFolders } };
  }

  async getCosts(filters?: { days?: number; model?: string }): Promise<CostsResponse> {
    await delay(90);
    const period = { sessions: 0, cost: 0, tokens: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, tool_calls: 0, api_calls: 0 };
    const selectedModel = filters?.model || "gpt-5.5";
    return {
      window_days: filters?.days ?? 30,
      summary: { last_24h: period, last_7d: period, last_30d: period, selected: period, all_time: period },
      by_model: [],
      by_source: [],
      daily: [],
      expensive_sessions: [],
      model_usage: {
        selected_model: selectedModel,
        models: ["gpt-5.5", "claude-sonnet-4", "gpt-4.1-mini"],
        source: "Demo model duration telemetry",
        daily: { label: "5h", used_seconds: 0, limit_seconds: 18000, used_hours: 0, limit_hours: 5, remaining_seconds: 18000, remaining_hours: 5, percent_used: 0, reset_at: "", reset_label: "9:19 AM" },
        weekly: { label: "Weekly", used_seconds: 0, limit_seconds: 126000, used_hours: 0, limit_hours: 35, remaining_seconds: 126000, remaining_hours: 35, percent_used: 0, reset_at: "", reset_label: "Jun 11" },
      },
    };
  }

  async listProjects(): Promise<ProjectsResponse> {
    await delay(90);
    return { projects: [], summary: { total: 0, active: 0, open_actions: 0, blocked: 0, knowledge: 0, workspaces: 0 }, kinds: [], sources: [] };
  }

  async getDelegateWorkContext(): Promise<DelegateWorkContextResponse> {
    await delay(90);
    return {
      projects: [],
      agents: this.agents.map((agent) => ({ id: agent.id, name: agent.name, status: agent.status })),
      masterInstructions: [],
      defaultProjectId: null,
      riskLevels: ["safe", "approval-required", "external-facing", "destructive", "account-sensitive"],
    };
  }

  async planDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string }): Promise<DelegateWorkMutationResponse> {
    await delay(90);
    const agent = this.agents.find((item) => item.id === input.agentId) || this.agents[0];
    return {
      ok: true,
      plan: {
        id: `mock-delegate-${uid()}`,
        title: input.request.slice(0, 80) || "Mock delegated work",
        userRequest: input.request,
        projectId: input.projectId || "mock-project",
        projectName: "Mock Project",
        agentId: agent?.id || "mock-agent",
        agentName: agent?.name || "Mock Agent",
        workItem: { id: "mock-intake", kind: "intake", title: input.request.slice(0, 80) || "Mock delegated work", status: "planned" },
        risk: (input.risk as any) || "safe",
        riskLabel: input.risk || "safe",
        approvalRequired: Boolean(input.risk && input.risk !== "safe"),
        routingReason: "Mock routing through Project master instructions.",
        masterInstructions: { projectId: input.projectId || "mock-project", projectName: "Mock Project", objective: "Mock objective", masterInstructions: "Project master instructions\nUse evidence-backed work items.", workspacePath: null, linkedSkills: [], linkedAgents: [], riskDefaults: ["safe"], updatedAt: "now" },
        promptPreview: `Project master instructions\n\n${input.request}`,
        taskBody: `Delegated from Mission Control Delegate Work front door.\n\n${input.request}`,
        nextActions: ["Create delegated task"],
        evidence: [],
      },
    };
  }

  async createDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string; title?: string }): Promise<DelegateWorkMutationResponse> {
    await delay(90);
    const planned = await this.planDelegateWork(input);
    return { ...planned, task: { id: `mock-task-${uid()}`, title: input.title || planned.plan?.title || "Mock delegated task" } };
  }

  async listProjectChats(): Promise<ProjectChatResponse> {
    await delay(90);
    const sessions = this.agents.flatMap((agent) => agent.messages.slice(0, 1).map((message) => ({
      id: `mock-${agent.id}-${message.id}`,
      title: `${agent.name} mock chat`,
      project_id: "mock-project",
      project_name: "Mock Project",
      source: "mock",
      model: agent.model,
      started_at: message.at,
      messages: agent.messages.length,
      tools: 0,
      tokens: 0,
    })));
    return { projects: [{ id: "mock-project", name: "Mock Project", sessions: sessions.length }], sessions, summary: { projects: 1, sessions: sessions.length } };
  }

  async getProjectBrief(): Promise<ProjectBriefResponse> {
    await delay(90);
    return { ok: false, error: "Mock projects are read-only" };
  }

  async createProjectTask(): Promise<BoardTaskMutationResponse> {
    await delay(90);
    return { ok: false, error: "Mock projects are read-only" };
  }

  async getSecondBrain(): Promise<SecondBrainResponse> {
    await delay(90);
    return {
      root: "mock://second-brain",
      wiki_path: "mock://second-brain/wiki",
      raw_path: "mock://second-brain/raw",
      schema_path: "mock://second-brain/schema/WORKFLOW.md",
      summary: { title: "Mock Second Brain", description: "Mock Karpathy-style LLM Wiki cockpit.", wiki_pages: 0, raw_sources: 0, sections: 0, log_entries: 0, last_updated: "now", health: "healthy" },
      sections: [],
      wiki: [],
      raw_sources: [],
      schema: { path: "mock://schema", updated_at: "now", preview: "# Workflow" },
      index: { path: "mock://index", updated_at: "now", preview: "# Index" },
      log: { path: "mock://log", updated_at: "now", preview: "# Log", entries: [] },
      command_center: null,
      health: { status: "healthy", checks: [] },
    };
  }

  async getSecondBrainIndex(): Promise<SecondBrainIndexResponse> {
    await delay(60);
    const item = { id: "mock-sgqr", title: "SGQR PayNow Web Integration", summary: "Mock topic with source evidence.", path: "mock://wiki/topics/sgqr.md", relative_path: "topics/sgqr.md", section: "topics", layer: "wiki", updated_at: "now", size: 1200, links: ["Mock Source"], preview: "# SGQR PayNow Web Integration", immutable: false };
    return { root: "mock://second-brain", summary: { wiki_pages: 1, raw_sources: 1, sections: 1, links: 1, chunks: 1, last_indexed: "now", semantic_status: "chunked-not-embedded" }, sections: ["topics"], wiki: [item], raw_sources: [], graph: { nodes: 1, edges: 1 }, chunks: [{ id: "mock-chunk", note_id: "wiki/topics/sgqr.md", text: "Mock semantic chunk", embedding_status: "not-indexed", section: "topics" }], policy: { mode: "read-only", path_safety: "mock", redaction: "mock" } };
  }

  async searchSecondBrain(): Promise<SecondBrainSearchResponse> {
    await delay(40);
    return { query: "", results: [], summary: { total: 0, returned: 0 }, policy: { mode: "read-only" } };
  }

  async getSecondBrainNote(path: string): Promise<SecondBrainNoteResponse> {
    await delay(40);
    const item = { id: "mock-sgqr", title: "SGQR PayNow Web Integration", summary: "Mock topic with source evidence.", path: "mock://wiki/topics/sgqr.md", relative_path: path, section: "topics", layer: "wiki", updated_at: "now", size: 1200, links: ["Mock Source"], preview: "# SGQR", immutable: false };
    return { note: { ...item, content: "# SGQR\n\nMock rendered markdown source.", backlinks: [], evidence: [], health: { redacted: false, backlinks: 0, outbound_links: 1 } }, context_actions: [{ id: "attach-to-chat", label: "Attach to chat context", status: "planned" }], policy: { mode: "read-only" } };
  }

  async getSecondBrainGraph(): Promise<SecondBrainGraphResponse> {
    await delay(40);
    return { nodes: [], edges: [], summary: { nodes: 0, edges: 0 }, policy: { mode: "read-only" } };
  }

  async getSecondBrainHealth(): Promise<SecondBrainHealthResponse> {
    await delay(40);
    return { health: { status: "healthy", checks: [] }, knowledge_health: { orphan_review: "0 candidates", stale_notes: "mock", conflicts: "mock" }, write_workflows: { status: "planned-read-only", actions: [] }, semantic_search: { status: "mock", chunks: 0 } };
  }

  async getMemoryContext(): Promise<MemoryContextResponse> {
    await delay(60);
    const entries = [
      { id: "mock-user-voice", scope: "user" as const, scope_label: "User profile", category: "identity-preferences", title: "User communication preference", text: "User prefers practical, direct, operator-led responses with clear evidence and blockers.", raw: "User prefers practical, direct, operator-led responses with clear evidence and blockers.", source_path: "mock://memory/USER.md", source_label: "User profile · USER.md", line_start: 1, updated_at: "now", redacted: false, tags: ["Hermes"] },
      { id: "mock-operational", scope: "memory" as const, scope_label: "Operational memory", category: "projects-environment", title: "Mission Control source", text: "Mission Control source and deployment locations are tracked as operational context.", raw: "Mission Control source and deployment locations are tracked as operational context.", source_path: "mock://memory/MEMORY.md", source_label: "Operational memory · MEMORY.md", line_start: 3, updated_at: "now", redacted: false, tags: ["Mission Control"] },
    ];
    return { entries, summary: { total: entries.length, user: 1, memory: 1, redacted: 0, categories: 2 }, categories: ["identity-preferences", "projects-environment"], category_counts: [{ category: "identity-preferences", count: 1 }, { category: "projects-environment", count: 1 }], sources: ["User profile · USER.md", "Operational memory · MEMORY.md"], policy: { summary: "Mock memory is read-only and redacted before display.", recommended_controls: ["Request correction", "Request deletion", "View source evidence", "Audit future edits"] } };
  }

  async listBoard(): Promise<BoardResponse> {
    await delay(90);
    const task = mockResearchSourceTask();
    const hmcTask = mockHmcReleaseTask();
    [task, hmcTask].forEach((item) => {
      item.board_id = "default";
      item.board_slug = "default";
      item.board_label = "Default board";
      item.board_is_default = true;
    });
    return { tasks: [task, hmcTask], lanes: { triage: [], todo: [task], scheduled: [], ready: [], running: [], blocked: [], error: [], review: [hmcTask], done: [] }, summary: { total: 2, triage: 0, todo: 1, scheduled: 0, ready: 0, running: 0, blocked: 0, error: 0, review: 1, done: 0, assignees: ["Melkizac", "dev-ops"], projects: ["project:mock-research-to-deliverable", "hmc-governed-software-factory"], boards: ["default"] }, statuses: ["triage", "todo", "scheduled", "ready", "running", "blocked", "error", "review", "done"], projects: ["project:mock-research-to-deliverable", "hmc-governed-software-factory"], boards: [{ id: "default", slug: "default", label: "Default board", is_default: true }], warnings: [] };
  }

  async getTaskResult(id: string): Promise<TaskResultResponse> {
    await delay(90);
    const task = id.includes("hmc") ? mockHmcReleaseTask(id) : mockResearchSourceTask(id);
    return { ok: true, mission_result: null, task };
  }

  async listAgentHandoffs(): Promise<AgentHandoffResponse> {
    await delay(40);
    return { ok: true, handoffs: [], summary: { total: 0, open: 0, completed: 0, blocked: 0, high_risk: 0 }, statuses: ["requested", "accepted", "in_progress", "blocked", "completed", "failed", "cancelled"] };
  }

  async createAgentHandoff(): Promise<AgentHandoffMutationResponse> {
    await delay(40);
    return { ok: false, error: "Mock handoff ledger is read-only" };
  }

  async updateAgentHandoff(): Promise<AgentHandoffMutationResponse> {
    await delay(40);
    return { ok: false, error: "Mock handoff ledger is read-only" };
  }

  async getOperatorLinkPreview(): Promise<OperatorLinkPreviewResponse> {
    await delay(30);
    return {
      ok: true,
      examples: [{
        title: "Mock approval",
        risk: "medium",
        agent: "Mock Agent",
        action: "Review, edit if needed, then Approve or Reject.",
        open: `${window.location.origin}/app?view=approvals&approval=mock-approval`,
        text: `Approval needed: Mock approval\nRisk: medium\nAgent: Mock Agent\nAction: Review, edit if needed, then Approve or Reject.\nOpen: ${window.location.origin}/app?view=approvals&approval=mock-approval`,
      }],
    };
  }

  async createSpecKitIntake(): Promise<SpecKitIntakeResponse> {
    await delay(90);
    return { ok: false, error: "Mock board is read-only" };
  }

  async createBoardTask(): Promise<BoardTaskMutationResponse> {
    await delay(90);
    return { ok: false, error: "Mock board is read-only" };
  }

  async updateBoardTask(): Promise<BoardTaskMutationResponse> {
    await delay(90);
    return { ok: false, error: "Mock board is read-only" };
  }

  async addBoardComment(): Promise<BoardTaskMutationResponse> {
    await delay(90);
    return { ok: false, error: "Mock board is read-only" };
  }

  async deleteBoardTask(): Promise<{ ok: boolean }> {
    await delay(90);
    return { ok: true };
  }
}
