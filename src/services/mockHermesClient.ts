import type { Agent, Approval, Attachment, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardTaskMutationResponse, ConfigFile, CostsResponse, InboxAction, InboxItem, InboxMutationResponse, InboxResponse, Message, ModelRoutingSelection, ProjectBriefResponse, ProjectChatResponse, ProjectsResponse, ReplyContext, RouterConfig, RuntimeConnectorResponse, RuntimeConnectorTokenResponse, RuntimeRegistryResponse, SecondBrainResponse, Skill, SkillsHubResponse } from "../types";
import type { HermesClient } from "./hermesClient";
import { seedAgents, seedApprovals } from "../data/mockData";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 9);

const colors = ["#0e8f84", "#3b6fe0", "#e8941b", "#7b8494", "#dc4040", "#8b5cf6"];

/**
 * MockHermesClient keeps an in-memory copy of the seed data and mutates it.
 * It simulates latency so the UI's loading/optimistic paths are exercised.
 */
export class MockHermesClient implements HermesClient {
  private agents: Agent[] = clone(seedAgents);
  private approvals: Approval[] = clone(seedApprovals);

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

  async stopMessage() {
    await delay(20);
    return { ok: true, stopped: [], count: 0 };
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

  async automationAction(id: string, action: "pause" | "resume" | "run"): Promise<AutomationActionResponse> {
    await delay(90);
    return { ok: true, job_id: id, action };
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

  async getCosts(): Promise<CostsResponse> {
    await delay(90);
    const period = { sessions: 0, cost: 0, tokens: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, tool_calls: 0, api_calls: 0 };
    return { window_days: 30, summary: { last_24h: period, last_7d: period, last_30d: period, selected: period, all_time: period }, by_model: [], by_source: [], daily: [], expensive_sessions: [] };
  }

  async listProjects(): Promise<ProjectsResponse> {
    await delay(90);
    return { projects: [], summary: { total: 0, active: 0, open_actions: 0, blocked: 0, knowledge: 0, workspaces: 0 }, kinds: [], sources: [] };
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

  async listBoard(): Promise<BoardResponse> {
    await delay(90);
    return { tasks: [], lanes: { queued: [], running: [], blocked: [], done: [], error: [] }, summary: { total: 0, queued: 0, running: 0, blocked: 0, done: 0, error: 0, assignees: [], projects: [] }, statuses: ["queued", "running", "blocked", "done", "error"], projects: [] };
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
