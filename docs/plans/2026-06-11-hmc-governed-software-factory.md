# HMC Governed Software Factory Implementation Plan

> **For Hermes:** Use subagent-driven-development or Kanban worker dispatch to implement this plan task-by-task. Do not copy gstack blindly; adapt the useful workflow patterns into Hermes Mission Control’s governance, audit, and production-ops model.

**Goal:** Turn the HMC/Andrej development workflow into a visible, repeatable, governed software-factory pipeline that combines gstack-style sprint discipline with Hermes production governance.

**Architecture:** Add workflow structure first, then UI/API/runtime automation in small verified slices. HMC remains the management, audit, and trust layer; Hermes profiles, Kanban, skills, browser tools, GitHub/Netlify/Supabase CLIs, and specialist overlays remain the worker layer. Every feature must write evidence back to Projects/Task Board/Audit rather than becoming a hidden local command.

**Tech Stack:** Hermes Mission Control Flask backend (`/opt/hermes-mission-control/app.py`), React/Vite frontend (`/opt/hermes-mission-control/source/src`), Hermes Kanban DB (`/root/.hermes/kanban.db`), Hermes skills/profile runtime, browser automation, Git/GitHub CLI wrappers, optional Netlify/Supabase CLI where deployment scope requires.

---

## Source evaluation

A local inspection of `garrytan/gstack` found useful patterns worth adapting:

- Unified sprint pipeline: Think → Plan → Build → Review → Test → Ship → Reflect.
- Product challenge before implementation.
- Release lane with explicit evidence.
- Skill/workflow CI and eval gates.
- Persistent browser daemon concepts: browser session continuity, scoped agent pairing, audit logs, domain learnings.
- Guard/freeze/checkpoint safety modes.
- Documentation drift prevention.
- Cross-model/specialist reviews for high-risk changes.

Patterns explicitly **not** copied as defaults:

- Telemetry/community analytics opt-in prompts.
- Raw cookie import as default business-account behavior.
- “Boil the ocean” production posture.
- Claude-first runtime assumptions.

## Current HMC/Andrej strengths to preserve

- Production-first DevOps evidence discipline: build logs, deploy logs, health checks, browser/API verification, rollback notes.
- HMC-specific source/live paths and service knowledge.
- Hermes Task Board/Kanban, Projects, skills, persistent memory, session search, cron, messaging delivery.
- Approval boundaries for production DB/cloud/DNS/secrets/external publishing.
- Profile-scoped specialist overlays: Engineering, Design, Security, Testing.
- User expectation: Project → Tasks; Boards/source are advanced plumbing.

## Product principles for this project

1. **HMC is the operating cockpit.** The operator should see where each request is in the pipeline without asking the agent.
2. **Project → Tasks is the default IA.** New work becomes a Project/tenant plus trackable child tasks.
3. **Evidence is part of done.** A card is not complete without artifact paths, commands, health/API/browser proof, or explicit blocker evidence.
4. **Guardrails are visible.** Freeze scope, destructive-command warnings, release gates, and approval boundaries should be visible to the operator.
5. **Focused adaptation.** Borrow the useful pattern from gstack, but implement in the Hermes/HMC model.

## Target HMC workflow

```text
/hmc-plan → /hmc-build → /hmc-review → /hmc-qa → /hmc-ship → /hmc-canary → /hmc-retro
```

Operator-facing states:

```text
Idea / Intake
Plan Review
Build
Security Review
Testing / QA
Ready to Deploy
Deployed
Canary
Done / Retro
Blocked
```

Each state should attach evidence:

```text
branch
commit
plan/spec path
changed files
test output
build output
security/testing review notes
browser/API verification
deploy target
health check
rollback note
docs impact
```

## Acceptance criteria

- A visible HMC Project exists for this initiative.
- Task Board contains a scheduled parent/container card and dependency-linked child cards.
- The plan/current-state card is marked done with this artifact path.
- First executable card is ready for implementation.
- No production code is deployed by merely starting the project.
- Future implementation cards include explicit evidence requirements and rollback/doc impact expectations.
- Board status is verified through the live Kanban DB/API or CLI.

---

## Task graph

### Task 0: Planning and current-state evidence

**Objective:** Capture the gstack gap analysis and adapted HMC approach as a durable artifact.

**Files:**
- Create: `docs/plans/2026-06-11-hmc-governed-software-factory.md`

**Verification:**
- Plan artifact exists.
- HMC source repo baseline build passes before dispatch.
- Kanban planning card completed with artifact path.

---

### Task 1: Define HMC workflow contract

**Objective:** Specify the canonical HMC software-factory workflow states, required evidence fields, status transitions, and Project/Task Board mapping.

**Files:**
- Create or modify: `docs/hmc-software-factory-workflow.md`
- Consider backend/frontend type touchpoints after code inspection.

**Required decisions:**
- Map HMC workflow state to existing Kanban statuses without prematurely changing backend enums.
- Decide whether workflow evidence is stored as task comments, task result JSON, a new evidence object, or a lightweight sidecar endpoint.
- Preserve Board/source as advanced plumbing; Project remains the operator-facing context.

**Verification:**
- Workflow contract is documented.
- Existing Task Board status semantics are not broken.
- Any proposed schema/API change is explicitly scoped for later implementation.

---

### Task 2: Implement product-fit and plan-review gate

**Objective:** Add a reusable HMC gate for non-trivial feature work before build starts.

**Expected gate questions:**
- What operator workflow does this improve?
- Does it fit Project → Tasks IA?
- What is the narrowest useful slice?
- What evidence will prove it worked?
- What approval or safety boundary applies?
- What documentation may drift?

**Files to inspect before editing:**
- `src/components/ChatThread.tsx`
- `src/views/MissionControl.tsx`
- Task/Project API client files under `src/`
- `/opt/hermes-mission-control/app.py`

**Verification:**
- Clear project-start language can produce or link a Project/task graph.
- Normal discussion remains chat-only.
- Plan-review output is visible as card/evidence, not only chat prose.

---

### Task 3: Add release lane/evidence model

**Objective:** Make build/test/review/deploy/canary evidence first-class in HMC task cards or drawers.

**Evidence fields:**
- Branch/commit.
- Build command and output summary.
- Test command and output summary.
- Deploy target and timestamp.
- Health endpoint result.
- Browser verification result/screenshot path where available.
- Rollback note/path.
- Docs impact.

**Verification:**
- A release task drawer can show the evidence in an operator-readable hierarchy.
- Raw logs remain accessible as evidence/source, not dumped into the overview.

---

### Task 4: Add guard/freeze/checkpoint design slice

**Objective:** Design the Hermes/HMC equivalent of guard modes without copying gstack implementation directly.

**Initial scope:**
- Guard mode metadata on Project/task: allowed edit paths, destructive-command warning level, checkpoint mode, rollback artifact path.
- UI surfaces: project drawer or task drawer badges.
- Runtime behavior: start as advisory/visible metadata unless a safe enforcement hook already exists.

**Verification:**
- Starting a guarded HMC project records allowed paths and evidence expectations.
- No worker is dispatched into a dirty unrelated repo without safe-start comments/evidence.

---

### Task 5: Skill/workflow CI pilot

**Objective:** Build a lightweight Hermes skill/workflow CI check inspired by gstack’s `skill:check`, adapted to Hermes.

**Pilot checks:**
- `skill_view` smoke-load for selected HMC/DevOps skills.
- Linked file existence check.
- Required command availability check.
- Stale reference detection for obvious broken links.
- Sample “project-from-discussion” dry-run checklist validation.

**Verification:**
- Script or endpoint produces a concise pass/fail report.
- Failures are actionable and do not expose secrets.

---

### Task 6: Browser runtime requirements and safe pilot

**Objective:** Define a Hermes Browser Runtime product slice: persistent sessions, operator handoff, per-agent tab isolation, scoped tokens, audit log, domain learnings, and safe session handling.

**Do not implement by default:**
- Raw business-account cookie import.
- Internet-exposed browser control surface.

**Verification:**
- Requirements document clearly distinguishes safe initial pilot from future privileged browser/session features.
- Any browser state/token design includes auditability and scope.

---

### Task 7: UI workflow surface pilot

**Objective:** Expose the governed software-factory project in HMC UI without overwhelming the operator.

**Likely UI locations:**
- Project detail drawer: workflow/evidence tab.
- Task Board drawer: evidence overview + sources tab.
- Main Chat workflow card: started project → current phase → next action.

**Verification:**
- Browser automation confirms the Project/Task Board surfaces load.
- No legacy Board/source clutter is introduced into normal operator filters.

---

### Task 8: QA, deploy, canary, and docs drift gate

**Objective:** Create the final release workflow for whatever implementation slices are approved.

**Required checks before deploy:**
- `npm run build`.
- Targeted backend/API smoke tests.
- Browser verification of affected pages.
- Security/Testing Division review for high-risk changes.
- Docs impact recorded.
- Rollback path documented.

**Verification:**
- Deployed HMC service is active.
- Local and public endpoints are checked where credentials/session allow.
- Canary check reports console errors/page health/perf regressions where measurable.

---

## Initial Kanban setup expected from this plan

- Project/container card: scheduled, tenant `hmc-governed-software-factory`.
- Planning/current-state card: done, with this artifact path and build evidence.
- Child cards:
  1. Workflow contract/spec.
  2. Product-fit/plan-review gate.
  3. Release lane/evidence model.
  4. Guard/freeze/checkpoint design.
  5. Skill/workflow CI pilot.
  6. Browser runtime requirements.
  7. UI workflow surface pilot.
  8. QA/deploy/canary/docs gate.

## Rollback notes

Starting this project only creates a branch, plan artifact, and Kanban cards. It does not deploy production code. Rollback for project setup is to archive the Kanban cards and delete or revert the plan branch/file if requested.
