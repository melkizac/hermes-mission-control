import type { ViewKey } from "../types";

export type UserRole = "admin" | "user" | "viewer" | string | undefined | null;

export interface UiPermissions {
  accountIsAdmin: boolean;
  canAccessAdmin: boolean;
  canManageRuntime: boolean;
  canEditGlobalAgents: boolean;
  canEditAgentIdentity: boolean;
  canEditSkills: boolean;
  canEditConfig: boolean;
  canSelectAgents: boolean;
}

export const adminOnlyViews = new Set<ViewKey>([
  "runtimes",
  "models",
  "costs",
  "users-workspaces",
  "shared-agent-templates",
  "desktop-gateway",
  "approval-policy",
  "quota",
  "settings",
]);

export const workspaceViews = new Set<ViewKey>([
  "mission",
  "dashboard",
  "delegate-work",
  "workflow-library",
  "profile",
  "agents",
  "agent-org",
  "skills",
  "memory",
  "tools",
  "plugins",
  "projects",
  "second-brain",
  "board",
  "approvals",
  "automations",
  "browser-ops",
  "audit",
  "research-runs",
]);

export function isAdminRole(role: UserRole) {
  return role === "admin";
}

export function permissionsForRole(role: UserRole, accountRole?: UserRole): UiPermissions {
  const admin = isAdminRole(role);
  return {
    accountIsAdmin: isAdminRole(accountRole ?? role),
    canAccessAdmin: admin,
    canManageRuntime: admin,
    canEditGlobalAgents: admin,
    canEditAgentIdentity: Boolean(role) && role !== "viewer",
    canEditSkills: admin,
    canEditConfig: admin,
    canSelectAgents: Boolean(role) && role !== "viewer",
  };
}

export function canAccessView(role: UserRole, view: ViewKey) {
  if (isAdminRole(role)) return true;
  if (adminOnlyViews.has(view)) return false;
  return workspaceViews.has(view);
}

export function safeDefaultViewForRole(role: UserRole): ViewKey {
  return canAccessView(role, "mission") ? "mission" : "profile";
}

export function viewLabelForRole(role: UserRole, view: ViewKey, fallback: string) {
  if (isAdminRole(role)) return fallback;
  const labels: Partial<Record<ViewKey, string>> = {
    agents: "My Agents",
    "delegate-work": "Delegate Work",
    "workflow-library": "Workflow Library",
    "agent-org": "My Agent Org",
    projects: "My Projects",
    board: "My Task Board",
    approvals: "Needs Attention",
    automations: "Routines",
    "browser-ops": "Browser Activity",
    "research-runs": "Research Runs",
    plugins: "Plugins",
    "second-brain": "Workspace Knowledge",
    audit: "My Audit / Evidence",
  };
  return labels[view] ?? fallback;
}
