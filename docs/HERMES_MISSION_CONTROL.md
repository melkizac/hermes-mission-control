# Hermes Mission Control Documentation

Last verified: 2026-05-31 SGT  
Live service: `hermes.melverick.com`  
Local service: `127.0.0.1:19080`  
Source repo path: `/opt/hermes-mission-control/source`  
Runtime app path: `/opt/hermes-mission-control`

## 1. Executive summary

Hermes Mission Control is the operational control plane for Melverick's Hermes agent system. It is not just a chat UI. It is a dashboard for supervising digital coworkers, automations, approvals, tasks, knowledge, costs, audit history, and agent workflows.

The current implementation turns Hermes from a single chat endpoint into a managed operating system with:

- A unified Hermes Agent chat surface.
- An Agent Org / AI Workforce control plane.
- Real automations from Hermes cron jobs.
- A durable approvals inbox for human-in-the-loop review.
- A task board backed by Hermes Kanban storage.
- A skills hub backed by installed Hermes skills.
- A projects/workspaces view built from local workspaces, plans, and knowledge sources.
- A Second Brain page backed by Melverick's Karpathy-style LLM Wiki.
- Audit log and cost dashboards backed by Hermes state/session data.
- Operator activity logging for Agent Org actions.

The product intent is:

> Melverick operates AI coworkers from one place: see what exists, what is running, what needs approval, what each agent owns, what it produced, how much it cost, and what evidence exists.

### Why Mission Control exists

Hermes is the worker layer. Mission Control is the management, audit, and trust layer.

Hermes agents can act on their own, but without Mission Control their work is scattered across chats, terminal output, cron jobs, Kanban records, logs, and tool traces. Mission Control gives the operator one control room for the AI workforce: what agents are doing, which tasks are queued/running/blocked/done, why a decision was made, where human approval is needed, which workflows are healthy or stale, and what happened across Telegram, cron, Kanban, tools, and subagents.

For Melverick, the goal is to move from "I chat with an agent" to "I operate a team of digital coworkers." That requires visibility, accountability, control, handoffs, human-in-the-loop governance, and proof of work. Without Mission Control, orchestration may still happen, but it is hidden. With Mission Control, autonomous work becomes inspectable, governable, and trustworthy.

## 2. Design principles

### 2.1 Orchestrate, do not operate

Mission Control exists to reduce manual context switching. Instead of asking an agent to remember everything in a blank chat, the UI exposes structured context: agents, projects, approvals, task queues, skills, automations, run history, and knowledge.

### 2.2 Context is the product

The most important data is not just messages. It is:

- Agent identity and responsibility.
- Workflow ownership.
- Skills and tools.
- Open tasks.
- Approval requirements.
- Outputs and artifacts.
- Knowledge sources.
- Audit evidence.
- Cost and token usage.

### 2.3 Autonomy needs guardrails

Mission Control separates safe inspection from side-effectful execution.

Examples:

- `Run health check` is safe.
- `Run now` may execute a real workflow.
- LinkedIn posting/commenting remains gated by auth, submit-path verification, limits, and approval rules.
- Inbox approvals support edit-before-approve.
- Dangerous profile creation/deletion is disabled in the web UI.

### 2.4 Trust requires observability

Every operational surface should answer:

- What happened?
- Which agent or automation did it?
- When did it run?
- What data source did it use?
- What output did it create?
- Did it need approval?
- What did it cost?
- Where is the trace or evidence?

## 3. System architecture

### 3.1 Runtime layout

```text
/opt/hermes-mission-control/
  app.py                         Python HTTP backend + static file server
  dist/                          Served production frontend bundle
  .basic-password                Basic Auth password file; do not commit
  approvals.db                   Durable approval/inbox database
  agent_activity.db              Durable Agent Org operator activity log
  ui-chat-overlays.json          Web UI-originated chat overlay messages

/opt/hermes-mission-control/source/
  src/                           React + TypeScript frontend
  src/views/                     Page-level UI modules
  src/services/                  HTTP client, mock client, store
  src/styles/                    CSS tokens and app styles
  docs/                          Product and implementation docs
```

### 3.2 Hermes data layout

```text
/root/.hermes/
  state.db                       Hermes sessions, messages, billing/token data
  cron/jobs.json                 Hermes scheduled jobs
  cron/output/<job_id>/*.md      Cron output artifacts
  kanban.db                      Task board / Kanban storage
  skills/                        Installed Hermes skills
  agent_registry.yaml            Agent Org registry
  logs/                          Runtime logs
```

### 3.3 Second Brain data layout

```text
/root/.openclaw/workspace/kb/
  raw/                           Immutable source inputs
  wiki/                          LLM-maintained compiled markdown wiki
  schema/WORKFLOW.md             Workflow/schema rules for the KB
  wiki/index.md                  Main index
  wiki/log.md                    Knowledge-base maintenance log
```

### 3.4 Service

Systemd service:

```text
hermes-mission-control.service
```

Important service settings:

```text
WorkingDirectory=/opt/hermes-mission-control
HMC_HOST=127.0.0.1
HMC_PORT=19080
HMC_USER=admin
HMC_PASSWORD_FILE=/opt/hermes-mission-control/.basic-password
ExecStart=/usr/bin/python3 /opt/hermes-mission-control/app.py
```

The app is reverse-proxied publicly at:

```text
https://hermes.melverick.com
```

## 4. Frontend application structure

### 4.1 App entry

File:

```text
src/App.tsx
```

Primary shell:

- `NavRail`
- `main.main`
- conditional page rendering based on current `view` from the store

Current views:

```text
mission        MissionControl
agents         Agents
agent-org      AgentOrg
projects       Projects
second-brain   SecondBrain
approvals      Approvals
board          TaskBoard
skills         SkillsHub
automations    Automations
audit          AuditLog
costs          CostDashboard
settings       Placeholder
```

### 4.2 Navigation

File:

```text
src/components/NavRail.tsx
```

Current nav items:

- Mission Control
- Agents
- Agent Org
- Projects
- Second Brain
- Task Board
- Skills Hub
- Approvals
- Automations
- Audit Log
- Costs
- Settings

The rail also polls `/api/status` every 15 seconds to show gateway/runtime/session activity.

### 4.3 Service client

Important files:

```text
src/services/hermesClient.ts
src/services/httpHermesClient.ts
src/services/mockHermesClient.ts
src/services/store.tsx
```

The live UI uses the HTTP client to call `/api/*` routes on the same origin. Requests include credentials so Basic Auth works through the browser.

## 5. Backend API overview

Backend file:

```text
/opt/hermes-mission-control/app.py
```

The backend is a Python `ThreadingHTTPServer` app. It serves the built React bundle and exposes JSON routes.

### 5.1 GET routes

```text
GET /api/status
GET /api/sessions
GET /api/audit/sessions
GET /api/audit/sessions/<session_id>
GET /api/costs
GET /api/automations
GET /api/inbox
GET /api/approval-inbox
GET /api/skills
GET /api/projects
GET /api/workspaces
GET /api/second-brain
GET /api/tasks
GET /api/task-board
GET /api/logs?kind=<kind>
GET /api/agents
GET /api/agents/<agent_id>
GET /api/approvals
GET /api/agent-org
```

### 5.2 POST routes

```text
POST /api/chat
POST /api/agents/<agent_id>/messages
POST /api/approvals/<id>
POST /api/inbox/<id>/action
POST /api/automations/<job_id>/action
POST /api/tasks
POST /api/tasks/<task_id>/comments
POST /api/agent-org/agents/<agent_id>/action
```

### 5.3 PUT routes

```text
PUT /api/agents/<agent_id>/files/<filename>
PUT /api/inbox/<id>
PUT /api/tasks/<task_id>
```

Editable agent files are intentionally limited. `config.yaml` is read-only from the web UI to avoid writing redacted secrets back to disk.

### 5.4 DELETE routes

```text
DELETE /api/tasks/<task_id>
```

Agent profile deletion is disabled from the web UI for safety.

## 6. Current live data snapshot

Verified via local authenticated API calls on 2026-05-31:

```text
/api/agent-org        8 agents, 4 flows
/api/tasks            1 task
/api/inbox            41 inbox items; 5 drafted; 33 sent; 3 rejected
/api/skills           133 skills
/api/projects         12 projects/workspaces
/api/second-brain     34 wiki pages surfaced; 5 raw sources
/api/audit/sessions   50 listed sessions out of 94 total
```

Agent Org summary at verification time:

```text
Digital Coworkers: 8
Running Now: 0
Queued Work: 1
Approvals Needed: 5
Failed Runs: 0
Active Workflows: 8
Cost 7d: 0.0
```

Second Brain summary at verification time:

```text
Title: Melverick Second Brain
Wiki pages surfaced: 34
Raw sources: 5
Sections: 9
Log entries: 16
Health: healthy
Last updated: 2026-05-30 10:42 SGT
```

## 7. Page documentation

## 7.1 Mission Control dashboard

View file:

```text
src/views/MissionControl.tsx
```

Purpose:

The daily operator cockpit. This page is intended to answer:

- What needs attention now?
- What changed since the last check?
- What is running or scheduled next?
- What did agents produce?
- Is the system healthy?
- What should Melverick click next?

Typical data sources:

- `/api/status`
- `/api/sessions`
- `/api/approvals`
- `/api/agent-org`
- `/api/second-brain`
- `/api/projects`
- `/api/costs`

Design pattern:

- Decision-first cards.
- Attention/approval focus.
- Latest outputs and health signals.
- Singapore-time display.

## 7.2 Agents

View file:

```text
src/views/Agents.tsx
```

Purpose:

Unified agent chat and context surface. In this Mission Control build, Telegram, Terminal, and Web UI/API are treated as channels for the same Hermes agent unless explicitly represented as separate runtimes.

Key behavior:

- Roster/list of agents or channels.
- Central chat/activity surface.
- Detail drawer rather than permanent right panel.
- Web UI send flow with immediate pending state and persisted UI-originated overlay messages.
- Agent file inspection/editing for safe files.

Backend routes:

```text
GET /api/agents
GET /api/agents/<agent_id>
POST /api/agents/<agent_id>/messages
PUT /api/agents/<agent_id>/files/<filename>
```

Safety:

- Profile creation/deletion disabled in web UI.
- `config.yaml` is read-only.
- Tool-call noise is filtered from primary chat; detailed traces belong in Audit Log.

## 7.3 Agent Org / AI Workforce

View file:

```text
src/views/AgentOrg.tsx
```

Primary backend contract:

```text
GET /api/agent-org
POST /api/agent-org/agents/<agent_id>/action
```

Purpose:

The operational control plane for digital coworkers. This is V2 of the Agent Org concept: it is not just a visual org chart. It joins registry, automations, tasks, approvals, runs, outputs, permissions, cost, and activity.

Current registered default agents:

```text
chief-operator
linkedin-growth
nexius-leads
second-brain
content-ops
project-task
email-monitor
devops-builder
```

Current default flows:

```text
Lead capture to follow-up
LinkedIn daily growth loop
Raw source to Second Brain
Build and deploy loop
```

Page tabs:

```text
Org
Agents
Queues
Flows
Runs
Outputs
Permissions
Health
```

Agent drawer tabs:

```text
Overview
Queue
Approvals
Runs
Outputs
Activity
Skills
Permissions
Config
```

Supported safe/operational actions:

```text
create_task
run_health_check
run_agent
run_automation
pause_automations
resume_automations
```

Important distinction:

- V2 operational agent: a named responsibility area mapped to real workflows, tasks, approvals, and logs.
- V3 runtime agent: independent process/profile/memory/tool/secrets boundary.

Current system is V2 operational. Some agents are promoted to cron-backed runtime responsibility areas, but they are not all isolated V3 runtimes.

### Agent activity timeline

Persistent store:

```text
/opt/hermes-mission-control/agent_activity.db
```

Records Mission Control operator actions such as:

- Run agent
- Run automation
- Health check
- Create task
- Pause automations
- Resume automations
- Approval CTAs connected to activity rows where available

This separates operator activity from actual runtime traces.

## 7.4 Automations

View file:

```text
src/views/Automations.tsx
```

Backend routes:

```text
GET /api/automations?q=<query>&state=<state>
POST /api/automations/<job_id>/action
```

Data source:

```text
/root/.hermes/cron/jobs.json
/root/.hermes/cron/output/<job_id>/*.md
/root/.hermes/state.db
```

Purpose:

Expose Hermes cron jobs as operational routines. This page shows schedules, last/next run, state, prompt preview, script/no-agent mode, delivery, skills/toolsets, outputs, and recent traces.

Supported actions:

```text
pause
resume
run
```

UI behavior:

- Card and list views.
- Cards/List selector sits on the far right side of the search row.
- Search and state filters.
- Routine cards with mode, trigger/schedule chip, prompt preview, run counts, skills, last status, next run.
- Drawer/details for schedule, delivery, profile, model, script mode, prompt, recent runs, and output previews.

Safety:

`Run now` can execute real workflows and deliveries. The UI warns about this.

### Heartbeat semantics

If `Run Heartbeat` is added, it should not be the same as `Run now`.

Recommended meaning:

- `Run now`: execute the actual workflow.
- `Run Heartbeat`: run a lightweight diagnostic probe: scheduler active, script exists, config present, last/next run state, recent failures, delivery target, obvious credential failures.

Do not label a full workflow run as a heartbeat unless it is genuinely side-effect-safe.

## 7.5 Approvals / Inbox

View file:

```text
src/views/Approvals.tsx
```

Backend routes:

```text
GET /api/inbox?status=drafted|ready|sent|rejected|all&q=...
GET /api/approval-inbox
POST /api/inbox/<id>/action
PUT /api/inbox/<id>
GET /api/approvals
POST /api/approvals/<id>
```

Persistent store:

```text
/opt/hermes-mission-control/approvals.db
```

Purpose:

Human-in-the-loop review queue for:

- Proposed outbound messages.
- Automation outputs.
- Generated reports.
- Risky actions.
- Follow-ups.
- Cron output artifacts derived into approval records.

Derived inbox behavior:

Recent non-empty cron output markdown files from:

```text
/root/.hermes/cron/output/*/*.md
```

are synced into durable drafted approval records with IDs like:

```text
cron-output-<sha1-digest>
```

UI behavior:

- Metrics: drafted, ready, sent, risk watch.
- Status tabs.
- Search across title/body/source/destination.
- Full-width approval cards.
- Right-side drawer for source/provenance and edit-before-approval.
- Actions: open, mark reviewed, reject, approve, save edits.

## 7.6 Task Board / Issues

View file:

```text
src/views/TaskBoard.tsx
```

Backend routes:

```text
GET /api/tasks
GET /api/task-board
POST /api/tasks
PUT /api/tasks/<task_id>
POST /api/tasks/<task_id>/comments
DELETE /api/tasks/<task_id>
```

Persistent source:

```text
/root/.hermes/kanban.db
```

Purpose:

Operational queue for tasks, issues, and agent-assigned work.

Main tables ensured by backend:

```text
tasks
task_comments
task_events
task_runs
task_links
```

Status normalization:

```text
open/todo/backlog      -> queued
in_progress/working   -> running
completed/closed      -> done
failed/crashed        -> error
```

UI behavior:

- Five lanes: queued, running, blocked, done, error.
- Card and list views.
- Cards/List selector sits on the far right side of the search row.
- Collapsed create form behind `+ Add Action`.
- Search/status/assignee filters.
- Slide-over drawer for detailed task metadata.
- Per-card status move and delete.
- Inline assignee update.

## 7.7 Skills Hub

View file:

```text
src/views/SkillsHub.tsx
```

Backend route:

```text
GET /api/skills
```

Data sources:

```text
/root/.hermes/skills/**/SKILL.md
Hermes profiles and profile skill directories
Hermes cron job skill declarations
Kanban task skill fields
Agent registry mappings
```

Purpose:

Expose reusable Hermes procedures and capabilities as an operational library.

Current verified count:

```text
133 skills surfaced
133 assigned/routed somewhere
```

UI behavior:

- Total/editable/plugin/user/assigned summary metrics.
- Card and list views.
- Cards/List selector sits on the far right side of the search row.
- Search by skill name, description, tag, or model.
- Filter by category/source.
- Skill cards show source, editability, routing evidence, usage, and preview.
- Right-side drawer for details and SKILL.md preview.

Backend performance rule:

Do not rescan every routing surface once per skill. Build routing/usage indexes once and join them to the skill list.

## 7.8 Projects / Workspaces

View file:

```text
src/views/Projects.tsx
```

Backend routes:

```text
GET /api/projects
GET /api/workspaces
```

Purpose:

Context cockpit for active workspaces and project memory. This page connects filesystem workspaces, implementation plans, second-brain/wiki context, Kanban tasks, and recent sessions where available.

Current verified count:

```text
12 projects/workspaces
```

UI behavior:

- Portfolio metrics.
- Search and kind/source filters.
- Project cards.
- Health/progress/source chips.
- Temporary right-side detail drawer with overview, knowledge/artifacts, activity, and sessions.
- No drawer auto-open on page load.

## 7.9 Second Brain

View file:

```text
src/views/SecondBrain.tsx
```

Backend route:

```text
GET /api/second-brain?q=<search>&section=<section>
```

Data root:

```text
/root/.openclaw/workspace/kb
```

Important paths:

```text
raw/                         immutable source inputs
wiki/                        compiled maintained wiki
schema/WORKFLOW.md           KB workflow/schema rules
wiki/index.md                index
wiki/log.md                  maintenance log
```

Purpose:

Expose Melverick's Karpathy-style LLM Wiki as a first-class Mission Control page.

Important product rule:

This is not plain RAG and not just a document library. It is a maintained knowledge system with source-of-truth inputs, compiled wiki pages, schema/workflow rules, index/log, and health checks.

Tabs:

```text
Overview
Wiki
Raw Sources
Schema
Index & Log
Health
```

Current source types:

- Raw Google Docs exports.
- Manual notes / seed notes.
- Setup docs/articles.
- OpenClaw documentation summaries.
- Human/agent-maintained wiki pages.

Currently not automatic by default unless explicitly ingested:

- Telegram messages.
- LinkedIn posts/comments/DMs.
- Email.
- Calendar.
- Meeting recordings/transcripts.
- CRM leads.
- Website leads.
- Raw PDFs/images/screenshots.

## 7.10 Audit Log

View file:

```text
src/views/AuditLog.tsx
```

Backend routes:

```text
GET /api/audit/sessions
GET /api/audit/sessions/<session_id>
```

Data source:

```text
/root/.hermes/state.db
```

Purpose:

Run/session trace viewer for Hermes activity from Telegram, cron, CLI, and API sessions.

UI behavior:

- Search and source filters.
- Full-width list.
- Right-side drawer for run detail.
- Messages/tool calls/events shown as trace evidence.
- Session metadata, token/cost details where available.

Verified summary at documentation time:

```text
94 total sessions
50 sessions listed in default API window
4465 tool calls
241603162 tokens
```

## 7.11 Cost Dashboard

View file:

```text
src/views/CostDashboard.tsx
```

Backend route:

```text
GET /api/costs?days=<n>
```

Data source:

```text
/root/.hermes/state.db
```

Purpose:

Token and cost observability for agent operations.

Includes:

- Selected window spend.
- 24h / 7d / all-time spend where data exists.
- Token totals and breakdowns.
- Spend/token breakdown by model/source.
- Daily trend bars.
- Highest-cost/highest-token sessions.
- Drawer-style session details.

Current caveat:

Estimated cost may be zero even when token usage is high if billing fields are unavailable or unset.

## 8. Agent registry

Registry path:

```text
/root/.hermes/agent_registry.yaml
```

This file makes agents explicit instead of only inferred from keywords.

Each agent can define:

```yaml
id: linkedin-growth
name: LinkedIn Growth Agent
type: runtime_agent
runtime: hermes-cron
profile: default
reports_to: chief-operator
mode: approval
skills: []
automations: []
permissions: {}
health_policy: {}
```

Agent Org joins registry data with:

- Cron jobs.
- Kanban tasks.
- Inbox approvals.
- Session/audit data.
- Cost data.
- Skills.
- Projects.
- Outputs.
- Activity events.

Use `automation_match: explicit` when known runtime job ownership exists. This prevents broad keywords from incorrectly attaching unrelated workflows.

## 9. Current runtime agents and workflows

### 9.1 LinkedIn Growth Agent

Runtime type:

```text
runtime_agent / hermes-cron
```

Mapped to LinkedIn block jobs such as:

- Morning block.
- Content block.
- Midday block.
- Afternoon block.
- Evening block.

Safety posture:

- Uses Melverick Ng `/in/melverick/` only.
- Does not use Enrico Huang profile.
- Live comments/posts/DMs/connection requests require auth, submit-path verification, dedup checks, limits, and approval-safe behavior.

### 9.2 Nexius Lead Agent

Runtime type:

```text
runtime_agent / hermes-cron / no-agent script watchdog
```

Primary mapped workflow:

```text
daily-nexius-lead-check
```

Script mode:

```text
no_agent: true
```

Purpose:

Checks Nexius Labs and Nexius Academy lead sources and sends Telegram alerts only when new leads are found. Empty stdout means silent no-op.

### 9.3 Email Attention Agent

Runtime type:

```text
script watchdog / no-agent
```

Primary mapped workflow:

```text
email-immediate-attention-monitor
```

Purpose:

Scans configured email accounts for immediate-attention messages and emits Telegram-ready alerts only when needed.

### 9.4 Other logical/operational agents

Other registered agents currently provide responsibility mapping and control-plane structure:

- Chief Operator.
- Second Brain Agent.
- Content Ops Agent.
- Project & Task Agent.
- DevOps / Builder Agent.

They may map to tasks, skills, approvals, sessions, or future runtime workflows.

## 10. Human-in-the-loop model

Mission Control uses a layered safety model.

### Observe

Agent/system can read and summarize but not change external state.

### Draft

Agent can create drafts, tasks, or proposed outputs.

### Approval required

Agent can prepare a side-effectful action, but the user must approve it.

### Execute

Agent/workflow can execute a safe or pre-authorized action directly.

Examples:

- New lead detection can send Telegram alerts.
- Cron output is converted into approvals when reviewable.
- LinkedIn live actions require verified auth and submit path.
- Profile creation/deletion remains CLI-only.

## 11. Operational workflows

### 11.1 Build/deploy/restart

Run from source directory:

```bash
cd /opt/hermes-mission-control/source
npm run build
rm -rf /opt/hermes-mission-control/dist/*
cp -a /opt/hermes-mission-control/source/dist/. /opt/hermes-mission-control/dist/
python3 -m py_compile /opt/hermes-mission-control/app.py
systemctl restart hermes-mission-control.service
systemctl is-active hermes-mission-control.service
```

### 11.2 API smoke tests

```bash
PW=$(cat /opt/hermes-mission-control/.basic-password)
curl -fsS -u "admin:$PW" http://127.0.0.1:19080/api/status | python3 -m json.tool >/dev/null
curl -fsS -u "admin:$PW" http://127.0.0.1:19080/api/agent-org | python3 -m json.tool >/dev/null
curl -fsS -u "admin:$PW" http://127.0.0.1:19080/api/second-brain | python3 -m json.tool >/dev/null
```

### 11.3 Agent Org health checks

```bash
PW=$(cat /opt/hermes-mission-control/.basic-password)
for agent in chief-operator linkedin-growth nexius-leads second-brain devops-builder; do
  curl -sS -u admin:$PW -H 'Content-Type: application/json' \
    -d '{"action":"run_health_check"}' \
    http://127.0.0.1:19080/api/agent-org/agents/$agent/action \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('agent_id'), d.get('ok'), d.get('status'))"
done
```

### 11.4 Frontend verification

Use Playwright or browser automation to verify:

- Mission Control loads.
- No console errors.
- Nav items render.
- Agent Org shows 8 agents and 4 flows.
- Agent drawer does not auto-open on page load.
- Drawer opens on agent click.
- Approvals cards open detail drawer.
- Task Board card/list selector is on the right side of the search bar.
- Skills Hub card/list selector is on the right side of the search bar.
- Automations card/list selector is on the right side of the search bar.
- Second Brain tabs render real counts and source cards.

## 12. Authentication and secrets

The public app is protected by Basic Auth.

Credentials are loaded from:

```text
HMC_USER
HMC_PASSWORD_FILE
```

Default user:

```text
admin
```

Password file:

```text
/opt/hermes-mission-control/.basic-password
```

Rules:

- Never commit `.basic-password`.
- Never print full secrets into docs or logs.
- Do not write redacted secrets back into config files.
- Web UI config editing intentionally blocks `config.yaml` writes.

## 13. Known implementation notes and pitfalls

### 13.1 Service PATH

Systemd may not inherit the interactive shell PATH. Backend code that shells out to Hermes should resolve the CLI using:

- `HMC_HERMES_BIN`, or
- `shutil.which('hermes')`, or
- known fallback path such as `/root/hermes-agent/venv/bin/hermes`.

Do not assume plain `subprocess.run(['hermes', ...])` works under systemd.

### 13.2 Avoid fake metrics

If data is missing, show an honest empty state. Do not invent runs, outputs, costs, or approvals.

### 13.3 Keep details in drawers

For dense operational pages, use temporary right-side drawers instead of permanent side panels. This preserves the primary workspace width.

Current drawer-first pages include:

- Agents.
- Agent Org.
- Task Board.
- Automations.
- Audit Log.
- Approvals.
- Skills Hub.
- Projects.
- Costs.
- Second Brain.

### 13.4 Singapore time

Operator-facing timestamps should display in Singapore time (`Asia/Singapore`, `SGT`) wherever possible.

### 13.5 Run Now versus Heartbeat

Do not blur the semantics:

- `Run now` can execute a real workflow.
- `Run heartbeat` should be diagnostic and side-effect-safe.

### 13.6 Agent activity versus run trace versus output

Keep these concepts separate:

- Activity: Mission Control operator/UI events.
- Runs: actual Hermes/cron/script execution traces.
- Outputs: artifacts, reports, approval items, generated files.

## 14. Roadmap

### 14.1 Short-term improvements

- Add explicit `Run Heartbeat` diagnostics for automations and agents.
- Add richer flow runtime state in Agent Org.
- Improve linked approval matching for Agent Org activity rows.
- Add more live sources into Second Brain.
- Add more robust public endpoint verification in deploy scripts.
- Add automated frontend smoke tests in repo.

### 14.2 Medium-term improvements

- Promote more logical agents into real runtime-backed workflows.
- Add profile-specific agent runtime boundaries where needed.
- Add per-agent cost caps and budget controls.
- Add event-driven webhook subscriptions.
- Add meeting transcript ingestion into Second Brain.
- Add LinkedIn/Telegram/email summarization pipelines into Second Brain.

### 14.3 V3 direction

V3 means independent runtime agents with their own:

- Hermes profile.
- Memory.
- Skills.
- Tool permissions.
- Schedules.
- Secrets boundary.
- Audit/cost accounting.
- Approval policy.

V2, which is currently implemented, is the operational control plane that prepares for V3 without prematurely fragmenting runtime state.

## 15. Glossary

### Agent

A named responsibility area or runtime worker in Mission Control. In V2, not every agent is an independent process.

### Runtime agent

An agent mapped to a real execution substrate such as Hermes cron, no-agent script watchdog, Kanban worker, or external runtime.

### Logical agent

A responsibility area represented in Agent Org but not yet backed by an isolated runtime.

### Workflow / automation

A scheduled or manually triggerable routine, usually backed by Hermes cron.

### Approval

A human-in-the-loop review item in `approvals.db` or derived from cron output.

### Activity

A Mission Control operator event, such as clicking Run Agent or Health Check.

### Run

A real Hermes session, cron execution, script run, or agent execution trace.

### Output

A generated artifact, cron output markdown, report, draft, or approval item.

### Second Brain

Melverick's maintained LLM Wiki at `/root/.openclaw/workspace/kb`.

## 16. File map

Important backend file:

```text
/opt/hermes-mission-control/app.py
```

Important frontend files:

```text
src/App.tsx
src/components/NavRail.tsx
src/views/MissionControl.tsx
src/views/Agents.tsx
src/views/AgentOrg.tsx
src/views/Projects.tsx
src/views/SecondBrain.tsx
src/views/Approvals.tsx
src/views/TaskBoard.tsx
src/views/SkillsHub.tsx
src/views/Automations.tsx
src/views/AuditLog.tsx
src/views/CostDashboard.tsx
src/services/hermesClient.ts
src/services/httpHermesClient.ts
src/services/mockHermesClient.ts
src/services/store.tsx
src/styles/app.css
src/styles/tokens.css
```

Important runtime files:

```text
/root/.hermes/agent_registry.yaml
/root/.hermes/cron/jobs.json
/root/.hermes/kanban.db
/root/.hermes/state.db
/opt/hermes-mission-control/approvals.db
/opt/hermes-mission-control/agent_activity.db
/root/.openclaw/workspace/kb/wiki/index.md
/root/.openclaw/workspace/kb/wiki/log.md
/root/.openclaw/workspace/kb/schema/WORKFLOW.md
```

## 17. One-line product definition

Hermes Mission Control is Melverick's AI workforce operating system: a supervised control plane where agents, automations, tasks, approvals, knowledge, audit evidence, and costs converge so digital coworkers can be operated with trust.
