# PR #6 Remaining Difference Classification

Base comparison: `recovery/missing-hmc-features` (`42c5883`) vs `project/hmc-governed-software-factory` (`87ca15b`).

Purpose: classify remaining differences after the preservation recovery so valid user-visible features are kept without regressing the newer runtime-switcher work.

## Summary

The remaining governed-vs-recovery diffs are small except for `src/views/ModelRouter.tsx`.

- Recover / keep in PR: tooltip affordances, Settings rate-limit peek, agent action dropdown, Capability Registry, Reflections, Task Board advanced source filter, Task Board realtime refresh status.
- Keep newer runtime-switcher implementation: `ModelRouter.tsx` from the runtime-switcher branch, because it adds `/api/agent-runtimes` account/model assignment and supersedes the older governed page body.
- Reject as stale/unsafe: restoring `models` as Admin-only and removing it from the workspace Workforce nav, because the current user requirement is easy agent switching between company/personal model accounts.
- Backend remains excluded from PR #6; any backend reconciliation must be a separate audited PR against live `/opt/hermes-mission-control/app.py`.

## File-by-file classification

### `src/components/ChatThread.tsx`

Diff remaining vs governed:

- Recovery has `title="Agent actions"` and `data-tooltip="Agent actions"`; governed does not.
- Recovery labels menu item `Worker log`; governed labels it `Agent Log`.

Classification: **keep recovery**.

Reason:

- User screenshot/request says the action menu should expose Worker log / Details / Rate limits.
- Tooltip/title attributes are valid accessibility/affordance recovery.

### `src/components/NavRail.tsx`

Diff remaining vs governed:

- Recovery keeps `Model Router` in the Workforce group; governed removes it from workspace and marks it admin-only.
- Recovery opens Settings with `setUsagePeekOpen(true)` and adds accessible Settings/rate-limit labels; governed only closes the peek when Settings closes.

Classification: **keep recovery**.

Reason:

- User requirement is easy agent/model switching, so `Model Router` must remain discoverable in the workspace Workforce area, not hidden in Admin-only settings.
- User explicitly flagged Settings with Rate Limit details as missing.
- Feature contract says workspace/account preferences and model rate-limit UI stay outside Admin-only settings.

### `src/services/uiPermissions.ts`

Diff remaining vs governed:

- Governed classifies `models` as admin-only.
- Recovery classifies `models` as workspace-accessible.

Classification: **keep recovery**.

Reason:

- The current product requirement is operator-level agent runtime switching between two OpenAI/ChatGPT accounts.
- Hiding `models` in Admin would regress that requirement.

### `src/styles/app.css`

Diff remaining vs governed:

- Recovery raises `.agent-action-dropdown` z-index from `35` to `120`.

Classification: **keep recovery**.

Reason:

- The dropdown is a floating menu near the chat header; higher z-index reduces clipping/hidden-menu regression risk.

### `src/views/ModelRouter.tsx`

Diff remaining vs governed:

- Governed has the older model-router page without account assignment.
- Recovery keeps the newer `Agent runtime switcher` types, `/api/agent-runtimes` load/save calls, account cards, per-agent assignment form, runtime audit log, and account/model metrics.

Classification: **keep newer runtime-switcher implementation**.

Reason:

- This is the active feature Melverick requested: switch agents between company and personal ChatGPT/OpenAI accounts.
- Reverting to governed would remove the core feature.
- Recovery added the missing tooltip affordances onto the newer implementation instead of replacing it.

### `src/views/TaskBoard.tsx`

Diff remaining vs governed:

- Recovery keeps `refreshStatusLabel` and renders `runtime-refresh-status realtime-status` in task title actions.
- Governed lacks those two lines in this comparison.

Classification: **keep recovery**.

Reason:

- Realtime/live refresh state is an operator affordance and was part of the preserved governed UI line before later branch divergence.

### `tests/test_capability_registry_ui.py`

Diff remaining vs governed:

- Governed includes one additional trailing blank line.

Classification: **ignore/no functional difference**.

Reason:

- No behavior or assertion difference.

## Valid changes recovered but not live yet

The built live production assets are still missing or partial for several valid features, while the PR build contains them:

- Hover/help tooltip system.
- Agent action dropdown markers.
- Capability Registry markers.
- Task Board advanced source filter markers.
- Task Board realtime refresh status markers.

This means these items are recovered in PR #6 but are not visible on production until PR #6 is merged/deployed.

## Deployment guard

Do not deploy directly from the dirty worktree. If approved later, deploy from a clean checked-out commit of PR #6 and verify:

1. source commit SHA;
2. `npm ci && npm run build`;
3. static markers in built JS/CSS;
4. browser DOM smoke for `/app?view=models`, `/app?view=agents`, `/app?view=tasks`, `/app?view=reflections`, and `/app?view=capabilities`;
5. production asset hash changed only after backup.
