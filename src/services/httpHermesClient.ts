import type { Agent, Approval, Attachment, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardStatus, BoardTaskMutationResponse, ConfigFile, CostsResponse, InboxAction, InboxMutationResponse, InboxResponse, InboxStatus, Message, ModelRoutingSelection, ProjectBriefResponse, ProjectChatResponse, ProjectsResponse, ReplyContext, RouterConfig, RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRegistryResponse, SecondBrainResponse, Skill, SkillFileResponse, SkillsHubResponse } from "../types";
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

    const deadline = Date.now() + 60 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(3000, options.signal);
      const agent = await this.getAgent(agentId);
      const requestMessages = (agent?.messages ?? []).filter((m) => m.requestId === requestId);
      const errorMessage = requestMessages.find((m) => m.role === "system" && /failed|interrupted|stopped/i.test(m.text ?? ""));
      if (errorMessage) throw new Error(errorMessage.text || "Message processing failed");
      const reply = requestMessages.find((m) => m.role === "agent");
      if (reply) {
        const user = requestMessages.find((m) => m.role === "user");
        return [user, reply].filter(Boolean) as Message[];
      }
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
      { method: "PUT", body: JSON.stringify({ content: file.content }) },
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

  async automationAction(id: string, action: "pause" | "resume" | "run"): Promise<AutomationActionResponse> {
    return request<AutomationActionResponse>(`/api/automations/${encodeURIComponent(id)}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
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

  async getCosts(filters?: { days?: number }): Promise<CostsResponse> {
    const params = new URLSearchParams();
    if (filters?.days) params.set("days", String(filters.days));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<CostsResponse>(`/api/costs${suffix}`);
  }

  async listProjects(filters?: { q?: string; kind?: string }): Promise<ProjectsResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.kind) params.set("kind", filters.kind);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<ProjectsResponse>(`/api/projects${suffix}`);
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

  async listBoard(filters?: { q?: string; status?: BoardStatus | ""; assignee?: string; project?: string }): Promise<BoardResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set("q", filters.q);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.assignee) params.set("assignee", filters.assignee);
    if (filters?.project) params.set("project", filters.project);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return request<BoardResponse>(`/api/tasks${suffix}`);
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
