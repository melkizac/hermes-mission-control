# Hermes Mission Control Operator Documentation

Last verified: 2026-06-05 SGT
Live service: `https://hermes.melverick.com`
Local service: `http://127.0.0.1:19080`
Source repo: `/opt/hermes-mission-control/source`
Runtime app: `/opt/hermes-mission-control`
Backend entrypoint: `/opt/hermes-mission-control/app.py`
Production frontend bundle: `/opt/hermes-mission-control/dist`

## Root-only login credential reset

Mission Control credentials are reset from the server, not from public demo shortcuts. The root/operator helper is:

```bash
sudo /opt/hermes-mission-control/reset-login.py --username NEW_LOGIN_ID
```

Safe operating rules:

- Run it only as root or via sudo on the Mission Control host; it fails before reading or writing credentials for non-root users.
- Omit `--password` for normal use so the helper prompts with `getpass` and never echoes the password.
- Use `--generate` to create a temporary password. It remains hidden by default; `--print-password` is allowed only with `--generate` from an interactive local TTY for display-once emergency handoff.
- The helper updates the systemd `HMC_USER` / `HMC_PASSWORD_FILE` values, writes the password file as `0600`, updates the Mission Control auth DB user record, clears `last_login_at`, and restarts `hermes-mission-control.service` unless `--no-restart` is supplied.
- The helper backs up `/opt/hermes-mission-control/mission_control.db` before modifying auth records. Keep that backup root-only and delete stale backups after the emergency window.
- Output is redacted by default: it prints the username, password-file path, auth DB path, backup path, and service restart status, but not the password.

Rollback:

1. Re-run the helper with the prior intended username/password, or restore the timestamped `mission_control.db.reset-backup-*` file after stopping the service.
2. Restore the previous `Environment=HMC_USER=...` and `Environment=HMC_PASSWORD_FILE=...` lines in `/etc/systemd/system/hermes-mission-control.service` if needed.
3. Run `systemctl daemon-reload && systemctl restart hermes-mission-control.service`.
4. Verify login through `/api/login` or `/login`; do not paste passwords into shared logs or chat.

Related design docs:

- [`ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md`](./ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md) — Admin control-plane design for many isolated Hermes user/workspace runtimes, written for both technical and functional stakeholders.
- [`plans/2026-06-06-admin-runtime-governance-phases-7-11.md`](./plans/2026-06-06-admin-runtime-governance-phases-7-11.md) — proposed later phases for Runtime Connectors, Approval Policy, Workflow Routine Admin, workspace run history, Browser Evidence, Research Runs, Costs / Usage, and Quota.
- [`RUNTIME_CONNECTOR_V2.md`](./RUNTIME_CONNECTOR_V2.md) — external runtime connector registration, heartbeat, and event ingestion.

## 1. What Mission Control is

Hermes is the worker layer. **Mission Control is the management, audit, and trust layer.**

Mission Control turns Hermes from a set of chats, cron jobs, Kanban records, logs, and profile folders into one operator cockpit for digital coworkers. The product goal is to move from:

> “I chat with an agent”

into:

> “I operate a team of digital coworkers with visible work, evidence, approvals, and runtime controls.”

Mission Control is designed around four operating questions:

1. **What needs me now?** — approvals, blockers, failed routines, gateway warnings.
2. **What is running?** — active agents, browser sessions, routines, runtime connectors.
3. **What did agents produce?** — task results, artifacts, screenshots, links, run traces.
4. **Can I trust it?** — evidence, audit logs, approval gates, costs, source data, execution boundaries.

## Chat command center

Chat is the clean signed-in landing surface for Mission Control. It replaces the old Home concept: the user should not need to choose Goal, Project, Mission, Task, Workflow, Routine, or Approval before speaking. The main chat UI is where the user tells Melkizac what they want done, and Melkizac routes the request to new or existing work.

The Chat command center intentionally follows a minimal screenshot-like layout: one centered heading, one rounded composer, one project strip, and a lightweight mission list. Operational cards, attention panels, running-work summaries, health cards, output panels, and recommended-action blocks belong on the separate **Dashboard** page, not below Chat.

The Chat command center contains:

1. **main input message box** — a large composer with the placeholder `Do anything`. Users can start new goals, continue missions, revise outputs, answer approvals, resolve blockers, ask for status, or modify routines here.
2. **Add document/image** — `Add document or image` accepts common image/document/data formats and enforces **Add document or image up to 50MB** through the `MAX_ATTACHMENT_BYTES` composer guard. Attachment chips show filename and size before submission.
3. **Permission mode** — visible selector supports `Full access`, `Ask permission`, and `Draft only`; prompt context maps these to governed permission boundaries such as `Full access within policy` and `Ask before critical actions`.
4. **AI model selector** — supports `AUTO` and concrete model modes such as `5.5 Medium`. **AUTO means Melkizac chooses the best model per step**.
5. **Project selector** — shows `No Project selected` when empty. **No Project selected means Melkizac should not assume a project boundary**; it may search across the workspace, but should ask when ambiguous. When no project is selected, Chat does not display any bottom mission list or placeholder rows below the project selector. Selecting a project gives Melkizac a strong context hint, not an absolute override.
6. **Missions in the selected project** — after a project is selected, Chat shows its goals/tasks as simple mission rows. Selecting a mission adds a `Mission:` context to the next submitted instruction.

When the user submits from Chat, Mission Control appends an internal context block to the instruction with Project, Mission, Permission, Model, and attachment names/sizes. This makes the routing decision visible and correctable while keeping the user experience simple.

## Glossary: Mission Control terminology

Mission Control uses these canonical terms when turning plain user intent into governed AI work. The simplest operator map is:

```text
Project = the folder / operating space
Goal = the desired result
Mission = the campaign/run to achieve the result
Task = the individual action
Evidence = proof it happened
```

For the broader system, the relationship is:

```text
Intent → Project → Goal → Mission → Tasks → Outputs / Evidence

If repeatable:
Goal → Workflow → Routine → Runs
```

### Relationship map

- User expresses **Intent**.
- Melkizac identifies the **Project**: the folder / operating space where the work belongs.
- Melkizac converts Intent into a **Goal**: the desired result with success criteria, assumptions, missing context, approval boundaries, and evidence expectations.
- To pursue the Goal, Melkizac starts a **Mission**: the campaign/run designed to achieve the result.
- The Mission is broken into **Tasks**.
- Tasks are assigned to **Agents**, humans, or system **Routines**.
- Tasks use **Skills** and **Tools**.
- Tools may require **Connectors** and **Runtimes**.
- Sensitive actions require **Approval Gates**.
- Missing access/context/capability creates **Blockers**.
- Completed Tasks produce **Outputs / Artifacts**.
- Outputs are supported by **Evidence**.
- Everything important is recorded in the **Audit Log**.
- If the process is repeatable, it becomes a **Workflow**.
- If the Workflow should recur automatically, it becomes a **Routine**.

### Core definitions

- **Intent**: Raw user request in plain language.
- **Project**: Folder / operating space where related goals, missions, tasks, evidence, routines, agents, files, and context belong.
- **Goal**: Desired result / structured business outcome Hermes is trying to achieve.
- **Mission**: Campaign or execution run designed to achieve a goal.
- **Task**: Individual action / concrete unit of work assigned to an agent, human, or system routine.
- **Workflow**: Reusable process template for a type of work.
- **Routine**: Scheduled or recurring Hermes work.
- **Automation**: Technical implementation behind a routine, such as cron, webhook, or background worker.
- **Skill**: Reusable know-how or operating procedure Hermes follows.
- **Tool**: Execution capability Hermes can use, such as browser, Telegram, GitHub, Supabase, filesystem, or Google Workspace.
- **Connector**: Integration that gives Hermes access to an external system or account.
- **Runtime**: Environment where work executes, such as the Hermes server, browser runtime, cron scheduler, or desktop gateway.
- **Agent**: AI worker or logical role responsible for work.
- **AI Workforce**: User-facing view of agents and responsibilities.
- **Approval Gate**: Human approve/reject checkpoint before sensitive external, irreversible, costly, policy-sensitive, or authority-bound action.
- **Blocker**: Missing access, context, permission, capability, or human decision preventing progress.
- **Output / Artifact**: Deliverable Hermes produced, such as a draft, report, file, checklist, deck, or code change.
- **Evidence**: Proof it happened, such as screenshot, final URL, source link, API response, test result, build output, approval record, lead record, draft, or run trace.
- **Audit Log**: Detailed operational record of what happened, when, why, by whom, using which tools, with errors/retries/costs where available.
- **Run**: One execution instance of a mission, task, workflow, or routine.

### Key distinctions

- **Project vs Goal**: Project is the folder / operating space; Goal is the desired result.
- **Mission vs Task**: Mission is the campaign/run to achieve the result; Task is an individual action.
- **Workflow vs Routine**: Workflow = reusable process template; Routine = scheduled or recurring execution.
- **Routine vs Automation**: Routine is the user-facing term; automation is the technical implementation.
- **Skill vs Tool**: Skill = reusable know-how; tool = execution capability.
- **Approval Gate vs Human Task**: Approval Gate = approve/reject checkpoint; human task = manual action.
- **Output vs Evidence**: Output = deliverable; evidence = proof that the work happened.

### Example chain

```text
Intent:
“I want more people to sign up for next month’s AI course.”

Goal:
Increase qualified AI course signups.

Project:
Nexius Academy Course Growth.

Mission:
Run this month’s signup campaign.

Tasks:
- Check funnel
- Draft posts
- Monitor leads
- Prepare follow-up

Skills:
Website funnel check, LinkedIn content architect, lead monitoring.

Tools/connectors/runtimes:
Browser, LinkedIn/browser connector, Supabase, cron scheduler.

Approval Gate:
Approve LinkedIn post before publishing.

Blocker:
LinkedIn posting access unavailable or course date missing.

Outputs:
Funnel audit report, LinkedIn draft, follow-up checklist.

Evidence:
Screenshots, drafts, lead records, approval trail.

If repeatable:
Workflow = Course signup growth loop.
Routine = Run every Monday at 9am.
```

## 2. Major revamp summary

The current build is a major revamp from a simple agent dashboard into a phased Mission Control platform.

Implemented phases:

- **Phase 1 — Delegate Work front door:** turn a plain instruction into a routed project/agent task.
- **Phase 2 — Artifact and evidence result view:** every important task can expose proof of work, artifacts, evidence, approval gates, and next actions.
- **Phase 3 — Packaged SME Workflow Library:** reusable business workflows such as Nexius Academy lead intake and LinkedIn content operating loop.
- **Phase 4 — Desktop Gateway / Runtime Readiness:** expose runtime targets, execution boundaries, readiness, and Windows-local setup status without pretending real Windows access exists.
- **Phase 5 — Browser operation visibility / readiness layer:** expose browser-session contracts and API fields for domain, URL, screenshot evidence, action log, risk labels, approval gates, and final evidence while keeping real Windows-local execution blocked until gateway configuration exists.
- **Phase 6 — Mobile Operator Hardening + Telegram deep links:** direct links can open task, approval, agent, or result contexts for mobile handoff.
- **Phase 7 — Browser Activity operator surface:** Browser Activity is now a workspace-visible operator page with stop/takeover controls, drawer-first details, and layout regression protection.
- **Phase 8 — Mobile Operator Mode / Field Operator UX:** mobile quick-action dock and field-operator interventions for Needs Attention, Running Now, Browser Activity, Delegate Work, and Task Board.
- **Phase 9 — Research Runs visibility:** research command center for parallel research lanes, evidence, confidence, blockers, and synthesis status.
- **Phase 10 — Research Run creation bridge:** operator-created wide research missions that create tracked research runs and linked work.
- **Phase 11 — Browser Runtime Event Bridge:** live browser/runtime connectors can now POST session events into Mission Control; Browser Activity merges runtime-event sessions with the readiness fallback and exposes live-event counts, domains, screenshots, action logs, account-sensitive flags, approval gates, and stop/takeover controls.
- **Phase 12 — Browser Runtime Producer Client:** browser workers now have a reusable producer client at `source/scripts/browser_runtime_producer.py` for publishing Browserbase/Playwright/desktop-browser lifecycle events, screenshots, final evidence, approval-before-submit/post/send/purchase boundaries, and stop/takeover polling into the Phase 11 bridge.
- **Phase 13 — Safe Browser Funnel Check Probe:** a real Playwright no-submit website funnel probe at `source/scripts/browser_funnel_check_probe.py` now imports the producer, opens a safe public form page, captures screenshot evidence, detects forms/submit controls, emits final evidence, and leaves Mission Control blocked before submit for operator approval.
- **Phase 14 — Production Browser Funnel Check Job:** `source/scripts/browser_funnel_check_job.py` turns the probe into a repeatable batch job with JSON target configs, Task Board task creation/update, screenshot/final URL/browser-session evidence handoff, approval-gated submit boundaries, and stop/takeover polling before and after browser execution.
- **Phase 15 — Website Funnel Check packaged workflow:** Workflow Library now exposes a Website Funnel Check operator workflow that accepts a `targetUrl`, creates a queued Task Board item with Phase 14 job config/command artifacts, keeps `NO_SUBMIT` enforced, and surfaces approval gates before any real form submit.
- **Phase 16 — Scheduled Funnel Checks:** Website Funnel Check can now prepare paused recurring routine bindings from Workflow Library with a cron schedule, target config, latest-run status, evidence-history fields, and mandatory `NO_SUBMIT`/approval safeguards.
- **Phase 17 — Enable real scheduled funnel routines:** Routines can now explicitly enable an approved Website Funnel Check binding as a real Hermes cron job only after operator approval, preserving `NO_SUBMIT`, safe-target metadata, local delivery, Browser Activity evidence links, and run-history ingestion.
- **Phase 18 — Configured target management + routine history UI:** Routines now includes a Website Funnel Check target registry for safe public URLs, target approval status, per-target enable/pause/run-now controls, latest run status, and evidence-history counts while keeping `NO_SUBMIT` and `safeTargetRequired` mandatory.
- **Phase 19 — Target evidence drill-down + production connector readiness:** Website Funnel Check targets now open evidence detail with latest screenshot, Browser Activity session link, Task result evidence link, final URL, approval history, and production connector readiness while run-now remains dry-run only / `NO_SUBMIT`.
- **Phase 20 — Production connector configuration gate:** Routines now has a connector gate for Browserbase, desktop-browser, and future Windows gateway connectors. It stores only `[REDACTED]` credentials, requires explicit approval and dry-run connectivity testing, keeps account-sensitive actions disabled, and does not enable any real connector before the checkpoint.

Checkpoint note: the browser operator surface, runtime event bridge, producer-side client, first low-risk real browser job, production-safe batch wrapper, packaged Website Funnel Check workflow, scheduled funnel-check routine binding, approved routine enablement path, target-management/history layer, target evidence/readiness drill-down, and production connector gate are implemented. Real Browserbase, desktop-browser, or Windows gateway execution is still intentionally blocked until the next checkpoint approves connector enablement. **Workflow-specific model compare** is also pending; the current Model Router only supports model allow-listing and route planning.

## 7.6 Task Board

The **Task Board** is the operator-facing work ledger for agent-owned work, Melverick-owned decisions, blockers, and completion evidence. It should be named Task Board in docs and UI, not Task Board / Issues.

Add and refresh controls are icon-only buttons aligned on the right side of the title row so mobile and desktop operators can quickly create a task or reload the board without crowding the page title. The buttons expose accessible labels: `Add action` and `Refresh task board`.

## 3. Access and operating modes

### 3.1 Login

Public entry points:

- `/` — public landing page.
- `/login` — authenticated operator login.
- `/demo-login` — demo-only session shortcut used for safe public/demo verification.
- `/app` — authenticated Mission Control app shell.

Example:

```bash
curl -i https://hermes.melverick.com/login
```

Login API:

```bash
curl -i -X POST https://hermes.melverick.com/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"[REDACTED]"}'
```

Do not document or print real passwords, API keys, gateway tokens, or cookie values.

### 3.2 User mode vs Admin mode

Mission Control has two UI modes.

**User mode** is the day-to-day operator workspace:

- Mission Control
- Delegate Work
- Workflow Library
- My Projects
- My Task Board
- Needs Attention
- My Agents
- My Agent Org
- Routines
- Browser Activity
- Workspace Knowledge
- My Audit / Evidence
- Profile

**Admin mode** is setup/governance:

- Admin Overview
- Users & Workspaces
- Platform Agent Org
- Shared Agent Templates
- Runtime Connectors
- Desktop Gateway
- Browser Activity
- Model Router
- Tools
- Skills
- Global Audit Log
- Costs / Usage
- Approval Policy
- Quota

Use User mode when supervising real work. Use Admin mode when configuring runtimes, tools, skills, policy, and cost controls.

## 4. Architecture and runtime layout

```text
/opt/hermes-mission-control/
  app.py                         Python HTTP backend + static file server
  dist/                          Deployed production frontend bundle
  approvals.db                   Durable approval/inbox data
  agent_activity.db              Agent Org activity/audit data
  processing-requests.json       Active web/API request tracking before restarts
  checkpoints/                   Local recovery checkpoints

/opt/hermes-mission-control/source/
  src/App.tsx                    App shell and route/view mapping
  src/components/NavRail.tsx     User/Admin navigation
  src/views/                     Page-level React views
  src/services/hermesClient.ts   Frontend client contract
  src/services/httpHermesClient.ts HTTP implementation
  src/services/mockHermesClient.ts Demo/mock implementation
  src/services/deepLinks.ts      Mission Control deep-link parsing
  src/services/store.tsx         App state, auth, permissions, deep-link target
  src/types.ts                   Shared frontend domain types
  src/styles/app.css             App styles and responsive/mobile rules
  tests/                         Source-level regression tests
  docs/                          Documentation
```

Hermes data sources used by Mission Control:

```text
/root/.hermes/state.db           Sessions, messages, cost/token fields
/root/.hermes/cron/jobs.json     Routines / scheduled work
/root/.hermes/cron/output/       Routine artifacts
/root/.hermes/kanban.db          Task Board storage
/root/.hermes/skills/            Installed skill library
/root/.hermes/agent_registry.yaml Agent Org registry
/root/.hermes/logs/              Runtime logs
```

Second Brain source:

```text
/root/.openclaw/workspace/kb/
  raw/                           Source inputs
  wiki/                          Compiled markdown wiki
  schema/WORKFLOW.md             KB workflow/schema rules
```

Service:

```text
systemctl status hermes-mission-control.service
```

Safe deploy rule:

1. Build frontend in `/opt/hermes-mission-control/source`.
2. Check `/opt/hermes-mission-control/processing-requests.json` for active requests.
3. Sync `source/dist/` to `/opt/hermes-mission-control/dist/`.
4. Restart `hermes-mission-control.service` only when safe.
5. Verify local API and browser UI.

## 5. Common usage patterns

### 5.1 “I want an agent to do work”

Use **Delegate Work**.

Example:

1. Open `Delegate Work`.
2. Select project context, e.g. `Nexius Academy`.
3. Select execution target/agent, e.g. `Content Ops` or `Melkizac`.
4. Enter a clear outcome:

```text
Audit the Nexius Academy lead intake flow and produce a list of missing tracking, form, or follow-up issues with evidence.
```

5. Use preview/dry-run if available.
6. Create delegated task.
7. Open the Task Board card and review result evidence.

API example:

```bash
curl -s -b cookie.txt http://127.0.0.1:19080/api/delegate-work/context | jq
```

### 5.2 “I need to review what needs me”

Use **Mission Control** or **Needs Attention**.

- Mission Control shows the daily cockpit: attention, running work, recent outputs, system health, and next actions.
- Needs Attention shows approval/review items requiring human action.

Example human action:

```text
A LinkedIn post draft is ready.
Open Needs Attention → review source/evidence → edit if needed → approve or reject.
```

### 5.3 “I need proof of what an agent did”

Use **Task Board** or **Audit / Evidence**.

- Task Board shows the operational task and result drawer.
- Audit / Evidence shows session/run traces, messages, costs, tool calls, and provenance.

Example:

```text
Open My Task Board → click a completed task → open Result / Evidence → inspect artifacts, evidence records, approval gates, and next actions.
```

### 5.4 “I need to see what an agent is doing in a browser”

Use **Browser Activity**.

Example:

```text
Open Browser Activity → choose a session → inspect domain, URL, screenshot, action log, approval gate, and final evidence → Stop or Takeover if needed.
```

External-facing actions such as submit, post, send, or purchase should be approval-gated.

### 5.5 “I want to launch a repeatable SME workflow”

Use **Workflow Library**.

Example:

```text
Open Workflow Library → select “Nexius Academy lead intake” → review steps and approval gates → launch → follow the created Task Board item.
```

### 5.6 “I received a Telegram link”

Open the link on mobile or desktop. Deep links are designed to route you to the relevant surface and auto-open the right context.

Examples:

```text
/app?view=board&task=<task_id>
/app?view=approvals&approval=<approval_id>
/app?view=agents&agent=<agent_id>
/app?view=task-result&task=<task_id>
```

Expected behavior:

- Task link opens Task Board and the linked task drawer.
- Approval link opens Needs Attention and the linked approval drawer.
- Agent link opens the Agents page with the selected agent context.
- Task result link opens result/evidence context.

## 6. Feature guide

### 6.1 Mission Control cockpit

**Purpose:** daily operator homepage.

Use it to answer:

- What needs attention?
- What is running now?
- What did agents recently produce?
- Is the system healthy?
- What should I do next?

Typical controls:

- Review attention item.
- Open Task Board.
- Track running agent/task.
- Open Audit / Evidence.
- Open Settings when health/setup issues appear.

Example workflow:

```text
Start your day → open Mission Control → review Needs Attention → inspect Running Now → open recent output evidence → act on Next Recommended Action.
```

Representative API inputs:

- `/api/status`
- `/api/inbox`
- `/api/automations`
- `/api/task-board`

### 6.2 Delegate Work

**Purpose:** simple front door for assigning work to digital coworkers.

What it does:

- Loads projects, agents, skills, and execution targets.
- Helps convert a human request into a structured task.
- Creates Task Board work with routing/evidence metadata.
- Adds operator-ready links where available.

How to use:

1. Describe the outcome, not just a command.
2. Select project/workspace if relevant.
3. Pick agent/runtime if known; otherwise let Mission Control route.
4. Review the generated brief.
5. Create task.

Good example:

```text
Find the top 5 funnel issues on nexiusacademy.com that could reduce course enquiries. Provide screenshots or URLs as evidence and create follow-up tasks for each issue.
```

Poor example:

```text
Check website.
```

APIs:

```text
GET  /api/delegate-work/context
POST /api/delegate-work/plan
POST /api/delegate-work
```

### 6.3 Workflow Library

**Purpose:** packaged SME workflows that can be launched repeatedly.

Current workflow examples:

- Nexius Academy lead intake.
- LinkedIn content operating loop.

How to use:

1. Open Workflow Library.
2. Search/filter for the workflow.
3. Review steps, expected artifacts, evidence, and approval gates.
4. Launch the workflow.
5. Track the generated task/result in Task Board.

API examples:

```bash
curl -s -b cookie.txt http://127.0.0.1:19080/api/workflows | jq '.workflows[].name'
```

```bash
curl -s -b cookie.txt -X POST \
  http://127.0.0.1:19080/api/workflows/linkedin-content-operating-loop/launch \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"demo","notes":"Prepare this week’s operator-led LinkedIn draft set."}' | jq
```

### 6.4 My Projects

**Purpose:** project/workspace context cockpit.

Use it to understand:

- what initiatives exist;
- what workspace/files/plans are linked;
- open actions and blockers;
- knowledge and activity associated with a project;
- which agents/workflows relate to it.

Example:

```text
Open My Projects → choose Nexius Academy → review open actions → create a project task for missing lead-source tracking → assign to Nexius Leads or Melkizac.
```

APIs:

```text
GET  /api/projects
GET  /api/workspaces
GET  /api/projects/<project_id>/brief
POST /api/projects/<project_id>/tasks
```

### 6.5 My Task Board

**Purpose:** operational queue for tasks, blockers, manual actions, and agent work.

Use it for:

- queued/running/blocked/done/error task states;
- human-only tasks assigned to Melverick;
- agent tasks assigned to Melkizac, Content Ops, DevOps Builder, etc.;
- evidence/result review;
- comments/operator instructions;
- task status changes.

Example:

```text
Open My Task Board → filter blocked → open card → read blocker and expected action → add comment “I have granted access” → move status or let agent resume.
```

Result/evidence example:

```text
Open completed task → Result Summary → inspect artifacts → check Evidence Timeline → review Approval Gates → follow Next Actions.
```

APIs:

```text
GET    /api/task-board
POST   /api/tasks
PATCH  /api/tasks/<task_id>
DELETE /api/tasks/<task_id>
GET    /api/tasks/<task_id>/result
POST   /api/tasks/<task_id>/comments
```

### 6.6 Needs Attention / Approval Gates

**Purpose:** human-in-the-loop review and approval.

Use this for:

- outbound messages or posts;
- destructive changes;
- costly/high-risk actions;
- external submit/post/send/purchase actions;
- policy-sensitive changes.

Not every human item belongs here. Use Task Board for manual actions, blockers, auth/payment/access issues, or “please review this” items that are not approve/reject gates.

Example:

```text
Open Needs Attention → open approval card → inspect draft and source → edit text if needed → approve, reject, or mark reviewed.
```

APIs:

```text
GET    /api/inbox
GET    /api/approvals
PATCH  /api/inbox/<item_id>
POST   /api/inbox/<item_id>/action
POST   /api/approvals/<approval_id>
DELETE /api/inbox/<item_id>
```

### 6.7 My Agents

**Purpose:** interact with Hermes agents and inspect agent context.

Current behavior:

- Aggregates meaningful Hermes chat across Terminal, Telegram, and Web UI where possible.
- Shows agent/profile-backed runtime identities.
- Supports selected-agent routing.
- Supports attachments.
- Keeps dense metadata in drawers/panels rather than taking over chat width.

How to use:

```text
Open My Agents → select Melkizac or DevOps Builder → send instruction → watch processing state → review response and attached evidence.
```

Example instruction:

```text
Check the latest Mission Control service health and summarize only blockers that need operator action.
```

APIs:

```text
GET    /api/agents
GET    /api/agents/<agent_id>
POST   /api/agents/<agent_id>/messages
POST   /api/agents/<agent_id>/messages/stop
POST   /api/agents/<agent_id>/attachments
GET    /api/project-chats
```

### 6.8 My Agent Org

**Purpose:** AI workforce control plane.

Use it to see:

- digital coworker roles;
- work/personal domains;
- active goals;
- queues;
- runs and outputs;
- permissions;
- health;
- collaboration flows.

Agent-owned goal rule:

- Agents should own strategy, step design, routine execution, and evidence.
- Melverick should only receive human-only tasks when tooling, access, legal authority, or external accounts require him.

Example:

```text
Open My Agent Org → select Content Ops → create goal “Generate 5 operator-led LinkedIn post angles this week” → check generated steps → ensure LinkedIn Growth is collaborator for scheduling/publishing.
```

APIs:

```text
GET  /api/agent-org
GET  /api/agent-goals
POST /api/agent-org/agents/<agent_id>/goals
POST /api/agent-org/agents/<agent_id>/action
POST /api/agent-org/agents/<agent_id>/goals/<goal_id>/actions/<action_id>
```

### 6.9 Routines

**Purpose:** scheduled/background Hermes cron work.

Use it to:

- see enabled/paused/error jobs;
- inspect schedules and outputs;
- run a routine now;
- pause/resume;
- inspect output evidence.

Example:

```text
Open Routines → find LinkedIn daily planner → check last/next run → open output → pause only if it is producing stale or duplicate work.
```

APIs:

```text
GET  /api/automations
POST /api/automations/<job_id>/action
```

Actions usually include run, pause, resume, or inspect depending on job state.

### 6.10 Browser Activity

**Purpose:** supervise live or simulated browser work.

Use it for:

- LinkedIn work;
- website funnel testing;
- form checks;
- lead capture checks;
- client research;
- Browserbase-style sessions;
- account-sensitive submit/post/send/purchase workflows.

Visible fields:

- current domain/site;
- current URL;
- screenshot preview/evidence slot;
- action log;
- browser session status;
- account-sensitive indicator;
- approval-required indicator;
- stop/takeover controls;
- final screenshot/link evidence.

Example:

```text
Open Browser Activity → select active session → verify it is only browsing → if it reaches a submit/post/send/purchase action, check approval gate → approve externally only after reviewing screenshot and action log.
```

APIs:

```text
GET  /api/browser-sessions
GET  /api/browser-sessions/<session_id>
POST /api/browser-sessions/<session_id>/stop
POST /api/browser-sessions/<session_id>/takeover
```

Safety rule:

- A simulated readiness session is not real browser access.
- Windows-local execution remains blocked until `WINDOWS_HERMES_GATEWAY_URL`, token, approved folders, and a connection probe are configured.

### 6.11 Workspace Knowledge / Second Brain

**Purpose:** expose Melverick’s Second Brain knowledge base.

Use it to:

- browse raw sources;
- inspect wiki pages;
- check KB health;
- find workflow rules;
- provide structured project context to agents.

Example:

```text
Open Workspace Knowledge → search “SGQR PayNow” → open the wiki topic → use it as source context for a task or agent instruction.
```

API:

```text
GET /api/second-brain
```

### 6.12 My Audit / Evidence

**Purpose:** inspect run traces and proof of work.

Use it to answer:

- What did the agent do?
- Which tool calls happened?
- What did it cost?
- What was the source channel?
- Which session produced this result?

Example:

```text
Open My Audit / Evidence → filter source “telegram” → open a recent session → review messages, timestamps, tool traces, and cost metadata.
```

APIs:

```text
GET /api/audit/sessions
GET /api/audit/sessions/<session_id>
GET /api/sessions
```

### 6.13 Skills

**Purpose:** inspect reusable Hermes operating procedures.

Use it to:

- search installed skills;
- see source/category/usage;
- inspect full `SKILL.md` where available;
- understand which workflows/agents use which skills.

Example:

```text
Open Skills → search “Mission Control” → open a skill → read Source tab → use linked references for implementation or troubleshooting.
```

APIs:

```text
GET /api/skills
GET /api/skills/<skill_id>/file
```

### 6.14 Tools

**Purpose:** inspect available tool/toolset capabilities.

Use it to understand what Mission Control/Hermes can do: browser, terminal, web, file, scheduling, messaging, etc.

Example:

```text
Open Tools → check whether browser or terminal capabilities are enabled for the relevant runtime/profile before assigning work that requires them.
```

### 6.15 Costs / Usage

**Purpose:** token and cost observability.

Use it to:

- see last 24h/7d/30d usage;
- inspect model/source costs;
- identify expensive sessions;
- decide when to route simpler work to cheaper models.

Example:

```text
Open Costs / Usage → select 7 days → inspect highest-token sessions → open audit trace for the expensive run → adjust model router policy if needed.
```

API:

```text
GET /api/costs?days=30
```

### 6.16 Model Router

**Purpose:** cost-aware model routing policy.

Use it to:

- reserve frontier models for strategy/planning/high-risk work;
- route easy tasks to cheaper models;
- preview which model a message would use;
- require approval for high-cost or high-risk work.

Example:

```text
Open Model Router → test an instruction “summarize this short transcript” → confirm it routes to an easy/low-cost model → test “design a multi-agent rollout plan” → confirm frontier model routing.
```

APIs:

```text
GET  /api/model-router
POST /api/model-router
POST /api/model-router/route
```

### 6.17 Runtime Connectors

**Purpose:** connect and monitor external runtimes.

Use it to:

- create connector tokens;
- register runtime connectors;
- receive heartbeats/events;
- inspect runtime status.

Example flow:

```text
Admin mode → Runtime Connectors → create token for a runtime → configure the external runtime with token → verify heartbeat appears → inspect events.
```

APIs:

```text
GET  /api/runtime-connect
POST /api/runtime-connect/tokens
POST /api/runtime-connect/tokens/<token_id>/revoke
POST /api/runtime-connect/register
POST /api/runtime-connect/heartbeat
POST /api/runtime-connect/events
GET  /api/runtimes
GET  /api/runtimes/<runtime_id>
```

### 6.18 Desktop Gateway

**Purpose:** readiness/configuration surface for local/desktop execution.

Use it to:

- inspect execution boundaries;
- see remote/VPS target readiness;
- see Windows-local setup requirements;
- configure Windows gateway URL/token/folders when ready;
- keep Windows-local execution explicitly blocked until real connection is verified.

Example:

```text
Admin mode → Desktop Gateway → check Windows status → if not configured, follow setup steps → add WINDOWS_HERMES_GATEWAY_URL and approved folders only when the real Windows gateway is reachable.
```

APIs:

```text
GET  /api/desktop-gateway
GET  /api/windows-gateway
POST /api/windows-gateway/config
```

Safety rule:

```text
Never claim access to the user's Windows PC until the gateway URL, token, approved folders, and probe are configured and verified.
```

### 6.19 Operator links and Telegram handoff

**Purpose:** create mobile-ready Mission Control links for alerts.

Operator alert payloads should include:

- short title;
- risk/status;
- owner/agent;
- direct Mission Control link;
- exact completion instruction.

Examples:

```text
Task: /app?view=board&task=<task_id>
Approval: /app?view=approvals&approval=<approval_id>
Agent: /app?view=agents&agent=<agent_id>
Task result: /app?view=task-result&task=<task_id>
```

API:

```text
GET /api/operator-links/preview
```

Example alert copy:

```text
Needs approval: LinkedIn comment draft
Risk: account-sensitive external post
Owner: LinkedIn Growth
Open: https://hermes.melverick.com/app?view=approvals&approval=abc123
Action: Review the draft, edit if needed, then approve or reject.
```

## 7. API smoke-check snapshot

The following local demo smoke checks were run against `127.0.0.1:19080` on 2026-06-04.

```text
/api/me                         user demo, role viewer
/api/status                     mode demo, api ok true, gateway running true
/api/agent-org                  agents 3, flows 1
/api/delegate-work/context      projects 1, agents 3
/api/workflows                  workflows 2
/api/task-board                 tasks 4; queued 1, running 1, blocked 1, done 1
/api/inbox                      items 1
/api/automations                summary total 1, enabled 1
/api/projects                   projects 1
/api/skills                     skills 3
/api/audit/sessions             sessions 2
/api/costs                      window days 30
/api/desktop-gateway            demo targets 2
/api/browser-sessions           sessions 1, approvalRequired 1, accountSensitive 1
/api/operator-links/preview     ok true
/api/model-router               policy present
/api/runtimes                   runtimes 6
/api/runtime-connect            tokens 1
```

Important interpretation:

- Demo data is safe and synthetic.
- Demo Windows readiness is not proof of real Windows-local execution.
- The live environment check during prior checkpoint showed `WINDOWS_HERMES_GATEWAY_URL` unset, so real Windows-local execution remains intentionally blocked.

## 8. Development, build, and deploy workflow

From source repo:

```bash
cd /opt/hermes-mission-control/source
```

Run backend syntax check:

```bash
python3 -m py_compile /opt/hermes-mission-control/app.py
```

Run tests:

```bash
python3 -m pytest tests -q
```

Build frontend:

```bash
npm run build
```

Before live restart:

```bash
cat /opt/hermes-mission-control/processing-requests.json
```

Deploy frontend and restart:

```bash
rsync -a --delete /opt/hermes-mission-control/source/dist/ /opt/hermes-mission-control/dist/
systemctl restart hermes-mission-control.service
systemctl is-active hermes-mission-control.service
```

Local demo smoke:

```bash
COOKIE=/tmp/hmc-demo.cookie
curl -sk -c "$COOKIE" -o /dev/null -L http://127.0.0.1:19080/demo-login
curl -sk -b "$COOKIE" http://127.0.0.1:19080/api/browser-sessions | jq '.summary'
```

## 9. Testing map

Representative phase tests:

```text
tests/test_phase0_foundation_primitives.py
tests/test_phase1_delegate_work_front_door.py
tests/test_phase2_artifact_evidence_result_view.py
tests/test_phase3_packaged_sme_workflows.py
tests/test_phase4_desktop_gateway_runtime_readiness.py
tests/test_phase5_browser_operation_visibility.py
tests/test_phase6_mobile_operator_hardening.py
tests/test_phase7_browser_operation_visibility.py
```

Use these when checking the phased revamp has not regressed.

Full suite command:

```bash
python3 -m pytest tests -q
```

Build command:

```bash
npm run build
```

## 10. Safety rules

1. **Never print secrets.** Passwords, tokens, API keys, session cookies, and connection strings must be redacted as `[REDACTED]`.
2. **Do not overstate runtime access.** Demo/runtime readiness is not the same as live Windows-local or browser control.
3. **Check active requests before restart.** Use `processing-requests.json`.
4. **Approval-gate external actions.** Submit/post/send/purchase and account-sensitive browser work require explicit approval.
5. **Use evidence for trust.** Task results and browser runs should produce screenshots, links, artifacts, or audit records where possible.
6. **Keep Task Board and Approval Gates distinct.** Manual actions and blockers go to Task Board; approve/reject gates go to Needs Attention.
7. **Preserve mobile usability.** No horizontal overflow; drawers and bottom nav must remain usable around 390px width.
8. **Version big checkpoints.** The current revamp has a local checkpoint at `/opt/hermes-mission-control/checkpoints/phase1-7-20260604T082617Z`.

## 11. Troubleshooting

### Browser Activity cards look stretched or URL wraps vertically

Use the Browser Activity layout regression fix pattern:

- `.browser-detail-grid` for Browser Activity detail metrics.
- `.browser-url-kv` full-width URL row.
- `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis` for long URLs.
- Run `tests/test_phase7_browser_operation_visibility.py`.

### Agent chat “hi” or simple sends fail

Check in order:

1. Browser console/network.
2. `/api/agents` and selected agent id.
3. `/api/agents/<agent_id>/messages` direct POST.
4. Profile-backed routing in `app.py`.
5. Processing state clears in UI.
6. Agent response persists to the right profile/session source.

### Windows-local appears available when it should not

Confirm:

```bash
printenv WINDOWS_HERMES_GATEWAY_URL
```

If unset, real Windows-local execution must remain blocked. Demo mode may show synthetic readiness and must be labeled as demo/simulated.

### UI changed but live site did not

Check:

```bash
npm run build
stat /opt/hermes-mission-control/source/dist/index.html
stat /opt/hermes-mission-control/dist/index.html
systemctl is-active hermes-mission-control.service
```

The live site serves `/opt/hermes-mission-control/dist`, not `source/dist`.

## 12. Roadmap after this documentation checkpoint

Recommended next browser-runtime phase:

### Phase 11 — Browser Runtime Event Bridge

Goal:

- Convert Browser Activity from an operator-ready visibility surface into a live runtime-fed supervision layer.

Scope:

- ingest real browser-session events from Browserbase, desktop browser agents, or runtime connectors;
- persist and refresh current domain/URL, screenshot previews, action log events, status, and account-sensitive indicators;
- enforce approval gates before submit/post/send/purchase operations;
- make Stop/Takeover affect the underlying runtime when the connected runtime supports it;
- attach final screenshot/link evidence back to Task Board results, approvals, and audit traces;
- keep Windows-local execution visibly blocked until `WINDOWS_HERMES_GATEWAY_URL`, token, approved folders, and a successful probe are configured.

Deferred governance phase:

### Workflow-specific model compare

Goal:

- Compare model quality, cost, latency, reliability, and evidence completeness for a specific workflow before assigning that model policy to a routine or packaged workflow.

This is **not implemented yet**. The current Model Router supports model allow-listing and route planning only.

Following operator/research continuation:

### Research Runs hardening

Goal:

- Continue turning parallel research into fully auditable agent work with citations, evidence, approval gates, and task/result linkage.

## 13. Glossary

**Agent** — a digital coworker or Hermes profile/runtime identity.
**Agent Org** — workforce map showing agents, goals, flows, queues, permissions, health, and outputs.
**Approval Gate** — explicit human approve/reject checkpoint before an external-facing, costly, destructive, or policy-sensitive action.
**Artifact** — output file/link/document/screenshot created by a task or workflow.
**Browser Activity** — operator view of browsing sessions with domain, URL, screenshot, action log, approval gate, stop/takeover, and final evidence.
**Delegate Work** — front door for submitting work to agents with context and routing.
**Evidence** — proof record such as artifact, screenshot, link, session id, source path, or audit trace.
**Mission Result** — structured task result containing summary, artifacts, evidence, approval gates, and next actions.
**Routine** — recurring/scheduled Hermes cron job.
**Task Board** — operational queue for agent tasks, human-only work, blockers, and result review.
**Workflow Library** — packaged repeatable SME workflows that launch into tracked tasks/results.
**Runtime Connector** — external runtime that registers, heartbeats, and sends events to Mission Control.
**Windows Gateway** — optional local Windows bridge; real execution requires URL, token, approved folders, and successful probe.

## 14. Important file map

```text
Backend/API:
/opt/hermes-mission-control/app.py

Frontend shell/navigation:
/opt/hermes-mission-control/source/src/App.tsx
/opt/hermes-mission-control/source/src/components/NavRail.tsx
/opt/hermes-mission-control/source/src/services/store.tsx
/opt/hermes-mission-control/source/src/services/uiPermissions.ts

Frontend contracts/clients:
/opt/hermes-mission-control/source/src/types.ts
/opt/hermes-mission-control/source/src/services/hermesClient.ts
/opt/hermes-mission-control/source/src/services/httpHermesClient.ts
/opt/hermes-mission-control/source/src/services/mockHermesClient.ts
/opt/hermes-mission-control/source/src/services/deepLinks.ts

Key views:
/opt/hermes-mission-control/source/src/views/MissionControl.tsx
/opt/hermes-mission-control/source/src/views/DelegateWork.tsx
/opt/hermes-mission-control/source/src/views/WorkflowLibrary.tsx
/opt/hermes-mission-control/source/src/views/TaskBoard.tsx
/opt/hermes-mission-control/source/src/views/Approvals.tsx
/opt/hermes-mission-control/source/src/views/Agents.tsx
/opt/hermes-mission-control/source/src/views/AgentOrg.tsx
/opt/hermes-mission-control/source/src/views/Automations.tsx
/opt/hermes-mission-control/source/src/views/BrowserOperations.tsx
/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx
/opt/hermes-mission-control/source/src/views/SkillsHub.tsx
/opt/hermes-mission-control/source/src/views/SecondBrain.tsx
/opt/hermes-mission-control/source/src/views/AuditLog.tsx
/opt/hermes-mission-control/source/src/views/CostDashboard.tsx
/opt/hermes-mission-control/source/src/views/ModelRouter.tsx

Shared components/styles:
/opt/hermes-mission-control/source/src/components/MissionFoundation.tsx
/opt/hermes-mission-control/source/src/components/SlideOverDrawer.tsx
/opt/hermes-mission-control/source/src/styles/app.css
```
