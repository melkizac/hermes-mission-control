import { useEffect, useState } from "react";
import type { DesktopGatewayStatus, ViewKey } from "../types";
import { Icon } from "../components/Icon";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";

const client = new HttpHermesClient();

type AccessRole = "admin" | "user" | "viewer";
type AccessStatus = "invited" | "pending" | "active" | "disabled";

type HermesProfile = {
  id: string;
  owner_user_id: string;
  profile_name: string;
  display_name: string;
  status: string;
  profile_path?: string;
  created_at?: string | number;
  updated_at?: string | number;
};

type UserRuntime = {
  id: string;
  user_id: string;
  profile_id: string;
  kind: "docker" | string;
  status: string;
  container_name: string;
  image: string;
  host_home: string;
  container_home: string;
  last_error?: string;
  created_at?: string | number;
  updated_at?: string | number;
};

type AccessUser = {
  id: string;
  email: string;
  name: string;
  role: AccessRole | string;
  status: AccessStatus | string;
  lifecycle?: { state: AccessStatus | string; label: string; can_login: boolean; pending_activation: boolean };
  status_updated_at?: string | number | null;
  disabled_at?: string | number | null;
  disabled_by?: string | null;
  disabled_reason?: string | null;
  created_at: string;
  last_login_at?: string | null;
  workspace?: { id: string; name: string; slug: string } | null;
  hermes_profile?: HermesProfile | null;
  runtime?: UserRuntime | null;
  runtime_cleanup_policy?: { session_policy: string; runtime_policy: string; reenable_policy: string };
  activity?: { projects: number; tasks: number; inbox: number };
  agent_access?: { assigned_agent_ids: string[]; effective_agent_ids: string[]; role_agent_ids: string[]; assigned_agents: SharedAgentTemplate[]; count: number };
};


type AccessResponse = {
  ok: boolean;
  users: AccessUser[];
  profiles?: HermesProfile[];
  runtimes?: UserRuntime[];
  agent_templates?: SharedAgentTemplate[];
  role_agent_assignments?: Record<AccessRole, RoleAgentAssignment>;
  summary: { total_users: number; active: number; invited?: number; disabled?: number; admins: number; profiles?: number; runtimes?: number; running_runtimes?: number };
  roles: AccessRole[];
  statuses: AccessStatus[];
  policy: {
    destructive_delete: boolean;
    passwords_returned_once: boolean;
    admin_required: boolean;
    disabled_user_enforcement?: string;
    disabled_user_runtime_cleanup?: { session_policy: string; runtime_policy: string; reenable_policy: string };
  };
};

type PlatformDomain = { id: string; label: string; status: string; detail: string };
type PlatformResponse = {
  ok: boolean;
  summary: { users: number; profiles: number; runtimes: number; running_runtimes: number; templates: number; active_templates: number; selected_templates: number; assigned_templates: number };
  runtime_statuses: Record<string, number>;
  agent_class_summary: Record<AgentClass, AgentClassSummary>;
  policy_domains: PlatformDomain[];
  guardrails: string[];
};

type AgentClass = "platform" | "workspace" | "personal";
type AssignmentPolicy = {
  assignable_to_users: boolean;
  assignment_scope: string;
  label: string;
  reason: string;
};
type PersonalAgentPromotionRequest = {
  status: string;
  requested_domains: string[];
  reason?: string;
};
type AgentClassSummary = AssignmentPolicy & { agent_class: AgentClass; count: number; active: number };

type AgentAccessSource = "user" | "role";

type SharedAgentTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  shared_agent_ref: string;
  status: string;
  admin_managed_only: boolean;
  agent_class: AgentClass;
  visibility: string;
  assignment_policy: AssignmentPolicy;
  selected_count?: number;
  assignment_count?: number;
  management_scope?: string;
  owner_user_id?: string | null;
  owner_workspace_id?: string | null;
  policy_metadata?: {
    connector_policy?: { transaction_domains?: string[]; restricted_domains?: string[]; default_access?: string };
    promotion_request?: PersonalAgentPromotionRequest;
  };
  access_sources: AgentAccessSource[];
  access_source_label: string;
  assigned_by_role?: string | null;
};

type RoleAgentAssignment = { role: AccessRole; agent_ids: string[]; agents: SharedAgentTemplate[] };

type TemplateResponse = {
  ok: boolean;
  templates: SharedAgentTemplate[];
  summary: { total: number; active: number; archived: number; selected: number; assigned: number };
  categories: string[];
  policy: Record<string, unknown>;
};

type TemplateFormState = { id: string; name: string; description: string; category: string; capabilities: string; shared_agent_ref: string; status: string };

type RuntimeConsoleMode = "supervise" | "manage" | "impersonate";
type RuntimeConsolePayload = {
  ok: boolean;
  mode: RuntimeConsoleMode;
  privacy_boundary: string;
  workspace: { id: string; name: string; slug?: string };
  owner_user?: { id: string; email: string; name: string; role: string; status: string } | null;
  hermes_profile?: HermesProfile | null;
  runtime?: UserRuntime | null;
  runtime_status?: { status: string; container_name: string; kind: string };
  assigned_workspace_agents?: SharedAgentTemplate[];
  personal_agent_policy?: { visibility: string; count: number; names_hidden: boolean; policy_summary: string; pending_promotion_requests?: number };
  links?: { audit?: string; logs?: string; agent_assignments?: string };
  manage_controls?: { id: string; label: string; description: string; safe: boolean; route?: string }[];
  controls?: string[];
  impersonation?: { enabled: boolean; explicit_required: boolean; warning: string };
};

type RuntimeConsoleActionResponse = { ok: boolean; audit_event_id?: string; warning?: string; error?: string };

type UserFormState = { email: string; name: string; workspaceName: string; role: AccessRole; status: AccessStatus; agentIds: string[] };
type EditUserFormState = { name: string; role: AccessRole; status: AccessStatus; resetPassword: boolean; disabledReason: string };
// Sensitive: password is display-once UI state only. Do not persist to storage or include in logs.
type OneTimeCredential = { kind: "invite" | "reset"; email: string; password: string; createdAt: number };
type OneTimeCredentialResponse = { ok: boolean; user: AccessUser; temporary_password?: string; temporary_password_display_once?: boolean; assigned_agent_ids?: string[] };
type AccessAuditEvent = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  workspace_id?: string;
  actor_id?: string;
  created_at: string;
  evidence?: {
    actor?: { user_id?: string; email?: string; role?: string };
    changes?: Record<string, unknown>;
    result?: string;
    occurred_at_sgt?: string;
    correlation_id?: string;
    credential_delivery?: string;
    credential_display_once?: boolean;
  };
};
type AccessAuditResponse = { events: AccessAuditEvent[]; summary?: { total: number } };

async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${window.location.protocol}//${window.location.host}${path}`, {
    credentials: "include",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : res.statusText);
  return data as T;
}

type AdminMetric = { label: string; value: string; detail: string; tone?: "good" | "warn" | "bad" };
type AdminCard = { title: string; body: string; target?: ViewKey; action: string; note?: string };
type AdminSection = { heading: string; body: string; cards: AdminCard[] };

type AdminSetupConfig = {
  eyebrow: string;
  title: string;
  blurb: string;
  metrics: AdminMetric[];
  sections: AdminSection[];
  evidence: string[];
};

const pageConfigs: Record<string, AdminSetupConfig> = {
  "users-workspaces": {
    eyebrow: "PLATFORM ADMIN",
    title: "User Access",
    blurb:
      "Manage who can enter Mission Control, which Hermes agent profile they own, and whether they are users, viewers, or platform admins.",
    metrics: [
      { label: "Scope", value: "Docker Runtime", detail: "User-owned Hermes container isolation" },
      { label: "Roles", value: "3", detail: "admin · user · viewer", tone: "good" },
      { label: "Guardrail", value: "RBAC", detail: "Server-side view permissions", tone: "good" },
      { label: "Next data source", value: "/api/me", detail: "Current signed-in profile evidence" },
    ],
    sections: [
      {
        heading: "Operational controls",
        body: "This is the admin setup hub for workspace membership, roles, ownership, and access review. It keeps account administration separate from the user workspace cockpit.",
        cards: [
          { title: "Review signed-in identity", body: "Check current account, role, and workspace from the authenticated /api/me contract.", target: "settings", action: "Open Admin Overview" },
          { title: "Audit workspace activity", body: "Use the global audit trail to confirm which workspaces and channels are active before changing access.", target: "audit", action: "Open Global Audit Log" },
          { title: "Check usage by workspace", body: "Review spend/session patterns before setting workspace limits or escalation rules.", target: "costs", action: "Open Costs / Usage" },
        ],
      },
      {
        heading: "Implementation boundary",
        body: "Step 3 replaces the scaffold with an operator-ready admin page. Destructive user provisioning, deletion, or live role changes remain intentionally out of scope until a dedicated membership API is added.",
        cards: [
          { title: "Required backend slice", body: "Add a membership endpoint that lists users, workspace IDs, roles, last login, and invited/pending status without exposing secrets.", action: "Planned API: /api/admin/users" },
        ],
      },
    ],
    evidence: ["Authenticated route remains admin-only", "Existing workspace default remains User mode", "No user deletion or role mutation controls are exposed"],
  },
  "workspace-runtime-console": {
    eyebrow: "RUNTIME SUPERVISION",
    title: "Workspace Runtime Console",
    blurb: "Admin-only switchboard for selecting a user workspace runtime, supervising safe operational metadata, and entering audited manage or impersonation modes only when necessary.",
    metrics: [
      { label: "Mode", value: "3", detail: "Supervise · Manage · Impersonate", tone: "good" },
      { label: "Privacy", value: "Safe", detail: "No private chat/memory in supervise", tone: "good" },
      { label: "Runtime", value: "User", detail: "Workspace-owned Hermes profile/container" },
      { label: "Audit", value: "Required", detail: "Reasoned impersonation is logged", tone: "warn" },
    ],
    sections: [],
    evidence: ["Admin-only API", "Supervision payload excludes private chat and memory", "Impersonation requires a reason before user-context actions"],
  },
  "agent-platform-admin": {
    eyebrow: "AGENT GOVERNANCE",
    title: "Agent Platform Admin",
    blurb:
      "Govern the sandbox for user-designed agent orgs: templates, tool/model access, approval rules, quotas, runtime isolation, shared skills, and audit health.",
    metrics: [
      { label: "User ownership", value: "Agent Org", detail: "Users design their own AI workforce", tone: "good" },
      { label: "Admin role", value: "Guardrails", detail: "Policies, templates, limits, runtime boundaries" },
      { label: "Actions", value: "Policy-gated", detail: "External/destructive/costly work needs controls", tone: "good" },
      { label: "Runtime", value: "Isolated", detail: "User → Hermes profile/runtime boundary" },
    ],
    sections: [
      {
        heading: "What users own",
        body: "Users should create their own agents, define responsibilities, design reporting lines, assign goals, and operate their AI Workforce within the boundaries allowed by the platform.",
        cards: [
          { title: "User AI Workforce", body: "The user-facing Agent Org remains the place to build and operate personal/team digital coworkers, goals, queues, runs, outputs, and agent collaboration.", target: "agent-org", action: "Open AI Workforce" },
          { title: "Agent conversations", body: "Users talk to and inspect individual agents from the Agents page; Admin should not manually script every user's org chart.", target: "agents", action: "Open Agents" },
          { title: "Projects and tasks", body: "Users connect agents to their own projects, task board work, approvals, and evidence instead of waiting for platform-level configuration.", target: "projects", action: "Open Projects" },
        ],
      },
      {
        heading: "What Admin governs",
        body: "Admin manages the capability system: what can be created, what tools and models are allowed, what requires approval, how much usage is allowed, and how runtime isolation is enforced.",
        cards: [
          { title: "Agent templates", body: "Publish reusable agent blueprints such as LinkedIn Growth, Lead Qualification, Research Analyst, Meeting Follow-up, DevOps Builder, or Finance Monitor. Users clone and customise them.", target: "shared-agent-templates", action: "Open Templates" },
          { title: "Tool and integration policy", body: "Control access to browser automation, email send, LinkedIn actions, file writes, shell/GitHub/database operations, and channel posting.", target: "tools", action: "Review Tools" },
          { title: "Model access and routing", body: "Set allowed providers/models, default tiers, premium model use, context budgets, and cost-aware routing rules.", target: "models", action: "Open Model Policy" },
          { title: "Approval policy", body: "Define global human-in-the-loop gates for outbound, destructive, costly, account-sensitive, or authority-bound actions. Users may be stricter, not weaker.", target: "approval-policy", action: "Open Approval Policy" },
          { title: "Quota and capacity", body: "Set max agents, active routines, concurrent runs, browser sessions, token/spend limits, and alert thresholds per user/profile.", target: "quota", action: "Open Quota" },
          { title: "Runtime isolation", body: "Own the User → Hermes Profile boundary, containers/runtimes, secrets scope, filesystem boundaries, and connector readiness.", target: "users-workspaces", action: "Open User Access" },
        ],
      },
      {
        heading: "Governance and evidence",
        body: "Admin should be able to prove what changed, who granted access, which policy applied, what failed, and what spent money without reading private user content by default.",
        cards: [
          { title: "Global Audit Log", body: "Review agent creation, template assignment, approval decisions, high-risk actions, runtime failures, and policy changes.", target: "audit", action: "Open Audit" },
          { title: "Costs / Usage", body: "Watch spend anomalies, model consumption, noisy routines, and per-source usage before changing quotas or model access.", target: "costs", action: "Open Costs" },
          { title: "Runtime Connectors", body: "Monitor connected runtimes, connector tokens, heartbeat health, and external runtime readiness.", target: "runtimes", action: "Open Runtime Connectors" },
        ],
      },
    ],
    evidence: [
      "Admin no longer links to the user-owned Agent Org as a platform org chart",
      "User AI Workforce remains available for users to design their own agents",
      "Admin scope is now templates, permissions, policies, quotas, isolation, audit, and runtime health",
    ],
  },
  "shared-agent-templates": {
    eyebrow: "PLATFORM AGENTS",
    title: "Shared Agent Templates",
    blurb:
      "Curate reusable agent blueprints that users can clone into their own AI Workforce, while keeping each user's editable agent identity and org design separate.",
    metrics: [
      { label: "Source of truth", value: "Templates", detail: "Admin-managed shared definitions" },
      { label: "User identity", value: "SOUL.md", detail: "Editable by users", tone: "good" },
      { label: "Runtime", value: "AI Workforce", detail: "Users clone into their own org" },
      { label: "Guardrail", value: "Scoped", detail: "No cross-workspace soul overwrite", tone: "good" },
    ],
    sections: [
      {
        heading: "Template workflow",
        body: "Shared templates should define reusable capabilities, default skills, model preferences, and safe permissions. Users personalize their own agent soul and org structure without changing the admin template.",
        cards: [
          { title: "Review platform guardrails", body: "Check which policies, tool access, model access, and runtime boundaries templates must respect.", target: "agent-platform-admin", action: "Open Agent Platform Admin" },
          { title: "Inspect Skills Library", body: "Check available Hermes/OpenClaw/Shared skills that templates can reference.", target: "skills", action: "Open Skills" },
          { title: "Audit template effects", body: "Use audit evidence when a template is assigned, changed, or promoted to a runtime workflow.", target: "audit", action: "Open Global Audit Log" },
        ],
      },
      {
        heading: "Personal vs Workspace boundary",
        body: "Personal agents are private productivity helpers owned by one user. Workspace agents are company-capable digital coworkers assigned by Admin. Company-system access must be requested for promotion, not granted automatically.",
        cards: [
          { title: "Personal agents", body: "Safe default capabilities only: chat, draft, summarize, and research inside the user's allowed policy. ERP, CRM, HR, and Accounting connectors stay blocked by default.", target: "agents", action: "Open My Agents" },
          { title: "Promotion path", body: "When a Personal agent needs company-system access, Mission Control records a promotion request for Admin review instead of silently granting transaction permissions.", target: "audit", action: "Review Audit Evidence" },
        ],
      },
      {
        heading: "User agent boundary",
        body: "Admin templates and user-owned agent identity/org edits are different scopes. This boundary lets users design their own agents without becoming platform admins.",
        cards: [
          { title: "User-owned agents", body: "Users should edit only their own agent identities and org design, not shared templates, global skills, connectors, model policy, or approval policy.", target: "agents", action: "Open My Agents" },
        ],
      },
    ],
    evidence: ["Admin-managed template concept is visible", "User agent personalization is documented in-page", "Existing AI Workforce and Skills routes are preserved"],
  },
  "desktop-gateway": {
    eyebrow: "RUNTIME ADMIN",
    title: "Desktop Gateway",
    blurb:
      "Monitor desktop gateway connectivity and route local computer-use capability into the runtime layer without hiding execution locality.",
    metrics: [
      { label: "Primary setup", value: "Connector V2", detail: "Token · register · heartbeat" },
      { label: "Runtime page", value: "Live", detail: "Connected runtimes remain the source" },
      { label: "Gateway", value: "Scoped", detail: "Desktop capability is explicit", tone: "good" },
      { label: "Safety", value: "Audited", detail: "Actions should leave evidence", tone: "good" },
    ],
    sections: [
      {
        heading: "Gateway operations",
        body: "Use this hub to understand what desktop execution path should be connected, what is currently online, and where to create or revoke connector tokens.",
        cards: [
          { title: "Runtime Connectors", body: "Create tokens, see connected runtimes, monitor heartbeats, and inspect connector events.", target: "runtimes", action: "Open Runtime Connectors" },
          { title: "Tools inventory", body: "Review available toolsets and platform tools before enabling desktop automation workflows.", target: "tools", action: "Open Tools" },
          { title: "Desktop/API settings", body: "Open the current admin overview where gateway and desktop settings remain accessible.", target: "settings", action: "Open Admin Overview" },
        ],
      },
    ],
    evidence: ["Desktop gateway is no longer an empty placeholder", "Connector V2 remains the primary operational path", "No live desktop action is triggered from this page"],
  },
  "approval-policy": {
    eyebrow: "GOVERNANCE ADMIN",
    title: "Approval Policy",
    blurb:
      "Define which actions need human-in-the-loop review before agents publish, spend, delete, message externally, or cross workspace boundaries.",
    metrics: [
      { label: "Policy mode", value: "HITL", detail: "Human-in-the-loop guardrails", tone: "good" },
      { label: "Review queue", value: "Needs Attention", detail: "Workspace-visible interventions" },
      { label: "Audit", value: "Global", detail: "Policy outcomes need evidence" },
      { label: "Scope", value: "Draft", detail: "No global mutation controls yet", tone: "warn" },
    ],
    sections: [
      {
        heading: "Default protected actions",
        body: "Agents can draft and prepare work autonomously, but these categories should remain approval-gated or routed to Task Board until an admin policy API is live.",
        cards: [
          { title: "Outbound messages and posts", body: "External Telegram, LinkedIn, email, website, or client-facing publication should require approve/edit/reject.", target: "approvals", action: "Open Needs Attention" },
          { title: "Destructive or costly operations", body: "Database changes, deletion, credential rotation, DNS/cloud mutations, and high-cost runs need policy gates.", target: "audit", action: "Open Global Audit Log" },
          { title: "Blocked manual work", body: "Human-only actions belong on Task Board / Needs Attention, not fake approve/reject cards.", target: "board", action: "Open Task Board" },
        ],
      },
      {
        heading: "Next backend slice",
        body: "A future /api/admin/approval-policy endpoint should persist policy thresholds, per-workspace overrides, and proof of the latest policy change.",
        cards: [{ title: "Policy contract", body: "Expose read-only current policy first, then add explicit versioned updates with audit entries.", action: "Planned API: /api/admin/approval-policy" }],
      },
    ],
    evidence: ["Approval taxonomy is visible", "Needs Attention and Audit links are preserved", "No live policy mutation is exposed without backend audit"],
  },
  quota: {
    eyebrow: "GOVERNANCE ADMIN",
    title: "Quota",
    blurb:
      "Set workspace limits for spend, tokens, sessions, routines, and shared runtime capacity after reviewing current usage evidence.",
    metrics: [
      { label: "Current evidence", value: "Costs", detail: "Usage dashboard is linked" },
      { label: "Limit types", value: "5", detail: "spend · tokens · sessions · runs · runtime" },
      { label: "Enforcement", value: "Planned", detail: "Read-only admin hub for now", tone: "warn" },
      { label: "Safety", value: "No mutation", detail: "No quota writes without approval", tone: "good" },
    ],
    sections: [
      {
        heading: "Quota operating model",
        body: "Quota should be evidence-driven: review current usage, identify noisy workspaces/routines, then set explicit caps with audit entries and operator-visible warnings.",
        cards: [
          { title: "Review costs and tokens", body: "Start from actual session, source, model, and token trends before setting limits.", target: "costs", action: "Open Costs / Usage" },
          { title: "Review routines", body: "Scheduled jobs and monitors are common quota consumers; inspect run cadence and errors.", target: "automations", action: "Open Routines" },
          { title: "Review runtime capacity", body: "Shared runtime pools and connected workers should be checked before changing capacity limits.", target: "runtimes", action: "Open Runtime Connectors" },
        ],
      },
      {
        heading: "Next backend slice",
        body: "A future /api/admin/quota endpoint should expose current limits, usage against limit, warning thresholds, and versioned updates.",
        cards: [{ title: "Quota contract", body: "Begin read-only, then add audited changes and workspace-level overrides after policy review.", action: "Planned API: /api/admin/quota" }],
      },
    ],
    evidence: ["Quota page is an operational setup hub", "Usage evidence routes are one click away", "No unaudited quota mutation is possible"],
  },
};

function metricClass(tone?: AdminMetric["tone"]) {
  return `skills-metric${tone ? ` ${tone}` : ""}`;
}

function formatDate(value?: string | number | null) {
  if (!value) return "Never";
  const date = new Date(typeof value === "number" && value < 1000000000000 ? value * 1000 : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function agentClassLabel(agentClass?: AgentClass) {
  if (agentClass === "platform") return "Platform (Admin-only)";
  if (agentClass === "personal") return "Personal (user-owned/policy template)";
  return "Workspace (assignable to users/roles)";
}

function AgentClassBadge({ agent }: { agent: Pick<SharedAgentTemplate, "agent_class" | "assignment_policy"> }) {
  const label = agent.assignment_policy?.label || agentClassLabel(agent.agent_class);
  const tone = agent.agent_class === "workspace" ? "good" : agent.agent_class === "platform" ? "warn" : "muted";
  return <span className={`tag ${tone}`}>{label}</span>;
}

function AgentAssignmentPolicyNote({ agent }: { agent: SharedAgentTemplate }) {
  return (
    <small className="agent-assignment-policy-note">
      {agent.assignment_policy?.reason || (agent.assignment_policy?.assignable_to_users ? "Workspace agents can be assigned to users or roles." : "This agent is not assignable to normal users.")}
    </small>
  );
}

function UsersAccessPanel() {
  const { setView } = useStore();
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null);
  const [editForm, setEditForm] = useState<EditUserFormState>({ name: "", role: "user", status: "active", resetPassword: false, disabledReason: "" });
  const [userAuditEvents, setUserAuditEvents] = useState<AccessAuditEvent[]>([]);
  const [userAuditLoading, setUserAuditLoading] = useState(false);
  const [assignedAgentIds, setAssignedAgentIds] = useState<string[]>([]);
  const [roleAgentAssignments, setRoleAgentAssignments] = useState<Record<AccessRole, string[]>>({ admin: [], user: [], viewer: [] });
  const [savingEdit, setSavingEdit] = useState(false);
  const [oneTimeCredential, setOneTimeCredential] = useState<OneTimeCredential | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>({ email: "", name: "", workspaceName: "", role: "user", status: "invited", agentIds: [] });

  async function loadAccess() {
    try {
      setError(null);
      const next = await adminRequest<AccessResponse>("/api/admin/access");
      setAccess(next);
      setRoleAgentAssignments({
        admin: next.role_agent_assignments?.admin?.agent_ids ?? [],
        user: next.role_agent_assignments?.user?.agent_ids ?? [],
        viewer: next.role_agent_assignments?.viewer?.agent_ids ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users and access");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccess();
  }, []);

  const availableAgentTemplates = access?.agent_templates ?? [];
  const assignableAgentTemplates = availableAgentTemplates.filter((agent) => agent.assignment_policy?.assignable_to_users);

  const filteredUsers = (access?.users ?? []).filter((user) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [user.email, user.name, user.role, user.status, user.workspace?.name, user.workspace?.slug, user.hermes_profile?.profile_name, user.hermes_profile?.display_name, user.runtime?.container_name, user.runtime?.status].some((value) => String(value ?? "").toLowerCase().includes(q));
  });



  async function createUser() {
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    try {
      setError(null);
      setNotice(null);
      setOneTimeCredential(null);
      setCopyStatus(null);
      setCreating(true);
      const result = await adminRequest<OneTimeCredentialResponse>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: form.email, name: form.name, role: form.role, status: form.status, workspace_name: form.workspaceName, agent_ids: form.agentIds }),
      });
      setForm({ email: "", name: "", workspaceName: "", role: "user", status: "invited", agentIds: [] });
      setAddDrawerOpen(false);
      if (result.temporary_password) {
        setOneTimeCredential({ kind: "invite", email: result.user.email, password: result.temporary_password, createdAt: Date.now() });
      }
      setNotice(`Invited ${result.user.email} (${result.user.lifecycle?.label ?? result.user.status}). ${result.assigned_agent_ids?.length ?? 0} direct Workspace agents assigned. ${result.temporary_password ? "Temporary password is shown in the display-once panel below; no email was sent." : ""}`.trim());
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
    } finally {
      setCreating(false);
    }
  }

  function confirmStatusTransition(user: AccessUser, nextStatus: unknown): boolean {
    if (typeof nextStatus !== "string" || nextStatus === user.status) return true;
    if (nextStatus === "disabled") {
      return window.confirm(`Disable ${user.email}? This immediately denies login, existing sessions, workspace mutations, and runtime actions. User data, profile, and runtime records are retained.`);
    }
    if (user.status === "disabled" && nextStatus === "active") {
      return window.confirm(`Re-enable ${user.email}? The user will need to authenticate again before workspace/runtime access resumes.`);
    }
    return true;
  }

  async function updateUser(user: AccessUser, payload: Record<string, unknown>) {
    if (!confirmStatusTransition(user, payload.status)) return;
    try {
      setError(null);
      setNotice(null);
      setOneTimeCredential(null);
      setCopyStatus(null);
      const result = await adminRequest<OneTimeCredentialResponse>(`/api/admin/users/${encodeURIComponent(user.id)}/action`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (result.temporary_password) {
        setOneTimeCredential({ kind: "reset", email: result.user.email, password: result.temporary_password, createdAt: Date.now() });
      }
      setNotice(result.temporary_password ? `Reset password for ${result.user.email}. Temporary password is shown in the display-once panel below.` : `Updated ${result.user.email}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    }
  }

  function openEditDrawer(user: AccessUser) {
    setError(null);
    setNotice(null);
    setEditingUser(user);
    setUserAuditEvents([]);
    void loadUserAudit(user);
    setEditForm({
      name: user.name || user.email,
      role: (user.role === "admin" || user.role === "viewer" || user.role === "user" ? user.role : "user") as AccessRole,
      status: (user.status === "disabled" || user.status === "invited" || user.status === "pending" ? user.status : "active") as AccessStatus,
      resetPassword: false,
      disabledReason: user.disabled_reason ?? "",
    });
    setAssignedAgentIds(user.agent_access?.assigned_agent_ids ?? []);
  }

  async function loadUserAudit(user: AccessUser) {
    try {
      setUserAuditLoading(true);
      const params = new URLSearchParams({ resource_id: user.id });
      const result = await adminRequest<AccessAuditResponse>(`/api/audit/events?${params.toString()}`);
      setUserAuditEvents(result.events ?? []);
    } catch (err) {
      setUserAuditEvents([]);
      setError(err instanceof Error ? err.message : "Unable to load user lifecycle audit evidence");
    } finally {
      setUserAuditLoading(false);
    }
  }

  async function saveEditUser() {
    if (!editingUser) return;
    try {
      setError(null);
      setNotice(null);
      setSavingEdit(true);
      const payload: Record<string, unknown> = {
        name: editForm.name,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.status === "disabled" || editForm.disabledReason !== (editingUser.disabled_reason ?? "")) {
        payload.disabledReason = editForm.disabledReason;
        payload.disabled_reason = editForm.disabledReason;
      }
      if (editForm.resetPassword) payload.resetPassword = true;
      if (!confirmStatusTransition(editingUser, payload.status)) return;
      const result = await adminRequest<OneTimeCredentialResponse>(`/api/admin/users/${encodeURIComponent(editingUser.id)}/action`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await adminRequest<{ ok: boolean; user: AccessUser; assigned_agent_ids: string[] }>(`/api/admin/users/${encodeURIComponent(editingUser.id)}/agents/action`, {
        method: "POST",
        body: JSON.stringify({ agent_ids: assignedAgentIds }),
      });
      setEditingUser(null);
      setEditForm({ name: "", role: "user", status: "active", resetPassword: false, disabledReason: "" });
      setAssignedAgentIds([]);
      if (result.temporary_password) {
        setOneTimeCredential({ kind: "reset", email: result.user.email, password: result.temporary_password, createdAt: Date.now() });
      }
      setNotice(result.temporary_password ? `Updated ${result.user.email}. New temporary password is shown in the display-once panel below. Assigned ${assignedAgentIds.length} direct agents.` : `Updated ${result.user.email}. Assigned ${assignedAgentIds.length} direct agents.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveRoleAgents(role: AccessRole) {
    try {
      setError(null);
      setNotice(null);
      const agent_ids = roleAgentAssignments[role] ?? [];
      await adminRequest<{ ok: boolean; role: AccessRole; assigned_agent_ids: string[] }>(`/api/admin/roles/${encodeURIComponent(role)}/agents/action`, {
        method: "POST",
        body: JSON.stringify({ agent_ids }),
      });
      setNotice(`Saved ${agent_ids.length} Workspace role assignments for ${role}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save role assignments");
    }
  }

  function toggleRoleAgent(role: AccessRole, agentId: string, checked: boolean) {
    setRoleAgentAssignments((current) => {
      const existing = current[role] ?? [];
      return { ...current, [role]: checked ? Array.from(new Set([...existing, agentId])) : existing.filter((id) => id !== agentId) };
    });
  }

  async function copyOneTimeCredential() {
    if (!oneTimeCredential) return;
    try {
      await navigator.clipboard.writeText(oneTimeCredential.password);
      setCopyStatus("Copied. Hand it off now; Mission Control will not show it again after dismissal or refresh.");
    } catch {
      setCopyStatus("Copy failed. Select the password text manually, then dismiss this panel.");
    }
  }

  function dismissOneTimeCredential() {
    setOneTimeCredential(null);
    setCopyStatus(null);
  }


  return (
    <section className="users-access-panel" aria-label="Users and access management">
      <div className="access-title-actions" aria-label="User Access actions">
        <button className="task-icon-action primary" aria-label="Add user" title="Add user" onClick={() => setAddDrawerOpen(true)}><Icon name="plus" size={18} /></button>
        <button className="task-icon-action dark" aria-label="Refresh users and access" title="Refresh users and access" onClick={() => void loadAccess()}><Icon name="refresh" size={18} /></button>
      </div>

      {error && <div className="skills-error">{error}</div>}
      {notice && <div className="access-secret-notice" role="status">{notice}</div>}

      {oneTimeCredential && (
        <article className="access-one-time-credential" aria-label="Display-once temporary password" role="status">
          <div className="access-one-time-head">
            <div>
              <span className="stub-tag">DISPLAY ONCE</span>
              <h2>{oneTimeCredential.kind === "invite" ? "New user temporary password" : "Reset temporary password"}</h2>
              <p>Copy this password now and hand it off securely. Mission Control does not store the plaintext password and it will disappear after dismissal or refresh.</p>
            </div>
            <button className="mc-drawer-close" type="button" aria-label="Dismiss display-once password" onClick={dismissOneTimeCredential}>×</button>
          </div>
          <div className="access-one-time-grid">
            <label>
              <span>Email</span>
              <input readOnly aria-readonly="true" value={oneTimeCredential.email} />
            </label>
            <label>
              <span>Temporary password</span>
              <input className="access-one-time-password" readOnly aria-readonly="true" value={oneTimeCredential.password} onFocus={(event) => event.currentTarget.select()} />
            </label>
          </div>
          <div className="access-one-time-actions">
            <button className="btn dark" type="button" onClick={() => void copyOneTimeCredential()}>Copy password</button>
            <button className="btn ghost" type="button" onClick={dismissOneTimeCredential}>Dismiss permanently</button>
          </div>
          <p className="access-one-time-warning">Sensitive: do not paste this password into notes, screenshots, Kanban comments, logs, or browser storage. It is present only in this React state for this response.</p>
          {copyStatus && <p className="access-one-time-copy" aria-live="polite">{copyStatus}</p>}
        </article>
      )}

      <div className="users-access-layout">
        <article className="router-panel access-users-card">
          <div className="section-head compact access-users-head">
            <div>
              <h2>Current access</h2>
              <p>{loading ? "Loading users…" : `${filteredUsers.length} shown · ${access?.summary.total_users ?? 0} total accounts`}</p>
            </div>
            <input className="access-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, role, profile…" />
          </div>
          <div className="access-policy-grid access-summary-grid" aria-label="User access summary">
            <div><b>{access?.summary.total_users ?? "—"} total</b><span>{access?.summary.active ?? 0} active · {access?.summary.invited ?? 0} invited · {access?.summary.disabled ?? 0} disabled</span></div>
            <div><b>{access?.summary.admins ?? "—"} admins</b><span>{access?.summary.profiles ?? 0} profiles · {access?.summary.running_runtimes ?? 0}/{access?.summary.runtimes ?? 0} runtimes running</span></div>
            <div><b>Disabled enforcement</b><span>{access?.policy.disabled_user_enforcement ?? "login, sessions, runtime, and workspace writes require active users"}</span></div>
          </div>
          <div className="access-user-list">
            {filteredUsers.map((user) => (
              <div className="access-user-row" key={user.id} role="button" tabIndex={0} aria-label={`Edit ${user.email}`} onClick={() => openEditDrawer(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditDrawer(user); } }}>
                <div className="access-user-main">
                  <strong>{user.name || user.email}</strong>
                  <span>{user.email}</span>
                  <small>{user.hermes_profile?.profile_name ?? "No profile"} · {user.runtime?.container_name ?? "No container"} · {user.runtime?.status ?? "runtime pending"}</small>
                  <small>{user.agent_access?.count ?? 0} effective agents: {(user.agent_access?.assigned_agents ?? []).map((agent) => `${agent.name} (${agent.access_source_label || "effective access source"})`).join(", ") || "none"}</small>
                  <small>Direct user assignment count: {user.agent_access?.assigned_agent_ids?.length ?? 0} · Role assignment count: {user.agent_access?.role_agent_ids?.length ?? 0}</small>
                  <small><span className={`access-lifecycle-badge ${user.lifecycle?.state ?? user.status}`}>{user.lifecycle?.label ?? user.status}</span> · Last login {formatDate(user.last_login_at)} · Can login: {user.lifecycle?.can_login ? "yes" : "no"}</small>
                  {user.status === "disabled" && <small>Disabled {formatDate(user.disabled_at ?? user.status_updated_at)}{user.disabled_by ? ` by ${user.disabled_by}` : ""}{user.disabled_reason ? ` · Reason: ${user.disabled_reason}` : ""}</small>}
                  {user.runtime?.last_error && <small title={user.runtime.last_error}>Runtime note: {user.runtime.last_error}</small>}
                </div>
                <div className="access-user-activity">
                  <span>{user.activity?.projects ?? 0} projects</span>
                  <span>{user.activity?.tasks ?? 0} tasks</span>
                  <span>{user.activity?.inbox ?? 0} approvals</span>
                </div>
                <select aria-label={`Role for ${user.email}`} value={user.role} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => void updateUser(user, { role: event.target.value })}>
                  <option value="admin">admin</option><option value="user">user</option><option value="viewer">viewer</option>
                </select>
                <select aria-label={`Status for ${user.email}`} value={user.status} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => void updateUser(user, { status: event.target.value })}>
                  <option value="invited">invited</option><option value="pending">pending</option><option value="active">active</option><option value="disabled">disabled</option>
                </select>
                <div className="access-user-actions" onClick={(event) => event.stopPropagation()}>
                  <button className="btn ghost small" onClick={() => openEditDrawer(user)}><Icon name="edit" size={14} /> Edit</button>
                  <button className="btn ghost small" onClick={() => void updateUser(user, { resetPassword: true })}>Reset password</button>
                </div>
              </div>
            ))}
            {!loading && filteredUsers.length === 0 && <div className="mc-empty inline"><h3>No matching users</h3><p>Try another search or create a new account.</p></div>}
          </div>
        </article>
      </div>

      <article className="router-panel access-policy-card">
        <h2>Workspace role assignments</h2>
        <p>Effective Workspace agents are the union of direct user assignments and Role assignment grants. Assign Workspace agent templates by role so effective access follows workspace membership policy. Direct user grants still override only that user's checkbox list. Role assignment: user is the default grant path for normal operators.</p>
        <div className="role-agent-assignment-grid" aria-label="Workspace role assignments">
          {(["admin", "user", "viewer"] as AccessRole[]).map((role) => (
            <div className="agent-assignment-box" key={role}>
              <div>
                <span className="stub-tag">ROLE ASSIGNMENT</span>
                <h3>{role}</h3>
                <p>{(roleAgentAssignments[role] ?? []).length} Workspace agents granted by Role assignment: {role}</p>
              </div>
              <div className="agent-assignment-list">
                {assignableAgentTemplates.map((agent) => (
                  <label className="agent-assignment-row" key={`${role}-${agent.id}`}>
                    <input type="checkbox" checked={(roleAgentAssignments[role] ?? []).includes(agent.id)} onChange={(event) => toggleRoleAgent(role, agent.id, event.target.checked)} />
                    <span><b>{agent.name}</b><small>{agent.category} · {agent.description}</small></span>
                  </label>
                ))}
              </div>
              <button className="btn dark" type="button" onClick={() => void saveRoleAgents(role)}>Save {role} agents</button>
            </div>
          ))}
        </div>
      </article>

      <article className="router-panel access-policy-card">
        <h2>Access policy boundary</h2>
        <div className="access-policy-grid">
          <div><b>Roles</b><span>admin manages platform settings; user operates their own Hermes profile agents; viewer is read-only.</span></div>
          <div><b>Runtime isolation</b><span>Every user receives a server-provisioned Docker container with their own Hermes home and profile; the browser never submits filesystem paths.</span></div>
          <div><b>Passwords</b><span>Temporary passwords are returned once in this browser response and are not stored in plaintext.</span></div>
          <div><b>Disabled enforcement</b><span>{access?.policy.disabled_user_enforcement ?? "Disabled users cannot login, keep sessions, mutate workspaces, or invoke runtime access."}</span></div>
          <div><b>Disable cleanup policy</b><span>{access?.policy.disabled_user_runtime_cleanup?.runtime_policy ?? "Disable is non-destructive: profile, runtime, and user data are retained for audit and re-enable."}</span></div>
          <div><b>Re-enable policy</b><span>{access?.policy.disabled_user_runtime_cleanup?.reenable_policy ?? "Re-enabled users must authenticate again before runtime provisioning resumes."}</span></div>
        </div>
      </article>

      {addDrawerOpen && (
        <div className="mc-drawer-layer access-add-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close add user drawer" onClick={() => setAddDrawerOpen(false)} />
          <aside className="mc-drawer mc-drawer-narrow access-add-drawer" aria-label="Add user drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title">
                <span className="stub-tag">ACCOUNT ADMIN</span>
                <h2>Invite user</h2>
                <p>Create a pending Mission Control login and server-managed Hermes profile. Mission Control generates display-once temporary credentials locally; no email is sent in this flow.</p>
              </div>
              <button className="mc-drawer-close" aria-label="Close add user drawer" onClick={() => setAddDrawerOpen(false)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void createUser(); }}>
                <label><span>Email</span><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="operator@example.com" autoFocus /></label>
                <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Operator name" /></label>
                <label><span>Workspace</span><input value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} placeholder="Blank = Name Workspace" /></label>
                <label><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccessRole })}><option value="user">User</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
                <label><span>Lifecycle state</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AccessStatus })}><option value="invited">Invited / pending activation</option><option value="pending">Pending</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
                <div className="agent-assignment-box">
                  <div>
                    <span className="stub-tag">WORKSPACE AGENTS</span>
                    <p>Optional direct Workspace agent grants for this invited user. Effective access will also include role assignments for {form.role}.</p>
                  </div>
                  <div className="agent-assignment-list">
                    {assignableAgentTemplates.map((agent) => (
                      <label className="agent-assignment-row" key={`invite-${agent.id}`}>
                        <input
                          type="checkbox"
                          checked={form.agentIds.includes(agent.id)}
                          onChange={(event) => setForm((current) => ({ ...current, agentIds: event.target.checked ? Array.from(new Set([...current.agentIds, agent.id])) : current.agentIds.filter((id) => id !== agent.id) }))}
                        />
                        <span><b>{agent.name}</b><AgentClassBadge agent={agent} /><small>{agent.category} · {agent.description}</small><AgentAssignmentPolicyNote agent={agent} /></span>
                      </label>
                    ))}
                    {assignableAgentTemplates.length === 0 && <p>No active assignable Workspace agent templates available.</p>}
                  </div>
                </div>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setAddDrawerOpen(false)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={creating}>{creating ? "Inviting…" : "Invite user"}</button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}

      {editingUser && (
        <div className="mc-drawer-layer access-edit-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close edit user drawer" onClick={() => setEditingUser(null)} />
          <aside className="mc-drawer mc-drawer-narrow access-edit-drawer" aria-label="Edit user drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title">
                <span className="stub-tag">ACCOUNT ADMIN</span>
                <h2>Edit user</h2>
                <p>{editingUser.email}</p>
              </div>
              <button className="mc-drawer-close" aria-label="Close edit user drawer" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void saveEditUser(); }}>
                <label><span>Email</span><input value={editingUser.email} readOnly aria-readonly="true" /></label>
                <label><span>Name</span><input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} placeholder="Operator name" autoFocus /></label>
                <label><span>Role</span><select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as AccessRole })}><option value="user">User</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
                <label><span>Status</span><select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as AccessStatus })}><option value="invited">Invited / pending activation</option><option value="pending">Pending</option><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
                {(editForm.status === "disabled" || editingUser.disabled_reason) && (
                  <label>
                    <span>Disabled reason / audit note</span>
                    <textarea value={editForm.disabledReason} maxLength={240} onChange={(event) => setEditForm({ ...editForm, disabledReason: event.target.value })} placeholder="Optional reason visible only to admins" />
                  </label>
                )}
                {editingUser.status === "disabled" && <p className="agent-assignment-boundary-copy">Disabled {formatDate(editingUser.disabled_at ?? editingUser.status_updated_at)}{editingUser.disabled_by ? ` by ${editingUser.disabled_by}` : ""}. Runtime policy: {editingUser.runtime_cleanup_policy?.runtime_policy ?? access?.policy.disabled_user_runtime_cleanup?.runtime_policy ?? "data retained; access denied until re-enabled."}</p>}
                <label className="access-reset-check"><input type="checkbox" checked={editForm.resetPassword} onChange={(event) => setEditForm({ ...editForm, resetPassword: event.target.checked })} /><span>Generate a new display-once temporary password</span></label>
                <div className="agent-assignment-box">
                  <div>
                    <span className="stub-tag">ASSIGNED AGENTS</span>
                    <p>Direct user assignments. Effective Workspace agents also include Role assignment grants shown below on the roster.</p>
                  </div>
                  <div className="agent-assignment-list">
                    <p className="agent-assignment-boundary-copy">Workspace agents can be assigned to users or roles. Platform agents are Admin-only and do not appear in normal-user assignment controls.</p>
                    {assignableAgentTemplates.map((agent) => (
                      <label className="agent-assignment-row" key={agent.id}>
                        <input
                          type="checkbox"
                          checked={assignedAgentIds.includes(agent.id)}
                          onChange={(event) => setAssignedAgentIds((current) => event.target.checked ? [...current, agent.id] : current.filter((id) => id !== agent.id))}
                        />
                        <span><b>{agent.name}</b><AgentClassBadge agent={agent} /><small>{agent.category} · {agent.description}</small><AgentAssignmentPolicyNote agent={agent} /></span>
                      </label>
                    ))}
                    {assignableAgentTemplates.length === 0 && <p>No active assignable Workspace agent templates available.</p>}
                  </div>
                </div>
                <div className="agent-assignment-box access-audit-evidence-box">
                  <div className="section-head compact">
                    <div>
                      <span className="stub-tag">LIFECYCLE EVIDENCE</span>
                      <h3>Recent access audit events</h3>
                      <p>Durable evidence for invite, reset, enable/disable, role, workspace, and agent-assignment changes. Generated credentials are redacted before storage.</p>
                    </div>
                    <button className="btn ghost small" type="button" onClick={() => setView("audit")}>Open Audit Log</button>
                  </div>
                  {userAuditLoading && <p>Loading lifecycle evidence…</p>}
                  {!userAuditLoading && userAuditEvents.length === 0 && <p>No lifecycle audit events recorded for this user yet.</p>}
                  <div className="access-audit-event-list">
                    {userAuditEvents.slice(0, 6).map((event) => {
                      const changeKeys = Object.keys(event.evidence?.changes ?? {}).filter((key) => !["before", "after"].includes(key));
                      return (
                        <div className="access-audit-event-row" key={event.id}>
                          <div>
                            <b>{event.action.replace(/_/g, " ")}</b>
                            <small>{event.evidence?.occurred_at_sgt ?? formatDate(event.created_at)} · actor {event.evidence?.actor?.email ?? event.actor_id ?? "system"}</small>
                            <small>Result: {event.evidence?.result ?? "recorded"}{changeKeys.length ? ` · Changes: ${changeKeys.join(", ")}` : ""}</small>
                            <small>Correlation: {event.evidence?.correlation_id ?? event.id}</small>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setEditingUser(null)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={savingEdit}>{savingEdit ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}


function PlatformAdminPanel() {
  const [platform, setPlatform] = useState<PlatformResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPlatform() {
    try {
      setError(null);
      const next = await adminRequest<PlatformResponse>("/api/admin/agent-platform");
      setPlatform(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agent platform policy");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPlatform(); }, []);

  return (
    <section className="admin-live-panel" aria-label="Live agent platform governance">
      <article className="router-panel">
        <div className="section-head compact">
          <div>
            <h2>Live platform boundary</h2>
            <p>{loading ? "Loading policy evidence…" : "Admin governs shared capabilities; users operate their own AI Workforce inside their Hermes profile/runtime."}</p>
          </div>
          <button className="task-icon-action dark" aria-label="Refresh agent platform" title="Refresh agent platform" onClick={() => void loadPlatform()}><Icon name="refresh" size={18} /></button>
        </div>
        {error && <div className="skills-error">{error}</div>}
        <div className="access-policy-grid">
          <div><b>{platform?.summary.users ?? "—"} users</b><span>{platform?.summary.profiles ?? "—"} Hermes profiles · {platform?.summary.running_runtimes ?? 0}/{platform?.summary.runtimes ?? 0} runtimes running</span></div>
          <div><b>{platform?.summary.active_templates ?? "—"} active templates</b><span>{platform?.summary.selected_templates ?? 0} user selections · {platform?.summary.assigned_templates ?? 0} project assignments</span></div>
          <div><b>Runtime statuses</b><span>{platform ? Object.entries(platform.runtime_statuses).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No runtimes" : "Loading…"}</span></div>
        </div>
        <div className="agent-class-summary-head">
          <h3>Agent classes</h3>
          <p>Class controls decide whether an agent is Admin-only, assignable to workspace users/roles, or personal to one owner.</p>
        </div>
        <div className="access-policy-grid agent-class-summary" aria-label="Agent classes">
          {(["platform", "workspace", "personal"] as AgentClass[]).map((agentClass) => {
            const item = platform?.agent_class_summary?.[agentClass];
            return (
              <div key={agentClass}>
                <b>{item?.label ?? agentClassLabel(agentClass)}</b>
                <span>{item?.count ?? 0} registered · {item?.assignable_to_users ? "assignable to users/roles" : "not assignable to normal users"}</span>
              </div>
            );
          })}
        </div>
      </article>

      <div className="admin-setup-grid live-admin-grid">
        <section className="admin-setup-main">
          <article className="router-panel admin-setup-section">
            <div className="section-head"><div><h2>Policy domains</h2><p>These are the platform-level controls that shape what user-owned agents may do. Platform agents are internal Mission Control operators; Workspace agents are the assignable digital coworkers users see in their own runtime.</p></div></div>
            <div className="admin-setup-cards">
              {(platform?.policy_domains ?? []).map((domain) => (
                <div className="admin-setup-card" key={domain.id}>
                  <div><h3>{domain.label}</h3><p>{domain.detail}</p></div>
                  <span className={`tag ${domain.status === "live" ? "good" : domain.status === "draft" ? "warn" : "muted"}`}>{domain.status}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
        <aside className="admin-setup-side">
          <article className="router-panel">
            <div className="section-head compact"><div><h2>Guardrails</h2><p>Boundary rules enforced by routing and permissions.</p></div></div>
            <div className="drawer-section-list">
              {(platform?.guardrails ?? []).map((item) => <div className="kv" key={item}><span>Rule</span><b>{item}</b></div>)}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

const emptyTemplateForm: TemplateFormState = { id: "", name: "", description: "", category: "general", capabilities: "", shared_agent_ref: "", status: "active" };

function formFromTemplate(template: SharedAgentTemplate): TemplateFormState {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category || "general",
    capabilities: (template.capabilities ?? []).join(", "),
    shared_agent_ref: template.shared_agent_ref || template.id,
    status: template.status || "active",
  };
}

function SharedAgentTemplatesPanel() {
  const [data, setData] = useState<TemplateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SharedAgentTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);

  async function loadTemplates() {
    try {
      setError(null);
      const next = await adminRequest<TemplateResponse>("/api/admin/agent-templates");
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load shared agent templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadTemplates(); }, []);

  const templates = (data?.templates ?? []).filter((template) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [template.id, template.name, template.description, template.category, template.status, template.shared_agent_ref, ...(template.capabilities ?? [])].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyTemplateForm);
    setNotice(null);
    setError(null);
    setDrawerOpen(true);
  }

  function openEdit(template: SharedAgentTemplate) {
    setEditing(template);
    setForm(formFromTemplate(template));
    setNotice(null);
    setError(null);
    setDrawerOpen(true);
  }

  async function saveTemplate() {
    if (!form.name.trim()) { setError("Template name is required."); return; }
    try {
      setSaving(true);
      setError(null);
      setNotice(null);
      const payload = { ...form, capabilities: form.capabilities.split(/[,\n|]+/).map((item) => item.trim()).filter(Boolean) };
      const path = editing ? `/api/admin/agent-templates/${encodeURIComponent(editing.id)}/action` : "/api/admin/agent-templates";
      const result = await adminRequest<{ ok: boolean; template: SharedAgentTemplate }>(path, { method: "POST", body: JSON.stringify(payload) });
      setDrawerOpen(false);
      setEditing(null);
      setForm(emptyTemplateForm);
      setNotice(`${editing ? "Updated" : "Created"} ${result.template.name}.`);
      await loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="shared-template-panel" aria-label="Shared agent template management">
      <article className="router-panel access-toolbar">
        <div>
          <h2>Template registry</h2>
          <p>Admin-managed blueprints that users can select into their own AI Workforce. Editing a template does not overwrite user-owned agent SOUL.md files.</p>
        </div>
        <div className="access-toolbar-actions">
          <button className="task-icon-action primary" aria-label="Add shared agent template" title="Add template" onClick={openCreate}><Icon name="plus" size={18} /></button>
          <button className="task-icon-action dark" aria-label="Refresh shared agent templates" title="Refresh templates" onClick={() => void loadTemplates()}><Icon name="refresh" size={18} /></button>
        </div>
      </article>

      {error && <div className="skills-error">{error}</div>}
      {notice && <div className="access-secret-notice" role="status">{notice}</div>}

      <div className="access-policy-grid">
        <div><b>{data?.summary.total ?? "—"} templates</b><span>{data?.summary.active ?? 0} active · {data?.summary.archived ?? 0} archived/disabled</span></div>
        <div><b>{data?.summary.selected ?? 0} selections</b><span>User workspace preferences using shared templates</span></div>
        <div><b>{data?.summary.assigned ?? 0} assignments</b><span>Project-level agent assignments</span></div>
      </div>

      <article className="router-panel access-users-card">
        <div className="section-head compact access-users-head">
          <div><h2>Shared templates</h2><p>{loading ? "Loading templates…" : `${templates.length} shown · ${data?.summary.total ?? 0} total`}</p></div>
          <input className="access-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search template, capability…" />
        </div>
        <div className="access-user-list">
          {templates.map((template) => (
            <div className="access-user-row" key={template.id} role="button" tabIndex={0} aria-label={`Edit ${template.name}`} onClick={() => openEdit(template)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEdit(template); } }}>
              <div className="access-user-main">
                <strong>{template.name}</strong>
                <span>{template.id} · {template.category} · shared ref {template.shared_agent_ref}</span>
                <AgentClassBadge agent={template} />
                <small>{template.description || "No description yet."}</small>
                <AgentAssignmentPolicyNote agent={template} />
                <small>{(template.capabilities ?? []).join(" · ") || "No capabilities listed"}</small>
              </div>
              <div className="access-user-activity">
                <span>{template.selected_count ?? 0} selected</span>
                <span>{template.assignment_count ?? 0} assigned</span>
                <span>{template.management_scope ?? "global-admin"}</span>
              </div>
              <select aria-label={`Status for ${template.name}`} value={template.status} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onChange={(event) => { event.stopPropagation(); void adminRequest(`/api/admin/agent-templates/${encodeURIComponent(template.id)}/action`, { method: "POST", body: JSON.stringify({ ...formFromTemplate(template), status: event.target.value }) }).then(() => loadTemplates()).catch((err) => setError(err instanceof Error ? err.message : "Unable to update status")); }}>
                <option value="active">active</option><option value="archived">archived</option><option value="disabled">disabled</option>
              </select>
              <div className="access-user-actions" onClick={(event) => event.stopPropagation()}><button className="btn ghost small" onClick={() => openEdit(template)}><Icon name="edit" size={14} /> Edit</button></div>
            </div>
          ))}
          {!loading && templates.length === 0 && <div className="mc-empty inline"><h3>No matching templates</h3><p>Create a shared blueprint or change the search.</p></div>}
        </div>
      </article>

      <article className="router-panel access-policy-card">
        <h2>Template boundary</h2>
        <div className="access-policy-grid">
          <div><b>Admin scope</b><span>Create, update, archive, and govern reusable shared definitions.</span></div>
          <div><b>User scope</b><span>Select templates and personalize their own workspace agent identity.</span></div>
          <div><b>No destructive delete</b><span>Archive/disable templates to preserve audit evidence and existing assignments.</span></div>
        </div>
      </article>

      {drawerOpen && (
        <div className="mc-drawer-layer access-edit-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close template drawer" onClick={() => setDrawerOpen(false)} />
          <aside className="mc-drawer mc-drawer-narrow access-edit-drawer" aria-label="Shared agent template drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title"><span className="stub-tag">TEMPLATE ADMIN</span><h2>{editing ? "Edit template" : "Add template"}</h2><p>Shared blueprint only; user-owned SOUL.md identity remains separate.</p></div>
              <button className="mc-drawer-close" aria-label="Close template drawer" onClick={() => setDrawerOpen(false)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}>
                <label><span>Template ID</span><input value={form.id} readOnly={Boolean(editing)} aria-readonly={Boolean(editing)} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="linkedin-growth" autoFocus={!editing} /></label>
                <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="LinkedIn Growth" autoFocus={Boolean(editing)} /></label>
                <label><span>Description</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} /></label>
                <label><span>Category</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="growth" /></label>
                <label><span>Capabilities</span><textarea value={form.capabilities} onChange={(event) => setForm({ ...form, capabilities: event.target.value })} rows={3} placeholder="research, outreach, approvals" /></label>
                <label><span>Shared profile ref</span><input value={form.shared_agent_ref} onChange={(event) => setForm({ ...form, shared_agent_ref: event.target.value })} placeholder="Optional Hermes profile ref" /></label>
                <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="archived">Archived</option><option value="disabled">Disabled</option></select></label>
                <div className="access-drawer-actions"><button className="btn ghost" type="button" onClick={() => setDrawerOpen(false)}>Cancel</button><button className="btn dark" type="submit" disabled={saving}>{saving ? "Saving…" : "Save template"}</button></div>
              </form>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function WorkspaceRuntimeConsolePanel() {
  const { setView } = useStore();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [mode, setMode] = useState<RuntimeConsoleMode>("supervise");
  const [consoleData, setConsoleData] = useState<RuntimeConsolePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impersonationReason, setImpersonationReason] = useState("");
  const [actionResult, setActionResult] = useState<RuntimeConsoleActionResponse | null>(null);

  useEffect(() => {
    let alive = true;
    adminRequest<AccessResponse>("/api/admin/access")
      .then((data) => {
        if (!alive) return;
        setUsers(data.users ?? []);
        const firstWorkspace = (data.users ?? []).find((user) => user.workspace?.id)?.workspace?.id ?? "";
        setSelectedWorkspaceId((current) => current || firstWorkspace);
      })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Unable to load workspaces"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedWorkspaceId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    adminRequest<RuntimeConsolePayload>(`/api/admin/workspaces/${encodeURIComponent(selectedWorkspaceId)}/runtime-console?mode=${encodeURIComponent(mode)}`)
      .then((data) => { if (alive) setConsoleData(data); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : "Unable to load runtime console"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedWorkspaceId, mode]);

  async function submitImpersonation() {
    const mode_action = "admin_workspace_runtime_impersonation";
    if (!selectedWorkspaceId || !impersonationReason.trim()) return;
    try {
      setError(null);
      const result = await adminRequest<RuntimeConsoleActionResponse>(`/api/admin/workspaces/${encodeURIComponent(selectedWorkspaceId)}/runtime-console/action`, {
        method: "POST",
        body: JSON.stringify({ mode: "impersonate", action: "open_context", mode_action, reason: impersonationReason.trim() }),
      });
      setActionResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start audited impersonation");
    }
  }

  const selectedUser = users.find((user) => user.workspace?.id === selectedWorkspaceId);
  const modes: { id: RuntimeConsoleMode; label: string; body: string }[] = [
    { id: "supervise", label: "Mode: Supervise", body: "Runtime health, profile, assigned Workspace agents, Personal agent policy summary, audit/log links." },
    { id: "manage", label: "Mode: Manage", body: "Safe Admin controls implemented so far; destructive runtime operations stay out of scope." },
    { id: "impersonate", label: "Mode: Impersonate / operate as user", body: "Explicit support mode only. This is visually obvious and audit logged before any user-context action." },
  ];

  return (
    <section className="admin-live-section workspace-runtime-console" aria-label="Workspace Runtime Console">
      <article className="router-panel access-policy-card">
        <div className="section-head compact">
          <div>
            <h2>Workspace runtime selector</h2>
            <p>Supervise mode does not expose private user chat or memory by default.</p>
          </div>
          <button className="btn ghost small" onClick={() => setView("users-workspaces")}>Open User Access</button>
        </div>
        {error && <div className="skills-error">{error}</div>}
        <div className="access-create-form">
          <label>
            <span>Workspace / runtime</span>
            <select aria-label="Select workspace runtime" value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value)}>
              <option value="">Select workspace runtime</option>
              {users.filter((user) => user.workspace?.id).map((user) => (
                <option key={user.workspace!.id} value={user.workspace!.id}>{user.workspace!.name} · {user.email}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-setup-cards" role="radiogroup" aria-label="Runtime supervision mode">
          {modes.map((item) => (
            <button key={item.id} type="button" className={"admin-setup-card mode-card" + (mode === item.id ? " selected" : "")} aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
              <div><h3>{item.label}</h3><p>{item.body}</p></div>
            </button>
          ))}
        </div>
      </article>

      <div className="desktop-target-grid">
        <article className="desktop-target-card">
          <h3>Runtime health</h3>
          <div className="kv"><span>Owner</span><b>{selectedUser?.email ?? consoleData?.owner_user?.email ?? "—"}</b></div>
          <div className="kv"><span>Status</span><b>{loading ? "Loading…" : consoleData?.runtime_status?.status ?? consoleData?.runtime?.status ?? "unknown"}</b></div>
          <div className="kv"><span>Container</span><b>{consoleData?.runtime_status?.container_name ?? consoleData?.runtime?.container_name ?? "—"}</b></div>
          <div className="kv"><span>Kind</span><b>{consoleData?.runtime_status?.kind ?? consoleData?.runtime?.kind ?? "—"}</b></div>
        </article>
        <article className="desktop-target-card">
          <h3>Hermes profile</h3>
          <div className="kv"><span>Profile</span><b>{consoleData?.hermes_profile?.profile_name ?? "—"}</b></div>
          <div className="kv"><span>Display</span><b>{consoleData?.hermes_profile?.display_name ?? "—"}</b></div>
          <div className="kv"><span>Status</span><b>{consoleData?.hermes_profile?.status ?? "—"}</b></div>
        </article>
        <article className="desktop-target-card">
          <h3>Assigned Workspace agents</h3>
          {(consoleData?.assigned_workspace_agents ?? []).map((agent) => <span className="tag good" key={agent.id}>{agent.name}</span>)}
          {!(consoleData?.assigned_workspace_agents ?? []).length && <p>No Workspace agents assigned.</p>}
        </article>
        <article className="desktop-target-card">
          <h3>Personal agent policy summary</h3>
          <p>{consoleData?.personal_agent_policy?.policy_summary ?? "Personal agent metadata is hidden until a user requests company access or promotion."}</p>
          <div className="kv"><span>Count</span><b>{consoleData?.personal_agent_policy?.count ?? 0}</b></div>
          <div className="kv"><span>Visibility</span><b>{consoleData?.personal_agent_policy?.visibility ?? "metadata-only"}</b></div>
        </article>
      </div>

      {mode === "manage" && (
        <article className="router-panel access-policy-card">
          <h2>Safe Admin controls</h2>
          <div className="admin-setup-cards">
            {(consoleData?.manage_controls ?? []).map((control) => <div className="admin-setup-card" key={control.id}><h3>{control.label}</h3><p>{control.description}</p><span className="tag good">safe</span></div>)}
          </div>
        </article>
      )}

      {mode === "impersonate" && (
        <article className="router-panel access-policy-card admin-runtime-console-impersonation-warning">
          <div className="section-head compact"><div><h2>Reason for impersonation</h2><p>This is visually obvious and audit logged before any user-context action.</p></div></div>
          <p>{consoleData?.impersonation?.warning ?? "You are about to operate as a user from Admin mode."}</p>
          <label><span>Reason required before operating as the user</span><textarea value={impersonationReason} onChange={(event) => setImpersonationReason(event.target.value)} rows={3} placeholder="Support ticket, incident, or operator request" /></label>
          <button className="btn dark" disabled={!impersonationReason.trim()} onClick={() => void submitImpersonation()}>Start audited impersonation</button>
          {actionResult?.audit_event_id && <span className="tag warn">Audit event {actionResult.audit_event_id}</span>}
        </article>
      )}

      <article className="router-panel access-policy-card">
        <h2>Audit and log links</h2>
        <div className="desktop-readiness-grid">
          <a className="btn ghost small" href={consoleData?.links?.audit ?? "#"}>Open audit trail</a>
          <a className="btn ghost small" href={consoleData?.links?.logs ?? "#"}>Open runtime logs</a>
          <a className="btn ghost small" href={consoleData?.links?.agent_assignments ?? "#"}>Review assigned agents</a>
        </div>
      </article>
    </section>
  );
}

export function AdminSetupPage({ kind }: { kind: keyof typeof pageConfigs }) {
  const { setView } = useStore();
  const config = pageConfigs[kind];
  const [desktopGateway, setDesktopGateway] = useState<DesktopGatewayStatus | null>(null);
  const [desktopError, setDesktopError] = useState<string | null>(null);
  const [windowsUrl, setWindowsUrl] = useState("");
  const [windowsToken, setWindowsToken] = useState("");
  const [approvedFolders, setApprovedFolders] = useState("C:/MelverickAgentWorkspace");

  async function loadDesktopGateway() {
    if (kind !== "desktop-gateway") return;
    try {
      setDesktopError(null);
      const next = await client.getDesktopGateway();
      setDesktopGateway(next);
      setWindowsUrl(next.windows.url || "");
      setApprovedFolders((next.windows.approvedFolders.length ? next.windows.approvedFolders : next.windows.recommendedFolders.slice(0, 1)).join("\n"));
    } catch (err) {
      setDesktopError(err instanceof Error ? err.message : "Unable to load Desktop Gateway");
    }
  }

  useEffect(() => {
    void loadDesktopGateway();
  }, [kind]);

  async function saveWindowsGateway() {
    try {
      setDesktopError(null);
      const folders = approvedFolders.split(/[\n,|]+/).map((item) => item.trim()).filter(Boolean);
      await client.saveWindowsGatewayConfig({
        url: windowsUrl,
        token: windowsToken,
        keepToken: !windowsToken,
        approvedFolders: folders,
      });
      setWindowsToken("");
      await loadDesktopGateway();
    } catch (err) {
      setDesktopError(err instanceof Error ? err.message : "Unable to save Windows gateway config");
    }
  }

  return (
    <div className="skills-page admin-setup-page scroll">
      <header className="skills-hero admin-setup-hero">
        <div>
          <span className="stub-tag">{config.eyebrow}</span>
          <h1>{config.title}</h1>
          <p>{config.blurb}</p>
        </div>
      </header>

      <section className="skills-metrics admin-setup-metrics" aria-label={`${config.title} metrics`}>
        {config.metrics.map((metric) => (
          <article className={metricClass(metric.tone)} key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.value}</b>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>

      {kind === "users-workspaces" && <UsersAccessPanel />}
      {kind === "workspace-runtime-console" && <WorkspaceRuntimeConsolePanel />}
      {kind === "agent-platform-admin" && <PlatformAdminPanel />}
      {kind === "shared-agent-templates" && <SharedAgentTemplatesPanel />}

      {kind === "desktop-gateway" && (
        <section className="desktop-gateway-live" aria-label="Desktop Gateway live readiness">
          <article className="router-panel desktop-readiness-card">
            <div className="section-head">
              <div>
                <h2>Readiness summary</h2>
                <p>Live probe for the remote Hermes Desktop gateway, Windows-local gateway, and execution boundaries before dispatch. Compare Run on VPS, Run on Windows Desktop, and synced workspace options before assigning work.</p>
              </div>
              <button className="btn ghost small" onClick={() => void loadDesktopGateway()}>Test connection</button>
            </div>
            {desktopError && <div className="skills-error">{desktopError}</div>}
            <div className="desktop-readiness-grid">
              <div className="kv"><span>Remote URL</span><b>{desktopGateway?.remoteUrl ?? "Loading…"}</b></div>
              <div className="kv"><span>Token</span><b>{desktopGateway?.tokenSet ? `Set ${desktopGateway.sessionTokenPreview ?? "[REDACTED]"}` : "Not set"}</b></div>
              <div className="kv"><span>Gateway service</span><b>{desktopGateway?.service.active || "unknown"}</b></div>
              <div className="kv"><span>Ready targets</span><b>{desktopGateway?.readinessSummary.readyTargets ?? 0}/{desktopGateway?.targets.length ?? 0}</b></div>
            </div>
            <div className="desktop-attention-list">
              {(desktopGateway?.readinessSummary.needsAttention.length ? desktopGateway.readinessSummary.needsAttention : ["No readiness blockers detected."]).map((item) => (
                <span className="tag warn" key={item}>{item}</span>
              ))}
            </div>
          </article>

          <div className="desktop-target-grid">
            {(desktopGateway?.targets ?? []).map((target) => (
              <article className="desktop-target-card" key={target.id}>
                <div className="skill-card-top">
                  <h3>{target.label}</h3>
                  <span className={`tag ${target.ready ? "good" : "warn"}`}>{target.ready ? "ready" : "not ready"}</span>
                </div>
                <p>{target.description}</p>
                <div className="kv"><span>Execution boundary</span><b>{target.executionBoundary}</b></div>
                <div className="kv"><span>Approval</span><b>{target.approvalRequired ? "Approval required" : "No extra approval"}</b></div>
                {target.url && <code>{target.url}</code>}
              </article>
            ))}
          </div>

          <article className="router-panel desktop-windows-config">
            <div className="section-head compact">
              <div>
                <h2>Windows Desktop Local Gateway</h2>
                <p>Configure WINDOWS_HERMES_GATEWAY_URL only after the Windows-side Hermes dashboard is reachable through a trusted tunnel.</p>
              </div>
            </div>
            <label>
              <span>WINDOWS_HERMES_GATEWAY_URL</span>
              <input value={windowsUrl} onChange={(event) => setWindowsUrl(event.target.value)} placeholder="http://windows-tailnet-name:9119" />
            </label>
            <label>
              <span>WINDOWS_HERMES_GATEWAY_TOKEN</span>
              <input value={windowsToken} onChange={(event) => setWindowsToken(event.target.value)} placeholder={desktopGateway?.windows.tokenSet ? "Leave blank to keep existing token" : "Paste token once"} type="password" />
            </label>
            <label>
              <span>Approved folders</span>
              <textarea value={approvedFolders} onChange={(event) => setApprovedFolders(event.target.value)} rows={4} />
            </label>
            <button className="btn dark" onClick={() => void saveWindowsGateway()}>Save and test Windows gateway</button>
            <div className="drawer-section-list">
              {(desktopGateway?.desktopSteps ?? []).map((step) => <div className="kv" key={step}><span>Setup step</span><b>{step}</b></div>)}
            </div>
          </article>
        </section>
      )}

      {kind !== "users-workspaces" && kind !== "workspace-runtime-console" && kind !== "agent-platform-admin" && kind !== "shared-agent-templates" && (
      <div className="admin-setup-grid">
        <section className="admin-setup-main">
          {config.sections.map((section) => (
            <article className="router-panel admin-setup-section" key={section.heading}>
              <div className="section-head">
                <div>
                  <h2>{section.heading}</h2>
                  <p>{section.body}</p>
                </div>
              </div>
              <div className="admin-setup-cards">
                {section.cards.map((card) => (
                  <div className="admin-setup-card" key={card.title}>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.body}</p>
                      {card.note && <small>{card.note}</small>}
                    </div>
                    {card.target ? (
                      <button className="btn ghost small" onClick={() => setView(card.target!)}>{card.action}</button>
                    ) : (
                      <span className="tag muted">{card.action}</span>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>

        <aside className="admin-setup-side" aria-label="Implementation evidence">
          <article className="router-panel">
            <div className="section-head compact">
              <div>
                <h2>Step 3 evidence</h2>
                <p>Real admin setup surface, linked to existing operational routes and explicit about what is not yet safe to mutate.</p>
              </div>
            </div>
            <div className="drawer-section-list">
              {config.evidence.map((item) => (
                <div className="kv" key={item}><span>Verified intent</span><b>{item}</b></div>
              ))}
            </div>
          </article>
        </aside>
      </div>
      )}
    </div>
  );
}
