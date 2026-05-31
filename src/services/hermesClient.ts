import type { Agent, Approval, AuditSessionDetailResponse, AuditSessionListResponse, AutomationActionResponse, AutomationsResponse, BoardResponse, BoardStatus, BoardTaskMutationResponse, ConfigFile, CostsResponse, InboxAction, InboxMutationResponse, InboxResponse, InboxStatus, Message, ProjectsResponse, Skill, SkillsHubResponse } from "../types";

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
  listAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  sendMessage(agentId: string, text: string): Promise<Message[]>;
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
  listAuditSessions(filters?: { q?: string; source?: string; limit?: number }): Promise<AuditSessionListResponse>;
  getAuditSession(id: string): Promise<AuditSessionDetailResponse>;
  listAutomations(filters?: { q?: string; state?: string }): Promise<AutomationsResponse>;
  automationAction(id: string, action: "pause" | "resume" | "run"): Promise<AutomationActionResponse>;
  listSkills(filters?: { q?: string; category?: string; source?: string }): Promise<SkillsHubResponse>;
  getCosts(filters?: { days?: number }): Promise<CostsResponse>;
  listProjects(filters?: { q?: string; kind?: string }): Promise<ProjectsResponse>;
  listBoard(filters?: { q?: string; status?: BoardStatus | ""; assignee?: string }): Promise<BoardResponse>;
  createBoardTask(input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; skills: string[] }>): Promise<BoardTaskMutationResponse>;
  updateBoardTask(id: string, input: Partial<{ title: string; body: string; assignee: string; status: BoardStatus; priority: number; tenant: string; result: string; skills: string[] }>): Promise<BoardTaskMutationResponse>;
  addBoardComment(id: string, body: string): Promise<BoardTaskMutationResponse>;
  deleteBoardTask(id: string): Promise<{ ok: boolean }>;
}
