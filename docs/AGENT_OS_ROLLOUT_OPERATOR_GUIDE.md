# Agent OS Rollout Operator Guide

Last verified: 2026-06-08 20:46 SGT
Live service: `https://hermes.melverick.com`
Local service: `http://127.0.0.1:19080`
Source workspace: `/opt/hermes-mission-control/source`
Runtime app: `/opt/hermes-mission-control/app.py`
Production frontend bundle: `/opt/hermes-mission-control/dist`
Project tenant: `project:agent-os-intelligent-operating-layer`

This guide documents how to operate, administer, verify, and roll back the Agent OS intelligent operating layer in Hermes Mission Control.

Hermes is the worker layer. Mission Control is the management, audit, and trust layer. Agent OS is the chat-triggered operating layer that turns plain instructions into visible Projects, Missions, Task Board work, Routines, Approval Gates, Evidence, and artifact handoffs.

No secrets, tokens, passwords, session cookies, signed URLs, or raw private source text belong in this document, task comments, evidence summaries, screenshots, or chat handoffs.

## 1. Rollout status and verified evidence

Current rollout status: deployed and smoke-verified on the live Mission Control service.

Verified evidence from the Agent OS QA gate:

- Branch at QA: `feat/research-to-deliverable-chat-workflow`
- Source commit at QA: `07203a4 fix: label workforce selector as Skills`
- Frontend build source: `/opt/hermes-mission-control/source/dist`
- Live static target: `/opt/hermes-mission-control/dist`
- Static backup before deploy: `/opt/hermes-mission-control/dist.backup-agent-os-20260608123228`
- Service: `hermes-mission-control.service`
- Local listener: `127.0.0.1:19080`
- Focused Agent OS tests: `49 passed in 17.58s`
- Frontend build: `npm run build` passed; Vite chunk-size warning only
- Live API route scenarios: `8/8` passed through authenticated `POST /api/intent/route`
- Intent router spec: `/api/agent-os/intent-router/spec` returned `ok=true` and `fixture_count=28`
- Project visibility: `/api/projects` included `project-agent-os-intelligent-operating-layer`
- Task visibility: `/api/tasks?tenant=project:agent-os-intelligent-operating-layer` returned Agent OS task rows
- Browser QA: desktop Chat, Projects, Task Board, Org Chart, Routines opened with no console/page errors; mobile 390px had no horizontal overflow
- Evidence pack: `/tmp/agent-os-qa-evidence/report.md` and screenshots under `/tmp/agent-os-qa-evidence/`

Known QA caveat: full repository pytest still had unrelated legacy string-contract failures at QA time. Treat the focused Agent OS suite, live API probes, production build, and browser smoke as the Agent OS rollout gate until a separate test-maintenance task reconciles those legacy assertions.

## 2. Operator model

The operator should not think of Agent OS as a standalone app. The default flow is:

```text
User speaks in Chat
→ Agent OS intent router classifies the request side-effect-free
→ Melkizac proceeds, asks a concise clarification, or creates visible work
→ Project / Mission / Task Board / Routine / Approval Gate tracks execution
→ Agents return outputs and evidence back to chat and project drawers
```

The core operator map remains:

```text
Project = the folder / operating space
Goal = the desired result
Mission = the campaign/run to achieve the result
Task = the individual action
Evidence = proof it happened
```

Use Chat as the command surface. Use Projects, Task Board, Org Chart, Routines, Approval Gates, and Audit / Evidence as supervision and governance surfaces.

## 3. Capability coverage

The rollout covers these operator-facing capabilities:

1. Main-chat intent routing through the Agent OS router.
2. Research-to-deliverable sub-intents for learning, source Q&A, summaries, comparisons, decks, reports, proposals, training materials, revisions, source expansion, and status checks.
3. Side-effect-free route preview before mutation.
4. Project and tenant creation/linking for durable work.
5. Dependency-linked Task Board / Kanban graphs for multi-step missions.
6. Project-aware task drawer with Overview, Sources, Tasks, Outputs, Evidence, and Settings concepts.
7. `Needs you` routing for genuine human input only.
8. Approval Gates for external-facing, irreversible, costly, policy-sensitive, destructive, or authority-bound actions.
9. Governed source processing through local parsers or the Open Notebook wrapper when configured.
10. Editable artifact generation through the document artifact generator for PPTX/DOCX-style deliverables when requested.
11. Evidence-gated completion, agent handoffs, subagent run-tree visibility, and realtime runtime refresh so operators can inspect proof rather than trust hidden work.

## 4. Day-to-day operator guide

### 4.1 Starting work from Chat

Use normal language in Mission Control Chat. Example intents:

- “Help me learn this topic and keep the sources for later.”
- “Summarize these uploaded sources.”
- “Compare these papers and give me a cited answer.”
- “Create an editable training deck from these notes.”
- “Generate a proposal draft for this client.”
- “Revise the deck using the new source.”
- “What is the status of the AI Workforce project?”

Expected behavior:

- Low-risk direct questions can be answered in chat.
- Source-based or deliverable work should create/link a Project and visible Task Board graph when confidence and policy allow.
- Ambiguous work should produce a concise clarification or `Needs you` card before mutation.
- External publication, client sending, deletion, production changes, sensitive provider use, and high-cost/long-running work should route through Approval Gates or explicit confirmation.

### 4.2 Reading the intent card

When a route preview or chat action card appears, check:

- Detected intent and research-to-deliverable sub-intent.
- Project selected or proposed.
- Output types requested.
- Sources and attachments detected.
- Permission mode: `Full access`, `Ask permission`, or `Draft only`.
- Model mode: `AUTO` or selected model.
- Whether the card will create a Project, create a Task, launch a Workflow, recommend a Routine, or ask for clarification.
- Evidence and Approval Gate requirements.

If the card is wrong, correct the Project, source, artifact, permission mode, or output type in chat before approving/proceeding.

### 4.3 Tracking work in Projects and Task Board

Use Projects to see the initiative context and Task Board to inspect execution state.

For Agent OS work, filter Task Board by:

```text
tenant = project:agent-os-intelligent-operating-layer
```

For research-to-deliverable projects, expect project-scoped task graphs similar to:

```text
intake_confirm
→ process_sources
→ synthesize_notes
→ draft_outline
→ generate_pptx / generate_docx
→ qa_artifacts
→ deliver_to_chat
```

A task is not complete unless it has evidence appropriate to its work type: test output, build output, API response, screenshot, artifact path, source/citation proof, approval record, or run trace.

### 4.4 Handling `Needs you` and blockers

`Needs you` should be reserved for genuine human input or access gaps. Good blockers are ready-to-act:

- “Upload the source PDF before source processing can start.”
- “Choose the target Project because two matching projects were found.”
- “Approve sending this proposal to the client before external delivery.”
- “Configure Open Notebook base URL before source Q&A can run.”
- “Approve external-provider use for client-sensitive sources.”

Do not create broad approval spam for ordinary internal drafts. Melkizac should choose safe defaults, record them in evidence, and proceed when policy allows.

### 4.5 Reviewing outputs

For any completed Agent OS mission, verify the return card includes:

```text
Project
Status
Outputs / artifacts
Evidence
Approval state
Next action
```

For editable deliverables, prefer editable source artifacts such as PPTX/DOCX/Markdown plus manifest/checksum evidence. PDF can be a convenience export, not the only editable output when editability was requested.

## 5. Admin guide

### 5.1 Important paths

```text
Source workspace:        /opt/hermes-mission-control/source
Backend app:             /opt/hermes-mission-control/app.py
Source build output:     /opt/hermes-mission-control/source/dist
Live static bundle:      /opt/hermes-mission-control/dist
Service:                 hermes-mission-control.service
Agent OS evidence pack:  /tmp/agent-os-qa-evidence/
```

Key documentation:

```text
docs/HERMES_MISSION_CONTROL.md
docs/AGENT_OS_INTENT_ROUTER_SPEC.md
docs/RESEARCH_TO_DELIVERABLE_PROJECT_CONTRACT.md
docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md
docs/OPEN_NOTEBOOK_WRAPPER.md
docs/CAPABILITY_REGISTRY_OPERATOR_GUIDE.md
docs/AGENT_OS_ROLLOUT_OPERATOR_GUIDE.md
```

Key local wrappers:

```text
scripts/open_notebook_wrapper.py
scripts/document_artifact_generator.py
```

### 5.2 Pre-change production checklist

Before changing live Mission Control:

1. Check active processing requests:

```bash
cat /opt/hermes-mission-control/processing-requests.json
```

2. Check service health:

```bash
systemctl is-active hermes-mission-control.service
curl -sS http://127.0.0.1:19080/api/status
```

3. Inspect branch, commit, and dirty files:

```bash
cd /opt/hermes-mission-control/source
git status --short --branch
git log -1 --oneline
```

4. Avoid restarting while live requests are active unless explicitly authorized or the change is urgent.

### 5.3 Build and deployment commands

Normal build verification:

```bash
cd /opt/hermes-mission-control/source
python3 -m py_compile /opt/hermes-mission-control/app.py
python3 -m pytest \
  tests/test_agent_os_intent_router_api.py \
  tests/test_chat_intent_router.py \
  tests/test_agent_os_kanban_project_creation.py \
  tests/test_realtime_runtime_refresh.py \
  tests/test_agent_os_evidence_gates.py \
  tests/test_agent_os_evidence_gates_ui.py \
  tests/test_agent_handoffs.py \
  tests/test_subagent_run_tree.py \
  tests/test_phase2_artifact_evidence_result_view.py \
  tests/test_task_result_evidence.py \
  -q
npm run build
```

Production deploy pattern after verification:

```bash
cd /opt/hermes-mission-control/source
backup="/opt/hermes-mission-control/dist.backup-agent-os-$(date +%Y%m%d%H%M%S)"
cp -a /opt/hermes-mission-control/dist "$backup"
rsync -a --delete /opt/hermes-mission-control/source/dist/ /opt/hermes-mission-control/dist/
systemctl restart hermes-mission-control.service
systemctl is-active hermes-mission-control.service
curl -sS http://127.0.0.1:19080/api/status
```

Do not paste auth cookies, passwords, API keys, or full sensitive API payloads into chat or task comments. When testing authenticated endpoints manually, keep credentials in root-only files or environment variables and report only redacted status fields.

### 5.4 API verification checklist

Authenticated checks should verify:

- `GET /api/status` returns healthy service state.
- `GET /api/agent-os/intent-router/spec` returns `ok=true`, schema fields, intent types, research-to-deliverable sub-intents, decision rules, and fixture count.
- `POST /api/intent/route` returns side-effect-free route decisions for one-time answer, task, project, workflow, routine recommendation, handoff, and evidence-query prompts.
- Low-confidence/clarification routes do not create tasks, projects, workflows, routines, approvals, files, or external messages.
- `GET /api/projects` includes Agent OS and any newly created project containers.
- `GET /api/tasks?tenant=<project tenant>` includes dependency-linked work and evidence state.

### 5.5 Browser verification checklist

Use browser automation after deployment or major UI changes:

- Login succeeds without exposing credentials in logs.
- Chat home loads.
- Chat controls render: permission selector, model selector, project selector, composer, submit affordance.
- Representative route cards render for Agent OS prompts.
- Projects page shows the target project.
- Task Board opens horizontally without lane wrapping regressions.
- Task drawer opens and closes without permanently shrinking the primary board.
- Org Chart and Routines open.
- Mobile width around 390px has no document-level horizontal overflow.
- Browser console/page errors are empty.

## 6. DB and migration notes

This documentation task does not introduce a database migration.

The Agent OS rollout uses existing Mission Control and Hermes surfaces:

- Mission Control app DB for auth/workspace/UI-owned records.
- Hermes/Kanban task board records for tasks, comments, events, runs, links, and subscriptions.
- Existing Project and Task Board API payloads for project and tenant visibility.
- Existing session/audit/runtime stores for evidence and run traces.

Operational notes:

- Do not manually edit production SQLite files while the service is running unless there is an emergency and a backup exists.
- Before any manual DB repair, stop the service or use the application APIs/tools where possible.
- Always create a timestamped backup of the affected DB before manual mutation.
- If rolling back only frontend/static behavior, no DB rollback is normally required.
- If rolling back a backend feature after it created projects/tasks, prefer archiving or commenting superseded rows over hard-deleting audit history.
- Hard-delete Kanban history only when the operator explicitly asks for archived rows to disappear from the UI and after a timestamped DB backup.

## 7. Rollback plan

### 7.1 Fast static rollback

Use this when the frontend build regresses but backend behavior is acceptable.

Known Agent OS pre-deploy backup from QA:

```bash
/opt/hermes-mission-control/dist.backup-agent-os-20260608123228
```

Rollback command shape:

```bash
rsync -a --delete /opt/hermes-mission-control/dist.backup-agent-os-20260608123228/ /opt/hermes-mission-control/dist/
systemctl restart hermes-mission-control.service
systemctl is-active hermes-mission-control.service
curl -sS http://127.0.0.1:19080/api/status
```

If a newer deploy created a newer backup, use the backup from immediately before that deploy instead.

### 7.2 Source-code rollback

Use this when backend/frontend source changes need to be reverted.

```bash
cd /opt/hermes-mission-control/source
git status --short --branch
git log --oneline -5
# choose the bad commit or revert range intentionally
git revert <bad-commit-sha>
python3 -m py_compile /opt/hermes-mission-control/app.py
npm run build
```

Then deploy the rebuilt `source/dist` to `/opt/hermes-mission-control/dist` using the deploy pattern above.

Do not use `git reset --hard` on a dirty production workspace unless Melverick explicitly authorizes it and active worker changes have been inspected/backed up.

### 7.3 Disable risky runtime surfaces without full rollback

If a specific Agent OS surface is unhealthy, prefer narrowing capability before reverting everything:

- Keep `/api/agent-os/intent-router/spec` and side-effect-free route preview available for diagnostics.
- Disable or gate task/project/workflow mutation routes if creation behavior regresses.
- Pause or disable affected Routines instead of deleting them.
- Mark affected capability/tool assignments unavailable in the Capability Registry rather than removing history.
- Keep Open Notebook/research backend disabled when credentials/runtime are missing.
- Keep external submit/post/send/share actions blocked behind Approval Gates.

### 7.4 Data cleanup after rollback

If a bad rollout created erroneous projects/tasks:

1. Export or back up the affected Kanban/app DB first.
2. Prefer adding a comment and archiving the rows.
3. Preserve evidence and approval records unless the operator explicitly requests hard deletion.
4. Verify Task Board and Projects APIs no longer show active erroneous rows.
5. Record the cleanup in the rollback task handoff.

## 8. Known limitations and follow-ups

- Full repository pytest was not green at QA time because of unrelated legacy string-contract tests; focused Agent OS tests passed.
- Open Notebook integration depends on configured runtime/access. Missing credentials must become a board-visible blocker, not a silent failure.
- Generated deliverables are only as strong as the provided sources and citation health; source gaps should appear in Evidence or `Needs you`.
- External sharing/publishing remains approval-gated by design.
- Sensitive, confidential, client-sensitive, or restricted sources must not be sent to external providers without recorded approval.
- Real desktop/Windows-local execution remains constrained by runtime connector readiness and explicit approved folders/tokens.
- Browser/runtime evidence should be treated as proof of observed UI/API behavior, not proof of hidden private chain-of-thought.
- Old task/project rows may still exist under historical tenants; reconcile by tenant/project before reporting project status.
- Hard deleting archived Kanban rows is not the default rollback path.

## 9. Incident response checklist

When Agent OS appears broken:

1. Capture exact symptom, route, project, task id, and timestamp.
2. Check `/api/status` and service status.
3. Check browser console/page errors if the issue is UI-visible.
4. Query `/api/agent-os/intent-router/spec` and a side-effect-free `/api/intent/route` scenario.
5. Check Task Board tenant and comments/events for blockers.
6. Confirm whether the issue is route classification, mutation/project creation, task dispatch, artifact generation, approval gate, runtime connector, or rendering.
7. If production is degraded, apply the narrowest rollback/disable path above.
8. Leave a Kanban comment with evidence, commands run, and remaining blocker.

## 10. Safe reporting template

Use this shape in handoffs:

```text
Status: deployed | verified | blocked | rolled back
Scope: <feature/surface>
Evidence: <test result, build output, API response summary, screenshot path, task id>
Production target: <service/path/host>
Rollback: <backup path or revert commit path>
Known limitations: <short list>
Next action: <who does what>
```

Never include secrets, auth cookies, signed URLs, raw private source text, or full sensitive API responses in the report.
