# HMC UI Decision Library

This library is the HMC-specific adaptation of the useful concept from `nextlevelbuilder/ui-ux-pro-max-skill`: a local, searchable UI decision database for agents before they change Mission Control UI.

It intentionally does **not** import the external repo, its installer, its generic AI-purple aesthetics, or its broad multi-assistant skill pack. HMC uses a smaller governance-first dataset focused on operator decisions, evidence, dense drawers, dashboards, and approval discipline.

## Query command

```bash
python3 scripts/hmc_ui_guidance.py "task detail drawer evidence"
python3 scripts/hmc_ui_guidance.py "model routing governance" --json
python3 scripts/hmc_ui_guidance.py --screen task-drawer
```

Use this before UI edits when the work touches:

- Task Board cards or task detail drawers
- Agent/runtime/workflow drawers
- dense tables, filters, audit logs, or evidence panels
- approval/review queues
- model routing/governance UI
- Mission Control navigation or operator dashboards

## Non-negotiable HMC UI principles

1. **Decision-first, not metric-first**
   - The first screen should answer what needs attention, what changed, what is blocked, what evidence exists, and where the operator clicks next.
   - Demote vanity telemetry unless it changes an operator decision.

2. **Evidence belongs where work is decided**
   - Prefer Task Detail / workflow drawers as proof surfaces.
   - Do not create standalone evidence pages unless the operator needs cross-task investigation.

3. **Improve existing drawers before adding redundant pages**
   - HMC should preserve dashboard context.
   - New full pages need a clear navigation/ownership reason.

4. **Governance labels must be concrete**
   - Show actor, action, target, risk/effect, approval state, and owner.
   - Avoid ambiguous status text like `ready`, `processed`, or `done` without evidence.

5. **Model routing UI is governance infrastructure**
   - Do not make model cards a vanity gallery.
   - Show route reason, provider/model, credential readiness, allowed uses, fallback trigger, cost/risk tier, and approval gates.

6. **Dense UI must stay operable**
   - Preserve filters, keyboard flow, focus states, loading/error/empty states, and responsive behavior.
   - Use counts on tab labels only when the count changes operator action.

7. **No hidden side effects**
   - Email, calendar, external posting, Supabase writes, git/PR/deploy actions, and credential changes require preview → approval → execute → verify.

## Screen-type guidance

The script contains curated records for these HMC surfaces:

| Screen key | When to use |
|---|---|
| `operator-dashboard` | Home/dashboard/overview pages |
| `task-drawer` | Task detail, execution cockpit, task result/evidence |
| `workflow-drawer` | Routines/workflows/automation detail drawers |
| `model-router` | Model routing, provider/model allow-list, route preview |
| `approval-queue` | Human review/approval flows |
| `agent-roster` | AI Workforce roster, agent org, agent detail |
| `memory-knowledge` | Memory, Second Brain, evidence/source views |
| `navigation` | Left rail, nav IA, settings/admin routing |
| `dense-table` | Tables, logs, filters, audit trails |
| `mobile-chat` | Mobile-first chat/voice surfaces |

## Adoption rule for agents

Before editing HMC UI, agents should:

1. Query this library with the target screen and change request.
2. Apply the returned acceptance checklist.
3. Verify with at least the relevant static/unit test or frontend build.
4. If the UI is served/deployed, browser-check the changed surface.
5. Report the exact guidance key used and verification results.

## What this deliberately excludes

- external `uipro-cli` installation
- generic UI aesthetics or brand decisions
- auto-installation of shadcn components
- broad font bundles
- public dataset/package sync logic
- any instructions that override HMC governance, owner gates, or approval discipline
