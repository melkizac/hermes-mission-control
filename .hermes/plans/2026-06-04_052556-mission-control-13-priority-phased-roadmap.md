# Mission Control 13-Priority Phased Development Roadmap

**Goal:** Phase the 13 agreed Mission Control priorities into a logical technical roadmap that strengthens Mission Control as the management, audit, and trust layer for AI coworkers.

**Strategic anchor:** Mission Control should not become a Manus/Odysseus clone. Borrow Manus-style simple delegation and artifact-first output, and Odysseus-style runtime/local/self-hosted confidence, but keep Mission Control's differentiator: operations, governance, evidence, approvals, second-brain context, multi-agent routing, and SME workflow orchestration.

---

## Phase 0 — Foundation hardening and shared primitives

**Purpose:** Make later feature work cheaper and safer by defining common data models and UI primitives.

**Priorities enabled:** all 13.

### Build / refine
- Shared `WorkItem` / `Task` / `Run` / `Artifact` / `Evidence` / `ApprovalGate` vocabulary.
- Shared right-side drawer pattern for details.
- Shared artifact card component.
- Shared evidence timeline component.
- Shared source/provenance chips.
- Shared project/agent/model/workflow selectors.
- Shared API client response types.
- Permission/risk metadata fields: safe, approval-required, external-facing, destructive, account-sensitive.

### Likely files
- `src/api/client.ts`
- `src/types.ts` or equivalent type files
- `src/components/*Drawer*`
- `src/components/*Evidence*`
- `src/components/*Artifact*`
- `app.py`
- backend runtime/task/audit helpers

### Validation
- Existing Mission Control pages still build and render.
- `npm run build` passes.
- Existing API smoke tests still pass.
- No visible regression on Dashboard, Agents, Task Board, Approvals, Projects, Automations, Audit, Skills, Costs.

---

## Phase 1 — Delegate Work front door + Project master instructions

**Purpose:** Give users a simple Manus-like entry point, but route work into Mission Control's existing operating model.

**Priorities covered:**
1. Delegate Work front door
6. Project master instructions

### Why this phase first
The front door needs project context. Project master instructions make routing and task creation more reliable. These two should be built together.

### User-facing outcome
A user can open Mission Control and say:

> “Get more signups for the next Nexius Academy class.”

Mission Control turns that into:
- selected or suggested project
- suggested agent
- recommended workflow/template
- model/risk/approval level
- expected artifact/evidence
- queued task or agent goal

### Build slices
1. Add `Delegate Work` top-level route/page.
2. Add large natural-language task composer.
3. Add suggested SME task prompts.
4. Add project selector with default recommendation.
5. Add agent selector with default recommendation.
6. Add risk/approval preview.
7. Add expected artifact/evidence preview.
8. Add `Create Task` / `Create Goal` action.
9. Add Project Operating Brief fields:
   - objective
   - canonical instructions
   - brand/voice constraints
   - allowed tools
   - linked knowledge
   - approval policy
   - evidence requirements
10. Render Project Operating Brief inside Projects detail drawer.

### Backend/API needs
- `GET /api/projects` enriched with operating brief fields.
- `PATCH /api/projects/<id>/brief` or equivalent persistence.
- `POST /api/delegate-work/preview` to classify task and return recommended project/agent/workflow/risk.
- `POST /api/delegate-work` to create task/goal.

### Acceptance criteria
- User can submit a natural-language task from Delegate Work.
- Mission Control creates a real task/goal, not only a chat message.
- Created item appears in Task Board or Agent Org.
- Project brief is saved and reused by preview/routing.
- Task includes expected artifact/evidence fields.

---

## Phase 2 — Artifact/evidence result view

**Purpose:** Make completed work feel tangible and auditable.

**Priorities covered:**
2. Artifact/evidence result view

### Why this phase follows Phase 1
Once work can be delegated cleanly, Mission Control needs a strong completion surface. This is the main Manus-inspired improvement, adapted for governance.

### User-facing outcome
Every completed task/run has a result page or drawer answering:
- What was produced?
- Where is the artifact?
- What evidence proves it?
- What did the agent do?
- What did it cost?
- What needs approval or follow-up?

### Build slices
1. Define backend artifact model:
   - id
   - task/run/session id
   - artifact type: file, link, screenshot, message, report, dataset, diff, note
   - title
   - summary
   - path/url
   - created by agent/profile
   - created timestamp
2. Define backend evidence model:
   - source
   - screenshot/file/log/session/tool call
   - confidence/provenance
   - redaction state
3. Add artifact/evidence endpoint.
4. Add Result drawer/page component.
5. Link Task Board completed tasks to Result view.
6. Link Audit sessions to Result view.
7. Add copy/export/open actions.
8. Redact secrets in previews.

### Backend/API needs
- `GET /api/results/<task_or_run_id>`
- `GET /api/artifacts?...`
- `GET /api/evidence?...`
- artifact discovery from uploads, cron outputs, run logs, generated files where safe.

### Acceptance criteria
- At least one real completed task shows a result view.
- Result view includes summary, artifact(s), evidence, cost/model/profile metadata, and next action.
- No secrets/raw financial/private state are exposed by default.

---

## Phase 3 — Packaged SME workflow templates + Skill/workflow library improvements

**Purpose:** Turn repeated Nexius/SME operations into reusable workflows that can be launched from Delegate Work.

**Priorities covered:**
3. Packaged SME workflow templates
12. Skill/workflow library improvements

### Why this phase follows artifacts
Workflow templates should specify not only steps, but expected outputs and evidence. Phase 2 gives them a consistent result contract.

### Initial workflow templates
- Lead Triage
- Course Signup Push
- LinkedIn Daily Ops
- Proposal Draft
- Website Funnel Audit
- Meeting Summary to Tasks
- Client Report
- Invoice / Payment Follow-up

### Build slices
1. Define workflow template schema:
   - id
   - name
   - business outcome
   - required inputs
   - default project type
   - default agent
   - default skills
   - approval policy
   - expected artifacts
   - evidence checklist
   - suggested schedule if recurring
2. Add Workflow Library page or extend Skills Hub with `Workflows` tab.
3. Add workflow cards to Delegate Work.
4. Add `Launch workflow` action.
5. Show linked skills and credentials required.
6. Show last successful run and common blockers.
7. Allow templates to create one-off task, recurring routine, or agent goal.

### Backend/API needs
- `GET /api/workflow-templates`
- `POST /api/workflow-templates/<id>/launch`
- optional file-backed template definitions under project source/config.
- link workflows to Hermes skills where applicable.

### Acceptance criteria
- User can launch at least 3 real workflows from UI.
- Workflow-created tasks carry expected artifact/evidence requirements.
- Skills Hub shows where skills are used by workflows/routines/agents.

---

## Phase 4 — Desktop Gateway / Runtime Readiness

**Purpose:** Make local/remote runtime capability visible, diagnosable, and safe.

**Priorities covered:**
4. Desktop Gateway / Runtime Readiness

### Why this is Phase 4
This is technically deeper and depends on clear task/evidence primitives. It also becomes more valuable once workflows need local files, browser sessions, and external runtimes.

### User-facing outcome
Mission Control clearly shows:
- which runtimes are connected
- whether Desktop Gateway is online
- which machine/folders are approved
- which tools/models are available
- which issues block execution
- what actions are safe/unsafe

### Build slices
1. Unify Runtime Connectors + Desktop Gateway status shape.
2. Add runtime health cards.
3. Add approved folders panel.
4. Add connector token/status/heartbeat view.
5. Add model/runtime capability detection where available.
6. Add troubleshooting checklist for offline gateway.
7. Add safe disconnect/revoke actions.
8. Add audit trail for local access events.

### Backend/API needs
- `GET /api/runtime-readiness`
- `GET /api/desktop-gateway/status`
- `GET /api/runtime-connectors/events`
- safe token/route redaction.

### Acceptance criteria
- Online/offline state is based on real heartbeat or API checks.
- Empty/offline gateway shows actionable reason and next steps.
- Approved folders and local access are visible and auditable.
- No tokens/secrets are displayed.

---

## Phase 5 — Browser operation visibility

**Purpose:** Make browser automation observable and controllable rather than magical.

**Priorities covered:**
5. Browser operation visibility

### Why this follows Runtime Readiness
Browser operation is a runtime capability. The system first needs to know which runtime/browser is active and what approvals are required.

### User-facing outcome
When an agent uses a browser, Mission Control can show:
- current site/domain
- screenshot preview
- action log
- account-sensitive indicator
- approval gates before post/send/purchase/submit
- stop/takeover controls
- final evidence screenshot/link

### Build slices
1. Define browser session model.
2. Add Browser Activity page or Runtime sub-tab.
3. Add browser operation cards in running task detail.
4. Add screenshot capture/preview where available.
5. Add domain/account-sensitive risk chips.
6. Add stop/request-approval action.
7. Store final screenshot/link evidence to task result.

### Backend/API needs
- `GET /api/browser-sessions`
- `GET /api/browser-sessions/<id>`
- `POST /api/browser-sessions/<id>/stop`
- browser tool/run event ingestion.

### Acceptance criteria
- A real or simulated browser run appears in Mission Control.
- Operator can see status, domain, latest screenshot/evidence, and action log.
- External submit/post/send actions require approval metadata.

---

## Phase 6 — Mobile operator mode

**Purpose:** Make Mission Control useful from Telegram/mobile for approvals, attention, and quick interventions.

**Priorities covered:**
7. Mobile operator mode

### Why this follows core operational pages
Mobile mode should focus on the highest-value operational primitives already built: delegate, approve, inspect result, unblock, stop.

### User-facing outcome
On phone, Mission Control shows:
- Needs Attention
- Approval Gates
- Running Now
- Recent Outputs
- Delegate Work quick composer
- task/result drawer optimized for mobile

### Build slices
1. Audit current responsive layout.
2. Add mobile bottom nav or collapsed nav.
3. Create mobile-first Operator page.
4. Optimize Task/Approval/Result drawers for small screens.
5. Add quick approve/reject/request-changes actions.
6. Add Telegram deep links to specific task/result/approval where possible.

### Acceptance criteria
- No horizontal overflow on mobile viewport.
- User can approve/reject/edit an approval from mobile.
- User can inspect a result artifact/evidence from mobile.
- User can submit Delegate Work from mobile.

---

## Phase 7 — Wide Research / parallel agent runs

**Purpose:** Let Mission Control orchestrate many workers for research or batch tasks with visible progress and consolidation.

**Priorities covered:**
8. Wide Research / parallel agent runs

### Why this is later
Parallel runs need strong task/result/evidence primitives and a more mature agent/workflow model.

### User-facing outcome
User can launch a parallel research/batch mission:
- topic or item list
- number of workers
- source constraints
- output format
- cost/time cap
- consolidation agent

Mission Control shows:
- worker progress
- partial outputs
- failures/retries
- final consolidated report
- citations/evidence
- converted tasks/actions

### Build slices
1. Define parallel run parent/child model.
2. Add launch form for research/batch mode.
3. Add worker progress board.
4. Add consolidation result view.
5. Add cost/time caps.
6. Add convert-findings-to-tasks action.

### Backend/API needs
- `POST /api/parallel-runs`
- `GET /api/parallel-runs/<id>`
- `GET /api/parallel-runs/<id>/children`
- integration with Hermes delegation/cron/task primitives.

### Acceptance criteria
- A small parallel run can be launched and monitored.
- Each child output is visible.
- Final consolidated artifact is attached to result view.

---

## Phase 8 — Workflow-specific model compare

**Purpose:** Make model evaluation operational, not a generic playground.

**Priorities covered:**
9. Workflow-specific model compare

### Why this follows workflows and parallel runs
Model comparison should evaluate actual workflow outputs and feed Model Router policy.

### User-facing outcome
For a workflow, user can compare models on:
- quality
- cost
- latency
- instruction following
- structured output validity
- brand fit
- tool reliability
- hallucination/risk indicators

Then save recommendation into routing policy.

### Build slices
1. Add model comparison run type.
2. Reuse workflow input and expected artifact schema.
3. Generate outputs from selected models.
4. Add side-by-side comparison UI.
5. Add scoring rubric.
6. Add save-to-Model-Router action.
7. Add history of comparisons per workflow.

### Backend/API needs
- `POST /api/model-compare`
- `GET /api/model-compare/<id>`
- `POST /api/model-router/policies`

### Acceptance criteria
- At least one workflow can compare two models.
- Cost/latency/output metadata are shown.
- Selected policy is saved or queued for approval.

---

## Phase 9 — Team collaboration around tasks/artifacts

**Purpose:** Move Mission Control from single-operator cockpit toward team operations.

**Priorities covered:**
10. Team collaboration around tasks/artifacts

### Why this comes after result views
Collaboration should happen around concrete tasks, decisions, approvals, and artifacts, not abstract chat.

### User-facing outcome
Users can:
- comment on a task/result/approval
- assign human or agent
- request changes
- mention a collaborator
- create a shared review link
- see decision history

### Build slices
1. Add comment model.
2. Add assignment model for human/agent.
3. Add request-changes action.
4. Add activity timeline entries.
5. Add shared task/result link with auth boundary.
6. Add notifications/delivery hooks later.

### Backend/API needs
- `GET/POST /api/tasks/<id>/comments`
- `POST /api/tasks/<id>/assign`
- `POST /api/results/<id>/request-changes`

### Acceptance criteria
- Comment thread works on task/result.
- Request changes creates a follow-up task or agent instruction.
- Assignment appears in Task Board/Needs Attention.

---

## Phase 10 — Unified intake from Telegram/email/forms

**Purpose:** Convert external signals into structured Mission Control work.

**Priorities covered:**
11. Unified intake from Telegram/email/forms

### Why this is later
Intake becomes more powerful after Delegate Work, workflows, tasks, artifacts, approvals, and collaboration are established.

### User-facing outcome
Mission Control shows one Intake queue for:
- Telegram requests
- email tasks
- website form leads
- Supabase lead captures
- meeting transcripts
- manual Delegate Work submissions

Each item is classified and routed to:
- task
- approval gate
- project update
- workflow launch
- FYI/evidence

### Build slices
1. Define intake item schema.
2. Add Intake page or Dashboard section.
3. Add source adapters incrementally:
   - Telegram first
   - Supabase lead captures second
   - email third
   - website forms/webhooks fourth
4. Add classification preview.
5. Add route-to-task/project/workflow controls.
6. Add deduplication and source provenance.

### Backend/API needs
- `GET /api/intake`
- `POST /api/intake/<id>/route`
- source-specific fetchers/adapters.

### Acceptance criteria
- At least two real intake sources appear.
- User can convert an intake item into a task/workflow/approval.
- Source evidence is preserved.

---

## Phase 11 — Public/demo storytelling page

**Purpose:** Explain and sell Mission Control without exposing private runtime data.

**Priorities covered:**
13. Public/demo storytelling page

### Why this is last
The story should reflect real product surfaces after the core workflows exist. Build too early and it becomes aspirational marketing.

### User-facing outcome
A clean public/demo page explains:
- Delegate work to digital coworkers
- Track task execution
- Review artifacts and evidence
- Approve risky actions
- Monitor runtime health and costs
- Package SME workflows
- Govern AI workforces

### Build slices
1. Define safe public route boundary.
2. Create marketing/demo landing page.
3. Add screenshot/demo data mode only.
4. Add role-aware login/CTA.
5. Add feature tour panels.
6. Add privacy/data-boundary notes.

### Acceptance criteria
- Public page does not expose live data, secrets, private tasks, finance data, or internal logs.
- Messaging matches: “Hermes is worker layer; Mission Control is management, audit, and trust layer.”
- Demo is understandable to SME clients.

---

## Recommended release grouping

### Release A — Core delegation loop
- Phase 0
- Phase 1
- Phase 2

**Outcome:** User can delegate work, route it to a project/agent, and inspect tangible evidence when done.

### Release B — SME workflow productization
- Phase 3
- Phase 4
- Phase 5

**Outcome:** Mission Control supports packaged SME workflows plus trustworthy runtime/browser capability visibility.

### Release C — Operator mobility and scale
- Phase 6
- Phase 7
- Phase 8

**Outcome:** Mobile approvals/operations, parallel runs, and model-routing evaluation.

### Release D — Team and intake layer
- Phase 9
- Phase 10

**Outcome:** Mission Control becomes a collaborative operations hub fed by real external channels.

### Release E — External story
- Phase 11

**Outcome:** Mission Control can be demoed/sold clearly without exposing private runtime data.

---

## Dependency map

- Delegate Work depends on Project briefs and task/goal creation.
- Artifact/evidence result view depends on task/run/session linking.
- Workflow templates depend on Delegate Work and result/evidence contracts.
- Runtime Readiness depends on connector/gateway status APIs.
- Browser visibility depends on Runtime Readiness and evidence capture.
- Mobile Operator Mode depends on stable core pages/actions.
- Wide Research depends on multi-agent/delegation and result consolidation.
- Model Compare depends on workflow templates and Model Router.
- Collaboration depends on task/result/approval records.
- Unified Intake depends on route-to-task/workflow/approval being stable.
- Public demo depends on enough real UI to tell a truthful story.

---

## Suggested implementation principle

Each phase should ship as a thin vertical slice:
1. real backend data or honest empty state
2. one usable UI surface
3. one end-to-end happy path
4. evidence/audit trail
5. tests/build verification
6. live UI verification before reporting complete

Avoid building large abstract frameworks before a user-facing loop works.
