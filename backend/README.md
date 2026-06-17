# Hermes Mission Control backend snapshot

This directory versions the Mission Control backend code that currently runs server-local from `/opt/hermes-mission-control`.

## Runtime boundary

Production service currently runs outside this repo:

- systemd unit: `hermes-mission-control.service`
- working directory: `/opt/hermes-mission-control`
- entrypoint: `/usr/bin/python3 /opt/hermes-mission-control/app.py`
- static assets: `/opt/hermes-mission-control/dist`
- frontend/source repo: `/opt/hermes-mission-control/source`

This backend directory is a source-control snapshot. Copying files here does **not** deploy or restart production.

Security note: the repo snapshot intentionally disables fallback demo-login password creation unless `HMC_DEMO_PASSWORD` is explicitly set in the runtime environment.

## Versioned code

- `app.py` — live HMC backend/router/API server entrypoint.
- `auth.py` — local authentication and invite/access helpers.
- `capability_registry.py` — capability registry/governance backend helpers.
- `reset-login.py` — operator password reset helper; reads/writes runtime auth DB/state when run against production.
- `wait-no-active-chat.py` — systemd stop-drain helper used before service restart.
- `scripts/seed_pilot_oss_capabilities.py` — capability registry seed helper.

## Local/runtime data intentionally excluded

Do not commit runtime state, secrets, generated output, logs, backups, uploads, or user runtime homes. Representative excluded classes:

- `.env`, `*.env`, `.basic-password`, `secrets/`
- `*.db`, `*.sqlite*`, `*.jsonl`
- `browser_connectors.json`, `model_router.json`, `processing-requests.json`, `ui-chat-overlays.json`
- `backups/`, `logs/`, `uploads/`, `output/`, `production-locks/`, `user-runtimes/`, `security-reports/`

See `.gitignore` for repo-level protections.

## Verification commands

From repo root:

```bash
python3 -m py_compile backend/app.py backend/auth.py backend/capability_registry.py backend/reset-login.py backend/wait-no-active-chat.py backend/scripts/seed_pilot_oss_capabilities.py
npm run build
npm run check:feature-contract
```

Optional live smoke, without printing credentials, should use the deployed service credentials through server-local helpers and verify status/classification only.

## Deployment caveat

Do not replace `/opt/hermes-mission-control/app.py` from this directory without a dedicated deploy plan, backup, `py_compile`, active-worker drain check, service restart, and authenticated smoke test.
