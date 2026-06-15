# HMC Governed Software Factory QA / Release Gate

Generated: 2026-06-11T18:55:00+08:00
Task: t_39dd3b44
Branch: project/hmc-governed-software-factory
Base commit: 5785d66d180cae8bd0bbc87e523dc384de4a7dae
Workspace: /opt/hermes-mission-control/source
Deploy target: not deployed; source/staging verification only

## Gate result

Review required before merge/deploy. Source/staging verification passed after fixing one browser runtime crash found during QA.

## Commands run

- `npm run build` — passed. Vite chunk-size warning only.
- `python3 -m pytest tests/test_agent_os_kanban_project_creation.py tests/test_task_board_kanban_live_state.py tests/test_agent_os_evidence_gates.py -q` — 22 passed.
- `python3 scripts/hermes_skill_ci.py --output /tmp/hmc-skill-ci-release.md --json /tmp/hmc-skill-ci-release.json` — 5 passed, 0 warned, 0 failed.
- Isolated backend smoke via `app.create_task()` + `app.list_task_board()` on a temporary Kanban DB — create_status 201, board_total 1, review_count 1.
- Browser staging smoke using local HMC backend on port 19081 serving `/opt/hermes-mission-control/source/dist` — Task Board rendered, Release tab rendered, Projects rendered, no captured browser errors after fix.
- `npm audit --omit=dev --json` — 0 production vulnerabilities.
- `npm audit --json` — 2 moderate dev-only advisories through Vite/esbuild dev server range.
- `git diff --check` on touched source/test/script/report files — passed.

## Browser issue found and fixed

Initial Task Board smoke exposed a runtime crash: `TypeError: Cannot read properties of undefined (reading 'flatMap')` in `getWorkflowEvidenceRecords` when a task payload omitted `comments`. The fix changed workflow evidence parsing to tolerate missing comments with `(task.comments ?? [])`. A second staging browser pass rendered Task Board and the Release tab without captured errors.

## Security / Testing Division notes

- Security scope reviewed against the HMC checklist: no auth/session, CSRF, token, runtime connector, cloud/DNS, or production DB mutation paths were changed in this slice.
- The new skill/workflow CI script is read-only by design: it parses SKILL.md/frontmatter, checks linked files/globs, validates command availability, and avoids executing arbitrary skill commands or printing secrets.
- Production dependency audit had zero findings. Full audit findings are dev-server Vite/esbuild advisories; do not expose dev/preview servers to untrusted networks.

## Docs impact

- New report artifacts under `docs/reports/` capture the skill CI pilot and this QA/release gate.
- Existing plan artifact remains `docs/plans/2026-06-11-hmc-governed-software-factory.md`.
- No public website/docs deployment was performed.

## Rollback notes

No production deploy was performed. Roll back this source slice by reverting the working-tree changes on branch `project/hmc-governed-software-factory` or restoring the previous committed source tree. If this static frontend is later deployed, use the standard rollback path: restore the timestamped `/opt/hermes-mission-control/dist.backup.<STAMP>` and verify the served bundle hash via GET.
