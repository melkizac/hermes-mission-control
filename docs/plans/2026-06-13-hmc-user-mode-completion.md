# HMC User Mode Completion Enhancement Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Finish the remaining user-mode Mission Control functions so HMC feels like a coherent daily operating cockpit rather than a collection of technically working pages.

**Architecture:** Keep User mode focused on operator outcomes: chat, projects, task execution, approvals, memory, routines, agents, evidence, and account preferences. Keep Admin mode separate for platform/runtime/governance setup. Prefer incremental changes with live API/browser verification after each slice.

**Tech Stack:** React + TypeScript frontend in `/opt/hermes-mission-control/source/src`, Python backend in `/opt/hermes-mission-control/app.py` and source copy `/opt/hermes-mission-control/source/backend/app.py`, live systemd service `hermes-mission-control`, HMC task/project tracking through the Hermes Kanban-backed Task Board.

---

## Acceptance Criteria

- User mode has no placeholder primary routes.
- Account/Profile page is a real user preferences and workspace identity surface.
- Approvals/Needs Attention is a clear decision queue with evidence and action states.
- Memory is understandable and actionable: user memory, workspace memory, edit/delete, and privacy boundaries.
- Dashboard tells the user what to do next: approvals, blocked tasks, active agents, running routines, recent outputs, rate-limit warnings.
- Task Board separates user work from agent/cron/internal work using visible type/source cues without exposing storage plumbing.
- Files, Knowledge, and Evidence have a clear IA and cross-links from projects/tasks/agent outputs.
- Voice is deliberately either composer-only or a first-class user route; no half-hidden dead-end surface.
- User Settings vs Admin Settings boundary is unambiguous.
- Browser QA passes across every User nav route with no console errors.

## Current Evidence Snapshot

Captured 2026-06-13 from live HMC APIs:

- `/api/projects`: 27 projects, 17 active, 16 open actions, 4 blocked.
- `/api/tasks`: 324 tasks; todo 5, scheduled 8, ready 1, blocked 5, done 305.
- `/api/agents`: 6 agents.
- `/api/inbox`: 71 approval/inbox records; 10 drafted/high-risk.
- `/api/automations`: 32 routines; 31 enabled, 1 paused.
- `/api/skills`: 195 skills.
- `/api/reflections`: reflections loaded for 6 agents.
- Current known gap: `profile` route renders a placeholder Account Settings page.

## Task 1: Replace Account Settings placeholder

**Objective:** Build a real User Profile / Workspace Preferences page.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`
- Create: `/opt/hermes-mission-control/source/src/views/AccountSettings.tsx`
- Modify if needed: `/opt/hermes-mission-control/source/src/services/httpHermesClient.ts`
- Modify if needed: `/opt/hermes-mission-control/app.py`
- Mirror backend if changed: `/opt/hermes-mission-control/source/backend/app.py`

**Implementation notes:**
- Replace `view === "profile"` Placeholder with `AccountSettings`.
- Show authenticated `/api/me` identity: user, workspace, role, Hermes profile/runtime metadata.
- Add read-only connected channel summary if already available through existing runtime/status endpoints.
- Add preferences shell for default agent/project, notifications, timezone, and voice preference. If persistence is not implemented in this slice, clearly label as planned/read-only rather than fake-saving.

**Verification:**
- `npm run build` from `/opt/hermes-mission-control/source`.
- Browser `/app`, open Profile/Account route.
- Confirm no placeholder copy remains.
- Console errors = 0.

## Task 2: Upgrade Approvals / Needs Attention into a decision queue

**Objective:** Make `/approvals` the primary user action queue.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/views/Approvals.tsx`
- Modify if needed: `/opt/hermes-mission-control/source/src/services/httpHermesClient.ts`
- Modify if needed: `/opt/hermes-mission-control/app.py` and source backend copy.

**Implementation notes:**
- Use `/api/inbox` as canonical source where possible.
- Group by decision state: Needs decision, Drafted, Sent/Done, Rejected.
- Show risk, agent, project/task relation, created time, and evidence preview.
- Actions: approve, reject, edit/revise, snooze if backend supports it; otherwise expose unsupported actions as disabled with clear reason.
- Ensure top-right bell count matches the visible queue.

**Verification:**
- API smoke `/api/inbox` summary vs UI count.
- Browser: approve/reject controls are visible only where safe.
- No high-risk item can be approved without evidence text visible.

## Task 3: Clarify Memory UX and privacy boundaries

**Objective:** Make User memory understandable and controllable.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/views/MemoryContext.tsx`
- Backend only if current memory endpoint is incomplete.

**Implementation notes:**
- Separate tabs/sections: About me, Workspace memory, Agent/session context, Recent use.
- Explain who can see/use each memory scope.
- Add edit/delete controls only when backend supports safe mutation; otherwise show read-only state and path to manage.
- Never expose secrets or raw private profile files beyond intended memory content.

**Verification:**
- Browser route loads in User mode.
- Copy explicitly distinguishes memory from Admin Capabilities.
- No secrets/env values appear in DOM text.

## Task 4: Dashboard daily cockpit pass

**Objective:** Turn Dashboard into a next-action cockpit.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/views/Dashboard.tsx`
- Reuse existing APIs: `/api/projects`, `/api/tasks`, `/api/agents`, `/api/inbox`, `/api/automations`, `/api/costs`.

**Implementation notes:**
- Cards: Pending approvals, blocked tasks, active/running agent work, running routines, recent outputs, rate-limit warnings.
- Every card should link to the route/filter where the user can act.
- Avoid admin-only controls in User mode.

**Verification:**
- Live counts match API summaries within expected filtering rules.
- Browser click-through works for each card.

## Task 5: Task Board source/type clarity

**Objective:** Keep Project-first IA while separating human, agent, routine, cron, and internal work.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/views/TaskBoard.tsx`
- Modify backend task normalization only if necessary.

**Implementation notes:**
- Preserve Project as primary filter.
- Add visible work type chips: Human, Agent, Routine, Cron, Internal, Implementation, Review.
- Hide noisy storage/source labels from default UI.
- Keep advanced source/board diagnostics out of normal user path.

**Verification:**
- `/api/tasks` smoke.
- Browser card DOM shows type cues.
- Default UI does not reintroduce “Board Source” / storage-plumbing labels.

## Task 6: Files / Knowledge / Evidence IA cleanup

**Objective:** Make output discovery coherent.

**Files:**
- Inspect/modify: `/opt/hermes-mission-control/source/src/views/FileSystem.tsx`
- Inspect/modify: `/opt/hermes-mission-control/source/src/views/SecondBrain.tsx`
- Inspect/modify evidence/audit components if linked from User mode.

**Implementation notes:**
- Define labels:
  - Files = uploaded/generated artifacts.
  - Knowledge = curated/searchable notes/context.
  - Evidence = audit trail, commands, approvals, deploy/build proof.
- Add cross-links from projects/tasks/agent outputs when IDs/paths are available.

**Verification:**
- Browser can reach files and knowledge/evidence from normal User flows.
- Labels are consistent and non-overlapping.

## Task 7: Voice product decision and implementation

**Objective:** Remove ambiguity around voice messaging.

**Files:**
- Inspect/modify: `/opt/hermes-mission-control/source/src/views/AgentVoice.tsx`
- Inspect/modify chat composer in `/opt/hermes-mission-control/source/src/components/ChatThread.tsx`
- Modify nav only if voice should be first-class.

**Decision required:**
- Option A: voice stays composer-only; remove/park standalone Agent Voice route.
- Option B: voice becomes first-class; add a route/card, history, state, and fallback messaging.

**Verification:**
- Browser confirms mic/composer path works or route is clearly disabled/removed.

## Task 8: User/Admin settings boundary cleanup

**Objective:** Avoid confusing User settings with Admin Console.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- Modify: `/opt/hermes-mission-control/source/src/services/uiPermissions.ts` if labels/routes change.

**Implementation notes:**
- User mode system group should prefer: Account/Profile, Workspace Preferences, Rate limits, Docs, Logout.
- Admin mode keeps Admin Console, Runtime, Capabilities, Model Router, Approval Rules, Quota.

**Verification:**
- User mode cannot navigate into admin-only settings accidentally.
- Admin mode still exposes platform setup.

## Task 9: User-mode onboarding and empty states

**Objective:** Make HMC usable for a new workspace/user without prior context.

**Files:**
- Modify key views: Dashboard, Projects, TaskBoard, Agents, Approvals, Routines, Workflows.

**Implementation notes:**
- Add first-run CTA blocks where lists are empty.
- Suggested actions: create project, send first agent task, set approval policy, start routine, upload knowledge.
- Avoid fake demo data in authenticated production mode.

**Verification:**
- Use mocked/empty states or query parameters if supported.
- Browser screenshots for at least Dashboard and Projects empty state.

## Task 10: User route smoke QA and release cut

**Objective:** Verify and prepare deployment evidence for all User functions.

**Files:**
- Add/extend Playwright smoke script if existing test infra supports it.
- Otherwise create a temporary verification script under `/tmp` and document commands in final report.

**Verification route list:**
- Chat
- Dashboard
- Projects
- Files
- Task Board
- Routines
- Workflows
- Agents
- Org Chart
- Skills
- Memory
- Reflections
- Tools
- Plugins
- Approvals
- Profile/Account
- Rate limits

**Required evidence:**
- Git branch/commit if committed.
- `npm run build` output.
- Backend `py_compile` if backend changed.
- Systemd status if restarted.
- Browser route smoke with console error count.
- Screenshots for Dashboard, Account, Approvals, Memory, Task Board.
- Rollback note: restore previous `dist` backup for frontend-only changes; restore backend file backup/revert commit and restart service for backend changes.
