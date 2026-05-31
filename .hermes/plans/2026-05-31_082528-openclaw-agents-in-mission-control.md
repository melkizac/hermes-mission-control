# OpenClaw Agents in Mission Control Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add OpenClaw agents into Hermes Mission Control so Melverick can supervise Hermes and OpenClaw coworkers from one Agents page.

**Architecture:** Start with a read-only observability slice. The backend reads OpenClaw state from `/root/.openclaw` and normalizes it into the existing Mission Control `Agent` shape, then the frontend roster can show `Hermes Agent` and `OpenClaw Agent` side-by-side. Message sending into OpenClaw is intentionally deferred until the correct OpenClaw invocation/API path is verified.

**Tech Stack:** Python backend `/opt/hermes-mission-control/app.py`, React/TypeScript frontend under `/opt/hermes-mission-control/source/src`, OpenClaw local files under `/root/.openclaw`, existing Mission Control CSS/design tokens.

---

## Context discovered

OpenClaw local state exists under:

- OpenClaw root: `/root/.openclaw`
- Main agent root: `/root/.openclaw/agents/main`
- Session index: `/root/.openclaw/agents/main/sessions/sessions.json`
- Session JSONL files: `/root/.openclaw/agents/main/sessions/*.jsonl`
- Trajectory JSONL files: `/root/.openclaw/agents/main/sessions/*.trajectory.jsonl`
- Auth/profile metadata:
  - `/root/.openclaw/agents/main/agent/auth-state.json`
  - `/root/.openclaw/agents/main/agent/auth-profiles.json`
- Tasks DB: `/root/.openclaw/tasks/runs.sqlite`
- Cron state: `/root/.openclaw/cron/jobs-state.json`
- Cron runs: `/root/.openclaw/cron/runs/*.jsonl`
- Workspace and KB:
  - `/root/.openclaw/workspace/kb`
  - `/root/.openclaw/workspace/tmp-kronos`
  - `/root/.openclaw/workspace/options-flow-tracker`

The current Mission Control Agents page already treats Hermes CLI, Telegram, and Web UI as channels of one `Hermes Agent`. OpenClaw should not be merged into that same row. It should appear as a separate coworker/runtime.

---

## Product decision

Recommended first slice:

- Add **OpenClaw Agent** as a second top-level row in the existing Agents roster.
- Keep it **read-only** initially.
- Show OpenClaw sessions, skills, runtime path, workspace, and task/cron evidence.
- Do not wire the composer to OpenClaw yet.

Future slice:

- Add controlled send/delegate into OpenClaw once the correct CLI/API invocation is verified.
- Later support routing: Hermes, OpenClaw, Codex/Claude/OpenCode via OpenClaw ACP.

---

## UX target

### Agents roster

Show at least:

1. `Hermes Agent`
   - Source: Hermes
   - Channels: Telegram, CLI, Web UI/API
   - Current behavior unchanged.

2. `OpenClaw Agent`
   - Source: OpenClaw
   - Runtime path: `/root/.openclaw/agents/main`
   - Sessions from OpenClaw JSONL/session index
   - Skills from OpenClaw runtime/session snapshot
   - Workspace: `/root/.openclaw/workspace`

### Center panel for OpenClaw

Display recent OpenClaw conversation/timeline entries:

- user/assistant messages parsed from JSONL where possible
- source badges such as Telegram, CLI, Cron, ACP/subagent where present
- latest session context
- honest empty/error states if parsing fails

### Right details drawer for OpenClaw

Tabs should reuse existing detail drawer grammar:

- **Overview**: runtime path, latest session, status, auth profile, source/channel
- **Sessions**: session id, started/updated time, channel, JSONL path
- **Skills**: OpenClaw skills from `skillsSnapshot` in `sessions.json` or session files
- **Workspace**: key workspace folders and KB path
- **Runs / Tasks**: optional first slice from tasks DB / cron state if easy

---

## Implementation tasks

### Task 1: Add backend OpenClaw file readers

**Objective:** Safely read OpenClaw agent metadata without changing runtime state.

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Steps:**
1. Define constants near existing Hermes constants:
   - `OPENCLAW_HOME = Path(os.environ.get('OPENCLAW_HOME', HOME / '.openclaw'))`
   - `OPENCLAW_AGENT_ROOT = OPENCLAW_HOME / 'agents' / 'main'`
   - `OPENCLAW_SESSIONS_DIR = OPENCLAW_AGENT_ROOT / 'sessions'`
   - `OPENCLAW_SESSIONS_INDEX = OPENCLAW_SESSIONS_DIR / 'sessions.json'`
   - `OPENCLAW_TASKS_DB = OPENCLAW_HOME / 'tasks' / 'runs.sqlite'`
   - `OPENCLAW_CRON_STATE = OPENCLAW_HOME / 'cron' / 'jobs-state.json'`
2. Add helper `read_json_file(path, default)` if not already available.
3. Add helper `openclaw_sessions_index()` returning parsed sessions index or `{}`.
4. Add helper `openclaw_latest_sessions(limit=10)`:
   - derive session file paths from `sessions.json`
   - sort by `updatedAt`, `lastInteractionAt`, or file mtime
   - include id, sessionFile, channel/source, updatedAt, authProfileOverride
5. Ensure all file reads are best-effort and never throw to the request handler.

**Verification:**

Run a small Python snippet or hit a temporary local endpoint after Task 2. Expected: OpenClaw metadata is returned even if some files are missing.

---

### Task 2: Normalize OpenClaw into the existing Agent payload

**Objective:** Create `openclaw_agent_payload()` matching the frontend `Agent` type.

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Implementation notes:**

Return a payload shaped like:

```python
{
  'id': 'openclaw-main',
  'name': 'OpenClaw Agent',
  'squad': 'OpenClaw Runtime',
  'initials': 'OC',
  'color': '#8b5cf6',
  'model': auth_profile_or_runtime_label,
  'status': 'idle' or 'working' or 'error',
  'activity': latest_session_summary,
  'lastActive': rel_time(latest_ts),
  'profilePath': str(OPENCLAW_AGENT_ROOT),
  'uptime': 'local OpenClaw runtime',
  'sessionCount': len(sessions),
  'skills': [...],
  'files': [],
  'messages': [...],
  'artifacts': openclaw_workspace_artifacts(),
  'tasks': openclaw_tasks_summary(),
  'insightSummary': 'Showing read-only OpenClaw state from /root/.openclaw...',
  'insightStatus': 'Read-only'
}
```

Status heuristic:

- `error` if `/root/.openclaw` or sessions index missing
- `working` if latest session update is within a short recent window
- `idle` otherwise

Skills heuristic:

- Prefer `skillsSnapshot.skills` in `/root/.openclaw/agents/main/sessions/sessions.json`
- Deduplicate by name
- Mark source as `openclaw`

Messages heuristic:

- Parse latest session JSONL lines if straightforward.
- Include only user/assistant style readable content.
- Redact secrets using existing `redact_text()` / `preview_content()` helpers.
- If JSONL schema is not obvious, show system messages with session IDs and file paths rather than fake messages.

**Verification:**

Run:

```bash
curl -fsS -u admin:$(cat /opt/hermes-mission-control/.basic-password) http://127.0.0.1:19080/api/agents | python3 -m json.tool
```

Expected:

- array includes `Hermes Agent`
- array includes `OpenClaw Agent`
- `OpenClaw Agent.id == openclaw-main`
- no stack traces or raw secrets

---

### Task 3: Merge OpenClaw into `/api/agents`

**Objective:** Show both Hermes and OpenClaw from the existing Agents page without a new nav item.

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Steps:**
1. Update `list_agents_payload()` from:

```python
return [agent_payload('default')]
```

To something like:

```python
agents = [agent_payload('default')]
oc = openclaw_agent_payload()
if oc:
    agents.append(oc)
return agents
```

2. Update `GET /api/agents/<id>` path handling:
   - if id is `openclaw-main`, return `openclaw_agent_payload()`
   - otherwise use existing Hermes `agent_payload()`
3. Keep POST `/api/agents/<id>/messages` guarded:
   - for `openclaw-main`, return `405` or a clear JSON error like `OpenClaw sending is not wired yet; read-only observability is enabled.`

**Verification:**

- `/api/agents` returns two agents.
- `/api/agents/openclaw-main` returns only OpenClaw agent.
- POST to `/api/agents/openclaw-main/messages` does not accidentally execute OpenClaw.

---

### Task 4: Adjust frontend composer for read-only agents

**Objective:** Prevent confusing send UX for OpenClaw until command routing is implemented.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/components/ChatThread.tsx`
- Possibly modify: `/opt/hermes-mission-control/source/src/types.ts`

**Options:**

Minimal path:

- If `agent.id === 'openclaw-main'`, disable composer and show placeholder:
  - `OpenClaw is connected in read-only mode. Command routing will be added after runtime invocation is verified.`

Better typed path:

- Add optional `readOnly?: boolean` or `runtime?: 'hermes' | 'openclaw'` to `Agent` type.
- Backend includes `readOnly: true` for OpenClaw.
- ChatThread disables send if `agent.readOnly`.

**Verification:**

- Hermes composer still sends normally.
- OpenClaw composer is disabled with clear text.
- No TypeScript errors.

---

### Task 5: Improve OpenClaw details in ContextPanel

**Objective:** Make OpenClaw inspectable, not just visible in the roster.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/components/ContextPanel.tsx`
- Possibly modify: `/opt/hermes-mission-control/source/src/types.ts`

**Steps:**
1. Reuse existing detail fields where possible:
   - profilePath shows `/root/.openclaw/agents/main`
   - skills tab shows OpenClaw skills
   - tasks tab shows task/cron summaries
   - artifacts tab shows workspace files
2. Add source/runtime label if a generic field exists.
3. Avoid special styling drift; preserve Mission Control drawer look.

**Verification:**

- OpenClaw Details drawer opens.
- Skills render without breaking Hermes details.
- Long paths wrap/truncate cleanly.

---

### Task 6: Build, deploy, and verify live

**Objective:** Ship the read-only OpenClaw Agents integration safely.

**Commands:**

```bash
cd /opt/hermes-mission-control/source
npm run build
rm -rf /opt/hermes-mission-control/dist/*
cp -a /opt/hermes-mission-control/source/dist/. /opt/hermes-mission-control/dist/
systemctl restart hermes-mission-control.service
systemctl is-active hermes-mission-control.service
```

**Browser verification:**

Use Playwright or browser automation to confirm:

- Agents nav loads.
- Roster contains `Hermes Agent` and `OpenClaw Agent`.
- Selecting `OpenClaw Agent` updates center panel.
- Details drawer opens for OpenClaw.
- OpenClaw composer is clearly read-only.
- Hermes send flow still works, including the animated processing indicator.
- Browser console has no page errors.

---

## Risks and constraints

- Do not execute OpenClaw commands in the first slice.
- Do not expose raw secrets from auth files, sessions, env files, or tool payloads.
- OpenClaw session JSONL schema may vary; parse defensively.
- Do not create separate pseudo-agents for every channel unless OpenClaw exposes real independent agents.
- Keep Hermes channel unification intact.

---

## Future phase: sending to OpenClaw

Before implementing send:

1. Inspect installed OpenClaw CLI/API invocation path.
2. Determine whether OpenClaw supports a safe app-server or session spawn endpoint.
3. Decide whether Mission Control should:
   - start a new OpenClaw session,
   - append to an existing session,
   - spawn an ACP subagent through OpenClaw,
   - or route via a local queue/approval layer.
4. Add approval guardrails for destructive commands.
5. Show the same pending/processing indicator pattern already added to Hermes Web UI sends.

---

## Suggested commit message

```bash
git add /opt/hermes-mission-control/app.py /opt/hermes-mission-control/source/src
# Include exact changed files once implemented.
git commit -m "feat: surface OpenClaw agent in Mission Control"
```
