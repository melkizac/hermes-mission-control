# Bring Paperclip Functions into Hermes Mission Control Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Bring the most useful Paperclip capabilities from `agents.melverick.com` into `hermes.melverick.com` in a safe, Hermes-native order.

**Architecture:** Do not copy Paperclip wholesale. Rebuild the useful product functions as thin Hermes Mission Control features backed by real Hermes data: `~/.hermes/state.db`, `~/.hermes/cron/jobs.json`, profile directories, skills tree, gateway/API server, logs, and existing `/api/*` endpoints in `/opt/hermes-mission-control/app.py`. Keep the current Mission Control app shell and add focused pages one function at a time.

**Tech Stack:** Python stdlib HTTP backend in `/opt/hermes-mission-control/app.py`; React + TypeScript + Vite frontend in `/opt/hermes-mission-control/source/src`; deployed by building Vite and serving `/opt/hermes-mission-control/dist` through `hermes-mission-control.service` on `127.0.0.1:19080`.

---

## Current Context

### Paperclip functions observed

Paperclip has these major functions:

1. Multi-company/workspace control plane.
2. Agents roster and agent detail pages.
3. Projects / project workspaces.
4. Issues / task board / issue tree control.
5. Goals.
6. Routines / automations.
7. Approvals and inbox.
8. Activity log / audit trail.
9. Costs dashboard.
10. Skills management.
11. Secrets management.
12. Environments and execution workspaces.
13. Plugins and adapters.
14. Access control, invites, user profiles, resource memberships.
15. Instance settings and database backups.
16. Dashboard/live status.
17. Assets and org chart.

### Hermes Mission Control current state

Verified current files:

- Backend: `/opt/hermes-mission-control/app.py`
- React app: `/opt/hermes-mission-control/source/src/App.tsx`
- Nav: `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- Client boundary: `/opt/hermes-mission-control/source/src/services/hermesClient.ts`
- HTTP client: `/opt/hermes-mission-control/source/src/services/httpHermesClient.ts`
- Types: `/opt/hermes-mission-control/source/src/types.ts`

Current UI already has these sections:

- Mission Control dashboard.
- Agents.
- Approvals.
- Placeholder Task Board.
- Placeholder Skills Hub.
- Placeholder Automations.
- Placeholder Audit Log.
- Placeholder Settings.

That means the fastest value is to convert existing placeholders into real pages before adding totally new navigation.

---

## Priority Decision

Build in this order:

1. **Audit Log / Activity History** first.
2. **Automations / Routines** second.
3. **Task Board / Issues** third.
4. **Skills Hub** fourth.
5. **Costs dashboard** fifth.
6. **Projects / Workspaces** sixth.
7. **Approvals+Inbox expansion** seventh.
8. **Settings / Secrets / Models** eighth.
9. **Profiles / Access / Company layer** ninth.
10. **Plugins / Adapters / Environments / Backups** last.

Why Audit Log first:

- It is the trust layer for everything else.
- It uses data Hermes already has: sessions, messages, tool-call counts, costs, logs.
- It makes all future automation safer because the user can inspect what happened.
- It is less risky than secrets, access control, plugins, or execution environments.
- Paperclip's strongest transferable product idea is visibility into autonomous work; Mission Control should adopt that first.

---

## Phase 1: Audit Log / Activity History

**Paperclip analogue:** Activity, agent runs, approvals history, cost/run trace.

**Hermes-native version:** A searchable run history showing sessions, source channel/profile, model, tool calls, tokens, cost, status, preview, and detail drawer with message/tool timeline.

### Task 1: Add backend endpoint for session history

**Objective:** Expose real Hermes sessions as an audit feed.

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`
- Test manually with: `curl -u admin:<password> http://127.0.0.1:19080/api/audit/sessions`

**Implementation notes:**
- Reuse `STATE_DB = ~/.hermes/state.db`.
- Query `sessions` ordered by `started_at desc`.
- Include: id, title, source, model, started_at, ended_at, message_count, tool_call_count, input_tokens, output_tokens, estimated_cost_usd.
- Add filters: `limit`, `source`, `q`.

**Verification:**
- Endpoint returns JSON list.
- No secrets from message content are exposed by default.
- Empty state is honest if database unavailable.

### Task 2: Add backend endpoint for one session trace

**Objective:** Expose drill-down details for a selected session.

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Implementation notes:**
- Route: `/api/audit/sessions/<session_id>`.
- Return session metadata and ordered messages.
- Redact or truncate very long message content.
- Include role, timestamp, summary/preview, and whether tool calls occurred if the schema has that data.

**Verification:**
- Select a known session id from Task 1 and fetch detail.
- Confirm tool messages do not dump sensitive command output wholesale.

### Task 3: Add frontend types and client methods

**Objective:** Create stable TypeScript models for audit data.

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/types.ts`
- Modify: `/opt/hermes-mission-control/source/src/services/hermesClient.ts`
- Modify: `/opt/hermes-mission-control/source/src/services/httpHermesClient.ts`

**Add types:**
- `AuditSession`
- `AuditSessionDetail`
- `AuditMessage`

**Add methods:**
- `listAuditSessions(filters?)`
- `getAuditSession(id)`

**Verification:**
- `npm run build` typechecks.

### Task 4: Replace Audit placeholder with real page

**Objective:** Turn `view === "audit"` from a placeholder into a Paperclip-style run history page.

**Files:**
- Create: `/opt/hermes-mission-control/source/src/views/AuditLog.tsx`
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`

**UI requirements:**
- Hero: `AUDIT TRAIL`, title `Audit Log`.
- Metrics: total sessions, active/recent, tool calls, tokens/cost.
- Search/filter row: query, source, model/status if available.
- Session table/cards: title, source, model, started time, status, messages, tools, tokens, estimated cost.
- Right drawer or inline detail panel for selected run.
- Detail timeline: messages/tool steps in chronological order.

**Verification:**
- Public page loads at `https://hermes.melverick.com` after deploy.
- Audit Log nav opens real data.
- Selecting a run opens details.

---

## Phase 2: Automations / Routines

**Paperclip analogue:** Routines, scheduled workflows, plugin jobs.

**Hermes-native version:** Cron job dashboard backed by `~/.hermes/cron/jobs.json` plus controls for pause/resume/run where safe.

### Task 5: Extend cron backend endpoint

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Implementation notes:**
- Current `get_cron_jobs()` exists; expand it into `/api/automations`.
- Include job id, name, schedule, enabled, state, next_run_at, last_run_at, last_status, skills, deliver target, model/provider if present.

**Controls:**
- Initially read-only.
- Add POST controls only after read-only UI is verified:
  - run now
  - pause
  - resume

**Verification:**
- `curl /api/automations` returns actual LinkedIn daily workflow and other cron jobs if present.

### Task 6: Replace Automations placeholder

**Files:**
- Create: `/opt/hermes-mission-control/source/src/views/Automations.tsx`
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`
- Modify client/types as needed.

**UI requirements:**
- Hero: `AI AUTOMATIONS`.
- Automation cards: enabled toggle/status, schedule, last run, next run, last status, attached skills, delivery target.
- Actions: `Run Now` first; pause/resume later.
- Honest error states if scheduler data missing.

**Verification:**
- Known cron jobs show accurately.
- No fake numbers.

---

## Phase 3: Task Board / Issues

**Paperclip analogue:** Issues, issue tree, workspaces, board claim, agents working on tasks.

**Hermes-native version:** A board from Hermes Kanban if configured, otherwise a session/task-derived queue from active sessions and cron outputs.

### Task 7: Discover board source

**Files:**
- Inspect Hermes Kanban storage/config from current install.
- Check `hermes kanban` CLI availability and board paths.

**Decision:**
- If Hermes Kanban board exists, use it directly.
- If not, build MVP from sessions with statuses: active, recent, blocked/error from logs, done.

### Task 8: Add `/api/tasks` backend

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Fields:**
- id, title, status, owner/profile/source, updatedAt, summary, evidence link/session id.

### Task 9: Replace Task Board placeholder

**Files:**
- Create: `/opt/hermes-mission-control/source/src/views/TaskBoard.tsx`
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`

**UI requirements:**
- Columns: Queued, Running, Blocked, Done.
- Cards link to Audit Log session detail.
- Filters by profile/source.

**Verification:**
- Board uses real data; no synthetic cards.

---

## Phase 4: Skills Hub

**Paperclip analogue:** Company skills.

**Hermes-native version:** Installed Hermes skills browser with readiness, category, source, and where-used hints.

### Task 10: Add `/api/skills` backend

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Implementation notes:**
- Scan `~/.hermes/skills` and optionally profile skill trees later.
- Parse frontmatter lightly: name, description, tags/category if available.
- Include file path, source, editable/custom vs bundled if detectable.

### Task 11: Replace Skills Hub placeholder

**Files:**
- Create: `/opt/hermes-mission-control/source/src/views/SkillsHub.tsx`
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`

**UI requirements:**
- Search by name/description/category.
- Cards/rows with skill name, description, category, source, path.
- Read-only first.
- Later add open/view and install/remove controls.

**Verification:**
- Shows installed LinkedIn skills, Hermes skills, and user-created skills.

---

## Phase 5: Costs Dashboard

**Paperclip analogue:** Costs.

**Hermes-native version:** Token/cost dashboard from session DB.

### Task 12: Add `/api/costs` backend

**Files:**
- Modify: `/opt/hermes-mission-control/app.py`

**Metrics:**
- Cost last 24h / 7d / 30d.
- Tokens by model.
- Tool calls by source/profile.
- Most expensive recent sessions.

### Task 13: Add Costs section

**Files:**
- Modify: `/opt/hermes-mission-control/source/src/types.ts`
- Modify: `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- Modify: `/opt/hermes-mission-control/source/src/App.tsx`
- Create: `/opt/hermes-mission-control/source/src/views/Costs.tsx`

**Verification:**
- Cost totals match session DB aggregates.

---

## Phase 6: Projects / Workspaces

**Paperclip analogue:** Companies, projects, project workspaces.

**Hermes-native version:** Context hubs for Melverick/Nexius workflows, backed initially by local KB and known repos instead of Paperclip's project DB.

### Task 14: Define Hermes project model

**Suggested entities:**
- Project id/name/status.
- Source path: repo, KB folder, Obsidian note folder, or external URL.
- Linked sessions.
- Linked automations.
- Linked skills.
- Recent activity.

### Task 15: Add `/api/projects` read-only backend

**Sources to consider:**
- `/root/.openclaw/workspace/kb/wiki`
- Known repos/workflows from memory.
- Optional project config file under `/opt/hermes-mission-control/projects.json`.

### Task 16: Add Projects page

**UI requirements:**
- Project Hub pattern: status, recent activity, linked automations, linked knowledge, linked sessions.

**Verification:**
- Nexius/Melverick KB projects show with real source paths.

---

## Phase 7: Approvals + Inbox Expansion

**Paperclip analogue:** Approvals and inbox dismissals.

**Hermes-native version:** A unified queue for proposed outbound posts/messages, risky automation outputs, and manual review items.

### Task 17: Audit existing Approvals implementation

**Files:**
- Read `/opt/hermes-mission-control/source/src/views/Approvals.tsx`
- Read approval handlers in `/opt/hermes-mission-control/app.py`

### Task 18: Add durable local approval store if needed

**Design:**
- JSON or SQLite store under `/opt/hermes-mission-control/approvals.db` or `~/.hermes/mission-control/approvals.json`.
- Each item has source, proposed action, body, risk, status, decision, decided_at.

### Task 19: Upgrade UI to Inbox pattern

**UI requirements:**
- Drafted / ready / approved / rejected tabs.
- Edit before approve.
- Source evidence and provenance.

**Verification:**
- Can approve/reject test local items without touching external platforms.

---

## Phase 8: Settings / Secrets / Models

**Paperclip analogue:** Secrets, LLMs, instance settings.

**Hermes-native version:** Read-only status first, then safe edit controls.

### Task 20: Settings read-only page

**Data:**
- Hermes API health.
- Gateway running.
- Model list from `/v1/models`.
- Config path and env path, without printing secret values.
- Toolset/skill availability if easy.

### Task 21: Safe model/config controls

**Only after read-only is stable:**
- Change default model via Hermes CLI command wrapper.
- Restart gateway button with confirmation.
- Never expose raw secrets in the browser.

---

## Phase 9: Profiles / Access / Company Layer

**Paperclip analogue:** Companies, access, invites, users, org chart.

**Hermes-native version:** Profiles and connected platforms, not SaaS tenants.

### Task 22: Profile manager

**Data:**
- `hermes profile list` output.
- Profile paths under `~/.hermes/profiles/<name>`.
- Active default profile.

**Controls later:**
- Create profile.
- Clone profile.
- Assign skills.

### Task 23: Access model decision

Since this is your private VPS Mission Control, do not blindly copy Paperclip's user/invite model.

Recommended first version:
- Keep current Basic Auth.
- Add read-only page showing auth mode and allowed access.
- Only add multi-user invites if you want team members to use the dashboard directly.

---

## Phase 10: Plugins / Adapters / Environments / Backups

**Paperclip analogue:** Plugin manager, adapters, execution environments, database backups.

**Hermes-native version:** Later-stage admin surfaces.

Why last:
- Highest risk.
- Needs more security controls.
- Less immediate operational value than audit, automations, task board, skills, and costs.

Possible future pages:
- MCP servers/adapters page from `hermes mcp list`.
- Toolsets page from `hermes tools list`.
- Backup/export page for `~/.hermes` selected files.
- Environment/workspace page for active services and ports.

---

## Files Likely to Change Across the Migration

Backend:
- `/opt/hermes-mission-control/app.py`

Frontend app routing/nav:
- `/opt/hermes-mission-control/source/src/App.tsx`
- `/opt/hermes-mission-control/source/src/components/NavRail.tsx`
- `/opt/hermes-mission-control/source/src/types.ts`
- `/opt/hermes-mission-control/source/src/services/hermesClient.ts`
- `/opt/hermes-mission-control/source/src/services/httpHermesClient.ts`

New views:
- `/opt/hermes-mission-control/source/src/views/AuditLog.tsx`
- `/opt/hermes-mission-control/source/src/views/Automations.tsx`
- `/opt/hermes-mission-control/source/src/views/TaskBoard.tsx`
- `/opt/hermes-mission-control/source/src/views/SkillsHub.tsx`
- `/opt/hermes-mission-control/source/src/views/Costs.tsx`
- `/opt/hermes-mission-control/source/src/views/Projects.tsx`
- `/opt/hermes-mission-control/source/src/views/Settings.tsx`

Optional backend data stores:
- `/opt/hermes-mission-control/approvals.db` or `~/.hermes/mission-control/approvals.json`
- `/opt/hermes-mission-control/projects.json`

---

## Standard Validation for Every Function

For each function/page:

1. Backend endpoint test:
   - `curl -u admin:<password> http://127.0.0.1:19080/api/<feature>`

2. Frontend build:
   - `cd /opt/hermes-mission-control/source && npm run build`

3. Deploy static build:
   - Copy build output to `/opt/hermes-mission-control/dist` if the build process does not already do it.

4. Restart service:
   - `systemctl restart hermes-mission-control.service`

5. Service status:
   - `systemctl is-active hermes-mission-control.service`

6. Local smoke test:
   - `curl -I http://127.0.0.1:19080/`

7. Public smoke test:
   - Open or curl `https://hermes.melverick.com`.

8. Browser verification:
   - Confirm page loads with real data.
   - Confirm no console errors.
   - Confirm empty/error states are honest.

---

## Risks and Guardrails

1. Do not expose secrets.
   - Settings and secrets pages must show presence/status only, never raw values.

2. Do not copy Paperclip's multi-company model directly.
   - Hermes profiles and projects are the better fit for this VPS.

3. Keep controls read-only before mutation.
   - First ship visibility, then add buttons for run/pause/resume/edit.

4. Avoid fake dashboard data.
   - If data source does not exist, show setup guidance or an empty state.

5. Keep Mission Control lightweight.
   - The current backend is a stdlib Python server. Avoid adding heavy dependencies unless there is a strong reason.

6. Use auditability as a prerequisite.
   - Any feature that triggers agent work should link back to Audit Log.

---

## Recommended First Implementation Slice

Start with Phase 1 only:

1. `/api/audit/sessions`
2. `/api/audit/sessions/<id>`
3. `AuditLog.tsx`
4. Wire `view === "audit"` to the new page.
5. Build, restart, and verify on `hermes.melverick.com`.

This gives immediate operator value and creates the foundation for every other Paperclip-inspired function.
