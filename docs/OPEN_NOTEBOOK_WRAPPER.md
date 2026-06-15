# Controlled Open Notebook wrapper

Mission Control uses `scripts/open_notebook_wrapper.py` as the controlled, API-first wrapper for `lfnovo/open-notebook` research backends. The wrapper exposes narrow actions for Research-to-Deliverable projects instead of giving agents unrestricted API or shell access.

## Configuration

Set these in the runtime environment or profile `.env` file. Do not paste secret values into chat or task comments.

- `HMC_OPEN_NOTEBOOK_BASE_URL`: Open Notebook REST API base URL, default `http://127.0.0.1:5055`.
- `HMC_OPEN_NOTEBOOK_PASSWORD` or `HMC_OPEN_NOTEBOOK_PASSWORD_FILE`: bearer password if Open Notebook auth is enabled.
- `HMC_OPEN_NOTEBOOK_ALLOWED_FILE_ROOTS`: `os.pathsep`-separated local roots allowed for upload-file. Defaults to `HMC_UPLOAD_DIR` or `/opt/hermes-mission-control/uploads`.
- `HMC_OPEN_NOTEBOOK_MAX_TEXT_CHARS`: max text source or note body chars, default `200000`.
- `HMC_OPEN_NOTEBOOK_MAX_FILE_BYTES`: max uploaded file bytes, default 25 MiB.

## Supported actions

All actions emit compact JSON with `ok`, `summary`, `data`, and `evidence` fields where applicable.

- `health`: GET `/health`.
- `list-notebooks`: GET `/notebooks`.
- `create-notebook`: POST `/notebooks` with a safe title/description.
- `list-sources`: GET `/sources`, optionally scoped by notebook.
- `ingest-text`: POST `/sources/json` with `type=text`.
- `ingest-url`: POST `/sources/json` with `type=link`; only `http` and `https` URLs without embedded credentials are accepted.
- `upload-file`: multipart POST `/sources`; local files must be under the allowed roots and below the byte limit.
- `source-status`: GET `/sources/{source_id}/status`.
- `search`: POST `/search` for text/vector search.
- `ask`: POST `/search/ask`; requires explicit strategy, answer, and final-answer model ids.
- `list-notes`: GET `/notes`.
- `create-note`: POST `/notes` with `note_type=human`.
- `citation-map`: read-only synthesis from `/sources` and `/notes`, returning source ids/titles/statuses suitable for Mission Control evidence and artifact citation maps.

## Safety controls

- No delete endpoints are exposed.
- No arbitrary API path or shell passthrough is exposed.
- Secrets are loaded from environment or root-readable files and redacted from JSON output.
- File uploads require an allowlisted local root and size check.
- URL ingestion rejects non-http(s) schemes and credential-bearing URLs.
- Source deletion after upload is always disabled by the wrapper.
- Mutating actions remain local to the configured Open Notebook backend; publishing or external customer delivery still requires separate approval gates.

## Harmless verification

If an Open Notebook dev runtime is available:

```bash
python3 scripts/open_notebook_wrapper.py health
python3 scripts/open_notebook_wrapper.py create-notebook --title "HMC wrapper smoke test" --description "Harmless dev notebook"
python3 scripts/open_notebook_wrapper.py ingest-text --notebook-id '<notebook-id>' --title 'Harmless dev source' --content 'This is a harmless wrapper verification source for Mission Control.'
python3 scripts/open_notebook_wrapper.py search --query 'wrapper verification' --search-type text --limit 5
python3 scripts/open_notebook_wrapper.py citation-map --notebook-id '<notebook-id>'
```

If credentials/runtime are missing, the wrapper will return a connection/auth error without printing secrets. Block the Kanban card with the exact missing runtime or credential needed.
