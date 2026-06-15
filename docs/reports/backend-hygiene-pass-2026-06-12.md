# Mission Control backend hygiene pass

Date: 2026-06-12

## Scope

Brought the server-local Mission Control backend code into the GitHub-controlled Mission Control repository without adding runtime state or secret files.

## Source files mirrored

- `/opt/hermes-mission-control/app.py` → `backend/app.py`
- `/opt/hermes-mission-control/auth.py` → `backend/auth.py`
- `/opt/hermes-mission-control/capability_registry.py` → `backend/capability_registry.py`
- `/opt/hermes-mission-control/scripts/seed_pilot_oss_capabilities.py` → `backend/scripts/seed_pilot_oss_capabilities.py`

## Secret scan summary

Scanned backend Python files for common inline secret patterns:

- hardcoded secret/password/token assignments
- bearer token literals
- OpenAI-style `sk-...` literals
- GitHub PAT-like literals
- JWT-like literals

Findings:

- `backend/app.py` had two secret-like matches:
  - generated runtime secret using `secrets.token_urlsafe(...)`
  - default empty token parameter in a probe helper
- `backend/auth.py`: no matches
- `backend/capability_registry.py`: no matches
- `backend/scripts/seed_pilot_oss_capabilities.py`: no matches

No credential values were copied into the report.

## Runtime data excluded

`.gitignore` now excludes Mission Control runtime data, including databases, logs, uploads, generated output, local JSON state, backups, and secrets directories.

## Deployment boundary

No production backend deployment was performed by this pass. The live backend file remains `/opt/hermes-mission-control/app.py`; the repository copy is for GitHub history, review, and future controlled deployment.
