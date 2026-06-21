# PRD: Perfect Mission Control for Hermes / OpenClaw Digital Coworkers

**Status**: Draft for product/design/engineering review  
**Author**: Melkizac  
**Last Updated**: 2026-06-20 05:39 UTC  
**Version**: 0.1  
**Primary Stakeholder**: Melverick Ng  
**Product Owner / Orchestrator**: Melkizac / default  
**Engineering Owner**: Andrej / dev-ops  
**Primary Surface**: `https://hermes.melverick.com` / `/opt/hermes-mission-control/source`  

---

## 0. Executive Summary

Mission Control should become the **operator cockpit for an AI workforce**, not merely a web dashboard for agent chats. The perfect version helps Melverick answer, within seconds:

1. **What needs me now?** — approvals, blockers, failed routines, risk gates, stale agents.
2. **What is running?** — active missions, agent work, browser sessions, routines, runtime connectors.
3. **What did agents produce?** — outputs, artifacts, screenshots, files, URLs, research synthesis, code changes.
4. **Can I trust it?** — evidence, traces, sources, approvals, cost, policy boundaries, human/accountability chain.
5. **Who should own the next step?** — Melkizac, Andrej, Enrico, Troas, a specialist agent, a human, or a routine.

Public internet scans show that comparable OpenClaw/Hermes/agent dashboards commonly include agent health, task boards, approvals, logs, traces, memory/tools, cost analytics, terminals, browser activity, and workflow controls. HMC already covers many of these, and is stronger than most public examples on **governance, evidence, browser safety, workflow packaging, and Project → Goal → Mission → Task IA**.

The next product leap is to convert the current strong surfaces into a unified, high-trust operator experience through:

- a **single command center** for attention/running/recent/evidence;
- a **Task/Run Trace Explorer** with tool calls, cost, approvals, handoffs, errors, and timeline;
- **Session Replay** for browser/research/agent runs;
- **Agent Swimlanes** for multi-agent missions;
- **live cost and loop-risk signals** inside task cockpits;
- **governed agent lifecycle controls**;
- a **workflow contract builder** for repeatable business operations.

The product principle: **HMC should show accountability, not activity.**

---

## 1. Problem Statement

### 1.1 Core problem

As Hermes/OpenClaw agents become more capable, their work becomes harder to supervise through chat logs alone. Operators need a cockpit that converts distributed activity — chats, kanban tasks, cron jobs, browser sessions, files, skills, memory, tools, runtimes, approvals, and costs — into a governed operational layer.

Without Mission Control, the operator must ask manually:

- Which agent is working on what?
- Is anything stuck?
- Did the agent actually complete the task?
- What evidence proves it?
- Did it use the right sources?
- Did it touch sensitive accounts?
- Did it spend too much?
- Is human approval needed before external action?
- Which routine produced this output?
- Which profile/tool/runtime owns the next step?

That creates operational risk: invisible work, unclear accountability, duplicated efforts, hidden costs, unsafe external actions, and low confidence in agent-produced outputs.

### 1.2 User pain

Primary operator Melverick is running a digital workforce across engineering, LinkedIn/content, research, lead operations, browser workflows, cron routines, and external messaging. Chat alone does not provide sufficient governance or auditability.

Pain appears in five recurring forms:

1. **Visibility gap** — active work is distributed across sessions, kanban, cron, logs, and profile folders.
2. **Trust gap** — outputs are not always visibly tied to evidence, sources, tests, screenshots, or approval records.
3. **Control gap** — pausing, redirecting, approving, retrying, or handing off work requires context switching.
4. **Governance gap** — tools, memory, credentials, runtimes, and account-sensitive browser actions need policy-aware gates.
5. **Routing gap** — digital coworkers must be routed by domain ownership/capability, not merely model/provider labels.

### 1.3 Cost of not solving

- Human operator loses time reconstructing work state.
- Agents may duplicate or drift without visible ownership.
- External posts, DMs, emails, form submits, purchases, or production changes may occur without proper review.
- Costs can spike from loops or wrong model routing.
- Valuable artifacts/evidence may be buried in logs or never linked back to tasks.
- HMC risks becoming a collection of pages rather than an operational cockpit.

---

## 2. Evidence and Market Scan

### 2.1 Public reference scan summary

Public Mission Control / agent dashboard patterns include:

| Public source | Observed UI patterns |
|---|---|
| Hermes Agent Web Dashboard | Config, API keys, MCP, messaging, webhooks, gateway, memory, credentials, sessions, logs, analytics, cron jobs, skills |
| `robsannaa/openclaw-mission-control` | Live overview, active agents, gateway health, cron jobs, resources, chat, model picker, Kanban, cost, agent hierarchy, terminal |
| `builderz-labs/mission-control` | Six-column task board, memory knowledge graph, cost dashboard, activity feed, logs, skills, MCP/tool-call auditing, quality gates |
| `JPeetz/Hermes-Studio` | Usage/cost tab, execution approvals, logs viewer, Kanban, terminal, memory/skills, permissions/toolsets, MCP |
| `pyrate-llama/hermes-ui` | Chat, split logs, tasks/live work board, terminal, MCP tools, files, memory inspection |
| `inbharatai/agent-arcade-gateway` | Directives queue, execution traces, span tree, session replay, swimlanes, token stream log, cost per span, intervention controls |
| LangSmith / LangGraph Studio | Assistants, threads, runs, run settings, graph config, prompt iteration, trace debugging, experiments |
| AgentOps | Dashboard, session overview, session drilldown, observability |
| OpenHands | Agent canvas, integrations, API keys, GitHub/Slack settings, org usage monitoring |
| Dify / Flowise | Build/publish/monitor/knowledge/workspace, model providers, plugins, logs, workflow/agentflow builders, HITL |

### 2.2 Current HMC comparison

Current HMC already includes or documents:

- Chat command center
- Dashboard
- Projects
- Files
- Task Board
- Routines
- Workflow Library
- Agents
- Capabilities / Agent Org
- Skills
- Memory
- Reflections
- Tools
- Plugins
- Approvals
- Profile / Settings / Models & limits
- Admin Console
- Users & Workspaces
- Workspace Runtime Console
- Platform Agent Org
- Shared Agent Templates
- Runtime Connectors
- Hermes Desktop
- Research Run Monitor
- Capability Registry
- Runs / Activity
- Costs / Usage
- Approval Rules
- Browser Activity route and source implementation

HMC is already differentiated on:

- governance and approval boundaries;
- task evidence and result drawers;
- project/workflow/routine semantics;
- mobile operator handoffs;
- browser activity safety gates;
- digital coworker capability routing;
- Second Brain / memory / source-evidence integration.

Main gaps relative to the strongest public examples:

- polished trace/span explorer;
- session replay timeline;
- multi-agent swimlanes;
- direct governed lifecycle controls on agents/runtimes;
- per-step/per-task live cost and loop-risk signals;
- admin-only terminal/runtime console;
- workflow contract/canvas builder;
- workflow-specific model comparison.

---

## 3. Product Vision

### 3.1 Vision statement

Mission Control is the **trust, governance, and operating layer** for a team of AI coworkers. It turns autonomous work into visible, auditable, controllable business operations.

### 3.2 Product promise

> “Operate your AI workforce with the same clarity, accountability, and control you expect from a human team — with evidence for every outcome and approval gates for every risky action.”

### 3.3 Positioning

HMC is not:

- a generic chatbot UI;
- a model leaderboard;
- a raw log viewer;
- a pretty Kanban board;
- a workflow canvas for its own sake.

HMC is:

- a command center for digital coworker operations;
- a governance layer over Hermes/OpenClaw agents;
- a project/task/evidence operating system;
- a runtime supervision cockpit;
- a trusted handoff layer between agents and humans.

---

## 4. Goals and Success Metrics

### 4.1 Product goals

| Goal | Metric | Current baseline | Target | Measurement window |
|---|---:|---:|---:|---|
| Reduce operator time-to-understand | Time for Melverick to answer “what needs me now?” | Manual / unknown | <30 seconds from Dashboard | 30 days post-launch |
| Improve trust in agent outputs | % completed tasks with linked evidence/artifact/source/test/screenshot | Partially present | ≥90% of completed agent tasks | 60 days |
| Improve intervention speed | Time from blocker/approval creation to human action | Unknown | 50% reduction | 60 days |
| Reduce hidden work | % active runs visible in Dashboard/Task Board/Runs | Partial | ≥95% of active runs represented | 60 days |
| Control cost drift | Expensive-loop/routing warnings before runaway spend | Limited | Warnings for ≥90% of detected loops/spikes | 90 days |
| Improve routing quality | % tasks assigned to correct domain owner by default | Manual judgment | ≥85% correct routing in review sample | 60 days |
| Increase safe automation | % recurring routines with schedule, owner, evidence, approval policy | Partial | ≥90% governed routine coverage | 90 days |

### 4.2 North Star metric

**Governed Completion Rate**:

> Percentage of agent-owned tasks completed with outcome, evidence, owner, audit trail, and no unresolved approval/blocker.

Target: **≥85% within 90 days** for HMC-managed tasks.

### 4.3 Supporting metrics

- Active tasks by state: todo/scheduled/running/blocked/review/done/error.
- Pending approval count and age.
- Routines with last run success/error and next run visibility.
- Runtime connector heartbeat freshness.
- Agent load and stale-run count.
- Evidence completeness score per task.
- Cost per task / run / model / agent.
- Browser sessions stopped/taken over before risky actions.
- Handoff completeness: from agent A to agent B/human with reason and expected next action.

---

## 5. Non-Goals

These should not be included in the next major product iteration unless explicitly approved.

1. **Do not build a vanity model-card UI.** Model/provider details are secondary to capability, cost, risk, and route governance.
2. **Do not build a generic workflow canvas before trace/replay/cost gaps are solved.** A canvas without governance is decorative.
3. **Do not expose raw terminal as a primary user-mode surface.** Terminal belongs in admin/runtime console only.
4. **Do not allow direct external submit/post/send/purchase without approval gates.** This remains a hard safety boundary.
5. **Do not imply real Windows/browser/desktop control unless connector readiness is verified.** Demo/readiness must remain clearly labeled.
6. **Do not collapse Task Board and Approvals.** Human manual tasks/blockers are different from approve/reject gates.
7. **Do not make Chat carry all operational weight.** Chat is the front door; operational accountability lives in tasks/runs/evidence.
8. **Do not optimize for public demo prettiness at the expense of operator trust.** Evidence and controls beat visual polish.

---

## 6. Personas

### 6.1 Primary persona: Melverick — AI workforce operator / business owner

Needs to supervise outcomes across Nexius Labs, Nexius Academy, LinkedIn, research, lead ops, client work, and internal systems.

Key needs:

- fast triage;
- low cognitive load;
- clear evidence;
- safe approvals;
- mobile handoff;
- business-readable status;
- trust without reading raw logs.

### 6.2 Primary agent persona: Melkizac — orchestrator

Routes work, supervises other agents, creates tasks, prepares evidence, flags blockers, manages handoffs.

Needs:

- structured project/task/routine model;
- clear ownership routing;
- evidence requirements;
- approval policies;
- visible handoffs;
- ability to link chat outputs to HMC records.

### 6.3 Specialist agent persona: Andrej — engineering owner

Owns HMC engineering, UI/API changes, tests, deployments, runtime debugging, technical verification.

Needs:

- precise implementation tasks;
- acceptance criteria;
- test evidence;
- deployment safety;
- logs/traces;
- conflict/merge gates;
- no ambiguous product asks.

### 6.4 Specialist agent persona: Enrico — marketing / LinkedIn workflow owner

Owns brand judgment and daily LinkedIn workflow.

Needs:

- content workflow tasks;
- draft approvals;
- source/evidence links;
- scheduled routines;
- approval before publishing/commenting/DMs.

### 6.5 Specialist agent persona: Troas — trading/watchlist pipeline owner

Owns Kronos trading/watchlist monitoring.

Needs:

- routine health;
- evidence-backed alerts;
- no raw financial state leakage unless explicitly requested;
- risk-aware handoff.

### 6.6 Admin persona: Andrej / system operator

Configures runtimes, tools, connectors, credentials, model routing, quotas, approval rules.

Needs:

- admin-only controls;
- connector health;
- terminal/runtime console;
- audit trails;
- safe rollback;
- credential redaction.

---

## 7. Core User Stories and Acceptance Criteria

### Story 1 — Triage what needs attention

As Melverick, I want to open Mission Control and immediately see what needs my decision so I can unblock work without reading logs.

Acceptance criteria:

- [ ] Dashboard shows pending approvals, blockers, failed routines, stale runtimes, high-risk browser sessions, and expensive-loop warnings.
- [ ] Each attention item shows owner, risk, requested action, due/age, and direct link.
- [ ] Approval items show explicit actor/action/target/effect before raw context.
- [ ] Human-only tasks are separated from approve/reject gates.
- [ ] Mobile view supports one-tap action opening from Telegram deep links.

### Story 2 — Understand running work

As Melverick, I want to see active missions/tasks/routines/browser sessions so I know what agents are doing now.

Acceptance criteria:

- [ ] Dashboard has Running Now section with active tasks, runs, routines, browser sessions, and runtime connectors.
- [ ] Each running item shows current step, owner, elapsed time, cost so far, and risk state.
- [ ] Stale items are visually flagged with last heartbeat/event time.
- [ ] Operators can open a drawer for trace/replay without leaving the page.

### Story 3 — Review a task result with evidence

As Melverick, I want every completed task to show output, evidence, sources, and next actions so I can trust the result.

Acceptance criteria:

- [ ] Completed task drawer includes summary, artifacts, evidence timeline, approval gates, source links, tests/screenshots/API evidence, and next actions.
- [ ] Evidence completeness score is visible.
- [ ] Missing evidence creates a review warning before moving to Done.
- [ ] Raw logs are available but secondary.

### Story 4 — Inspect execution trace

As an operator/admin, I want to expand a run into steps, tool calls, costs, approvals, errors, and handoffs so I can debug and audit agent behavior.

Acceptance criteria:

- [ ] Task/run drawer includes Trace Explorer tab.
- [ ] Trace groups events by run → step → tool call/result.
- [ ] Each step shows timestamp, actor, action, input summary, output summary, duration, cost/tokens where available, error/retry state.
- [ ] Approval waits, human actions, browser screenshots, and agent handoffs appear in the same timeline.
- [ ] Trace can be filtered by errors, approvals, tools, cost, actor.

### Story 5 — Replay browser/research sessions

As Melverick, I want to replay important browser/research runs so I can verify what happened without reading raw logs.

Acceptance criteria:

- [ ] Browser Activity and Research Run drawers include Replay tab.
- [ ] Replay timeline shows screenshots/evidence, URL/domain, action labels, approval waits, final evidence.
- [ ] Risky boundaries such as submit/post/send/purchase are visually marked.
- [ ] Stop/takeover events are recorded in replay.

### Story 6 — Route work by capability

As Melkizac, I want Mission Control to route work to the right digital coworker by ownership, tools, skills, risk, and evidence needs.

Acceptance criteria:

- [ ] Capabilities panel shows role, owns, safe defaults, approval needs, expected evidence, escalation path, load, and why this owner.
- [ ] Task creation suggests owner/agent with rationale.
- [ ] Model/provider is not the primary visible identity of an agent.
- [ ] Misrouted tasks can be reassigned with handoff reason.

### Story 7 — Govern external actions

As Melverick, I want external-facing or account-sensitive actions to require approval before execution.

Acceptance criteria:

- [ ] Submit/post/send/purchase/destructive/costly/policy-sensitive actions generate approval gates.
- [ ] Approval copy states actor, action, target, effect, risk, and evidence.
- [ ] Approval can be approve/reject/needs changes/mark reviewed depending on type.
- [ ] Approved action records approver, timestamp, scope, and result evidence.

### Story 8 — Manage recurring routines

As Melverick, I want recurring agent work to be visible as governed routines, not hidden cron jobs.

Acceptance criteria:

- [ ] Routines show schedule, owner, workflow, last run, next run, status, recent output, evidence, and policy.
- [ ] Operators can pause/resume/run-now/inspect where policy permits.
- [ ] Failed routines create attention items.
- [ ] Routine output links to task/run evidence.

### Story 9 — Manage tools, skills, memory, and connectors

As an admin/operator, I want to inspect what capabilities agents have and what memory/context they use.

Acceptance criteria:

- [ ] Tools show source, type, enabled agents, category, install/config status.
- [ ] Skills show source/category/usage/readiness and agents/routines/tasks using them.
- [ ] Memory shows user memory, operational memory, KB sources, source path, governance state.
- [ ] Runtime connectors show tokens, allowed types, heartbeats, events, policy dimensions.

### Story 10 — Control agent/runtime lifecycle safely

As an admin, I want to pause, stop, restart, or drain agents/runtimes safely when they misbehave.

Acceptance criteria:

- [ ] Agent/runtime drawers expose safe lifecycle actions based on role and permission.
- [ ] Risky actions require confirmation/approval.
- [ ] Actions record audit event with actor, target, reason, result.
- [ ] Stop current run and pause queue are supported before restart/update.

---

## 8. Solution Overview

### 8.1 Information architecture

#### User mode navigation

1. **Chat** — clean command center/front door.
2. **Workspace**
   - Dashboard
   - Projects
   - Files
   - Task Board
3. **Operations**
   - Routines
   - Workflows
4. **Workforce**
   - Agents
   - Capabilities
   - Skills
   - Memory
   - Reflections
   - Tools
   - Plugins
   - Approvals
5. **System**
   - Profile
   - Settings
   - Models & Limits
   - Docs

#### Admin mode navigation

1. **Platform**
   - Admin Console
   - Users & Workspaces
   - Workspace Runtime Console
   - Platform Agent Org
   - Shared Agent Templates
2. **Runtime**
   - Hermes Desktop
   - Runtime Connectors
   - Workflow Templates Admin
   - Research Run Monitor
   - Capabilities
   - Routine Governance
3. **Governance**
   - Runs / Activity
   - Costs / Usage
   - Approval Rules
   - Quota

### 8.2 Primary surfaces

#### A. Chat Command Center

Purpose: start or continue work in natural language.

Must include:

- composer with `Do anything` placeholder;
- attachment support;
- permission mode selector;
- model mode selector with `AUTO` default;
- project selector;
- selected project mission rows;
- internal context block appended to submitted instruction.

Design principle: Chat should remain simple. Operational cards belong on Dashboard.

#### B. Dashboard / Command Center

Purpose: daily cockpit.

Sections:

1. Needs Attention
2. Running Now
3. Recent Outputs
4. System Health
5. Cost/Risk Signals
6. Recommended Next Actions

Every card must answer:

- What is this?
- Who owns it?
- Why do I care?
- What is the next action?
- What evidence/status supports it?

#### C. Task Board

Purpose: canonical operational work ledger.

Required lanes:

- To-do
- Scheduled
- In progress
- Blocked / Error / Review
- Done

Required drawer tabs:

- Overview cockpit
- Sources
- Tasks/subtasks
- Outputs
- Trace Explorer / Run Tree
- Handoffs / Swimlanes
- Release / Deployment
- Evidence
- Settings

#### D. Runs / Activity

Purpose: operational ledger for chats, scheduled runs, API calls, workers, child runs, webhooks, and system events.

Required capabilities:

- filter by source, run type, actor, status;
- trace drawer;
- cost/tokens/tool calls;
- contextual evidence;
- raw messages/logs as expandable details.

#### E. Browser Activity

Purpose: supervise browser work.

Required fields:

- domain;
- URL;
- screenshot preview;
- action log;
- status;
- account-sensitive flag;
- approval-required flag;
- stop/takeover controls;
- final evidence;
- Replay tab.

Hard rule: submit/post/send/purchase requires approval.

#### F. Agents / Capabilities

Purpose: route by ownership and capability.

Agent cards should prioritize:

- role;
- owns;
- can do safely/default;
- needs approval for;
- evidence expected;
- escalation path;
- current load;
- why this owner;
- runtime health;
- active tasks/routines.

Do not prioritize model labels as identity.

#### G. Approvals

Purpose: human-in-the-loop gatekeeping.

Approval cards must show:

- actor;
- requested action;
- target;
- effect;
- risk;
- source/evidence;
- editable payload where applicable;
- approve/reject/needs changes/mark reviewed.

#### H. Routines

Purpose: scheduled/background work as business operations.

Show:

- routine name;
- workflow;
- owner;
- schedule;
- enabled/paused/error state;
- last run;
- next run;
- evidence history;
- policy/approval requirements;
- run now/pause/resume/inspect.

#### I. Memory & Knowledge

Purpose: govern durable context.

Show:

- user profile memory;
- operational memory;
- KB notes;
- sources/evidence;
- graph links;
- health;
- governance/source tabs;
- memory read/write audit events where possible.

#### J. Tools / Skills / Plugins

Purpose: capability inventory.

Show:

- enabled capabilities;
- source: Hermes/User/OpenClaw/Runtime;
- type: tool, CLI, MCP, toolset;
- assigned agents;
- readiness;
- install/configure controls;
- auditability and permission scope.

---

## 9. New Major Capabilities Required

### 9.1 Trace Explorer

#### Problem

Current audit/task information exists but can feel fragmented. Operators need a readable step-by-step execution view.

#### Requirements

Trace Explorer must display:

- run hierarchy;
- parent/child runs;
- agent steps;
- tool calls;
- tool results;
- browser events;
- approvals;
- handoffs;
- errors/retries;
- duration;
- tokens/cost;
- evidence attachments.

#### UX

Inside Task Drawer and Run Drawer:

```text
Trace
├─ 13:02 Melkizac planned task
├─ 13:03 delegated to Andrej
├─ 13:04 Andrej read files
│  └─ tool: read_file / output summary
├─ 13:07 test failed
│  └─ error summary
├─ 13:10 patch applied
├─ 13:12 tests passed
├─ 13:14 evidence attached
└─ 13:15 awaiting approval
```

#### Acceptance criteria

- [ ] Trace Explorer groups events by run and actor.
- [ ] Operators can expand/collapse events.
- [ ] Error and approval events are visually prominent.
- [ ] Cost/time/tool-call counts are visible at run and step level where available.
- [ ] Raw payload is available but hidden by default.

### 9.2 Session Replay

#### Problem

Browser/research/agent activity needs verification beyond logs.

#### Requirements

Replay supports:

- timeline scrubber;
- screenshot/evidence frames;
- action labels;
- URL/domain;
- approval waits;
- stop/takeover events;
- final evidence;
- export/share link.

#### Acceptance criteria

- [ ] Browser sessions with screenshots show replay frames.
- [ ] Events without screenshots still appear as timeline markers.
- [ ] Risk boundaries are highlighted.
- [ ] Replay links back to related task/run/approval.

### 9.3 Agent Swimlanes

#### Problem

Multi-agent work is hard to understand as linear logs.

#### Requirements

Swimlane view shows work across:

- orchestrator;
- specialist agents;
- human approver;
- routines;
- external runtime/browser.

Example:

```text
Melkizac     | Plan ─ Delegate ─ Review ─ Close
Andrej       |      Build ─ Test ─ Evidence
Enrico       | Draft ─ Wait Approval ─ Publish
Melverick    |               Approve
Browser      | Open ─ Screenshot ─ Block before Submit
```

#### Acceptance criteria

- [ ] Swimlane view appears in mission/task drawer for multi-agent tasks.
- [ ] Handoffs include reason and expected next action.
- [ ] Blocked/waiting states are visually distinct.

### 9.4 Live Cost and Loop Risk

#### Problem

Costs are visible in aggregate but need task/run-level actionability.

#### Requirements

Task/run cockpit shows:

- model/provider;
- tokens so far;
- estimated cost;
- tool calls;
- runtime duration;
- repeated failed actions;
- expensive loop warning;
- routing recommendation.

#### Acceptance criteria

- [ ] Task drawer contains cost signal card.
- [ ] Runs over configured threshold create warning.
- [ ] Repeated retries/tool loops create warning.
- [ ] Warning links to trace events causing the spike.

### 9.5 Governed Agent Lifecycle Controls

#### Problem

Operators need to stop, pause, restart, or drain work safely.

#### Requirements

Depending on permission and runtime support:

- stop current task;
- pause agent queue;
- resume queue;
- restart runtime/profile;
- health check now;
- drain mode;
- safe update;
- open logs/trace.

#### Acceptance criteria

- [ ] Controls are shown only if supported by runtime and user role.
- [ ] Risky controls require explicit confirmation or approval.
- [ ] All lifecycle actions write audit events.
- [ ] Failed controls return actionable error messages.

### 9.6 Workflow Contract Builder

#### Problem

Repeatable business workflows need explicit governance contracts, not just task templates.

#### Requirements

Workflow contract defines:

- trigger;
- project/workspace;
- owner;
- steps;
- agent per step;
- tools allowed;
- required evidence;
- approval gates;
- retry/blocker policy;
- schedule/routine binding;
- output artifacts;
- success metrics.

#### Acceptance criteria

- [ ] Workflow Library detail drawer shows contract tabs.
- [ ] New workflow creation validates evidence and approval policy before enabling routine.
- [ ] Workflow can create a Task Board task and routine binding.
- [ ] Workflow canvas is optional; contract table is required.

---

## 10. Data Model Requirements

### 10.1 Core entities

```text
Project
Goal
Mission
Task
Run
RunEvent
ToolCall
ApprovalGate
Blocker
Artifact
Evidence
Agent
AgentCapability
Handoff
Routine
Workflow
RuntimeConnector
BrowserSession
MemoryEvent
CostEvent
PolicyRule
```

### 10.2 Required cross-links

Every important record should link where possible:

- Task → Project / Mission / Goal
- Task → Agent / Assignee
- Task → Runs
- Run → Events
- Event → ToolCall / Approval / Evidence / Cost
- Approval → Task / Run / Actor / Target
- Evidence → Artifact / Screenshot / URL / File / Session
- Routine → Workflow / Runs / Output evidence
- BrowserSession → Task / Run / Approval / Evidence
- MemoryEvent → Task / Run / Agent / Memory entry
- Handoff → From agent / To agent or human / Reason / Next action

### 10.3 Evidence completeness model

Each completed task should calculate an evidence status:

| Status | Meaning |
|---|---|
| Complete | Has output and at least one strong evidence artifact/source/test/screenshot/API response |
| Partial | Has output but weak or incomplete evidence |
| Missing | No linked evidence |
| Not required | Manual/admin task where evidence is explicitly unnecessary |

Evidence strength examples:

- Test output
- Build/deploy output
- Screenshot
- Final URL
- API response ID/status
- Source citation
- File path with artifact
- Approval record
- Trace/run ID
- External platform confirmation

---

## 11. UX Principles

1. **Evidence before logs.** Show proof and summary first; raw logs are drill-down.
2. **Drawers over duplicate pages.** Keep task/project/run context in slide-over drawers where possible.
3. **Operator language over system language.** Say “Approve LinkedIn post” not “POST /api/inbox action.”
4. **Capability over model identity.** Agents are routed by domain ownership, tools, risk, and evidence expectations.
5. **Human gates are explicit.** Approvals must state actor/action/target/effect.
6. **No false readiness.** Demo/simulated/runtime-blocked states must be labeled.
7. **Mobile is a first-class operator mode.** Approval/task links must work on mobile with no horizontal overflow.
8. **Progress should be compact.** Use horizontal bars/status chips, not giant decorative rings.
9. **Admin complexity stays in Admin mode.** User mode remains task/outcome focused.
10. **Every card needs a next action.** If the operator sees a card, they should know what to do with it.

---

## 12. Technical Considerations

### 12.1 Existing code surfaces

Key frontend files:

- `src/App.tsx`
- `src/components/NavRail.tsx`
- `src/views/MissionControl.tsx`
- `src/views/Dashboard.tsx`
- `src/views/TaskBoard.tsx`
- `src/views/AuditLog.tsx`
- `src/views/Agents.tsx`
- `src/views/AgentOrg.tsx`
- `src/views/Automations.tsx`
- `src/views/BrowserOperations.tsx`
- `src/views/WorkflowLibrary.tsx`
- `src/views/MemoryContext.tsx`
- `src/views/ToolsHub.tsx`
- `src/views/CostDashboard.tsx`
- `src/views/ModelRouter.tsx`
- `src/components/SlideOverDrawer.tsx`
- `src/components/MissionFoundation.tsx`
- `src/types.ts`
- `src/services/httpHermesClient.ts`
- `src/services/hermesClient.ts`

Key backend/API files:

- `backend/app.py`
- root runtime app: `/opt/hermes-mission-control/app.py`

Existing data sources:

- `/root/.hermes/state.db`
- `/root/.hermes/cron/jobs.json`
- `/root/.hermes/cron/output/`
- `/root/.hermes/kanban.db`
- `/root/.hermes/skills/`
- `/root/.hermes/agent_registry.yaml`
- `/root/.hermes/logs/`

### 12.2 Dependencies

| Dependency | Needed for | Owner | Risk |
|---|---|---|---|
| Hermes session DB cost/tool fields | Trace/cost explorer | Andrej | Medium |
| Kanban task/run links | Task cockpit / run tree | Andrej | Medium |
| Runtime event bridge | Browser replay/lifecycle controls | Andrej | Medium |
| Approval DB/API | Approval gates | Andrej | Low-Medium |
| Cron jobs/output | Routines | Andrej | Low |
| Agent registry | Capabilities / routing | Melkizac + Andrej | Medium |
| Frontend responsive drawers | Mobile operator mode | Andrej | Low |
| Source/evidence artifact paths | Evidence completeness | Melkizac + Andrej | Medium |

### 12.3 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| UI becomes too complex | High | High | Keep Chat simple; use drawer-first details; role-based Admin/User modes |
| Trace data incomplete | Medium | High | Show partial trace with confidence labels; improve event ingestion incrementally |
| Runtime controls can be dangerous | Medium | High | Permission gates, confirmation, audit logs, safe defaults |
| Evidence scoring becomes noisy | Medium | Medium | Start with transparent heuristic; allow manual mark verified/needs evidence |
| Mobile layout regresses | Medium | Medium | Add responsive tests around 390px width |
| Cost data unavailable for some runs | Medium | Medium | Show “unknown” clearly; do not fabricate cost |
| Canvas workflow becomes vanity | Medium | Medium | Contract table first; canvas later only if useful |

---

## 13. Phased Roadmap

### Phase 0 — Product alignment and baselines

Goal: lock scope and define measurable baseline.

Deliverables:

- This PRD reviewed and approved.
- Baseline current surfaces and APIs.
- Define event schema for trace/replay/cost.
- Confirm P0/P1/P2 scope with Melverick and Andrej.

Success gate:

- Clear build sequence with acceptance criteria.

### Phase 1 — Trace Explorer MVP

Goal: turn current task/run events into an expandable trace.

Scope:

- Trace Explorer component.
- Use existing task events/runs/tool calls where available.
- Add to TaskBoard drawer and AuditLog drawer.
- Error/approval/tool/cost highlighting.

Success gate:

- A completed task can be inspected from summary → trace → evidence without leaving drawer.

### Phase 2 — Live cost and loop-risk cockpit

Goal: make costs actionable at task/run level.

Scope:

- Task cost signal card.
- Run cost/time/tool-call summary.
- Expensive loop warning heuristic.
- Link warning to trace event cluster.

Success gate:

- Operator can identify cost spikes before opening raw logs.

### Phase 3 — Browser Session Replay

Goal: make browser evidence reviewable as a timeline.

Scope:

- Replay tab in Browser Activity.
- Screenshot/action timeline.
- Approval boundary markers.
- Stop/takeover event markers.
- Link browser replay to task/result evidence.

Success gate:

- Browser funnel check can be reviewed through replay with screenshot and approval boundary.

### Phase 4 — Agent swimlanes and handoff map

Goal: make multi-agent work understandable.

Scope:

- Swimlane component.
- Use task runs, handoffs, assignees, human approvals.
- Add to task/mission drawer.

Success gate:

- Multi-agent mission shows who did what, when, and what is waiting.

### Phase 5 — Governed lifecycle controls

Goal: safely control agents/runtimes.

Scope:

- Agent/runtime drawer lifecycle controls.
- Stop current run, pause/resume queue where supported.
- Health check now.
- Restart/update only admin-gated.
- Audit event for every action.

Success gate:

- Admin can stop a misbehaving supported runtime with auditable result.

### Phase 6 — Workflow Contract Builder

Goal: make repeatable workflows governed and evidence-aware.

Scope:

- Workflow contract model.
- Required evidence/approval gates per step.
- Routine binding guardrails.
- Optional visual representation after contract table.

Success gate:

- New workflow cannot be enabled as routine without owner, schedule, evidence, and approval policy.

### Phase 7 — Workflow-specific model compare

Goal: evaluate model quality/cost/latency/reliability by workflow.

Scope:

- Run workflow sample across models.
- Compare output quality, evidence completeness, latency, cost.
- Save route policy recommendation.

Success gate:

- Operator can choose model policy for a workflow based on measured evidence.

---

## 14. Launch Plan

### 14.1 Alpha

Audience: Melverick + Melkizac + Andrej only.

Scope:

- Trace Explorer MVP
- Task cost signal
- Browser Replay MVP

Success gate:

- No P0 UI regressions.
- Existing Task Board, Approvals, Routines, Audit, Browser Activity still pass tests.
- Melverick can review one task and one browser run end-to-end.

### 14.2 Beta

Audience: internal digital coworker operations.

Scope:

- Swimlanes
- Lifecycle controls for safe supported actions
- Evidence completeness score

Success gate:

- At least 10 real HMC tasks reviewed through new cockpit.
- ≥80% evidence completeness on completed tasks.
- No accidental external action without approval.

### 14.3 GA

Audience: broader demo/client-facing controlled use if desired.

Scope:

- Workflow Contract Builder
- Model compare for selected workflows
- Admin documentation
- Operator training/demo script

Success gate:

- Stable live service.
- Mobile operator mode verified.
- PRD success metrics reviewed.

### 14.4 Rollback criteria

Rollback or disable new modules if:

- Task Board fails to load;
- Approvals cannot be opened/actioned;
- Browser Activity hides approval-required state;
- Admin lifecycle action fires without audit event;
- mobile layout blocks core operator action;
- trace/replay displays fabricated or misleading evidence.

---

## 15. Open Questions

| Question | Owner | Needed by | Notes |
|---|---|---|---|
| What is the canonical event schema for trace/replay? | Andrej | Before Phase 1 | Should unify task events, session messages, tool calls, browser events |
| Which lifecycle controls are safe for user mode vs admin mode? | Melverick + Andrej | Before Phase 5 | Start with stop/pause before restart/update |
| Should evidence completeness block Done status or only warn? | Melverick | Before Phase 2/3 | Recommendation: warn first, block later for governed workflows |
| Which workflows need model compare first? | Melverick + Melkizac | Before Phase 7 | Likely research-to-deliverable, LinkedIn, funnel checks |
| Should terminal be added? | Andrej | Later | Recommendation: admin-only runtime console, not daily UI |
| What is minimum trace data needed for useful replay? | Andrej | Before Phase 1 | Start partial and label unknowns clearly |

---

## 16. Acceptance Checklist for “Perfect Mission Control”

A release deserves the name “Perfect Mission Control” when:

- [ ] Melverick can open Dashboard and know what needs attention in <30 seconds.
- [ ] Every active run/task/routine/browser session has a visible owner and status.
- [ ] Every completed agent task has evidence or a clear evidence-missing warning.
- [ ] Risky external actions cannot bypass approval gates.
- [ ] Task drawer shows overview, trace, evidence, handoffs, outputs, and cost.
- [ ] Browser runs can be replayed with screenshots/action timeline where available.
- [ ] Multi-agent missions show swimlanes/handoffs.
- [ ] Agent cards explain capabilities and routing rationale, not just model labels.
- [ ] Routines show owner, schedule, last/next run, status, and evidence history.
- [ ] Memory/tool/skill usage is inspectable and governed.
- [ ] Runtime connector status and readiness are clearly labeled.
- [ ] Admin controls are gated, auditable, and reversible where possible.
- [ ] Mobile operator links remain usable around 390px width.
- [ ] Raw logs are available but never the only way to understand what happened.

---

## 17. Appendix A — Prioritized Feature Backlog

### P0

1. Trace Explorer in Task/Run drawers.
2. Task/run live cost signal and loop-risk warning.
3. Browser Session Replay.
4. Evidence completeness score/warning.

### P1

5. Agent swimlanes.
6. Governed lifecycle controls.
7. Stronger Dashboard Running Now / Needs Attention synthesis.
8. Handoff map and reassignment rationale.

### P2

9. Workflow Contract Builder.
10. Admin-only terminal/runtime console.
11. Workflow-specific model compare.
12. Visual workflow canvas, only after contract builder.
13. Prompt/dataset experiment studio, only if workflow evaluation becomes core.

---

## 18. Appendix B — Design North Star

The perfect Mission Control should feel like:

- **Air Traffic Control** for agent activity;
- **Jira + Datadog + LangSmith** for tasks/runs/traces;
- **Notion/Obsidian** for workspace knowledge;
- **Linear** for crisp operational surfaces;
- **GitHub checks** for evidence and approvals;
- **a COO dashboard** for AI workforce accountability.

But it should not copy any of those literally. Its unique wedge is:

> **Digital coworker governance with evidence-first execution.**

---

## 19. Appendix C — Source references used for this PRD

Public scan references:

- Hermes Agent Web Dashboard docs: `https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard`
- `https://raw.githubusercontent.com/robsannaa/openclaw-mission-control/main/README.md`
- `https://raw.githubusercontent.com/builderz-labs/mission-control/main/README.md`
- `https://raw.githubusercontent.com/JPeetz/Hermes-Studio/main/README.md`
- `https://raw.githubusercontent.com/pyrate-llama/hermes-ui/main/README.md`
- `https://raw.githubusercontent.com/inbharatai/agent-arcade-gateway/main/README.md`
- LangSmith Studio docs: `https://docs.langchain.com/langsmith/use-studio`
- LangSmith Observability Studio: `https://docs.langchain.com/langsmith/observability-studio`
- AgentOps docs: `https://docs.agentops.ai/v2/introduction`
- OpenHands docs: `https://docs.openhands.dev/overview/introduction`
- Dify docs: `https://docs.dify.ai/en/use-dify/getting-started/introduction`
- Flowise Agentflow V2 docs: `https://docs.flowiseai.com/using-flowise/agentflowv2`

Current HMC references:

- `/opt/hermes-mission-control/source/docs/HERMES_MISSION_CONTROL.md`
- `/root/.hermes/workspace/kb/wiki/projects/hermes-mission-control.md`
- `/opt/hermes-mission-control/source/src/App.tsx`
- `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- `/opt/hermes-mission-control/source/src/views/TaskBoard.tsx`
- `/opt/hermes-mission-control/source/src/views/AuditLog.tsx`
- `/opt/hermes-mission-control/source/src/views/MemoryContext.tsx`
- `/opt/hermes-mission-control/source/src/views/ToolsHub.tsx`
- `/opt/hermes-mission-control/source/tests/test_task_board_execution_cockpit.py`
- `/opt/hermes-mission-control/source/tests/test_agent_org_capability_routing_panel.py`
