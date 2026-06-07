# Phase 0 plan: Admin platform multi-runtime foundation

Date: 2026-06-06
Task: t_6a00ed3f
Scope: planning / implementation readiness only. This document does not change runtime behavior.

## Purpose

Phase 0 should turn the current Mission Control multi-user/admin work into a safe foundation before deeper Platform / Workspace / Personal agent work continues.

The target architecture in `docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md` says Mission Control is a central Admin control plane over isolated Hermes user/workspace runtimes (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:14-24`) and that policy must be checked before execution (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:1048-1061`). The same document currently starts its implementation roadmap at Phase 1 (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:950`), so Phase 0 is the missing stabilization/readiness phase.

## Phase 0 outcome

By the end of Phase 0:

1. Admin vs workspace mode boundaries are explicit and server-enforced.
2. User, workspace, runtime, and agent-selection records have a documented contract.
3. Existing tests either pass or are updated to match the actual current API names/behavior.
4. Admin UI pages are honest about what is live, read-only, or planned.
5. Rollback is simple: revert Phase 0 source changes and restore the previous runtime database backup if schema migration is touched.

## Current-state evidence

### Design baseline

- The design recommends one central Mission Control Admin platform managing many isolated Hermes runtimes/profiles (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:14-24`, `docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:68-85`).
- It explicitly rejects one shared runtime for all users because of memory/session/credential leakage and weak tenant isolation (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:43-55`).
- It defines the execution principle as policy-before-execution: identify workspace, resolve allowed agents/tools/models, route to isolated Hermes runtime, then record evidence/audit (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:1048-1061`).
- It preserves key product decisions: one Admin platform and many isolated Hermes runtimes/profiles (`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md:1101-1105`).

### Backend baseline

- `auth.py` owns local auth and workspace/runtime bootstrap:
  - `ensure_auth_tables()` starts at `/opt/hermes-mission-control/auth.py:399`.
  - `users` table creation starts at `/opt/hermes-mission-control/auth.py:402`.
  - `workspaces` table creation starts at `/opt/hermes-mission-control/auth.py:412`.
  - `user_runtimes` table creation starts at `/opt/hermes-mission-control/auth.py:435`.
  - `upsert_local_user()` starts at `/opt/hermes-mission-control/auth.py:462`.
  - `authenticate_user()` starts at `/opt/hermes-mission-control/auth.py:557`.
  - `me_payload_from_cookie()` starts at `/opt/hermes-mission-control/auth.py:588`.
  - `ensure_user_runtime()` starts at `/opt/hermes-mission-control/auth.py:213` and `ensure_user_hermes_profile()` starts at `/opt/hermes-mission-control/auth.py:302`.
- `app.py` already has admin and agent-directory surfaces:
  - `admin_access_payload()` starts at `/opt/hermes-mission-control/app.py:273`.
  - `list_agent_directory()` starts at `/opt/hermes-mission-control/app.py:493`.
  - `select_user_agent()` starts at `/opt/hermes-mission-control/app.py:509`.
  - `admin_agent_platform_payload()` starts at `/opt/hermes-mission-control/app.py:637`.
  - `resolve_agent_runtime_route()` starts at `/opt/hermes-mission-control/app.py:802`.
  - `require_auth()` starts at `/opt/hermes-mission-control/app.py:10757`.
  - GET `/api/admin/access` dispatch is at `/opt/hermes-mission-control/app.py:10936-10938`.
  - GET `/api/admin/agent-platform` dispatch is at `/opt/hermes-mission-control/app.py:10939-10941`.
  - POST `/api/admin/users` handling begins at `/opt/hermes-mission-control/app.py:11113`.
- Live service state at inspection time: `hermes-mission-control.service` was active and listening on `127.0.0.1:19080`.
- Unauthenticated read-only endpoint smoke checks returned HTTP 401 for `/api/status`, `/api/me`, `/api/admin/access`, and `/api/admin/agent-platform`, confirming the live server is not exposing these JSON surfaces without a session.

### Frontend baseline

- `uiPermissions.ts` declares admin-only and workspace-visible routes:
  - `adminOnlyViews` starts at `/opt/hermes-mission-control/source/src/services/uiPermissions.ts:16`.
  - `workspaceViews` starts at `/opt/hermes-mission-control/source/src/services/uiPermissions.ts:29`.
  - `permissionsForRole()` starts at `/opt/hermes-mission-control/source/src/services/uiPermissions.ts:55`.
  - `canAccessView()` starts at `/opt/hermes-mission-control/source/src/services/uiPermissions.ts:69`.
- `store.tsx` implements the important account-role vs effective-role separation:
  - `/admin` startup detection at `/opt/hermes-mission-control/source/src/services/store.tsx:65`.
  - Admin account in workspace mode is downgraded to effective `user` at `/opt/hermes-mission-control/source/src/services/store.tsx:75`.
  - Bootstrap calls `client.getMe()` at `/opt/hermes-mission-control/source/src/services/store.tsx:96`.
- `App.tsx` renders restricted and admin pages:
  - `Shell()` starts at `/opt/hermes-mission-control/source/src/App.tsx:55`.
  - Admin mode toggle renders at `/opt/hermes-mission-control/source/src/App.tsx:100`.
  - `users-workspaces`, `agent-platform-admin`, and `shared-agent-templates` render through `AdminSetupPage` at `/opt/hermes-mission-control/source/src/App.tsx:126-128`.
- `NavRail.tsx` has a separate Admin Console nav group:
  - `adminConsoleGroups` starts at `/opt/hermes-mission-control/source/src/components/NavRail.tsx:60`.
  - Runtime Connector, Workflow Routine Admin, Global Audit Log, Costs/Usage, Approval Policy, and Quota entries live inside Admin nav (`/opt/hermes-mission-control/source/src/components/NavRail.tsx:71-86`).
- `AdminSetupPage.tsx` contains direct admin API calls and live admin panels:
  - `adminRequest()` starts at `/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx:102`.
  - `UsersAccessPanel()` starts at `/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx:333`.
  - User creation calls POST `/api/admin/users` at `/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx:382-384`.
  - User edit calls POST `/api/admin/users/<id>/action` and agent assignment calls POST `/api/admin/users/<id>/agents/action` at `/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx:437-444`.
  - `SharedAgentTemplatesPanel()` starts at `/opt/hermes-mission-control/source/src/views/AdminSetupPage.tsx:683`.
- Frontend type shape is still minimal:
  - `MissionControlUser` starts at `/opt/hermes-mission-control/source/src/types.ts:551`.
  - `MissionControlWorkspace` starts at `/opt/hermes-mission-control/source/src/types.ts:559`.
  - `MissionControlMe` starts at `/opt/hermes-mission-control/source/src/types.ts:565`.

### Test / build evidence

Commands run from `/opt/hermes-mission-control/source`:

1. `git status --short && git branch --show-current && systemctl is-active hermes-mission-control.service || true && ss -ltnp 'sport = :19080' || true`
   - Branch: `main`.
   - Service: active.
   - Listener: `127.0.0.1:19080`.
   - Existing uncommitted files were already present before this plan file was written: `docs/HERMES_MISSION_CONTROL.md`, `src/App.tsx`, `src/components/NavRail.tsx`, `src/services/deepLinks.ts`, `src/services/uiPermissions.ts`, `src/styles/app.css`, `src/types.ts`, `src/views/AdminSetupPage.tsx`, `tests/test_nav_ia_step3_admin_pages.py`, and untracked `docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md`.
2. `python -m pytest ... -q`
   - Result: 24 failed / 10 passed.
   - Root blocker: tests loading `/opt/hermes-mission-control/app.py` from the source directory could not import sibling `/opt/hermes-mission-control/auth.py` without `PYTHONPATH=/opt/hermes-mission-control`.
3. `PYTHONPATH=/opt/hermes-mission-control python -m pytest ... -q`
   - Result: 13 failed / 21 passed.
   - Remaining failures are real contract drift, not environment import failures:
     - `tests/test_multi_user_phase2_phase3.py:4-90` expects `app.upsert_local_user` plus workspace project/task/inbox/audit and agent selection helpers.
     - `tests/test_multi_user_phase6_runtime_routing.py:8-168` expects runtime route helpers including `resolve_agent_runtime_route`, profile/channel isolation, prompt/header injection, and profile-backed CLI behavior.
     - `tests/test_multi_user_phase7_ui_separation.py:28-40` expects an exact store source string for role-guard logic that no longer matches current refactored code.
     - `tests/test_multi_user_phase7_ui_separation.py:73-79` expects exact `canAccessView(me?.user.role, view)` and `safeDefaultViewForRole(me?.user.role)` source strings, while current code uses optional chaining with `me?.user?.role`.
4. `npm run build`
   - Result: success.
   - Output bundle built in `source/dist`; Vite emitted only the existing large-chunk warning.
5. Read-only unauthenticated smoke via `urllib.request` against local service:
   - `/api/status`: HTTP 401 Unauthorized.
   - `/api/me`: HTTP 401 Unauthorized.
   - `/api/admin/access`: HTTP 401 Unauthorized.
   - `/api/admin/agent-platform`: HTTP 401 Unauthorized.

## Gaps Phase 0 must close

### Gap 1: Test harness import path is fragile

The Python tests import `/opt/hermes-mission-control/app.py` from `source/tests`, but `app.py` imports `auth` as a sibling module. Without `PYTHONPATH=/opt/hermes-mission-control`, most multi-user tests fail before exercising product behavior.

Acceptance criteria:

- Running the documented test command from `source/` succeeds without needing the operator to remember an ad hoc `PYTHONPATH`, or the README/test plan explicitly includes the required environment.
- Prefer a `tests/conftest.py` or test helper fix over changing runtime import behavior.

### Gap 2: Backend helper/API contract drift

Phase 2/3/4/6 tests reference helper names such as `app.upsert_local_user`, workspace CRUD/list helpers, agent assignment helpers, and runtime routing helpers. Some implementation has moved into `auth.py` or may have been renamed/private, while tests still target `app.py` public helpers.

Acceptance criteria:

- Decide which helpers are part of the testable contract.
- Either re-export stable helpers from `app.py` or update tests to target the current module/function names.
- Do not silently weaken server-side authorization tests; they are the evidence for the design's policy-before-execution principle.

### Gap 3: Source-string tests are brittle

`tests/test_multi_user_phase7_ui_separation.py` currently asserts exact substrings for role gating. Current source appears semantically equivalent in places but differs by optional-chaining syntax and refactoring.

Acceptance criteria:

- Replace exact string checks with behavior-level or AST-ish assertions where practical.
- Preserve the important assertion: admin accounts in workspace mode are treated as workspace users; admin-only routes are not rendered for non-admin effective roles.

### Gap 4: Admin API client typing is split

`httpHermesClient.ts` has typed general methods and `getMe()`, but `AdminSetupPage.tsx` has its own `adminRequest()` local helper. This is acceptable for a slice, but Phase 0 should decide whether admin endpoints become part of the typed client contract.

Acceptance criteria:

- Document the current local `adminRequest()` pattern or move admin API calls into typed client methods.
- Ensure admin mutation responses never expose raw secrets beyond one-time temporary password UI messages.
- Add frontend types for access roster, runtime, workspace membership, and shared agent templates if they are kept.

### Gap 5: Runtime isolation model is partly implemented but not fully proven

The design requires separate runtime/profile state per workspace. Existing code has `user_runtimes` and Hermes profile bootstrap functions, and tests expect one workspace profile reused by selected workspace agents plus special admin profile-backed routing. The failing test set shows this contract is not currently green.

Acceptance criteria:

- Runtime route tests pass for workspace profile isolation and admin profile-backed exceptions.
- Headers/prompt blocks include workspace/profile identifiers without leaking secrets.
- Normal users cannot route to unselected/disallowed agents by direct API call.

### Gap 6: Admin pages mix live controls and setup-roadmap content

`UsersAccessPanel` is live, while pages such as Quota and Approval Policy are setup hubs with planned endpoints. This is fine if labeled clearly, but Phase 0 should make the distinction explicit so operators do not assume unavailable controls are active.

Acceptance criteria:

- Each Admin Console page declares one of: Live, Read-only evidence, Planned, or Disabled pending policy.
- Planned pages name the future endpoint and state that no mutation occurs.

## Phase 0 implementation steps

### Step 0.1 — Freeze current state and test command

Tasks:

- Add a short `docs/plans` or test README note with the canonical local test command for backend tests.
- Add/adjust `tests/conftest.py` so `/opt/hermes-mission-control` is in `sys.path` when tests import `app.py`, unless the project prefers documenting `PYTHONPATH` only.
- Re-run the targeted multi-user/admin tests.

Acceptance criteria:

- Import-path failures disappear without changing production runtime behavior.
- Test failure list reflects product contract issues only.

Rollback:

- Remove the test helper or revert the README/test-command note.

### Step 0.2 — Define the Phase 0 backend contract

Tasks:

- Create a concise contract section in docs for:
  - `MissionControlUser` / `MissionControlWorkspace` / `MissionControlMe`.
  - Workspace-owned Hermes profile and runtime row.
  - Shared agent templates vs user-selected agents.
  - Admin-only mutation endpoints.
- Choose stable names/locations for test helpers:
  - Local user creation/bootstrap.
  - Workspace project/task/inbox/audit CRUD.
  - Agent directory selection/unselection.
  - Runtime route resolution.
- Verify every mutation path runs through identity/role checks, not just hidden UI buttons.

Acceptance criteria:

- Test helpers and HTTP endpoints match the documented contract.
- Normal-user direct API attempts return 403/404 as appropriate.
- Admin access endpoints require admin identity, not only any authenticated identity.

Rollback:

- Revert contract docs and helper exports; no database migration required unless Step 0.4 has run.

### Step 0.3 — Fix brittle UI separation tests

Tasks:

- Convert source-string checks in `test_multi_user_phase7_ui_separation.py` into robust checks that still assert:
  - `StoreProvider` loads `client.getMe()`.
  - `permissionsForRole` receives downgraded effective role for admin-in-workspace-mode.
  - `App` gates rendering through `canAccessView` and displays `AdminOnlyNotice` on forbidden views.
- If possible, add a small pure unit helper for effective role calculation so the behavior is directly testable.

Acceptance criteria:

- UI separation tests pass after harmless formatting/refactor changes.
- Tests fail if admin-only views can render for non-admin users.

Rollback:

- Revert test-only changes.

### Step 0.4 — Validate or repair runtime/profile isolation

Tasks:

- Run the Phase 6 runtime routing tests after import-path fixes.
- If failures remain, inspect whether functions were renamed/moved or behavior is actually missing.
- Repair only the root cause:
  - Re-export from `app.py` if tests are pointed at the wrong module.
  - Update tests if helper location changed intentionally.
  - Fix runtime route logic only if direct API bypass or workspace leakage is real.
- Ensure runtime route prompt/headers carry only non-secret identifiers: profile name, workspace id/slug, selected agent/template id.

Acceptance criteria:

- Workspace A and Workspace B resolve to different profile paths/channel IDs.
- A workspace agent selection does not affect another workspace.
- Admin-only profile-backed routing works only for configured admin/platform agents.
- No raw credentials are logged or returned.

Rollback:

- Revert code and restore prior DB backup if schema/data mutation was involved.

### Step 0.5 — Normalize Admin API/UI contracts

Tasks:

- Either type admin endpoints in `httpHermesClient.ts` or document why `AdminSetupPage.adminRequest()` remains local for now.
- Add visible status labels to Admin Console panels:
  - Live: User Access, Shared Agent Templates if backed by real endpoints.
  - Read-only evidence: Runtime Connectors, Audit, Costs where already read-only.
  - Planned: Quota, Approval Policy if no mutation endpoint exists.
- Confirm admin page navigation stays in Admin mode and workspace nav stays user-focused.

Acceptance criteria:

- Admin UI does not overstate planned functionality as active.
- Admin mutations are explicit, limited, and auditable.
- No destructive production DB/cloud/DNS changes are made in Phase 0.

Rollback:

- Revert UI copy/client typing changes.

### Step 0.6 — Final Phase 0 verification

Run:

```bash
cd /opt/hermes-mission-control/source
python -m pytest tests/test_multi_user_phase1.py \
  tests/test_multi_user_phase2_phase3.py \
  tests/test_multi_user_phase4_permissions.py \
  tests/test_multi_user_phase6_runtime_routing.py \
  tests/test_multi_user_phase7_ui_separation.py \
  tests/test_nav_ia_step3_admin_pages.py \
  tests/test_multi_user_needs_attention_bell.py -q
npm run build
python - <<'PY'
import urllib.request
for path in ['/api/status','/api/me','/api/admin/access','/api/admin/agent-platform']:
    try:
        with urllib.request.urlopen('http://127.0.0.1:19080' + path, timeout=5) as r:
            print(path, r.status)
    except Exception as e:
        print(path, type(e).__name__, str(e))
PY
```

Expected:

- Targeted tests pass or any remaining failures are explicitly documented as follow-up cards.
- `npm run build` succeeds.
- Unauthenticated admin/status/API surfaces continue to reject with 401 unless the route is intentionally public.

## Rollback strategy

Phase 0 should be low-risk because it is mostly tests, contracts, UI labels, and helper alignment.

Before any DB/schema-affecting implementation step:

1. Back up runtime database files with timestamped copies:
   - `/opt/hermes-mission-control/mission_control.db`
   - any auth DB path in use by `auth.py` / configured env
   - `/root/.hermes/state.db` only if a change will touch live Hermes state
2. Record current git branch and diff.
3. Do not restart `hermes-mission-control.service` until source build/tests pass.

Rollback procedure:

1. `git restore` or revert the Phase 0 commit(s) for source/test/UI changes.
2. Restore timestamped DB backups only if a migration/data write was applied.
3. Rebuild from the previous known-good source and copy to `/opt/hermes-mission-control/dist` only after approval.
4. Restart `hermes-mission-control.service` and verify `127.0.0.1:19080` plus public `/app` if deployment was touched.

## Risks and mitigations

- Risk: fixing tests by weakening assertions could hide real tenant-isolation gaps.
  - Mitigation: preserve behavior assertions for 403/404, workspace id/profile path isolation, and admin-only routing.
- Risk: exposing temporary passwords in durable logs or task comments.
  - Mitigation: never include actual generated passwords in tests, docs, Kanban comments, or logs; use `[REDACTED]` in evidence.
- Risk: admin UI appears to support quota/policy mutations that do not exist.
  - Mitigation: label planned endpoints clearly and keep buttons disabled/read-only until audited endpoints exist.
- Risk: workspace profile model drifts into one profile per agent.
  - Mitigation: keep the Phase 6 acceptance criterion: workspace = Hermes profile; agents are templates/preferences unless an admin/platform profile exception is explicitly configured.

## Recommended next task breakdown

1. Backend/test harness: make the multi-user test suite import `auth.py` reliably and decide helper export locations.
2. Backend contract repair: align `app.py`/`auth.py` helper names and runtime route behavior with tests or update tests to current names.
3. Frontend test hardening: replace brittle source-string assertions with behavior-preserving checks.
4. Admin UI truth-in-labeling: mark Admin Console sections Live / Read-only / Planned.
5. Verification/deploy gate: run targeted tests, `npm run build`, authenticated browser smoke, then request review before copying to live `dist`.

## Review gate

This plan should be human-reviewed before implementation because it affects the foundation for user/workspace isolation, admin authority boundaries, and runtime routing. The next worker should not deploy changes until the reviewer confirms whether Phase 0 should prioritize test-contract repair or UI/admin endpoint hardening first.
