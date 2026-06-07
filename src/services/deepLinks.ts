import type { ViewKey } from "../types";

export type MissionControlDeepLinkTarget = {
  view?: ViewKey;
  taskId?: string;
  approvalId?: string;
  agentId?: string;
};

const allowedViews = new Set<ViewKey>([
  "mission",
  "dashboard",
  "delegate-work",
  "workflow-library",
  "profile",
  "agents",
  "agent-voice",
  "agent-org",
  "agent-platform-admin",
  "runtimes",
  "tools",
  "plugins",
  "projects",
  "second-brain",
  "board",
  "skills",
  "approvals",
  "automations",
  "audit",
  "costs",
  "models",
  "users-workspaces",
  "shared-agent-templates",
  "desktop-gateway",
  "browser-ops",
  "research-runs",
  "approval-policy",
  "quota",
  "settings",
]);

export function parseMissionControlDeepLink(input: string | URL | Location = window.location): MissionControlDeepLinkTarget {
  const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.href, window.location.origin);
  const params = url.searchParams;
  const rawView = params.get("view") as ViewKey | null;
  const target: MissionControlDeepLinkTarget = {};
  if (rawView && allowedViews.has(rawView)) target.view = rawView;
  if (!target.view && url.pathname.replace(/\/$/, "") === "/admin") target.view = "settings";
  const taskId = params.get("task") || params.get("task_id");
  const approvalId = params.get("approval") || params.get("approval_id");
  const agentId = params.get("agent") || params.get("agent_id");
  if (taskId) target.taskId = taskId;
  if (approvalId) target.approvalId = approvalId;
  if (agentId) target.agentId = agentId;
  if (!target.view) {
    if (target.approvalId) target.view = "approvals";
    else if (target.taskId) target.view = "board";
    else if (target.agentId) target.view = "agents";
  }
  return target;
}

export function buildMissionControlUrl(target: MissionControlDeepLinkTarget, origin = window.location.origin): string {
  const params = new URLSearchParams();
  const view = target.view ?? (target.approvalId ? "approvals" : target.taskId ? "board" : target.agentId ? "agents" : "mission");
  params.set("view", view);
  if (target.approvalId) params.set("approval", target.approvalId);
  if (target.taskId) params.set("task", target.taskId);
  if (target.agentId) params.set("agent", target.agentId);
  const query = params.toString();
  // Keep these examples literal for regression docs/tests: view=approvals&approval=, view=board&task=, view=agents&agent=
  const adminViews = new Set<ViewKey>(["settings", "agent-platform-admin", "users-workspaces", "shared-agent-templates", "desktop-gateway", "approval-policy", "quota"]);
  const basePath = adminViews.has(view) ? "/admin" : "/app";
  return `${origin.replace(/\/$/, "")}${basePath}?${query}`;
}

export const initialDeepLinkTarget = () => parseMissionControlDeepLink(window.location);
