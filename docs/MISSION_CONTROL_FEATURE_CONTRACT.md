# Mission Control Feature Contract

This is the retention contract for Mission Control. Every PR that changes UI, API, source-control layout, deployment packaging, or cleanup/refactor behavior must preserve the relevant capabilities below unless the PR explicitly records a Melverick-approved removal/replacement.

## Merge rule

A PR is not ready for `main` until it has:

- a narrow branch/PR scope;
- a clean working tree except for the PR's intended files;
- the PR template completed with touched routes and preserved capabilities;
- build/test evidence;
- page/API smoke evidence for touched routes;
- conflict resolution performed on the PR branch after updating from latest `main`;
- no unexplained feature contract regression.

Git conflicts are necessary but not sufficient. A feature can be removed cleanly without a merge conflict, so this contract and smoke checks are the guardrail against omitted features.

## Global Mission Control invariants

- Default IA stays operator-first and Project-first: `Project -> Tasks`.
- Board/source/internal storage concepts stay out of the default user path unless exposed intentionally as advanced/admin diagnostics.
- Hiding an advanced concept does not delete the capability. Preserve advanced access through a drawer, advanced filter, admin view, API path, or documented replacement.
- Chat remains the default/fresh landing mode unless a request explicitly needs Project + cards/evidence.
- Reflections must show an agent list plus per-agent approval/reflection drawer.
- Admin Capabilities governs skills, tools, plugins, and connectors.
- Memory remains separate from Admin Capabilities.
- Workspace/account preferences and model rate-limit UI stay outside Admin-only settings.
- No sample/demo data should mask an empty real state.

## /tasks — Task Board

Must preserve:

- Search by ID, title, body, owner, project, skill, or source metadata.
- Status filtering.
- Owner/assignee filtering.
- Project filtering using canonical project labels where available.
- Board/source filtering as an advanced/internal capability when multiple task sources exist. It may be hidden from the default Project-first path, but it must be accessible through an advanced filter/drawer/admin diagnostic/API path or have an explicitly approved replacement.
- Cards/List view switch.
- Lane grouping for Not Started, In Progress, and Attention/Outcomes.
- Task drawer/detail view.
- Deep-linked task opening and clear notice when hidden by filters.
- Create action/manual task capture.
- Clear filters action in empty state.
- Drag/status update behavior, delete behavior, comments, assignment/handoff controls where present.
- Work-type clarity cues: human, agent, routine, cron, internal, implementation, review.

Smoke evidence for `/tasks` PRs should include:

- frontend build result;
- static or browser/DOM assertion that search/status/owner/project filters render;
- evidence for advanced board/source access or a documented approved exception;
- console check when browser verification is possible.

## /projects — Projects

Must preserve:

- Project-first language and labels.
- Canonical project records from `/api/projects` or the documented canonical source.
- Project selector parity with other Project-aware pages.
- Project details/drawer/source/evidence surfaces where present.
- Hidden/deprecated Board/source labels in default IA unless intentionally advanced.

## /agents and Reflections

Must preserve:

- Agent list visibility.
- Per-agent drawer/detail flow.
- Approval/reflection evidence surfacing.
- Human-in-the-loop controls and auditability.

## /admin and Capabilities

Must preserve:

- Admin Capabilities owns skills/tools/plugins/connectors.
- Memory is not moved into Admin Capabilities.
- User/workspace preferences remain separate from Admin-only settings.

## Deployment/source-control invariants

- Frontend source, built `dist`, and live served bundle must be verified separately when deploying.
- Backend code under `/opt/hermes-mission-control` must not be assumed to be in GitHub unless representative backend files are verified in the repo.
- Runtime state, secrets, DBs, uploads, logs, outputs, and generated local JSON remain excluded from Git.
- Cleanup PRs must not stage broad/generated files without an ignore check.

## Approved removal/replacement format

If a PR intentionally removes or replaces a capability, the PR must include:

```text
Capability removed/replaced:
Reason:
Approved by:
Replacement path:
Verification:
Rollback:
```

Without this section, missing contract items are treated as regressions.
