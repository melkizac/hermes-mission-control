# Mission Control Admin Platform: Multi-Runtime Design

Last prepared: 2026-06-06 UTC
Live service: `https://hermes.melverick.com`
Local service: `http://127.0.0.1:19080`
Source repo: `/opt/hermes-mission-control/source`
Runtime app: `/opt/hermes-mission-control`
Backend entrypoint: `/opt/hermes-mission-control/app.py`

---

## 1. Executive summary

Mission Control should be designed as a **central Admin control plane** over **many isolated Hermes user/workspace runtimes**.

The recommended model is:

```text
One Mission Control Admin platform
  └── manages many user/workspace Hermes runtimes
        ├── each runtime is isolated
        ├── each runtime has its own Hermes profile/home
        ├── each runtime can have its own agents, memory, sessions, files, and credentials
        └── admin governs Platform agents, Workspace agent access, Personal agent policy, and audit trails
```

In simple terms:

- **Mission Control** is the cockpit for operating and supervising the AI workforce platform.
- **Hermes runtimes** are the isolated execution environments where each user/workspace's agents actually work.
- **Agents** are digital coworkers or admin operators. They are split into three classes: Platform agents for Admin-only operations, Workspace agents for company workflows assigned by user/role, and Personal agents for individual productivity.
- **Admin** controls who has access to which runtime, which agents, which tools, which models, and which sensitive actions require approval.

This combines the best parts of two earlier options:

- The safety and isolation of separate Hermes runtimes.
- The governance and control of one Admin platform.

---

## 2. The design decision

### Rejected long-term design: one shared Hermes account for all users

A single Hermes account/runtime shared by all users is simpler, but it is not the best long-term architecture for SME/customer workspaces.

Problems:

- Higher risk of memory/session/credential leakage.
- Harder to explain tenant isolation to customers.
- Admin becomes the bottleneck for every agent.
- One runtime failure can affect every user.
- It feels like a shared chatbot rather than a real AI workforce operating system.

This approach may still be useful for demos or tightly controlled training sandboxes, but it should not be the final product architecture.

### Rejected long-term design: uncontrolled separate Hermes accounts

Giving every user a fully independent Hermes account with unrestricted tools is also risky.

Problems:

- Users could create unsafe agents.
- Users could enable powerful tools without governance.
- Admin loses platform-level visibility.
- On the same VPS, unmanaged containers could create security and operational risk.

### Recommended design: governed multi-runtime platform

The recommended architecture is:

```text
Mission Control = central governance/control plane
Hermes containers/profiles = isolated user/workspace runtimes
Agents/templates = digital coworkers governed by policy
```

This means:

- Each user/workspace gets its own isolated Hermes runtime.
- Admin can see and manage all runtimes from Mission Control.
- Admin creates internal Platform agents for administration only.
- Admin creates or approves Workspace agents and assigns them to users or roles.
- Users can eventually create their own Personal agents, but only within policy limits.
- Sensitive actions require approval and are audit logged.

---

## 3. Functional explanation for non-technical users

### What Admin can do

Admin uses Mission Control to manage the AI workforce platform.

Admin can:

- Create users.
- Create or supervise workspaces.
- See all Hermes runtimes and whether they are running.
- Assign Workspace agents to users or roles.
- Create Admin-only Platform agents and company-facing Workspace agent templates.
- Control what tools each user/workspace is allowed to use.
- Control what models/providers users may use.
- Restart or disable a user runtime.
- Review audit logs and evidence.
- Approve sensitive actions such as posting publicly, sending email, or using powerful tools.

### What a user sees

A normal user should not see the entire platform.

A normal user sees only:

- Their own workspace.
- Their own assigned agents.
- Their own private/workspace agents, if enabled.
- Their own chat sessions, tasks, files, routines, and outputs.

A user should not see another user's memory, files, sessions, credentials, or agents unless explicitly shared through a workspace policy.

### What a workspace is

A workspace is the user's operating area.

For an SME customer, a workspace could represent:

- One company.
- One department.
- One training cohort.
- One project team.

A workspace contains:

- Assigned Workspace agents.
- User-created Personal agents, if allowed.
- Files and working context.
- Memory and sessions.
- Tasks, missions, workflows, routines.
- Credentials/connectors approved for that workspace.
- Audit records.

### What an agent is

An agent is a digital coworker with a role, instructions, and allowed capabilities.

Examples:

- Research Analyst
- LinkedIn Growth Operator
- CRM Follow-up Assistant
- Proposal Writer
- Course Builder
- Operations Coordinator

Admin can create **Platform agents** for administration only. Admin can also create or approve **Workspace agents** and assign them to users or roles. Later, users can create **Personal agents** inside their own workspace, subject to policy.

### What it means to open a workspace console

Admin should be able to select a user/workspace from the Admin UI and open that workspace's runtime console.

Example:

```text
Admin Mission Control
  → Users & Workspaces
  → Client A Workspace
  → Open Runtime Console
```

The console should clearly show which runtime is being viewed:

```text
Viewing: Client A Workspace
Mode: Supervise
Runtime: hmc-user-client-a
Hermes profile: client-a
```

Admin should not silently become the user. If Admin needs to act inside that user's workspace, it should be explicit and audit logged.

Recommended modes:

1. **Supervise** — Admin views status, assignments, policies, logs, health, and evidence.
2. **Manage** — Admin changes assignments, runtime state, policy, or templates.
3. **Impersonate / operate as user** — Admin acts inside the workspace. This must be explicit and audit logged.

---

## 4. Technical architecture

### High-level architecture

```text
Same VPS initially

/opt/hermes-mission-control
  ├── Mission Control backend/API
  ├── Mission Control frontend bundle
  ├── platform database/state
  ├── runtime registry
  ├── agent template registry
  ├── user/workspace access registry
  └── user-runtimes/
        ├── user-admin/
        │     ├── hermes-home/
        │     └── workspace/
        ├── user-melverick/
        │     ├── hermes-home/
        │     └── workspace/
        └── user-client-a/
              ├── hermes-home/
              └── workspace/

Docker containers
  ├── hmc-user-admin
  ├── hmc-user-melverick
  └── hmc-user-client-a
```

Each runtime container should point to only its own mounted runtime folder:

```text
Container: hmc-user-client-a
  HERMES_HOME=/runtime/hermes-home
  workspace=/runtime/workspace
```

This creates a clean separation between users.

### Control plane vs runtime plane

Mission Control has two major planes.

#### Control plane

The control plane is the Admin/backend layer.

It manages:

- Users.
- Workspaces.
- Hermes profiles.
- Docker runtime records.
- Agent templates.
- Agent assignments.
- Tool/model/policy rules.
- Runtime health.
- Audit events.

#### Runtime plane

The runtime plane is where Hermes actually executes work.

It contains:

- Hermes process/profile.
- User memory.
- User sessions.
- User files.
- User cron jobs.
- User skills.
- User credentials/connectors.
- Agent conversations and tool execution.

Admin controls the runtime plane through governed backend routes, not by manually logging into each container.

---

## 5. How Admin controls multiple Hermes runtimes

Admin controls multiple Hermes runtimes through Mission Control.

Admin does not need to SSH into every container or manually open every Hermes account.

Mission Control keeps a registry like:

```text
User: Client A
Workspace: Client A Workspace
Hermes profile: client-a
Runtime container: hmc-user-client-a
Runtime status: running
Assigned Workspace agents: Research Analyst, Proposal Writer
Policy: restricted external actions
```

From the Admin UI, Admin can:

- Select the workspace.
- Inspect runtime health.
- See which agents are available to that user.
- Assign or remove Workspace agents.
- Restart the container.
- Review logs and audit trail.
- Update policy.
- Open a runtime console.

This makes Mission Control the switchboard for all Hermes workspaces.

---

## 6. Agent ownership model

The platform should support three classes of agents. The classes are intentionally separated by **who controls them**, **who can access them**, and **what business risk they carry**.

### 6.1 Platform agents

Platform agents are created and managed by Admin for platform-level operations, governance, and internal administration.

Critical rule:

```text
Normal users must not be able to access, run, assign, edit, or see Platform agents.
```

Examples:

- Platform Runtime Supervisor
- Tenant Provisioning Agent
- Security / Audit Reviewer
- Billing and Usage Monitor
- System Health Operator
- Agent Template Curator

Properties:

```text
Owner: Platform Admin
Visibility: Admin only
Editable by: Admin only
Runnable by: Admin only
Assignable to normal users: No
Policy source: platform policy only
Primary use: operate and govern Mission Control itself
```

These are not customer-facing digital coworkers. They are internal control-plane agents used to operate the platform safely.

### 6.2 Workspace agents

Workspace agents are company/workspace-level digital coworkers. They may perform company-related work and therefore need stricter access control than personal agents.

They are suitable for business transactions and company systems such as:

- ERP
- CRM
- HR
- Accounting
- Invoicing
- Procurement
- Customer support
- Internal operations
- Company knowledge base / SOPs

Examples:

- ABC Clinic Appointment Follow-up Agent
- Finance SOP Assistant
- Sales Proposal Drafter
- CRM Lead Qualification Agent
- HR Leave Policy Assistant
- Accounting Reconciliation Assistant

Properties:

```text
Owner: Workspace / Company
Visibility: limited by workspace membership, user role, or explicit Admin assignment
Editable by: workspace owner, Admin, or approved role
Runnable by: users/roles assigned in Admin
Assignable to normal users: Yes, but only by Admin or workspace owner according to policy
Policy source: workspace policy + role policy + connector policy
Primary use: company-related work and business transactions
```

Access should be controlled from Admin using user/role assignment.

Examples:

```text
CRM Lead Qualification Agent
  Allowed users: Sales team, Sales Manager
  Restricted users: Finance, HR, external contractors

Accounting Reconciliation Agent
  Allowed users: Finance Manager, Admin
  Restricted users: Sales team, general staff

HR Leave Policy Agent
  Allowed users: HR team, company managers
  Restricted users: external users
```

Workspace agents may access company credentials or connectors, so they should support approval gates and audit logs for sensitive actions.

### 6.3 Personal agents

Personal agents are created by or assigned to an individual user for their own productivity.

Examples:

- My Meeting Summary Agent
- My Daily Planner
- My Research Assistant
- My Writing Assistant
- My Learning Coach

Properties:

```text
Owner: User
Visibility: private to the user
Editable by: user, unless policy requires review
Runnable by: user
Assignable to other users: No by default
Policy source: user policy + workspace safety policy
Primary use: personal productivity, drafting, research, and learning
```

Personal agents should not automatically receive access to company transaction systems such as ERP, CRM, HR, or Accounting. If a personal agent needs company-system access, Admin should either:

1. convert it into a Workspace agent, or
2. approve a tightly scoped connector permission with audit logging.

These support the product idea that domain experts can design their own AI coworkers while keeping business-system access governed.

---

## 7. Agent access and assignment rules

### Current implementation direction

The current implementation already supports the first governance layer. In the current code this is named "shared agent templates"; in the target product taxonomy, these user-accessible assigned agents should be treated as **Workspace agents**, not Platform agents.

```text
Admin creates/manages Workspace agent templates.
Admin assigns active Workspace agents to users or roles from Users & Access.
Normal users only see assigned Workspace agents plus their own Personal agents if enabled.
Normal users cannot grant themselves more Workspace agents.
Platform agents remain Admin-only and are never exposed to normal users.
Runtime routes reject unassigned agent access.
```

Important backend concepts currently implemented in `/opt/hermes-mission-control/app.py` include:

- `admin_access_payload(...)` — returns users, workspaces, profiles, runtimes, and agent template access evidence.
- `admin_agent_templates_payload(...)` — currently returns the shared template inventory; target taxonomy should split these into Admin-only Platform agents and assignable Workspace agent templates.
- `admin_agent_platform_payload(...)` — returns platform-wide runtime/template/governance summary.
- `list_agent_directory(...)` — returns only assigned Workspace agents for non-admin users.
- `admin_set_user_agents(...)` — authoritative Admin assignment for a user's allowed Workspace agents.
- `select_user_agent(...)` — blocks non-admin self-selection of Workspace agents.
- `agent_is_selected(...)` — checks whether a runtime route is allowed to use an agent.

Key API routes currently include:

```text
GET  /api/admin/access
GET  /api/admin/agent-platform
GET  /api/admin/agent-templates
POST /api/admin/users/<user_id>/agents/action
GET  /api/agent-directory
GET  /api/agents
POST /api/agents/<agent_id>/messages
```

### Desired future behavior

The current shared-template assignment model should evolve into:

```text
Admin-only Platform agents
  +
Admin/Workspace-owner managed Workspace agents assigned by user or role
  +
User-owned Personal agents
  +
Policy-based tool/model/credential permissions
  +
Audit-logged runtime supervision
```

The key product rule is:

```text
Users may create agents, but they cannot automatically grant those agents dangerous capabilities.
```

Agent creation and tool permission should be treated separately.

---

## 8. Policy model

The strongest design is not simply "users can create agents" or "users cannot create agents".

The stronger design is:

```text
Users can create agents within policy.
Admin controls what those agents are allowed to do.
```

### Example policy categories

```text
Models:
  - allowed model providers
  - model cost limits
  - default model routes

Tools:
  - web search
  - browser automation
  - file read/write
  - terminal
  - email
  - Telegram/WhatsApp/Slack
  - Google Workspace
  - CRM
  - GitHub
  - cron/scheduled jobs
  - webhook triggers

Credentials:
  - user-owned credentials
  - workspace-owned credentials
  - platform-owned credentials
  - read-only vs write access

Approvals:
  - send email
  - post to LinkedIn/social
  - modify external CRM
  - run destructive shell command
  - publish content
  - spend money or use high-cost model
  - schedule autonomous recurring task
```

### Safe default policy

A new user-created agent should start with low-risk capabilities:

```text
Allowed by default:
  - chat
  - summarize
  - draft
  - reason over uploaded documents
  - web search if workspace allows it

Restricted by default:
  - terminal
  - external posting
  - sending email
  - writing to CRM
  - destructive file operations
  - scheduled autonomous jobs
  - webhooks
  - credential changes
```

---

## 9. Admin UI design

### Recommended Admin navigation

The Admin UI should clearly separate global control from selected workspace operation.

```text
Admin
  ├── Dashboard
  ├── Users & Workspaces
  ├── Runtime Supervisor
  ├── Agent Platform Admin
  ├── Tool & Model Policy
  ├── Credentials & Connectors
  ├── Approvals
  └── Audit Logs
```

### Users & Workspaces

Purpose: manage people, their workspaces, and their runtime assignment.

Should show:

- User name/email.
- Role: admin, user, viewer.
- Status: active or disabled.
- Workspace name.
- Hermes profile.
- Runtime/container status.
- Assigned agents.
- Last login.
- Activity counters.

Primary actions:

- Create user.
- Disable user.
- Reset password / issue invite.
- Assign agents.
- Open workspace console.
- Restart runtime.
- View audit log.

### Runtime Supervisor

Purpose: see and operate all Hermes runtimes.

Should show:

- Runtime ID.
- User/workspace owner.
- Container name.
- Status: running, stopped, unhealthy, unknown.
- Last heartbeat.
- Current queue/workload.
- Memory/disk/cpu indicators if available.
- Restart/stop/start controls.

### Agent Platform Admin

Purpose: manage Admin-only Platform agents and Workspace agent templates.

Should show:

- Agent name.
- Class: Platform, Workspace, or Personal policy template.
- Category.
- Description.
- Capabilities.
- Status: active, archived, disabled.
- Visibility: Admin-only, workspace, role, or user-assigned.
- Number of users/roles assigned for Workspace agents.
- Number of project assignments.

Primary actions:

- Create Platform agent for Admin-only operations.
- Create Workspace agent template for company/business use.
- Edit template.
- Archive template.
- Assign Workspace agent to users or roles.
- Review where template is used.

Critical UI rule:

```text
Platform agents must not appear in normal user Agent Chat or user agent directories.
```

### Workspace Runtime Console

Purpose: inspect one selected workspace runtime.

Should show:

```text
Workspace: Client A
Runtime: hmc-user-client-a
Mode: Supervise / Manage / Impersonate
Hermes profile: client-a
Status: Running
Assigned Workspace agents: Research Analyst, Proposal Writer
Workspace transaction agents: Finance SOP Assistant
Personal agents: hidden unless allowed by policy
```

Sections:

- Chat.
- Agents.
- Tasks/missions.
- Files.
- Memory/context.
- Routines/cron.
- Connectors.
- Logs.
- Audit events.

### Impersonation mode

Admin impersonation should be explicit.

Recommended warning:

```text
You are about to operate inside Client A Workspace as an administrator.
Your actions will be recorded in the audit log.
```

Every impersonated action should record:

- Admin user ID.
- Target user/workspace ID.
- Action type.
- Timestamp.
- Reason if provided.
- Tool/API used.
- Result.

---

## 10. Data model overview

The current Mission Control backend uses platform state and auth tables to track users, workspaces, profiles, runtimes, agent directory entries, and preferences.

Conceptual entities:

```text
users
  id
  email
  name
  role
  status

workspaces
  id
  owner_user_id
  name
  slug

hermes_profiles
  id
  user_id/workspace_id
  profile_name
  hermes_home_path

user_runtimes
  id
  user_id/workspace_id
  container_name
  status
  runtime_path

agent_directory
  id
  name
  description
  category
  capabilities
  shared_agent_ref
  status
  admin_managed_only

user_agent_preferences
  user_id
  workspace_id
  agent_id
  enabled
  display_order
  nickname

agent_assignments
  workspace_id
  project_id
  agent_id
  created_by

audit_events
  actor
  action
  target_type
  target_id
  metadata
  timestamp
```

The important rule is:

```text
Admin assignment lives in platform state.
Runtime execution happens inside the target user's isolated Hermes profile/container.
```

---

## 11. Security and isolation model

### Isolation boundaries

Each user/workspace runtime should have:

- Separate Docker container.
- Separate `HERMES_HOME`.
- Separate workspace directory.
- Separate memory and sessions.
- Separate credential scope.
- Separate cron/jobs state.
- Separate logs where possible.

### Important container rules

Do not give user runtimes unnecessary host control.

Recommended rules:

- Do not mount the host Docker socket into user runtimes.
- Do not share writable host directories across tenants.
- Use resource limits for CPU and memory.
- Restrict network access where possible.
- Keep secrets out of frontend payloads.
- Store credentials in per-user or per-workspace scope.
- Use audit logs for admin actions and sensitive runtime actions.

### Permission boundaries

Normal users should not be able to:

- See other users' agents.
- See other users' sessions.
- See other users' memory.
- See, run, or assign Platform agents.
- Use unassigned Workspace agents.
- Self-assign restricted Workspace agents.
- Use Personal agents for company-system transactions unless approved.
- Change platform templates.
- Change platform policy.
- Access admin routes.

Admin should be able to manage the platform, but sensitive admin operations should still be visible and auditable.

---

## 12. How this was built so far

The current implementation already includes important building blocks.

### Backend

Backend file:

```text
/opt/hermes-mission-control/app.py
```

Current backend responsibilities include:

- Serving Mission Control API routes.
- Reading/writing users and workspace state.
- Ensuring each user has a Hermes profile and runtime record.
- Returning public profile/runtime payloads.
- Maintaining an `agent_directory` for currently assignable agent records.
- Returning assigned Workspace agents only for non-admin users.
- Enforcing Admin-only Workspace agent assignment.
- Rejecting unassigned agent runtime calls.
- Returning Admin access summaries.
- Returning Agent Platform Admin summaries.

Target backend evolution:

- Add an explicit `agent_class` field: `platform`, `workspace`, or `personal`.
- Ensure `platform` agents are Admin-only and excluded from all normal user directories.
- Support role-based Workspace agent assignment for ERP/CRM/HR/Accounting use cases.

### Frontend

Frontend source path:

```text
/opt/hermes-mission-control/source/src
```

Important UI areas include:

- Admin navigation and route permission handling.
- Users & Workspaces / User Access page.
- Agent Platform Admin page.
- Agent directory and chat surfaces.
- Permission-aware routing for admin-only views.

### Production bundle

Build output:

```text
/opt/hermes-mission-control/source/dist
/opt/hermes-mission-control/dist
```

The production service serves the built bundle through the Mission Control backend.

### Service

Runtime service:

```text
hermes-mission-control.service
```

Expected state:

```text
active
```

---

## 13. Operator workflows

### Workflow A: create a new user/workspace

1. Admin opens **Users & Workspaces**.
2. Admin creates user with name/email/role.
3. Backend creates or ensures:
   - user record
   - workspace record
   - Hermes profile record
   - runtime record
   - runtime folder
4. Admin assigns initial Workspace agents if needed.
5. User logs in and sees only their workspace, assigned Workspace agents, and allowed Personal agents.

### Workflow B: assign Workspace agents to users or roles

1. Admin opens **Users & Workspaces**.
2. Admin selects a user, role, or team.
3. Admin checks/unchecks Workspace agents under **Assigned Agents**.
4. Backend updates assignment records authoritatively.
5. User's agent directory updates to only show assigned active Workspace agents.
6. Platform agents remain hidden and Admin-only.
7. Runtime calls to unassigned agents are rejected.

### Workflow C: supervise a workspace runtime

1. Admin opens **Runtime Supervisor** or **Users & Workspaces**.
2. Admin selects the target workspace.
3. Admin views runtime status, assigned Workspace agents, and policy.
4. Admin can restart runtime or open console.
5. Any sensitive admin operation is audit logged.

### Workflow D: user creates their own Personal agent, future phase

1. User opens their workspace AI Workforce page.
2. User creates a Personal agent.
3. Agent starts with safe default capabilities.
4. Personal agent cannot use ERP/CRM/HR/Accounting/company transaction connectors by default.
5. If the user requests restricted capabilities, the system asks for approval or Admin policy change.
6. If the agent should perform company transactions regularly, Admin converts or promotes it into a Workspace agent.
7. Agent runs inside the user's own Hermes runtime only.

---

## 14. Runtime operations, evidence, and research placement

The Admin design should separate **control surfaces** from **run-history surfaces**.

Admin should primarily control:

- connector access
- approval policy
- quota
- cost/usage
- runtime health
- audit trail
- workflow routines

Users/workspaces should primarily see:

- their own runs
- proof/evidence attached to those runs
- their own research outputs
- artifacts/files produced by those runs

### Updated Admin IA

```text
ADMIN
├── Overview
├── Users & Workspaces
├── Agent Platform
│   ├── Platform agents
│   ├── Workspace agents
│   ├── Personal agent policy
│   └── Agent assignments
├── Runtime Operations
│   ├── Runtime Connectors
│   ├── Workflow Routine Admin
│   ├── Runtime Health / Logs
│   └── Workspace Runtime Console
└── Governance
    ├── Global Audit Log
    ├── Costs / Usage
    ├── Approval Policy
    └── Quota
```

### Updated Workspace IA

```text
WORKSPACE
├── Chat / Agents
├── Runs
│   ├── Agent run history
│   ├── Browser evidence attached to each browser run
│   ├── Research run history
│   └── Artifacts / files
├── Routines
├── Connectors, if user has permission
└── Usage, if user has permission
```

### Browser Evidence decision

Browser Evidence should be attached to the specific run that generated it.

Do **not** make Browser Evidence a standalone Admin menu item.

Primary placement:

```text
Workspace → Runs → selected run → Evidence drawer
Agent Chat → completed run → Evidence drawer
Routine Run → selected execution → Evidence drawer
```

Secondary Admin access should be contextual only:

```text
Admin → Global Audit Log → event detail → Evidence
Admin → Approval Policy / approval queue → request detail → Evidence
Admin → Workspace Runtime Console → Runs → selected run → Evidence
```

Access rules:

```text
Platform agent evidence:
  Admin-only.

Workspace agent evidence:
  visible to authorized workspace users/roles and Admin through audit/support/supervision context.

Personal agent evidence:
  visible to the owning user by default.
  Admin sees metadata by default, not full content, unless policy/support/legal workflow explicitly permits access.
```

### Research Runs decision

Research Runs should be workspace/user run history, not a standalone Admin menu item.

Do **not** make Research Runs a main Admin function.

Primary placement:

```text
Workspace → Runs → Research Runs
Workspace → Chat / Agents → research output → Research Run detail
```

Secondary Admin access should be through governance and supervision:

```text
Admin → Costs / Usage → research usage breakdown
Admin → Quota → research limits
Admin → Global Audit Log → research events
Admin → Workspace Runtime Console → Research Runs
```

Admin is not usually controlling the research content itself. Admin controls:

- cost
- quota
- model/depth
- source/data scope
- browser use
- file download/extraction
- internal-document access
- visibility
- citation/evidence standards

Use this research policy ladder:

```text
Basic research:
  allowed.

Deep research:
  quota-limited.

Browser research:
  approval or quota-limited.

Download / extract files:
  restricted.

Use internal docs:
  role-controlled.
```

Definitions:

- **Basic research** — public web search, lightweight summarization, citation collection, and drafting. Allowed within normal usage quota.
- **Deep research** — multi-step research using more sources, larger context, subagents, or longer runtime. Quota-limited.
- **Browser research** — research requiring browser navigation, screenshots, page interaction, or browser automation. Approval-required or quota-limited depending on workspace policy; evidence attaches to the run.
- **Download / extract files** — downloading or extracting PDFs, spreadsheets, documents, images, archives, or uploaded files. Restricted by approval, file-type allowlist, size limits, scanning, and audit.
- **Use internal docs** — private workspace knowledge, Google Drive, email, CRM exports, HR policies, contracts, finance files, meeting transcripts, or other internal data. Role-controlled and connector-policy controlled.

---

## 15. Rollout roadmap

### Phase 1: Admin-created Workspace agents and assignment

Status: in progress / partially live.

Goal:

```text
Admin creates assignable Workspace agents.
Admin assigns Workspace agents to users or roles.
Platform agents remain Admin-only and hidden from normal users.
Users only see assigned Workspace agents plus allowed Personal agents.
Runtime rejects unassigned agent usage.
```

### Phase 2: Workspace console switcher

Goal:

```text
Admin can select any user/workspace and open a clearly labeled runtime console.
```

Required UI:

- Workspace selector.
- Runtime status card.
- Assigned Workspace agents list.
- Open console action.
- Clear Supervise/Manage/Impersonate mode indicator.

### Phase 3: Runtime supervisor controls

Goal:

```text
Admin can start/stop/restart user runtime containers from Mission Control.
```

Required backend:

- Runtime registry.
- Container state detection.
- Start/stop/restart actions.
- Audit events.
- Error handling and evidence.

### Phase 4: User-created Personal agents inside policy

Goal:

```text
Users can create Personal agents without gaining unrestricted tool or company-system access.
```

Required backend:

- Agent owner/scope/class fields.
- Policy checks for tool/model access.
- Safe defaults.
- Approval requests for restricted tools.
- Promotion workflow from Personal agent to Workspace agent when company transactions are needed.

### Phase 5: Policy and approval center

Goal:

```text
Admin manages models, tools, credentials, approval rules, and high-risk actions from one place.
```

Required UI:

- Tool policy page.
- Model policy page.
- Credential/connector governance page.
- Approval queue.
- Audit log.

### Phase 6: Multi-node runtime support

Goal:

```text
Mission Control can manage runtimes across more than one VPS or customer-owned server.
```

Required backend:

- Runtime node registry.
- Runtime Connector V2 integration.
- Heartbeats.
- Remote capability reporting.
- Node-level health and capacity.

### Proposed Phase 7: Runtime Connectors

Goal:

```text
Admin governs which runtimes, workspaces, agent classes, users, and roles can access each connector.
```

Required outcomes:

- Platform, Workspace, and Personal connector scopes.
- ERP/CRM/HR/Accounting connectors treated as Workspace connectors by default.
- Connector policy maps allowed agent classes, users/roles, actions, approvals, and quotas.
- Personal agents do not receive company transaction connector access by default.

### Proposed Phase 8: Approval Policy

Goal:

```text
Admin defines which risky actions require human approval before execution.
```

Required outcomes:

- Approval rules by workspace, role, user, agent, connector, and action.
- Approval for external send/post, company-system writes, restricted downloads/extraction, browser research where required, impersonation, and runtime operations.
- Approval request detail can show Browser Evidence attached to the underlying run.

### Proposed Phase 9: Workflow Routine Admin

Goal:

```text
Admin manages scheduled and recurring routines without bypassing connector, approval, or quota policy.
```

Required outcomes:

- Platform, Workspace, and Personal routine types.
- Routine dependencies on agent class, connector, approval policy, and quota.
- Routine runs link to their run detail, including Browser Evidence or Research Run details when applicable.

### Proposed Phase 10: Workspace Run History, Browser Evidence, and Research Runs

Goal:

```text
Users/workspaces see their own run history, browser proof, research outputs, and artifacts in context.
```

Required outcomes:

- Browser Evidence is attached to the specific browser-related run.
- Research Runs are workspace/user run history, not a standalone Admin menu item.
- Admin reaches evidence/research contextually through Audit Log, Approval request detail, Costs / Usage, Quota, or Workspace Runtime Console.
- Research policy ladder is enforced:
  - Basic research: allowed.
  - Deep research: quota-limited.
  - Browser research: approval or quota-limited.
  - Download / extract files: restricted.
  - Use internal docs: role-controlled.

### Proposed Phase 11: Costs / Usage and Quota

Goal:

```text
Admin can attribute and limit usage before execution, including research depth and browser/file activity.
```

Required outcomes:

- Usage attributed by workspace, runtime, user, role, agent, agent class, connector, routine, run type, model/provider, token usage, cost, browser usage, and file extraction.
- Quota enforced before execution, not only reported afterwards.
- Research usage appears under Costs / Usage and Quota, not as a standalone Admin Research Runs page.
- Browser usage appears under Costs / Usage and run evidence, not as a standalone Admin Browser Evidence page.

Detailed planning doc:

```text
docs/plans/2026-06-06-admin-runtime-governance-phases-7-11.md
```

---

## 16. Explanation to technical stakeholders

The platform is a multi-tenant AI workforce control plane.

Mission Control owns identity, tenancy, assignment, policy, and audit state. Hermes owns execution. Each tenant/user/workspace gets an isolated Hermes home and runtime, usually containerized. Agents are classified as Platform, Workspace, or Personal. Platform agents are Admin-only control-plane agents and must not appear in normal user directories. Workspace agents are assignable by Admin or workspace policy to users/roles for company-related workflows. Personal agents belong to individual users and run under safe policy limits. User-visible agent directories are filtered by class, assignment, role, and policy. Runtime calls are checked again server-side so the UI cannot bypass permissions.

The key principle is **policy before execution**:

```text
User request
  → Mission Control identifies workspace identity
  → Mission Control resolves allowed agents/tools/models
  → Mission Control routes to the user's isolated Hermes runtime
  → Hermes executes inside that runtime's profile/container
  → Mission Control records evidence/audit where needed
```

This design gives:

- Tenant isolation.
- Central governance.
- Shared templates without shared memory.
- Admin runtime supervision.
- A path to user-created agents.
- A path to multi-node deployments.

---

## 17. Explanation to functional/business stakeholders

Mission Control lets Admin manage many AI workspaces from one place.

Each customer/user gets a private workspace where their digital coworkers operate. Admin can assign Workspace agents, control what they are allowed to do, monitor whether the runtime is healthy, and approve sensitive actions. Platform agents are reserved for Admin-only platform operations. Personal agents support individual productivity but do not automatically receive access to company transaction systems.

This means Nexius can offer SMEs a governed AI workforce platform instead of a loose collection of chatbots.

The value proposition is:

- **Control** — Admin decides who can use what.
- **Safety** — sensitive actions require approval.
- **Isolation** — each workspace has separate memory, files, sessions, and credentials.
- **Scalability** — new users/workspaces can be added without mixing their data.
- **Flexibility** — users can eventually design their own agents within safe boundaries.
- **Auditability** — important actions are traceable.

---

## 18. Recommended final product wording

Use this wording when explaining the platform:

> Mission Control is the Admin control plane for governed AI workforces. Each user or company workspace runs in its own isolated Hermes runtime, while Admin centrally manages runtime health, policies, approvals, audit logs, and three agent classes: Admin-only Platform agents, role/user-assigned Workspace agents for company operations, and user-owned Personal agents for individual productivity. Users can operate assigned Workspace agents and create Personal agents inside safe policy boundaries, without compromising tenant isolation or platform governance.

---

## 19. Key decisions to preserve

1. Use **one Mission Control Admin platform**, not one disconnected admin console per Hermes account.
2. Use **many isolated Hermes runtimes/profiles**, not one shared Hermes runtime for every user.
3. Host runtimes on the **same VPS initially**, using separate Docker containers and runtime folders.
4. Allow Admin to select which workspace/runtime console to view.
5. Make impersonation explicit and audit logged.
6. Treat agent classes distinctly: Platform agents are Admin-only, Workspace agents are assignable by user/role for company operations, and Personal agents are user-owned.
7. Let users eventually create Personal agents, but only inside policy boundaries and without automatic company-system access.
8. Separate **agent creation** from **tool/model/credential permission**.
9. Enforce access in the backend, not only in the UI.
10. Design now for future multi-node/customer-dedicated runtime deployment.
