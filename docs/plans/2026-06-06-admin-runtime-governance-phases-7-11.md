# Proposed phases 7-11: Runtime operations and governance extensions

Date: 2026-06-06
Status: assigned to Andrej / Hermes profile `devops` as dependency-gated Kanban build tasks. Do not start until the parent Admin design phases 0-6 are complete.

Kanban tenant:

```text
mission-control-admin-multi-runtime-design
```

Assigned task chain:

```text
Phase 6 parent: t_16592730
  └── Phase 7 Runtime Connectors: t_6ecf48fa
        └── Phase 8 Approval Policy: t_ef23e0ba
              └── Phase 9 Workflow Routine Admin: t_a5e3b4f0
                    └── Phase 10 Workspace run history, Browser Evidence, and Research Runs: t_bda18420
                          └── Phase 11 Costs / Usage and Quota: t_22d696e0
```

Assignee instructions for Andrej:

- Work phase by phase only; every phase depends on the previous phase.
- Do not proceed unless focused tests for the current phase pass.
- Keep code clean: centralized policy helpers, clear types, no duplicated permission logic, no hardcoded secrets, and no frontend-only enforcement.
- Completion summaries must include changed files, tests run, build/deploy result if applicable, and known limitations.

Source of truth:

- `docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md`
- User decision: Browser Evidence and Research Runs should not be standalone Admin menu items.

## Product decision

Browser Evidence and Research Runs are primarily **user/workspace run-history features**, not primary Admin control surfaces.

Admin still needs indirect visibility through governance contexts:

- Audit Log event detail
- Approval request detail
- Costs / Usage breakdown
- Quota policy and usage limits
- Workspace Runtime Console when supervising a workspace

This keeps the Admin UI focused on control, policy, and operations, while keeping proof-of-work and research outputs close to the user task that produced them.

## Updated Admin IA after phases 0-6

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

## Updated Workspace IA

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

## Browser Evidence placement

Browser Evidence should be attached to the specific run that generated it.

Primary placement:

```text
Workspace → Runs → selected run → Evidence drawer
Agent Chat → completed run → Evidence drawer
Routine Run → selected execution → Evidence drawer
```

Secondary Admin placement:

```text
Admin → Audit Log → event detail → Evidence
Admin → Approval Queue / Approval Policy → request detail → Evidence
Admin → Workspace Runtime Console → Runs → selected run → Evidence
```

Do **not** add a standalone Admin menu item named Browser Evidence.

### Browser Evidence access rules

```text
Platform agent evidence:
  Admin-only.

Workspace agent evidence:
  visible to authorized workspace users/roles and Admin through audit/support/supervision context.

Personal agent evidence:
  visible to the owning user by default.
  Admin should see metadata by default, not full content, unless policy/support/legal workflow explicitly permits access.
```

### Browser Evidence examples

- screenshot before/after action
- URL and page title
- browser console errors
- form submission proof
- downloaded file metadata
- extracted page text
- timestamp and agent/run identity

## Research Runs placement

Research Runs should be run history and artifacts, not a primary Admin menu item.

Primary placement:

```text
Workspace → Runs → Research Runs
Workspace → Chat / Agents → research output → Research Run detail
```

Secondary Admin placement:

```text
Admin → Costs / Usage → research usage breakdown
Admin → Quota → research limits
Admin → Audit Log → research events
Admin → Workspace Runtime Console → Research Runs
```

Do **not** add a standalone Admin menu item named Research Runs.

## Research Run policy model

Research is not usually high-risk by itself. The main Admin controls are cost, source/data scope, depth, browser usage, downloads, and internal-data access.

Use this policy ladder:

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

### Definitions

#### Basic research

Public web search, lightweight summarization, citation collection, and normal drafting.

Default policy:

```text
Allowed for normal users and Personal/Workspace agents within normal usage quota.
```

#### Deep research

Multi-step research that may use more sources, larger context, more model calls, subagents, or longer runtime.

Default policy:

```text
Allowed but quota-limited by workspace/user/model/provider.
```

#### Browser research

Research that opens websites in a browser, navigates pages, captures screenshots, or relies on browser automation.

Default policy:

```text
Approval-required or quota-limited depending on workspace risk policy.
Evidence is attached to the run.
```

#### Download / extract files

Research that downloads PDFs, spreadsheets, documents, images, or archives, or extracts text from uploaded/downloaded files.

Default policy:

```text
Restricted.
May require approval, file-type allowlist, size limit, virus scan, and audit event.
```

#### Use internal docs

Research over private workspace knowledge, Google Drive, emails, CRM exports, HR policies, contracts, finance files, meeting transcripts, or other internal content.

Default policy:

```text
Role-controlled.
Must follow workspace data-access policy and connector permissions.
```

## Phase 7 — Runtime Connectors

### Objective

Implement connector governance as the foundation for company-system access.

### Scope

- Connector inventory by workspace/runtime.
- Connector scopes:
  - Platform connector
  - Workspace connector
  - Personal connector
- Allowed agent classes per connector.
- Allowed actions per connector:
  - read
  - draft
  - write
  - delete
  - external send/post
- Connector risk level and approval requirement.
- Role/user assignment for Workspace connectors.

### Explicit non-scope

- Browser Evidence standalone Admin page.
- Research Runs standalone Admin page.

### Testing before completion

- Platform connectors hidden from normal users.
- Workspace connector visible only to authorized users/roles.
- Personal connector visible only to owner.
- Workspace agent can use allowed Workspace connector action.
- Personal agent cannot use ERP/CRM/HR/Accounting connector by default.
- Backend rejects direct unauthorized connector use.

## Phase 8 — Approval Policy

### Objective

Implement policy rules for actions that require human approval.

### Scope

- Policy hierarchy:
  - platform
  - workspace
  - role
  - user
  - agent
  - connector
  - action
- Approval rules for:
  - external send/post
  - CRM/ERP/HR/Accounting writes
  - file downloads/extraction where restricted
  - browser research where approval policy requires it
  - impersonation
  - runtime/container operations
- Approval request detail may include Browser Evidence if generated by the run.

### Testing before completion

- Allowed action runs without approval.
- Approval-required action pauses and creates approval request.
- Denied action stays blocked.
- Browser research can be configured as approval-required.
- Download/extract can be configured as restricted.
- Audit event is emitted for request, approval, denial, and execution.

## Phase 9 — Workflow Routine Admin

### Objective

Implement Admin control of recurring/scheduled routines.

### Scope

- Routine inventory by workspace/runtime.
- Routine type:
  - Platform routine
  - Workspace routine
  - Personal routine
- Schedule/trigger status.
- Agent class and agent used.
- Connector dependencies.
- Approval policy dependency.
- Quota impact.
- Last run / next run / run status.

### Evidence and research placement

Routine executions should link to run details:

```text
Routine → execution run → Browser Evidence, if any
Routine → execution run → Research Run detail, if research was performed
```

### Testing before completion

- Normal user cannot manage Platform or other-workspace routines.
- Workspace-authorized user can see allowed Workspace routines.
- Personal routine is private to owner.
- Routine cannot run if connector, approval, or quota policy blocks it.
- Routine run links to evidence/research artifacts contextually.

## Phase 10 — Run History, Browser Evidence, and Research Runs as workspace features

### Objective

Build user/workspace run-history surfaces for evidence and research without adding standalone Admin menu items.

### Scope

- Workspace run history.
- Run detail drawer/page.
- Browser Evidence attached to browser-related runs.
- Research Run detail attached to research-related runs.
- Artifacts/files linked to each run.
- Admin contextual access via Audit Log, Approval request detail, and Workspace Runtime Console.

### Research policy implementation

Implement the policy ladder:

```text
Basic research: allowed
Deep research: quota-limited
Browser research: approval or quota-limited
Download/extract files: restricted
Use internal docs: role-controlled
```

### Testing before completion

- User sees their own Browser Evidence attached to their own run.
- User sees their own Research Runs.
- Another user cannot see Personal run content.
- Workspace-authorized user can see Workspace run content.
- Admin does not have a standalone Browser Evidence or Research Runs nav item.
- Admin can reach evidence/research through Audit/Approval/Workspace Console context.
- Basic research allowed within quota.
- Deep research blocked or warned when quota exceeded.
- Browser research follows approval/quota setting.
- Download/extract files restricted without approval/permission.
- Internal docs require role-controlled access.

## Phase 11 — Costs / Usage and Quota

### Objective

Implement cost attribution and enforceable quota across runtimes, agents, connectors, routines, browser usage, and research depth.

### Scope

- Usage attribution fields:
  - workspace_id
  - runtime_id
  - user_id
  - role_id where applicable
  - agent_id
  - agent_class
  - connector_id where applicable
  - routine_id where applicable
  - run_type
  - model/provider
  - token usage
  - estimated cost
  - browser minutes/actions
  - file extraction size/count
- Quota levels:
  - platform
  - workspace
  - user
  - agent
  - routine
  - connector
  - model/provider
  - research depth
- Enforcement before execution, not only reporting after usage.

### Research-specific quotas

- Basic research count/cost.
- Deep research count/cost/source limit/runtime limit.
- Browser research count/browser-minute quota.
- Download/extract size and count quota.
- Internal-doc access quota or role-based limits.

### Testing before completion

- Usage is attributed by workspace/user/agent_class/model.
- Quota blocks execution before run starts when over limit.
- Quota block creates audit event.
- Costs / Usage page groups by Platform, Workspace, and Personal agents.
- Research usage appears under Costs / Usage, not as a standalone Admin Research Runs page.
- Browser usage appears under Costs / Usage, not as a standalone Admin Browser Evidence page.

## Summary decision

Keep Admin focused on governance and operations:

```text
Admin controls connector access, approval, routines, quota, audit, and costs.
Users/workspaces see their own run history, browser proof, research outputs, and artifacts.
```
