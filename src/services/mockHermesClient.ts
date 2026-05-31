import type { Agent, Approval, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardTaskMutationResponse, ConfigFile, CostsResponse, InboxAction, InboxItem, InboxMutationResponse, InboxResponse, Message, ProjectsResponse, Skill, SkillsHubResponse } from "../types";
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

  async sendMessage(agentId: string, text: string): Promise<Message[]> {
    await delay(120);
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return [];
    const userMsg: Message = { id: uid(), role: "user", text, at: "now" };
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

  async getCosts(): Promise<CostsResponse> {
    await delay(90);
    const period = { sessions: 0, cost: 0, tokens: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, tool_calls: 0, api_calls: 0 };
    return { window_days: 30, summary: { last_24h: period, last_7d: period, last_30d: period, selected: period, all_time: period }, by_model: [], by_source: [], daily: [], expensive_sessions: [] };
  }

  async listProjects(): Promise<ProjectsResponse> {
    await delay(90);
    return { projects: [], summary: { total: 0, active: 0, open_actions: 0, blocked: 0, knowledge: 0, workspaces: 0 }, kinds: [], sources: [] };
  }

  async listBoard(): Promise<BoardResponse> {
    await delay(90);
    return { tasks: [], lanes: { queued: [], running: [], blocked: [], done: [], error: [] }, summary: { total: 0, queued: 0, running: 0, blocked: 0, done: 0, error: 0, assignees: [] }, statuses: ["queued", "running", "blocked", "done", "error"] };
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
