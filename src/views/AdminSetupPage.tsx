import { useEffect, useState } from "react";
import type { DesktopGatewayStatus, ViewKey } from "../types";
import { Icon } from "../components/Icon";
import { HttpHermesClient } from "../services/httpHermesClient";
import { useStore } from "../services/store";

const client = new HttpHermesClient();

type AccessRole = "admin" | "user" | "viewer";
type AccessStatus = "active" | "disabled";

type AccessUser = {
  id: string;
  email: string;
  name: string;
  role: AccessRole | string;
  status: AccessStatus | string;
  created_at: string;
  last_login_at?: string | null;
  workspace?: { id: string; name: string; slug: string } | null;
  activity?: { projects: number; tasks: number; inbox: number };
};

type AccessWorkspace = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  owner?: { id: string; email: string; name: string; role: string; status: string } | null;
  created_at: string;
  activity?: { projects: number; tasks: number; inbox: number };
};

type AccessResponse = {
  ok: boolean;
  users: AccessUser[];
  workspaces: AccessWorkspace[];
  summary: { total_users: number; active: number; admins: number; workspaces: number };
  roles: AccessRole[];
  statuses: AccessStatus[];
  policy: { destructive_delete: boolean; passwords_returned_once: boolean; admin_required: boolean };
};

type UserFormState = { email: string; name: string; workspaceName: string; role: AccessRole; password: string };
type EditUserFormState = { name: string; workspaceName: string; role: AccessRole; status: AccessStatus; password: string };
type WorkspaceFormState = { name: string; slug: string; ownerUserId: string };

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
    title: "Users & Workspaces",
    blurb:
      "Manage who can enter Mission Control, which workspace they operate in, and whether they are workspace users, viewers, or platform admins.",
    metrics: [
      { label: "Scope", value: "Workspace", detail: "Workspace-scoped identity and access" },
      { label: "Roles", value: "3", detail: "admin · user · viewer", tone: "good" },
      { label: "Guardrail", value: "RBAC", detail: "Server-side view permissions", tone: "good" },
      { label: "Next data source", value: "/api/me", detail: "Current signed-in workspace evidence" },
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
  "shared-agent-templates": {
    eyebrow: "PLATFORM AGENTS",
    title: "Shared Agent Templates",
    blurb:
      "Curate global agent definitions that workspaces can select from, while keeping each workspace's own editable SOUL.md identity separate.",
    metrics: [
      { label: "Source of truth", value: "Templates", detail: "Admin-managed shared definitions" },
      { label: "Workspace identity", value: "SOUL.md", detail: "Editable by workspace users", tone: "good" },
      { label: "Runtime", value: "Agent Org", detail: "Platform org remains linked" },
      { label: "Guardrail", value: "Scoped", detail: "No cross-workspace soul overwrite", tone: "good" },
    ],
    sections: [
      {
        heading: "Template workflow",
        body: "Shared templates should define reusable capabilities, default skills, model preferences, and safe permissions. Workspace users personalize their own agent soul without changing the admin template.",
        cards: [
          { title: "Inspect Platform Agent Org", body: "Review the current shared org and capability graph before creating or changing templates.", target: "agent-org", action: "Open Platform Agent Org" },
          { title: "Inspect Skills Library", body: "Check available Hermes/OpenClaw/Shared skills that templates can reference.", target: "skills", action: "Open Skills" },
          { title: "Audit template effects", body: "Use audit evidence when a template is assigned, changed, or promoted to a runtime workflow.", target: "audit", action: "Open Global Audit Log" },
        ],
      },
      {
        heading: "Workspace soul boundary",
        body: "Admin templates and workspace SOUL.md edits are different scopes. Step 3 makes that boundary explicit so users can edit their agent identity without becoming platform admins.",
        cards: [
          { title: "Workspace SOUL.md", body: "Users should edit only their workspace-agent SOUL.md, not shared templates, skills, connectors, or model-router configuration.", target: "agents", action: "Open My Agents" },
        ],
      },
    ],
    evidence: ["Admin-managed template concept is visible", "Workspace SOUL.md personalization is documented in-page", "Existing Agent Org and Skills routes are preserved"],
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

function formatDate(value?: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function UsersAccessPanel() {
  const [access, setAccess] = useState<AccessResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [addWorkspaceDrawerOpen, setAddWorkspaceDrawerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [editingUser, setEditingUser] = useState<AccessUser | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<AccessWorkspace | null>(null);
  const [editForm, setEditForm] = useState<EditUserFormState>({ name: "", workspaceName: "", role: "user", status: "active", password: "" });
  const [editWorkspaceForm, setEditWorkspaceForm] = useState<WorkspaceFormState>({ name: "", slug: "", ownerUserId: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [form, setForm] = useState<UserFormState>({ email: "", name: "", workspaceName: "", role: "user", password: "" });
  const [workspaceForm, setWorkspaceForm] = useState<WorkspaceFormState>({ name: "", slug: "", ownerUserId: "" });

  async function loadAccess() {
    try {
      setError(null);
      const next = await adminRequest<AccessResponse>("/api/admin/access");
      setAccess(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load users and access");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccess();
  }, []);

  const filteredUsers = (access?.users ?? []).filter((user) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [user.email, user.name, user.role, user.status, user.workspace?.name, user.workspace?.slug].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

  const activeUsers = (access?.users ?? []).filter((user) => user.status === "active");
  const filteredWorkspaces = (access?.workspaces ?? []).filter((workspace) => {
    const q = workspaceQuery.trim().toLowerCase();
    if (!q) return true;
    return [workspace.name, workspace.slug, workspace.owner?.email, workspace.owner?.name].some((value) => String(value ?? "").toLowerCase().includes(q));
  });

  async function createUser() {
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    try {
      setError(null);
      setNotice(null);
      setCreating(true);
      const result = await adminRequest<{ ok: boolean; user: AccessUser; temporary_password?: string }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: form.email, name: form.name, workspaceName: form.workspaceName, role: form.role, password: form.password }),
      });
      setForm({ email: "", name: "", workspaceName: "", role: "user", password: "" });
      setAddDrawerOpen(false);
      setNotice(result.temporary_password ? `Created ${result.user.email}. Temporary password: ${result.temporary_password}` : `Created ${result.user.email}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create user");
    } finally {
      setCreating(false);
    }
  }

  async function updateUser(user: AccessUser, payload: Record<string, unknown>) {
    try {
      setError(null);
      setNotice(null);
      const result = await adminRequest<{ ok: boolean; user: AccessUser; temporary_password?: string }>(`/api/admin/users/${encodeURIComponent(user.id)}/action`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setNotice(result.temporary_password ? `Reset password for ${result.user.email}: ${result.temporary_password}` : `Updated ${result.user.email}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    }
  }

  function openEditDrawer(user: AccessUser) {
    setError(null);
    setNotice(null);
    setEditingUser(user);
    setEditForm({
      name: user.name || user.email,
      workspaceName: user.workspace?.name ?? "",
      role: (user.role === "admin" || user.role === "viewer" || user.role === "user" ? user.role : "user") as AccessRole,
      status: (user.status === "disabled" ? "disabled" : "active") as AccessStatus,
      password: "",
    });
  }

  async function saveEditUser() {
    if (!editingUser) return;
    try {
      setError(null);
      setNotice(null);
      setSavingEdit(true);
      const payload: Record<string, unknown> = {
        name: editForm.name,
        workspaceName: editForm.workspaceName,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password.trim()) payload.password = editForm.password;
      const result = await adminRequest<{ ok: boolean; user: AccessUser; temporary_password?: string }>(`/api/admin/users/${encodeURIComponent(editingUser.id)}/action`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setEditingUser(null);
      setEditForm({ name: "", workspaceName: "", role: "user", status: "active", password: "" });
      setNotice(result.temporary_password ? `Updated ${result.user.email}. New password: ${result.temporary_password}` : `Updated ${result.user.email}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function createWorkspace() {
    if (!workspaceForm.name.trim()) {
      setError("Workspace name is required.");
      return;
    }
    try {
      setError(null);
      setNotice(null);
      setCreatingWorkspace(true);
      const result = await adminRequest<{ ok: boolean; workspace: AccessWorkspace }>("/api/admin/workspaces", {
        method: "POST",
        body: JSON.stringify(workspaceForm),
      });
      setWorkspaceForm({ name: "", slug: "", ownerUserId: "" });
      setAddWorkspaceDrawerOpen(false);
      setNotice(`Created workspace ${result.workspace.name}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  function openWorkspaceDrawer(workspace: AccessWorkspace) {
    setError(null);
    setNotice(null);
    setEditingWorkspace(workspace);
    setEditWorkspaceForm({ name: workspace.name, slug: workspace.slug, ownerUserId: workspace.owner_user_id });
  }

  async function saveWorkspace() {
    if (!editingWorkspace) return;
    try {
      setError(null);
      setNotice(null);
      setSavingWorkspace(true);
      const result = await adminRequest<{ ok: boolean; workspace: AccessWorkspace }>(`/api/admin/workspaces/${encodeURIComponent(editingWorkspace.id)}/action`, {
        method: "POST",
        body: JSON.stringify(editWorkspaceForm),
      });
      setEditingWorkspace(null);
      setEditWorkspaceForm({ name: "", slug: "", ownerUserId: "" });
      setNotice(`Updated workspace ${result.workspace.name}.`);
      await loadAccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update workspace");
    } finally {
      setSavingWorkspace(false);
    }
  }

  return (
    <section className="users-access-panel" aria-label="Users and access management">
      <div className="access-toolbar router-panel">
        <div>
          <h2>Access roster</h2>
          <p>Manage sign-in accounts, workspace ownership, and role boundaries. Deletes are intentionally disabled; disable access instead so the audit trail remains intact.</p>
        </div>
        <div className="access-toolbar-actions">
          <button className="btn ghost small access-inline-add" onClick={() => setAddWorkspaceDrawerOpen(true)}><Icon name="projects" size={15} /> Workspace</button>
          <button className="task-icon-action primary" aria-label="Add user" title="Add user" onClick={() => setAddDrawerOpen(true)}><Icon name="plus" size={18} /></button>
          <button className="task-icon-action dark" aria-label="Refresh users and access" title="Refresh users and access" onClick={() => void loadAccess()}><Icon name="refresh" size={18} /></button>
        </div>
      </div>

      {error && <div className="skills-error">{error}</div>}
      {notice && <div className="access-secret-notice" role="status">{notice}</div>}

      <div className="users-access-layout">
        <article className="router-panel access-users-card">
          <div className="section-head compact access-users-head">
            <div>
              <h2>Current access</h2>
              <p>{loading ? "Loading users…" : `${filteredUsers.length} shown · ${access?.summary.total_users ?? 0} total accounts`}</p>
            </div>
            <input className="access-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, role, workspace…" />
          </div>
          <div className="access-user-list">
            {filteredUsers.map((user) => (
              <div className="access-user-row" key={user.id} role="button" tabIndex={0} aria-label={`Edit ${user.email}`} onClick={() => openEditDrawer(user)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openEditDrawer(user); } }}>
                <div className="access-user-main">
                  <strong>{user.name || user.email}</strong>
                  <span>{user.email}</span>
                  <small>{user.workspace?.name ?? "No workspace"} · last login {formatDate(user.last_login_at)}</small>
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
                  <option value="active">active</option><option value="disabled">disabled</option>
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

        <article className="router-panel access-workspaces-card">
          <div className="section-head compact access-users-head">
            <div>
              <h2>Workspaces</h2>
              <p>{loading ? "Loading workspaces…" : `${filteredWorkspaces.length} shown · ${access?.summary.workspaces ?? 0} total workspaces`}</p>
            </div>
            <input className="access-search" value={workspaceQuery} onChange={(event) => setWorkspaceQuery(event.target.value)} placeholder="Search workspace or owner…" />
          </div>
          <div className="access-workspace-list">
            {filteredWorkspaces.map((workspace) => (
              <div className="access-workspace-row" key={workspace.id} role="button" tabIndex={0} aria-label={`Edit workspace ${workspace.name}`} onClick={() => openWorkspaceDrawer(workspace)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openWorkspaceDrawer(workspace); } }}>
                <div className="access-user-main">
                  <strong>{workspace.name}</strong>
                  <span>{workspace.slug}</span>
                  <small>Owner: {workspace.owner?.name || workspace.owner?.email || "Unassigned"}</small>
                </div>
                <div className="access-user-activity">
                  <span>{workspace.activity?.projects ?? 0} projects</span>
                  <span>{workspace.activity?.tasks ?? 0} tasks</span>
                  <span>{workspace.activity?.inbox ?? 0} approvals</span>
                </div>
                <div className="access-user-actions" onClick={(event) => event.stopPropagation()}>
                  <button className="btn ghost small" onClick={() => openWorkspaceDrawer(workspace)}><Icon name="edit" size={14} /> Edit</button>
                </div>
              </div>
            ))}
            {!loading && filteredWorkspaces.length === 0 && <div className="mc-empty inline"><h3>No matching workspaces</h3><p>Create a workspace or adjust the search.</p></div>}
          </div>
        </article>
      </div>

      <article className="router-panel access-policy-card">
        <h2>Access policy boundary</h2>
        <div className="access-policy-grid">
          <div><b>Roles</b><span>admin manages platform settings; user operates workspace agents; viewer is read-only.</span></div>
          <div><b>No hard delete</b><span>Disable accounts instead of deleting them, preserving audit/evidence history.</span></div>
          <div><b>Passwords</b><span>Temporary passwords are returned once in this browser response and are not stored in plaintext.</span></div>
        </div>
      </article>

      {addDrawerOpen && (
        <div className="mc-drawer-layer access-add-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close add user drawer" onClick={() => setAddDrawerOpen(false)} />
          <aside className="mc-drawer mc-drawer-narrow access-add-drawer" aria-label="Add user drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title">
                <span className="stub-tag">ACCOUNT ADMIN</span>
                <h2>Add user</h2>
                <p>Create a local Mission Control login and workspace. If password is blank, a one-time temporary password is generated and shown once.</p>
              </div>
              <button className="mc-drawer-close" aria-label="Close add user drawer" onClick={() => setAddDrawerOpen(false)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void createUser(); }}>
                <label><span>Email</span><input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="operator@example.com" autoFocus /></label>
                <label><span>Name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Operator name" /></label>
                <label><span>Workspace</span><input value={form.workspaceName} onChange={(event) => setForm({ ...form, workspaceName: event.target.value })} placeholder="Company / Team Workspace" /></label>
                <label><span>Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AccessRole })}><option value="user">User</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
                <label><span>Password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Blank = generate" /></label>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setAddDrawerOpen(false)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={creating}>{creating ? "Creating…" : "Create user"}</button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}

      {addWorkspaceDrawerOpen && (
        <div className="mc-drawer-layer access-add-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close add workspace drawer" onClick={() => setAddWorkspaceDrawerOpen(false)} />
          <aside className="mc-drawer mc-drawer-narrow access-add-drawer" aria-label="Add workspace drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title">
                <span className="stub-tag">WORKSPACE ADMIN</span>
                <h2>Add workspace</h2>
                <p>Create a workspace boundary and assign an owner. Users remain managed separately; deletion is intentionally unavailable.</p>
              </div>
              <button className="mc-drawer-close" aria-label="Close add workspace drawer" onClick={() => setAddWorkspaceDrawerOpen(false)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void createWorkspace(); }}>
                <label><span>Workspace name</span><input value={workspaceForm.name} onChange={(event) => setWorkspaceForm({ ...workspaceForm, name: event.target.value })} placeholder="Nexius Labs" autoFocus /></label>
                <label><span>Slug</span><input value={workspaceForm.slug} onChange={(event) => setWorkspaceForm({ ...workspaceForm, slug: event.target.value })} placeholder="Blank = generated from name" /></label>
                <label><span>Owner</span><select value={workspaceForm.ownerUserId} onChange={(event) => setWorkspaceForm({ ...workspaceForm, ownerUserId: event.target.value })}><option value="">Current admin</option>{activeUsers.map((user) => <option value={user.id} key={user.id}>{user.name || user.email} · {user.email}</option>)}</select></label>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setAddWorkspaceDrawerOpen(false)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={creatingWorkspace}>{creatingWorkspace ? "Creating…" : "Create workspace"}</button>
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
                <label><span>Workspace</span><input value={editForm.workspaceName} onChange={(event) => setEditForm({ ...editForm, workspaceName: event.target.value })} placeholder="Company / Team Workspace" /></label>
                <label><span>Role</span><select value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as AccessRole })}><option value="user">User</option><option value="viewer">Viewer</option><option value="admin">Admin</option></select></label>
                <label><span>Status</span><select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as AccessStatus })}><option value="active">Active</option><option value="disabled">Disabled</option></select></label>
                <label><span>New password</span><input type="password" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} placeholder="Leave blank to keep current" /></label>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setEditingUser(null)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={savingEdit}>{savingEdit ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}

      {editingWorkspace && (
        <div className="mc-drawer-layer access-edit-drawer-layer" role="presentation">
          <button className="mc-drawer-scrim" aria-label="Close edit workspace drawer" onClick={() => setEditingWorkspace(null)} />
          <aside className="mc-drawer mc-drawer-narrow access-edit-drawer" aria-label="Edit workspace drawer" role="dialog" aria-modal="true">
            <div className="mc-drawer-head">
              <div className="mc-drawer-title">
                <span className="stub-tag">WORKSPACE ADMIN</span>
                <h2>Edit workspace</h2>
                <p>{editingWorkspace.id}</p>
              </div>
              <button className="mc-drawer-close" aria-label="Close edit workspace drawer" onClick={() => setEditingWorkspace(null)}>×</button>
            </div>
            <div className="mc-drawer-body">
              <form className="access-create-card access-create-form" onSubmit={(event) => { event.preventDefault(); void saveWorkspace(); }}>
                <label><span>Workspace name</span><input value={editWorkspaceForm.name} onChange={(event) => setEditWorkspaceForm({ ...editWorkspaceForm, name: event.target.value })} placeholder="Workspace name" autoFocus /></label>
                <label><span>Slug</span><input value={editWorkspaceForm.slug} onChange={(event) => setEditWorkspaceForm({ ...editWorkspaceForm, slug: event.target.value })} placeholder="workspace-slug" /></label>
                <label><span>Owner</span><select value={editWorkspaceForm.ownerUserId} onChange={(event) => setEditWorkspaceForm({ ...editWorkspaceForm, ownerUserId: event.target.value })}>{activeUsers.map((user) => <option value={user.id} key={user.id}>{user.name || user.email} · {user.email}</option>)}</select></label>
                <div className="access-drawer-actions">
                  <button className="btn ghost" type="button" onClick={() => setEditingWorkspace(null)}>Cancel</button>
                  <button className="btn dark" type="submit" disabled={savingWorkspace}>{savingWorkspace ? "Saving…" : "Save changes"}</button>
                </div>
              </form>
            </div>
          </aside>
        </div>
      )}
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

      {kind !== "users-workspaces" && (
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
