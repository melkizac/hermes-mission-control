# Mission Control Backend

This directory versions the Python backend code that currently runs on the Mission Control host.

## Runtime boundary

The production service is currently launched from `/opt/hermes-mission-control/app.py` on the server. This repository copy is the source-controlled mirror used for review, rollback, and rebuilds. Runtime state remains outside Git.

## Files tracked here

- `app.py` — HTTP backend and Mission Control API surface.
- `auth.py` — local auth/session/workspace helpers.
- `capability_registry.py` — capability and workflow registry helpers.
- `scripts/seed_pilot_oss_capabilities.py` — seed helper for pilot OSS capabilities.

## Runtime files intentionally not tracked

Keep these out of GitHub:

- `.env` and `.env.*`
- `secrets/`
- `*.db`, `*.sqlite`, `*.sqlite3`
- `logs/`, `uploads/`, `output/`, `backups/`
- `browser_connectors.json`, `browser_runtime_events.json`
- `model-usage-remaining.json`, `model_router.json`
- `processing-requests.json`, `tool_installations.json`, `ui-chat-overlays.json`

## Required configuration

Most paths are configurable through environment variables. Production defaults are server-local and should be overridden where appropriate:

- `HERMES_HOME` — default `/root/.hermes`
- `HERMES_API_BASE` — default `http://127.0.0.1:8642/v1`
- `HMC_APP_ROOT` — default `/opt/hermes-mission-control`
- `HMC_DIST_DIR`
- `HMC_UPLOAD_DIR`
- `HMC_GENERATED_OUTPUT_DIR`
- `HMC_APPROVALS_DB`
- `HMC_RUNTIME_CONNECTORS_DB`
- `HMC_APP_DB`
- `HMC_AGENT_REGISTRY`
- `HMC_AGENT_ACTIVITY_DB`

Do not commit actual credential values. Keep production secrets in root/user-only env files or service manager environment files.

## Verification

From the repository root:

```bash
python3 -m py_compile backend/app.py backend/auth.py backend/capability_registry.py backend/scripts/seed_pilot_oss_capabilities.py
npm run build
python3 -m pytest -q tests/test_agent_os_kanban_project_creation.py tests/test_main_chat_attachment_handoff.py tests/test_drawer_tab_overflow_consistency.py tests/test_workflow_library_card_consistency.py
```

## Deployment note

This commit does not automatically deploy or replace `/opt/hermes-mission-control/app.py`. Backend deployment should copy the reviewed file to the live app path only after explicit release approval, service backup, and health checks.
