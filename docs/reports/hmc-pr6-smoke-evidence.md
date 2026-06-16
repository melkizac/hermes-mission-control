# HMC PR #6 Browser/Static Smoke Evidence

Date: 2026-06-15
Branch: `recovery/missing-hmc-features`
Head before this report commit: `42c5883`

## Build

Command:

```bash
npm run build
```

Result:

```text
> hermes-mission-control@0.1.0 build
> tsc -b && vite build

✓ 89 modules transformed.
dist/assets/index-DMc9zaKZ.css
dist/assets/index-cuwC9j7e.js
✓ built in 2.55s
```

## Feature-preservation audit script

Command:

```bash
python3 scripts/hmc_feature_preservation_audit.py
```

Result:

```text
features audited: 12
required recovery source markers: no missing required feature rows
```

Live production built assets are still missing/partial for several valid features that are present/partial in the PR build:

```text
hover-help-tooltips: live=missing pr=partial decision=recover
agent-action-dropdown: live=partial pr=present decision=recover
capability-registry: live=missing pr=partial decision=recover
task-board-advanced-source-filter: live=partial pr=present decision=recover
task-board-realtime-refresh-status: live=missing pr=partial decision=recover
```

Interpretation: these are recovered in PR #6 but not visible on production until PR #6 is deployed.

## Browser DOM smoke: `/app?view=models`

Served the PR build locally with a minimal same-origin API fixture and opened:

```text
http://127.0.0.1:19180/app?view=models
```

DOM/assertion result:

```json
{
  "modelRouter": true,
  "runtimeSwitcher": true,
  "tooltipButton": true,
  "settingsOpened": true,
  "settingsText": "Profile\nSettings\nRate limits\n5h\n—\n—\nWeekly\n—\n—\nDocs\nLog out",
  "usagePeek": "5h\n—\n—\nWeekly\n—\n—"
}
```

Verified by browser snapshot:

- `Model Router` remains in the Workforce nav.
- `Cost-aware AI Model Router` renders.
- `About Model Router` tooltip affordance renders.
- `Agent runtime switcher` renders.
- Settings button label is `Open Settings menu with rate limit details`.
- Opening Settings shows `Rate limits` and the usage peek rows.

## Static marker smoke for agent dropdown

Static checks confirmed:

```text
src/components/ChatThread.tsx:
- agent-action-dropdown
- Worker log
- data-tooltip="Agent actions"
- Rate limits

src/styles/app.css:
- .agent-action-dropdown
- z-index: 120
```

A full `/app?view=agents` browser smoke should be rerun against the real Mission Control backend or a fuller fixture because the local fixture is intentionally minimal and does not emulate every chat/session API shape.

## Risk guard

PR diff checked for risky paths:

```bash
git diff --name-only origin/feat/agent-runtime-switcher-left-rail...HEAD | grep -E '^(backend/|\.hermes/|\.github/)'
```

Result: no matches.

Backend remains untouched in PR #6.
