# HMC Software Factory Workflow Contract

This contract defines the canonical Hermes Mission Control software-factory workflow for non-trivial product, UI, API, DevOps, and runtime changes. It turns Andrej/Hermes work from ad hoc chat plus terminal execution into a visible Project → Tasks pipeline with phase-specific evidence, review gates, and release readiness.

Related artifacts:

- `docs/plans/2026-06-11-hmc-governed-software-factory.md`
- `docs/HERMES_MISSION_CONTROL.md`
- `docs/RESEARCH_TO_DELIVERABLE_PROJECT_CONTRACT.md`

## Product boundary

The normal operator-facing model remains:

```text
Project → Tasks → Evidence
```

The HMC software-factory workflow is a specialized workflow overlay on a Mission Control Project and its Task Board cards. It must not expose Kanban Board/source selection as normal operator complexity. Board/source remains storage plumbing and an advanced/admin reconciliation concept.

This contract does not require a backend status-enum migration. The first implementation slice should preserve existing Task Board lanes and map workflow phases onto existing task statuses, metadata, comments, and evidence records.

## Workflow commands and operator-facing phases

Canonical command chain:

```text
/hmc-plan → /hmc-build → /hmc-review → /hmc-qa → /hmc-ship → /hmc-canary → /hmc-retro
```

Operator-facing phases:

| Command | Phase label | Operator meaning | Primary owner | Typical card type |
| --- | --- | --- | --- | --- |
| `/hmc-plan` | Plan Review | Clarify objective, product value, narrowest useful slice, Project→Tasks fit, safety boundary, and evidence expectations. | Andrej / lead agent | spec or planning task |
| `/hmc-build` | Build | Implement the approved slice in the scoped workspace/branch. | implementer agent | coding task |
| `/hmc-review` | Review | Review for spec compliance, code quality, security, migration risk, and UI/UX fit. | reviewer / specialist | review gate task |
| `/hmc-qa` | QA | Run focused tests, build, API probes, browser checks, accessibility/performance checks when relevant. | testing agent | QA task |
| `/hmc-ship` | Ship | Prepare deployment bundle, rollback note, docs impact, and approval status; deploy only when authorized by the card/request. | DevOps | deploy task |
| `/hmc-canary` | Canary | Verify live health, public/local endpoint behavior, console errors, affected UI, and regressions after deploy. | DevOps / QA | canary task |
| `/hmc-retro` | Retro | Record outcome, lessons, docs/skill updates, follow-up cards, and final evidence summary. | lead agent | retro task |

Additional terminal states:

| Phase label | Meaning |
| --- | --- |
| Blocked | Progress requires a human decision, missing credential/access, failing dependency, or external constraint. |
| Rework | A review/QA/canary gate failed and the task is returned to Build with findings attached. |
| Done | Required evidence is attached, downstream handoff is clear, and no open blocker remains. |

## Mapping to Project → Tasks IA

Each non-trivial HMC change should create or link a single Project with a stable project key, then materialize phase cards as child tasks.

Required project fields:

| Field | Required | Notes |
| --- | --- | --- |
| `project_id` | yes | Stable human-readable id or UUID. |
| `tenant` | yes | Task grouping key. Prefer `project:<project_id>` for new generic projects; existing initiatives may use a stable tenant such as `hmc-governed-software-factory`. |
| `workflow_type` | yes | `hmc_software_factory`. |
| `objective` | yes | One-sentence operator outcome. |
| `workspace_paths` | yes | Source/worktree/artifact paths in scope. Do not include secrets. |
| `lead_agent_id` | yes | Usually `andrej` / `dev-ops`, with Melkizac as command layer when chat-triggered. |
| `origin` | recommended | Chat/session/task/plan that started the workflow. |
| `guards` | recommended | Allowed edit paths, approval requirements, destructive-action boundaries, deploy authorization. |
| `summary` | yes | Current phase, next action, blocker status, latest evidence. |

Task graph pattern:

1. Project/container task: long-lived, `scheduled` or equivalent non-executing state, summarizes the initiative.
2. Spec/plan task: defines contract and acceptance criteria.
3. Build task(s): implement the slice.
4. Review task(s): spec/code/security/design review as needed.
5. QA task: focused verification.
6. Ship task: deployment prep and deploy, only if approved.
7. Canary task: live verification after deploy.
8. Retro task: lessons, docs drift, follow-up cards.

The UI should show the Project and its Tasks. It should not require the operator to know which Kanban DB/board/source a card came from unless they open Advanced filters or an admin/debug view.

## Mapping to existing Kanban statuses

Preserve current backend statuses and Task Board lanes. Map workflow state through a separate `workflow_phase` metadata field or evidence object.

| HMC phase | Existing Kanban status | Visible lane today | Notes |
| --- | --- | --- | --- |
| Plan Review not started | `todo` or `ready` | To-do / Not Started | Card exists but has not been claimed. |
| Plan Review in progress | `running` | In-progress | Agent is drafting or validating the contract. |
| Build not started | `todo` or `ready` | To-do / Not Started | Build waits for plan approval/dependency. |
| Build in progress | `running` | In-progress | Implementation executing. |
| Review required | `blocked` with reason prefix `review-required:` or future `review` when already supported | Blocked / Review | Current worker protocol blocks most code changes for review. If the visible `review` lane is enabled, use it for non-error review gates. |
| QA in progress | `running` | In-progress | Focused test/build/browser verification. |
| Ready to ship | `blocked` with `approval-required:` or `review` | Blocked / Review | Ship requires explicit deploy authorization unless task body already grants it. |
| Shipping | `running` | In-progress | Deployment command executing. |
| Canary | `running` or `ready` | In-progress / To-do | Use `running` while checks execute; use `ready` when waiting for canary worker. |
| Blocked | `blocked` | Blocked | Missing access, business decision, failing dependency. |
| Failed/Error | `error` | Error | Worker crashed/failure state needing attention. |
| Done/Retro complete | `done` | Done | Required evidence attached. |
| Container/scheduled project | `scheduled` | Schedule / Not Started | Keeps project visible without dispatching executable work. |

Do not add new persisted Kanban statuses in the first slice. If a future migration introduces first-class workflow statuses, it must update backend normalization, API summaries/lanes, TypeScript status types, mock clients, dropdowns, CSS, and migration/rollback notes together.

## Evidence model

### Storage decision

First slice decision: use existing Task Board records as the durable coordination surface, and introduce a lightweight evidence object shape stored in task comments/result metadata before adding a new database table.

Rationale:

- Kanban task comments, events, runs, and result metadata already exist and are visible to workers.
- Existing frontend types already include `EvidenceRecord`, `MissionResult`, `EvidenceGateState`, and related artifact concepts.
- A new table/endpoint is useful later, but is not required to prove the operator workflow.
- Avoids schema migration risk while the UI/API contract is still being validated.

Recommended first-slice write pattern:

1. Phase workers append a structured `workflow-evidence` JSON block in a Kanban comment for handoff durability.
2. Terminal cards use `kanban_complete(metadata={...})` when genuinely done.
3. Code-changing cards that need review place evidence in a comment, then `kanban_block(reason="review-required: ...")`.
4. The API can parse latest structured comments and task metadata into a read-only evidence summary for the Project/Task drawer.

Future storage decision after the first UI/API slice: add a first-class `workflow_evidence` object/table or endpoint only when one of these becomes true:

- Evidence needs independent lifecycle, filtering, redaction, attachment upload, or cross-task reuse.
- The UI needs to update individual evidence records without editing comments.
- Multiple runtimes need to append evidence concurrently.
- Completion gates need machine-enforced evidence validation.

### Canonical evidence object

Use this JSON-compatible shape for comments now and for a future endpoint/table later:

```json
{
  "schema": "hmc.workflow_evidence.v1",
  "project_id": "hmc-governed-software-factory",
  "tenant": "hmc-governed-software-factory",
  "task_id": "t_...",
  "phase": "hmc-plan",
  "status": "passed",
  "summary": "Workflow contract documented and build passes.",
  "created_at": "2026-06-11T17:00:00+08:00",
  "created_by": "dev-ops",
  "branch": "project/hmc-governed-software-factory",
  "commit": "<sha-or-null>",
  "workspace_path": "/opt/hermes-mission-control/source",
  "artifacts": [
    {"kind": "document", "path": "docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md", "title": "Workflow contract"}
  ],
  "commands": [
    {"command": "npm run build", "status": "passed", "summary": "Vite build completed; chunk-size warning only."}
  ],
  "checks": [
    {"type": "doc", "status": "passed", "summary": "Contract includes phase model, status mapping, evidence fields, storage decision, and first-slice acceptance criteria."}
  ],
  "risks": [],
  "approval": {"required": false, "status": "not-required", "reason": "Documentation/spec only; no production deploy."},
  "docs_impact": "New docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md contract.",
  "rollback": "Revert the docs commit; no production deploy or schema change."
}
```

Required base fields for every evidence object:

| Field | Required | Notes |
| --- | --- | --- |
| `schema` | yes | Start with `hmc.workflow_evidence.v1`. |
| `project_id` / `tenant` | yes | Project association and Task Board grouping. |
| `task_id` | yes | Kanban card that produced the evidence. |
| `phase` | yes | One of `hmc-plan`, `hmc-build`, `hmc-review`, `hmc-qa`, `hmc-ship`, `hmc-canary`, `hmc-retro`. |
| `status` | yes | `pending`, `running`, `passed`, `blocked`, `failed`, `skipped`. |
| `summary` | yes | Operator-readable result, not raw log dump. |
| `created_at` | yes | ISO timestamp, display in SGT in UI. |
| `created_by` | yes | Agent/profile or human actor. |
| `artifacts` | recommended | Files, URLs, screenshots, diffs, docs. |
| `commands` | recommended for build/QA/ship | Command, status, summarized output, log path where available. |
| `checks` | recommended | Acceptance/security/QA/browser/API checks. |
| `approval` | yes | Explicit `not-required`, `pending`, `approved`, `rejected`, or `changes-requested`. |
| `docs_impact` | yes for ship/retro; recommended earlier | Docs updated or intentionally unchanged. |
| `rollback` | yes for ship/canary; recommended earlier | Revert/deploy rollback path. |

Never store secrets, raw tokens, full private env files, raw financial data, or unredacted PII in evidence comments/results.

## Required evidence by phase

| Phase | Required evidence | Gate condition |
| --- | --- | --- |
| `/hmc-plan` | Plan/spec path, objective, Project→Tasks mapping, phase acceptance criteria, storage/schema decision, safety/deploy boundary, rollback note for planning artifacts. | Contract accepted when the doc exists, covers required decisions, and build still passes if source tree changed. |
| `/hmc-build` | Branch, commit or diff path, changed files, implementation summary, commands run, unit/focused tests, known risks, docs impact note. | Build card cannot be terminal-done if code changes need human/spec review; block with `review-required:` after evidence comment. |
| `/hmc-review` | Reviewer identity, reviewed commit/diff, spec compliance findings, code-quality/security/design findings, approval decision, required rework. | Passed only when blocking findings are absent or rework cards exist. |
| `/hmc-qa` | Test commands/output summaries, build output, API probes, browser/DOM checks, console errors, screenshot path where useful, skipped checks with reason. | Passed when focused gate succeeds or failures are linked to rework/blocker tasks. |
| `/hmc-ship` | Deploy authorization source, branch/commit, build artifact, deploy command/target, service/restart output, migration note, rollback command/path, docs impact. | Must not deploy unless the user/card explicitly authorizes production deploy. |
| `/hmc-canary` | Health endpoint result, public/local URL checks, affected UI browser proof, console errors, smoke data cleanup, comparison to acceptance criteria. | Passed when live behavior is verified and rollback is not needed. |
| `/hmc-retro` | Final summary, shipped commit/deploy target, evidence links, follow-up tasks, skill/doc updates, unresolved risks, operator-facing result. | Done when lessons and follow-ups are recorded and parent project status is reconciled. |

## First UI/API slice acceptance criteria

The first implementation slice should be narrow and read-only where possible.

Required API behavior:

1. Given a Project/tenant, return a workflow summary composed from existing Kanban tasks, comments, run metadata, and structured `workflow-evidence` JSON blocks.
2. Expose phases in this order: Plan Review, Build, Review, QA, Ship, Canary, Retro.
3. For each phase, include: status, current/linked task ids, latest evidence summary, missing required evidence types, next action, and blocker state.
4. Do not require a new persisted Kanban status or new board selector.
5. Redact or omit secrets and raw tool payloads.

Required UI behavior:

1. Project drawer or Task Board detail drawer shows a `Workflow` or `Evidence` section for HMC software-factory projects.
2. The operator sees current phase, next action, evidence completeness, blockers, and latest artifacts without opening raw logs first.
3. Board/source remains hidden from normal filters; Project remains the primary context filter.
4. Raw comments/logs remain reachable under Sources/Evidence, not dumped into the overview.
5. Empty state explains how evidence appears after workers append structured comments/results.

Required verification for the first slice:

1. `npm run build` passes.
2. API probe for a known tenant returns the expected phase list and does not expose secrets.
3. Browser/DOM check confirms the Project or Task Board drawer renders the workflow/evidence section.
4. Existing Task Board status lanes and filters still render as before.
5. No production deploy occurs unless a later card explicitly authorizes it.

## Completion rules for workers

- Spec/research-only cards may complete when the deliverable is committed and verification passes.
- Code-changing cards should comment structured evidence and block for review unless the task explicitly says no review is required.
- Deploy cards require explicit production authorization and must report build, deploy target, health check, browser/API verification, and rollback note.
- If a required evidence field is unavailable, record it as `skipped` or `blocked` with a reason; do not fabricate logs or results.

## Rollback notes for this contract

This contract is documentation only. Rollback is to revert the commit that adds or changes `docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md`. It does not deploy production code, modify databases, change Kanban enums, or create external resources.
