# Mission Control Chat-First Simplification Audit + IA Redesign

## Goal

Re-evaluate Mission Control after the Phase 0–25 buildout and simplify it for non-technical users without deleting the advanced functionality already built.

Core product decision:

> Chat drives. UI confirms. Evidence proves. Approvals protect. Settings configure.

The simplified product should feel like a **chat-first AI workforce operating system**, not a technical admin dashboard. Most heavy lifting should happen through agent chat. Mission Control pages become supporting drill-downs for work, approvals, evidence, and configuration.

## Current context observed

Source inspected:

- `/opt/hermes-mission-control/source/src/App.tsx`
- `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- `/opt/hermes-mission-control/source/src/views/MissionControl.tsx`
- `/opt/hermes-mission-control/source/src/views/Agents.tsx`
- `/opt/hermes-mission-control/source/src/components/ChatThread.tsx`
- `/opt/hermes-mission-control/source/src/services/deepLinks.ts`
- `/opt/hermes-mission-control/source/src/services/uiPermissions.ts`

Current first-class workspace nav exposes many concepts:

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
- Research Runs
- Workspace Knowledge
- My Audit / Evidence
- Profile

Admin mode exposes additional concepts:

- Admin Overview
- Users & Workspaces
- Platform Agent Org
- Shared Agent Templates
- Runtime Connectors
- Desktop Gateway
- Browser Activity
- Research Runs
- Model Router
- Tools
- Skills
- Global Audit Log
- Costs / Usage
- Approval Policy
- Quota

Current home/cockpit already has useful blocks:

- Needs Attention
- Running Now
- Recent Outputs
- System Health
- Recommended next actions
- Mobile operator actions

Current chat surface exists mainly under `Agents` via `ChatThread`, with:

- model selection
- attachment upload
- reply context
- stop processing
- optimistic pending message
- processing indicator
- unread / jump to latest
- project/session scoping

Conclusion: the system has the right components, but the IA makes too many internal primitives visible as equal destinations. The redesign should not remove capability; it should re-layer it.

## Target user mental model

A non-technical SME user should not need to know whether work is a workflow, task, browser session, runtime, routine, model route, research run, or agent goal.

They should ask natural business commands:

- “Get more signups for next week’s AI class.”
- “Check if the website funnel is working.”
- “Prepare my LinkedIn post for today.”
- “Follow up with these leads.”
- “What is blocked today?”
- “What did the agents complete?”

Mission Control should infer and route internally.

## New IA principle

### Layer 1 — Simple user layer

Visible daily:

1. Chat command surface
2. Needs Attention
3. Running Now
4. Recent Results

### Layer 2 — Operator layer

Available for drill-down:

1. Work
2. Approvals
3. Evidence

### Layer 3 — Admin/debug layer

Hidden under Settings / Advanced:

1. Routines
2. Runtime Connectors
3. Browser Activity raw sessions
4. Model Router
5. Skills
6. Tools
7. Agent Org internals
8. Audit logs
9. Costs / quotas

## Proposed top-level navigation

Reduce visible workspace nav to five top-level destinations:

### 1. Home

Purpose:

> Ask agents, see what needs attention, see what is running, review recent proof.

Contains:

- large `Ask Mission Control` composer
- suggested prompts/playbooks
- Needs Attention summary
- Running Now summary
- Recent Results / Proof summary
- System warnings only when actionable

### 2. Work

Purpose:

> All open, running, completed, and planned work.

Absorbs or routes to:

- Task Board
- Delegate Work
- Workflow Library / Playbooks
- Projects
- Research Runs
- Agent goals

Non-technical visible labels:

- `Open Work`
- `Running Work`
- `Completed Work`
- `Playbooks`
- `Projects`

### 3. Approvals

Purpose:

> Things agents cannot do without the human.

Contains:

- approve / reject / edit
- request changes
- external-facing actions
- submit / post / send / purchase gates
- account-sensitive gates

### 4. Evidence

Purpose:

> Proof of what agents did.

Absorbs or routes to:

- Audit Log
- Browser Activity
- Task result drawers
- screenshots
- final links
- generated artifacts
- run traces

Non-technical label options:

- `Evidence`
- `Results & Proof`

Recommended label: `Evidence` in nav, `Results & Proof` as page heading.

### 5. Settings

Purpose:

> Agents, connections, safety, schedules, tools, models, and advanced setup.

Absorbs:

- Routines / Scheduled Work
- Runtime Connectors / Connections
- Browser connector gate
- Desktop Gateway
- Model Router / AI Settings
- Skills
- Tools
- Costs / Usage
- Quota
- Approval Policy
- Admin setup

## Page inventory: keep / merge / hide / rename

| Current page | Recommendation | New user-facing home |
| --- | --- | --- |
| Mission Control | Keep and redesign | `Home` |
| Agents | Keep but make secondary | Home chat + Settings > AI Team |
| Delegate Work | Merge into chat | Home `Ask Mission Control`; advanced under Work |
| Workflow Library | Rename / merge | `Playbooks` inside chat and Work |
| Projects | Merge | Work > Projects / Context |
| Task Board | Rename / merge | Work |
| Approvals / Needs Attention | Keep | Approvals |
| Agent Org | Hide for normal users | Settings > AI Team / Advanced |
| Routines | Hide for normal users | Settings > Scheduled Work |
| Browser Activity | Move to evidence-first | Evidence > Browser Evidence; raw sessions in Advanced |
| Research Runs | Merge | Work > Research / Evidence drill-down |
| Second Brain | Hide / contextual | Settings > Knowledge; surfaced in chat context when relevant |
| Audit Log | Merge | Evidence > Audit Trail |
| Skills | Hide | Settings > Skills |
| Tools | Hide | Settings > Tools |
| Costs | Hide except warnings | Settings > Usage; cost warning cards on Home |
| Model Router | Hide | Settings > AI Settings |
| Runtime Connectors | Hide | Settings > Connections |
| Desktop Gateway | Hide | Settings > Connections > Desktop Gateway |
| Approval Policy | Hide | Settings > Safety |
| Quota | Hide | Settings > Usage / Limits |
| Profile | Keep secondary | Settings > Profile |

## Chat-first user journey

### Journey A — Start work

1. User lands on Home.
2. User types: `Check if the Nexius Academy funnel is working.`
3. Agent classifies intent as Website Funnel Check.
4. Agent responds with a confirmation card:

```text
I can run a safe no-submit funnel check.

I will:
1. Open the website
2. Check the lead form
3. Capture screenshot evidence
4. Stop before any real submission
5. Report issues and suggested fixes

[Run safe check] [Change target] [Cancel]
```

5. User clicks `Run safe check`.
6. System creates work internally:
   - Task Board item
   - playbook/workflow instance
   - browser runtime session
   - evidence/result container
7. Chat shows live progress card.
8. Final chat response summarizes result with evidence links.

### Journey B — Approval required

1. Agent reaches external action boundary.
2. Chat interrupts with approval card:

```text
I need your approval before this external action.

Action: Submit form / post / send / purchase
Risk: Medium
Reason: External-facing action
Evidence: Screenshot attached

[Approve] [Reject] [Edit instruction]
```

3. User decides from chat or opens Approvals for detail.

### Journey C — Review completed work

1. User asks: `What did the agents complete today?`
2. Agent summarizes Recent Results.
3. Each item has proof cards:

```text
Website funnel check completed
Status: Safe no-submit
Evidence: screenshot + final URL

[View proof] [Create follow-up task] [Run again]
```

### Journey D — Missing connection/setup

1. User asks for work requiring unavailable connector.
2. Chat explains the blocker simply:

```text
I cannot run this yet because the browser connector is not connected.

Needed: Desktop/browser connection
Status: Not connected
Safety: Production submit/post/send remains blocked

[Open setup] [Use safe demo check] [Cancel]
```

## Chat action-card model

Add a typed card system that chat responses can render. Suggested initial types:

### 1. `task_created`

Fields:

- task id
- title
- owner / agent
- status
- risk
- expected evidence
- links/actions

Buttons:

- View work
- Stop
- Add instruction

### 2. `workflow_suggested`

Fields:

- playbook id/name
- why suggested
- expected steps
- required inputs
- risk/approval policy

Buttons:

- Use playbook
- Customize
- Cancel

### 3. `approval_required`

Fields:

- approval id
- action type
- risk
- reason
- evidence
- editable instruction

Buttons:

- Approve
- Reject
- Edit
- View evidence

### 4. `browser_running`

Fields:

- browser session id
- current domain
- status
- latest screenshot
- approval boundary

Buttons:

- View evidence
- Stop
- Takeover

### 5. `evidence_ready`

Fields:

- result id / task id / session id
- summary
- artifacts
- screenshots
- final links

Buttons:

- View proof
- Create follow-up task
- Export / copy

### 6. `connection_needed`

Fields:

- connector type
- missing requirement
- safe fallback
- setup link

Buttons:

- Open setup
- Use safe fallback
- Cancel

### 7. `human_action_needed`

Fields:

- instruction
- owner
- deadline / urgency
- why agent cannot do it

Buttons:

- Mark done
- Assign
- Ask agent to draft

## Implementation plan: Phase S1

### S1.0 — Checkpoint first

Before editing:

1. Create checkpoint archive or commit of current tested build.
2. Verify current build still passes:
   - focused phase tests
   - full pytest
   - `npm run build`
3. Record current nav/page inventory.

Reason: many files are already modified from previous phases; simplification should not accidentally erase functionality.

### S1.1 — Navigation simplification without deleting routes

Goal: reduce visible nav while keeping old routes deep-linkable.

Likely files:

- `src/components/NavRail.tsx`
- `src/services/uiPermissions.ts`
- `src/types.ts`
- `src/services/deepLinks.ts`
- `src/App.tsx`

Implementation:

- Add simplified workspace groups:
  - Home
  - Work
  - Approvals
  - Evidence
  - Settings
- Keep admin mode with advanced groups, but rename for clarity.
- Existing view keys remain valid.
- Old deep links continue to route to the original pages.
- Consider adding route aliases later:
  - `work` -> `board` or new Work hub
  - `evidence` -> new Evidence hub

Acceptance:

- visible workspace nav has no more than 5 primary destinations
- existing routes still render when deep-linked
- admin can still reach advanced pages

### S1.2 — Home becomes chat-first

Goal: Home is the main command center.

Likely files:

- `src/views/MissionControl.tsx`
- `src/components/ChatThread.tsx`
- `src/services/store.tsx`
- `src/styles/app.css`

Implementation options:

Option A: Embed selected default agent chat directly in Home.

- Pros: reuses current `ChatThread`
- Cons: current `ChatThread` expects an `Agent` and includes roster/project controls elsewhere

Option B: Create a new lightweight `AskMissionControl` component that calls the same `send` store action.

- Pros: simpler user experience
- Cons: duplicated composer behavior unless carefully refactored

Recommended: Option B initially, but extract shared composer pieces only if duplication grows.

Home layout:

1. Ask Mission Control composer
2. Suggested prompt chips
3. Needs Attention
4. Running Now
5. Recent Results / Proof

Suggested prompts:

- Check my website funnel
- Get more course signups
- Draft today’s LinkedIn post
- Show what needs my attention
- Summarize completed work
- Follow up with leads

Acceptance:

- user can send a command from Home without navigating to Agents
- while sending, Home shows an obvious processing state
- response appears in a simple chat/result stream or opens the full Agents chat if needed

### S1.3 — Introduce chat action cards

Goal: make chat the layer that exposes tasks, approvals, browser sessions, evidence, and setup blockers.

Likely files:

- `src/types.ts`
- `src/components/ChatActionCard.tsx` new
- `src/components/ChatThread.tsx`
- `src/components/MissionFoundation.tsx`
- `src/styles/app.css`
- backend `app.py` if structured card payloads are emitted server-side

Initial strategy:

- Frontend can infer cards from existing message metadata/artifacts first.
- Backend structured card payloads can be added later.
- Reuse existing deep-link builders for buttons.

Initial card types:

- `task_created`
- `workflow_suggested`
- `approval_required`
- `browser_running`
- `evidence_ready`
- `connection_needed`
- `human_action_needed`

Acceptance:

- at least three card types render in chat from mock/demo or real metadata
- cards link to existing Task Board / Approvals / Evidence / Settings pages
- cards do not expose secrets

### S1.4 — Create Work hub

Goal: merge Task Board, Delegate Work, Workflow Library, Projects, and Research Runs into one non-technical workspace.

Implementation options:

Option A: `Work` route is a new hub with tabs/cards linking to existing pages.

- Pros: safe, minimal disruption
- Cons: pages still exist separately behind the hub

Option B: fully merge pages into one route.

- Pros: cleaner long-term
- Cons: high risk and larger refactor

Recommended: Option A for S1.

Likely files:

- `src/views/WorkHub.tsx` new
- `src/App.tsx`
- `src/types.ts`
- `src/components/NavRail.tsx`
- `src/services/uiPermissions.ts`
- `src/styles/app.css`

Work hub sections:

- Open Work
- Running Work
- Completed Work
- Playbooks
- Projects / Context
- Research / Deep Work

Acceptance:

- user sees a single `Work` destination
- old Task Board / Delegate Work / Workflow Library / Projects routes remain deep-linkable

### S1.5 — Create Evidence hub

Goal: merge Audit Log, Browser Activity, task results, and artifacts into a proof-first page.

Likely files:

- `src/views/EvidenceHub.tsx` new
- `src/App.tsx`
- `src/types.ts`
- `src/components/NavRail.tsx`
- `src/services/uiPermissions.ts`
- `src/styles/app.css`

Evidence hub sections:

- Recent proof
- Browser evidence
- Task results
- Run traces
- Screenshots/files

Acceptance:

- user sees a single `Evidence` destination
- old Browser Activity and Audit Log remain deep-linkable
- evidence links from chat/cards open the right drawer/detail where possible

### S1.6 — Settings / Advanced re-layering

Goal: make technical controls available but not day-to-day.

Likely files:

- `src/views/SettingsDesktop.tsx`
- `src/views/AdminSetupPage.tsx`
- `src/components/NavRail.tsx`
- `src/services/uiPermissions.ts`

Settings categories:

- AI Team
- Scheduled Work
- Connections
- Safety & Approvals
- Knowledge
- Tools & Skills
- AI Models
- Usage & Limits
- Advanced Audit

Acceptance:

- normal workspace mode does not show raw `Routines`, `Runtime Connectors`, `Model Router`, `Skills`, `Tools`, `Costs` as equal top-level pages
- admin mode can still access them

## Tests / validation plan

Add focused tests before implementation.

Potential test file:

- `tests/test_simplification_chat_first_ia.py`

Test assertions:

1. `NavRail.tsx` workspace nav exposes only simplified destinations:
   - Home
   - Work
   - Approvals
   - Evidence
   - Settings
2. Old routes still exist in `App.tsx` and deep-link parser.
3. `MissionControl.tsx` includes `Ask Mission Control` or equivalent chat-first composer.
4. Chat action card component exists and supports at least initial card types.
5. Work hub and Evidence hub exist.
6. Admin-only advanced pages remain accessible in admin mode.
7. Build passes.

Browser verification:

- live `/app?view=mission` shows chat-first Home
- nav is simplified
- `/app?view=board` still works by deep link
- `/app?view=browser-ops&session=<id>` still opens Browser Activity session drawer
- `/app?view=approvals` still works
- Settings exposes advanced entries without crowding normal nav

## Risks and tradeoffs

### Risk: hiding too much

If advanced pages are buried too aggressively, power users may feel functionality disappeared.

Mitigation:

- keep deep links
- add Settings > Advanced index
- add `Open advanced view` links from hub cards

### Risk: chat action cards require backend changes

Structured cards are cleaner if backend emits typed payloads, but that may require more backend work.

Mitigation:

- S1 starts with frontend card rendering based on existing metadata/artifacts where possible
- backend structured card payloads become S2 if needed

### Risk: Home chat duplicates Agents chat

Mitigation:

- initially keep Home composer simple
- full transcript/history remains in Agents or a future unified chat route
- later refactor shared composer logic

### Risk: route aliases create confusion

Mitigation:

- keep old view keys stable
- add new hub views gradually
- document alias mapping

## Open decisions for Melverick

1. Should the simplified top-level nav be exactly:
   - Home
   - Work
   - Approvals
   - Evidence
   - Settings

2. Should `Agents` disappear from top-level nav and become part of Home/Settings, or remain as a sixth top-level item named `AI Team`?

3. Should Home chat always talk to Melkizac/main agent, or should the user be able to choose an agent from the Home composer?

Recommended answer: default to Melkizac/main agent; let Melkizac route internally.

4. Should `Work` be a hub first, or should it replace the Task Board as the main task view?

Recommended answer: hub first for lower refactor risk.

5. Should `Evidence` be a hub first, or should it replace Audit Log/Browser Activity directly?

Recommended answer: hub first.

## Recommended implementation sequence

1. Checkpoint/archive current build.
2. Add RED tests for simplified nav + route preservation.
3. Implement simplified nav in workspace mode only.
4. Add `WorkHub` and `EvidenceHub` as safe aggregation pages.
5. Add Home `Ask Mission Control` composer.
6. Add initial `ChatActionCard` component.
7. Add Settings advanced index links.
8. Run focused tests, full pytest, frontend build.
9. Deploy/restart safely and browser-verify.
10. After S1, decide whether to proceed to S2: backend structured card payloads and deeper chat orchestration.

## S1 definition of done

S1 is complete when a non-technical user can:

1. Land on Home.
2. Ask an agent for work in plain English.
3. See any required attention/running work/recent proof without knowing internal page names.
4. Use only five main nav choices.
5. Still access advanced functionality through Settings or drill-down links.
6. Verify evidence and approvals without losing trust/safety controls.

S1 should not remove or disable existing advanced routes. It should simplify the default path.
