# HMC backend source-control hygiene report

## Scope

Mirrored reviewed backend code from `/opt/hermes-mission-control` into the frontend Git repo under `backend/` so GitHub can track the live backend source separately from runtime state.

## Included

- `/opt/hermes-mission-control/app.py` -> `backend/app.py`
- `/opt/hermes-mission-control/auth.py` -> `backend/auth.py`
- `/opt/hermes-mission-control/capability_registry.py` -> `backend/capability_registry.py`
- `/opt/hermes-mission-control/reset-login.py` -> `backend/reset-login.py`
- `/opt/hermes-mission-control/wait-no-active-chat.py` -> `backend/wait-no-active-chat.py`
- `/opt/hermes-mission-control/scripts/seed_pilot_oss_capabilities.py` -> `backend/scripts/seed_pilot_oss_capabilities.py`

## Excluded

- production credentials and env files
- SQLite databases and WAL/SHM files
- runtime JSON state
- JSONL performance logs
- static build artifacts and backups
- uploads, output, user runtimes, security reports, caches

## Secret scan summary

A redacted regex scan found no bearer literals, OpenAI keys, GitHub PATs, or JWT literals in the included files. It did find variable names such as `token`, `temp_password`, and password prompt/default handling; those are code paths or environment/default placeholders, not committed live credential values.

## Hardening delta in repo snapshot

The mirrored `backend/auth.py` removes the historical fallback demo password by changing the default `HMC_DEMO_PASSWORD` value to empty. Demo access will require an explicit environment variable if this backend snapshot is deployed later. This is intentionally safer for source control and was **not** applied to production in this hygiene pass.

## Production status

No production files were modified by the source-control mirror. The live service remains `/opt/hermes-mission-control/app.py` under systemd.
