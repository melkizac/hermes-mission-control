import type { Agent, Approval, Attachment, BrowserConnectorMutationResponse, BrowserConnectorProbeResponse, BrowserConnectorsResponse, BrowserSession, BrowserSessionsResponse, BrowserRuntimeEventIngestRequest, BrowserRuntimeEventIngestResponse, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionPayload, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardStatus, BoardTaskMutationResponse, ConfigFile, CostsResponse, DelegateWorkContextResponse, DelegateWorkMutationResponse, DesktopGatewayStatus, FunnelTargetDetailResponse, FunnelTargetMutationResponse, FunnelTargetsResponse, InboxAction, InboxMutationResponse, InboxResponse, InboxStatus, Message, MissionControlMe, ModelRoutingSelection, MemoryContextResponse, OperatorLinkPreviewResponse, PluginsHubResponse, ProjectBriefResponse, ProjectChatResponse, ProjectsResponse, ReplyContext, ResearchRunsResponse, ResearchRunCreateRequest, ResearchRunCreateResponse, RouterConfig, RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRegistryResponse, SecondBrainGraphResponse, SecondBrainHealthResponse, SecondBrainIndexResponse, SecondBrainNoteResponse, SecondBrainResponse, SecondBrainSearchResponse, Skill, SkillFileResponse, SkillsHubResponse, TaskResultResponse, WindowsGatewayConfigResponse, WorkflowLaunchResponse, WorkflowLibraryResponse } from "../types";
import type { HermesClient } from "./hermesClient";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${window.location.protocol}//${window.location.host}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data?.error === "string" ? data.error : res.statusText;
    throw new Error(detail);
  }
  return data as T;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

export class HttpHermesClient implements HermesClient {
  async getMe(): Promise<MissionControlMe> {
    return request<MissionControlMe>("/api/me");
  }

  async listAgents(): Promise<Agent[]> {
    return request<Agent[]>("/api/agents");
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return request<Agent>(`/api/agents/${encodeURIComponent(id)}`);
  }

  async uploadAttachment(agentId: string, file: File): Promise<Attachment> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Failed to read selected file"));
      reader.readAsDataURL(file);
    });
    const [, data = ""] = dataUrl.split(",", 2);
    return request<Attachment>(`/api/agents/${encodeURIComponent(agentId)}/attachments`, {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mime: file.type || "application/octet-stream", sizeBytes: file.size, data }),
    });
  }

  async sendMessage(agentId: string, text: string, attachments: Attachment[] = [], options: { signal?: AbortSignal; requestId?: string; replyTo?: ReplyContext; modelRouting?: ModelRoutingSelection } = {}): Promise<Message[]> {
    const requestId = options.requestId ?? `ui-${agentId}-${Date.now()}`;
    const url = `${window.location.protocol}//${window.location.host}/api/agents/${encodeURIComponent(agentId)}/messages`;
    const startedAt = Date.now() / 1000;
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      signal: options.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        attachments,
        requestId,
        replyTo: options.replyTo,
        modelRouting: options.modelRouting,
        async: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) {
      const detail = typeof data?.error === "string" ? data.error : res.statusText;
      throw new Error(detail);
    }
    if (!data?.accepted) {
      return data as Message[];
    }

    const pollDelays = [250, 750, 1500, 3000];
    let pollIndex = 0;
    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(pollDelays[Math.min(pollIndex, pollDelays.length - 1)], options.signal);
      pollIndex += 1;
      const agent = await this.getAgent(agentId);
      const requestMessages = (agent?.messages ?? []).filter((m) => m.requestId === requestId);
      const errorMessage = requestMessages.find((m) => m.role === "system" && /failed|interrupted|stopped/i.test(m.text ?? ""));
      if (errorMessage) throw new Error(errorMessage.text || "Message processing failed");
      const reply = requestMessages.find((m) => m.role === "agent");
      const requestedUser = requestMessages.find((m) => m.role === "user");
      if (reply) {
        return [requestedUser, reply].filter(Boolean) as Message[];
      }
      const replyAnchorTs = requestedUser?.ts ?? startedAt;
      const profileBackedReply = (agent?.messages ?? []).find(
        (m) => m.role === "agent" && m.source === "cli" && !m.requestId && (m.ts ?? 0) >= replyAnchorTs - 2,
      );
      if (profileBackedReply) return [requestedUser, profileBackedReply].filter(Boolean) as Message[];
      const lateReply = (agent?.messages ?? []).find((m) => m.role === "agent" && (m.ts ?? 0) >= startedAt);
      if (lateReply) return [lateReply];
      const activeRequests = new Set(agent?.processingRequests ?? []);
      const requestKnown = requestMessages.length > 0;
      const backendNoLongerRunning = requestKnown && !activeRequests.has(requestId) && Date.now() - startedAt * 1000 > 10000;
      if (backendNoLongerRunning) {
        throw new Error("Message processing ended without an assistant reply. The backend may have restarted or the worker was interrupted; refresh the chat to confirm the latest state.");
      }
    }
    throw new Error("Mission Control is still waiting for the agent after 60 minutes. Refresh the chat to check the latest result.");
  }

  async getModelRouter(): Promise<RouterConfig> {
    return request<RouterConfig>("/api/model-router");
  }

  async stopMessage(agentId: string, requestId?: string): Promise<{ ok: boolean; stopped: string[]; count: number }> {
    return request<{ ok: boolean; stopped: string[]; count: number }>(`/api/agents/${encodeURIComponent(agentId)}/messages/stop`, {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
  }

  async createAgent(input: { name: string; squad: string; model: string }): Promise<Agent> {
    return request<Agent>("/api/agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async deleteAgent(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  }

  async saveConfigFile(agentId: string, file: ConfigFile): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(file.name)}`,
      { method: "PUT", body: JSON.stringify({ content: file.content, scope: file.scope }) },
    );
  }

  async addSkill(agentId: string, skill: Skill): Promise<void> {
    await request<{ ok: boolean }>(`/api/agents/${encodeURIComponent(agentId)}/skills`, {
      method: "POST",
      body: JSON.stringify(skill),
    });
  }

  async removeSkill(agentId: string, skillId: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/agents/${encodeURIComponent(agentId)}/skills/${encodeURIComponent(skillId)}`,
      { method: "DELETE" },
    );
  }

  async listApprovals(): Promise<Approval[]> {
    const data = await request<Approval[] | { items?: Array<{ id: string; agent_id: string; agent_name: string; kind: string; description: string; title: string; created_at: string; status: string }> }>("/api/approvals");
    if (Array.isArray(data)) return data;
    return (data.items ?? [])
      .filter((item) => item.status === "drafted" || item.status === "ready")
      .map((item) => ({ id: item.id, agentId: item.agent_id, agentName: item.agent_name, kind: item.kind, detail: item.description || item.title, createdAt: item.created_at }));
  }

  async resolveApproval(id: string, decision: "approve" | "reject"): Promise<void> {
    await request<{ ok: boolean }>(`/api/approvals/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    });
  }

  async listInbox(filters?: { q?: string; status?: InboxStatus | "all" | "" }): Promise<InboxResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.status) params.set("status", filters.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<InboxResponse>(`/api/inbox${suffix}`);
  }

  async inboxAction(id: string, action: InboxAction): Promise<InboxMutationResponse> {
    return request<InboxMutationResponse>(`/api/inbox/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  }

  async updateInboxItem(id: string, input: Partial<{ title: string; description: string; body: string; risk: string; destination: string }>): Promise<InboxMutationResponse> {
    return request<InboxMutationResponse>(`/api/inbox/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  }

  async listAuditSessions(filters?: { q?: string; source?: string; limit?: number }): Promise<AuditSessionListResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.source) params.set("source", filters.source);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<AuditSessionListResponse>(`/api/audit/sessions${suffix}`);
  }

  async getAuditSession(id: string): Promise<AuditSessionDetailResponse> {
    return request<AuditSessionDetailResponse>(`/api/audit/sessions/${encodeURIComponent(id)}`);
  }

  async listAutomations(filters?: { q?: string; state?: string }): Promise<AutomationsResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.state) params.set("state", filters.state);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<AutomationsResponse>(`/api/automations${suffix}`);
  }

  async listFunnelTargets(filters?: { q?: string }): Promise<FunnelTargetsResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<FunnelTargetsResponse>(`/api/funnel-targets${suffix}`);
  }

  async getFunnelTarget(id: string): Promise<FunnelTargetDetailResponse> {
    return request<FunnelTargetDetailResponse>(`/api/funnel-targets/${encodeURIComponent(id)}`);
  }

  async createFunnelTarget(input: Record<string, unknown>): Promise<FunnelTargetMutationResponse> {
    return request<FunnelTargetMutationResponse>("/api/funnel-targets", { method: "POST", body: JSON.stringify(input) });
  }

  async funnelTargetAction(id: string, action: "enable" | "pause" | "run_now", payload: Record<string, unknown> = {}): Promise<FunnelTargetMutationResponse> {
    return request<FunnelTargetMutationResponse>(`/api/funnel-targets/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async listBrowserConnectors(): Promise<BrowserConnectorsResponse> {
    return request<BrowserConnectorsResponse>("/api/browser-connectors");
  }

  async createBrowserConnector(input: Record<string, unknown>): Promise<BrowserConnectorMutationResponse> {
    return request<BrowserConnectorMutationResponse>("/api/browser-connectors", { method: "POST", body: JSON.stringify(input) });
  }

  async browserConnectorAction(id: string, action: "approve" | "dry_run_probe" | "archive_probe" | "enable", payload: Record<string, unknown> = {}): Promise<BrowserConnectorMutationResponse> {
    return request<BrowserConnectorMutationResponse>(`/api/browser-connectors/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async browserConnectorProbe(id: string, payload: Record<string, unknown> = {}): Promise<BrowserConnectorProbeResponse> {
    return request<BrowserConnectorProbeResponse>(`/api/browser-connectors/${encodeURIComponent(id)}/probe`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async automationAction(id: string, action: "pause" | "resume" | "run" | "enable_funnel_routine", payload: AutomationActionPayload = {}): Promise<AutomationActionResponse> {
    return request<AutomationActionResponse>(`/api/automations/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: JSON.stringify({ ...payload, action }),
    });
  }

  async enableAutomationRoutine(id: string, payload: AutomationActionPayload): Promise<AutomationActionResponse> {
    return this.automationAction(id, "enable_funnel_routine", payload);
  }

  async listSkills(filters?: { q?: string; category?: string; source?: string }): Promise<SkillsHubResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.source) params.set("source", filters.source);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<SkillsHubResponse>(`/api/skills${suffix}`);
  }

  async getSkillFile(id: string): Promise<SkillFileResponse> {
    return request<SkillFileResponse>(`/api/skills/${encodeURIComponent(id)}/file`);
  }

  async listPlugins(filters?: { q?: string; category?: string; source?: string; status?: string }): Promise<PluginsHubResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.category) params.set("category", filters.category);
    if (filters?.source) params.set("source", filters.source);
    if (filters?.status) params.set("status", filters.status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<PluginsHubResponse>(`/api/plugins${suffix}`);
  }

  async listRuntimes(filters?: { q?: string }): Promise<RuntimeRegistryResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<RuntimeRegistryResponse>(`/api/runtimes${suffix}`);
  }

  async listRuntimeConnectors(): Promise<RuntimeConnectorResponse> {
    return request<RuntimeConnectorResponse>("/api/runtime-connect");
  }

  async createRuntimeConnectorToken(input: { label: string; allowed_types: string[] }): Promise<RuntimeConnectorTokenResponse> {
    return request<RuntimeConnectorTokenResponse>("/api/runtime-connect/tokens", { method: "POST", body: JSON.stringify(input) });
  }

  async revokeRuntimeConnectorToken(id: string): Promise<{ ok: boolean; id: string; status: string }> {
    return request<{ ok: boolean; id: string; status: string }>(`/api/runtime-connect/tokens/${encodeURIComponent(id)}/revoke`, { method: "POST", body: JSON.stringify({}) });
  }

  async getDesktopGateway(): Promise<DesktopGatewayStatus> {
    return request<DesktopGatewayStatus>("/api/desktop-gateway");
  }

  async listBrowserSessions(): Promise<BrowserSessionsResponse> {
    return request<BrowserSessionsResponse>("/api/browser-sessions");
  }

  async ingestBrowserRuntimeEvent(input: BrowserRuntimeEventIngestRequest): Promise<BrowserRuntimeEventIngestResponse> {
    return request<BrowserRuntimeEventIngestResponse>("/api/browser-sessions/events", { method: "POST", body: JSON.stringify(input) });
  }

  async getBrowserSession(id: string): Promise<BrowserSession | undefined> {
    return request<BrowserSession>(`/api/browser-sessions/${encodeURIComponent(id)}`);
  }

  async stopBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string }> {
    return request<{ ok: boolean; id: string; status: string }>(`/api/browser-sessions/${encodeURIComponent(id)}/stop`, { method: "POST", body: JSON.stringify({}) });
  }

  async takeoverBrowserSession(id: string): Promise<{ ok: boolean; id: string; status: string; instruction?: string }> {
    return request<{ ok: boolean; id: string; status: string; instruction?: string }>(`/api/browser-sessions/${encodeURIComponent(id)}/takeover`, { method: "POST", body: JSON.stringify({}) });
  }

  async saveWindowsGatewayConfig(input: Partial<{ url: string; token: string; keepToken: boolean; approvedFolders: string[] }>): Promise<WindowsGatewayConfigResponse> {
    return request<WindowsGatewayConfigResponse>("/api/windows-gateway/config", { method: "POST", body: JSON.stringify(input) });
  }

  async getCosts(filters?: { days?: number }): Promise<CostsResponse> {
    const params = new URLSearchParams();
    if (filters?.days) params.set("days", String(filters.days));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CostsResponse>(`/api/costs${suffix}`);
  }

  async listProjects(filters?: { q?: string; area?: string }): Promise<ProjectsResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.area) params.set("area", filters.area);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<ProjectsResponse>(`/api/projects${suffix}`);
  }

  async getDelegateWorkContext(): Promise<DelegateWorkContextResponse> {
    return request<DelegateWorkContextResponse>("/api/delegate-work/context");
  }

  async listWorkflows(filters?: { q?: string; category?: string }): Promise<WorkflowLibraryResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.category) params.set("category", filters.category);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<WorkflowLibraryResponse>(`/api/workflows${suffix}`);
  }

  async launchWorkflow(id: string, input: Partial<{ projectId: string; agentId: string; title: string; request: string; targetUrl: string; expected: string; runMode: string; schedule: string; project: string }>): Promise<WorkflowLaunchResponse> {
    return request<WorkflowLaunchResponse>(`/api/workflows/${encodeURIComponent(id)}/launch`, { method: "POST", body: JSON.stringify(input) });
  }

  async listResearchRuns(): Promise<ResearchRunsResponse> {
    return request<ResearchRunsResponse>("/api/research-runs");
  }

  async listWorkspaceRuns(filters?: { q?: string }): Promise<import("../types").WorkspaceRunHistoryResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<import("../types").WorkspaceRunHistoryResponse>(`/api/workspace-runs${suffix}`);
  }

  async getWorkspaceRun(id: string): Promise<import("../types").WorkspaceRunDetailResponse> {
    return request<import("../types").WorkspaceRunDetailResponse>(`/api/workspace-runs/${encodeURIComponent(id)}`);
  }

  async createResearchRun(input: ResearchRunCreateRequest): Promise<ResearchRunCreateResponse> {
    return request<ResearchRunCreateResponse>("/api/research-runs", { method: "POST", body: JSON.stringify(input) });
  }

  async planDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string }): Promise<DelegateWorkMutationResponse> {
    return request<DelegateWorkMutationResponse>("/api/delegate-work/plan", { method: "POST", body: JSON.stringify(input) });
  }

  async createDelegateWork(input: { request: string; projectId?: string; agentId?: string; risk?: string; title?: string }): Promise<DelegateWorkMutationResponse> {
    return request<DelegateWorkMutationResponse>("/api/delegate-work", { method: "POST", body: JSON.stringify(input) });
  }

  async listProjectChats(filters?: { q?: string; project?: string }): Promise<ProjectChatResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.project) params.set("project", filters.project);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<ProjectChatResponse>(`/api/project-chats${suffix}`);
  }

  async getProjectBrief(projectId: string): Promise<ProjectBriefResponse> {
    return request<ProjectBriefResponse>(`/api/projects/${encodeURIComponent(projectId)}/brief`);
  }

  async createProjectTask(projectId: string, input: Partial<{ title: string; body: string; assignee: string; priority: number; skills: string[] }>): Promise<BoardTaskMutationResponse> {
    return request<BoardTaskMutationResponse>(`/api/projects/${encodeURIComponent(projectId)}/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getSecondBrain(filters?: { q?: string; section?: string }): Promise<SecondBrainResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.section) params.set("section", filters.section);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<SecondBrainResponse>(`/api/second-brain${suffix}`);
  }

  async getSecondBrainIndex(filters?: { q?: string; section?: string }): Promise<SecondBrainIndexResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.section) params.set("section", filters.section);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<SecondBrainIndexResponse>(`/api/second-brain/index${suffix}`);
  }

  async searchSecondBrain(filters?: { q?: string; section?: string; limit?: number }): Promise<SecondBrainSearchResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.section) params.set("section", filters.section);
    if (filters?.limit) params.set("limit", String(filters.limit));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<SecondBrainSearchResponse>(`/api/second-brain/search${suffix}`);
  }

  async getSecondBrainNote(path: string): Promise<SecondBrainNoteResponse> {
    const params = new URLSearchParams({ path });
    return request<SecondBrainNoteResponse>(`/api/second-brain/note?${params.toString()}`);
  }

  async getSecondBrainGraph(): Promise<SecondBrainGraphResponse> {
    return request<SecondBrainGraphResponse>("/api/second-brain/graph");
  }

  async getSecondBrainHealth(): Promise<SecondBrainHealthResponse> {
    return request<SecondBrainHealthResponse>("/api/second-brain/health");
  }

  async getMemoryContext(filters?: { q?: string; scope?: string; category?: string }): Promise<MemoryContextResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.scope) params.set("scope", filters.scope);
    if (filters?.category) params.set("category", filters.category);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<MemoryContextResponse>(`/api/memory${suffix}`);
  }

  async listBoard(filters?: { q?: string; status?: BoardStatus | ""; assignee?: string; project?: string; board?: string }): Promise<BoardResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assignee) params.set("assignee", filters.assignee);
    if (filters?.project) params.set("project", filters.project);
    if (filters?.board) params.set("board", filters.board);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<BoardResponse>(`/api/tasks${suffix}`);
  }

  async getTaskResult(id: string): Promise<TaskResultResponse> {
    return request<TaskResultResponse>(`/api/tasks/${encodeURIComponent(id)}/result`);
  }

  async getOperatorLinkPreview(filters?: { task?: string; approval?: string; agent?: string }): Promise<OperatorLinkPreviewResponse> {
    const params = new URLSearchParams();
    if (filters?.task) params.set("task", filters.task);
    if (filters?.approval) params.set("approval", filters.approval);
    if (filters?.agent) params.set("agent", filters.agent);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<OperatorLinkPreviewResponse>(`/api/operator-links/preview${suffix}`);
  }

  async createBoardTask(input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; skills: string[] }>): Promise<BoardTaskMutationResponse> {
    return request<BoardTaskMutationResponse>("/api/tasks", { method: "POST", body: JSON.stringify(input) });
  }

  async updateBoardTask(id: string, input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; result: string; skills: string[] }>): Promise<BoardTaskMutationResponse> {
    return request<BoardTaskMutationResponse>(`/api/tasks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
  }

  async addBoardComment(id: string, body: string): Promise<BoardTaskMutationResponse> {
    return request<BoardTaskMutationResponse>(`/api/tasks/${encodeURIComponent(id)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  }

  async deleteBoardTask(id: string): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>(`/api/tasks/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
