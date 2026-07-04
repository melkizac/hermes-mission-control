# Hermes Mission Control

Hermes Mission Control is Melverick's control plane for operating a Hermes-based AI workforce.

Hermes is the worker/runtime layer. **Mission Control is the management, audit, governance, and trust layer**: the operator cockpit that makes autonomous work visible, accountable, interruptible, and reviewable across chats, agents, projects, task boards, routines, runtime connectors, browser sessions, approvals, evidence, costs, and audit logs.

Live service: `https://hermes.melverick.com`

## What Mission Control helps Melverick do

Mission Control is designed to answer four operator questions:

| Question | Mission Control answer |
|---|---|
| **What needs me now?** | Approval gates, blockers, failed routines, runtime warnings, quota/cost alerts, and human-owned tasks. |
| **What is running?** | Active chats, agent tasks, project missions, routines, research runs, browser sessions, runtime connectors, and desktop/gateway readiness. |
| **What did agents produce?** | Task results, files, drafts, links, screenshots, browser evidence, run traces, comments, artifacts, and final evidence records. |
| **Can I trust it?** | Approval policy, execution boundaries, account-sensitive action gates, source context, audit logs, model/cost telemetry, rollback notes, and proof-of-work evidence. |

## Current capability map

### 1. Operator command center

- **Chat-first command center** for giving Melkizac plain-language instructions without pre-selecting Goal/Project/Mission/Task terminology.
- **Attachment-aware requests** for documents, images, and data files up to the configured 50 MB composer guard.
- **Permission mode selection** (`Full access`, `Ask permission`, `Draft only`) so the operator can constrain the next request before it is routed.
- **Model selection / AUTO routing context** so requests can carry a model preference while still allowing policy-aware routing.
- **Project and mission context** that can be attached to chat instructions when the work belongs to an existing project.
- **Mobile / Telegram deep-link handoff** for task, approval, agent, and task-result contexts.

### 2. AI workforce and agent operations

- **Agent chat surfaces** for profile-backed conversations with specialist agents.
- **Pinned/recent project chat sessions** in the navigation rail so active work can be resumed quickly.
- **Agent Org / AI Workforce map** showing digital coworker responsibilities, goals, queues, outputs, permissions, and health.
- **Agent detail drawers** for role, operating context, capabilities, and runtime status.
- **Agent voice / standalone voice entry point** for the voice interaction surface.
- **Shared agent template and platform-agent admin surfaces** for multi-agent workforce administration.

### 3. Projects, goals, missions, and task execution

Mission Control uses this canonical work model:

```text
Intent → Project → Goal → Mission → Tasks → Outputs / Evidence

If repeatable:
Goal → Workflow → Routine → Runs
```

- **Projects** act as folders / operating spaces for related goals, missions, tasks, files, evidence, routines, agents, and context.
- **Delegate Work** turns a plain instruction into a routed project/agent task.
- **Task Board** is the operational queue for agent-owned work, Melverick-owned decisions, blockers, comments, result review, artifacts, approval gates, and next actions.
- **Task result and evidence views** expose what happened, what was produced, which links/files matter, and what the operator should do next.
- **Operations / Work Hub surfaces** consolidate active operational workflows and automation entry points.

### 4. Approvals, governance, and auditability

- **Needs Attention / Approvals** queue for human-in-the-loop approve/reject decisions.
- **Approval policy surfaces** for external-facing, destructive, costly, account-sensitive, or policy-sensitive actions.
- **Capability governance** that can require approval gates, smoke evidence, rollback notes, health checks, and per-agent assignment before a tool/app/service is trusted.
- **Audit / Runs Activity** for inspecting important operational traces, events, errors, retries, and evidence.
- **Result evidence links / evidence records** for screenshots, final URLs, source links, build/test output, generated artifacts, approval records, and task comments.
- **Admin-only permission boundaries** so workspace operators and platform admins see different surfaces.

### 5. Runtime connectors, desktop gateway, and browser operations

- **Runtime Connectors** show readiness, connector registration, heartbeat/status, execution boundaries, and runtime event ingestion.
- **Desktop Gateway admin** documents Windows/local execution readiness without pretending that unconfigured real local-PC access is available.
- **Browser Activity / Browser Operations** show browser sessions, current domain/URL, screenshot slots, action logs, account-sensitive flags, stop/takeover controls, approval-before-submit/post/send/purchase boundaries, and final evidence.
- **Browser runtime event bridge** accepts lifecycle events from browser workers and merges them into Mission Control visibility.
- **Reusable browser producer client** (`scripts/browser_runtime_producer.py`) lets Browserbase, Playwright, or desktop-browser jobs publish screenshots, action logs, final evidence, and stop/takeover polling data.
- **Safe funnel-check probes and jobs** can inspect public website forms without submitting, capture evidence, create/update Task Board tasks, and stop at approval gates before sensitive actions.
- **Production connector configuration gate** keeps real Browserbase, desktop-browser, and Windows gateway credentials redacted and blocked until explicit approval and dry-run connectivity checks pass.

### 6. Workflows, routines, and automation governance

- **Workflow Library / Workflow Templates Admin** for packaged repeatable workflows such as lead intake, LinkedIn/content operating loops, research-to-deliverable work, and website funnel checks.
- **Routine Governance / Automations** for Hermes cron jobs, schedules, paused/enabled state, latest run status, outputs, and controls.
- **Website Funnel Check routine flow** supports safe target registries, paused recurring bindings, explicit enablement after approval, run-now dry runs, evidence drill-down, and history counts while preserving `NO_SUBMIT` safeguards.
- **Webhook/event-driven workflow support** is documented through the connector and routine model.

### 7. Research, knowledge, files, and deliverables

- **Research Run Monitor** tracks parallel research lanes, evidence, confidence, blockers, synthesis status, and operator-created wide research missions.
- **Research-to-deliverable workflow** converts chat-detected source Q&A, decks, reports, proposals, revisions, and status requests into Projects, task graphs, sources, outputs, blockers, approvals, and editable artifacts.
- **Second Brain / Workspace Knowledge** provides the Karpathy-style LLM Wiki and source context browser.
- **Files / File System** surfaces workspace files and supports file inspection/editing through governed UI affordances.
- **Memory, Skills, Tools, Plugins, Reflections** expose the reusable context, procedures, integrations, and learning surfaces behind the AI workforce.

### 8. Capabilities and owned-app operations

- **Capability Registry** manages OSS/package/service/owned-app capabilities with assignment, approval, smoke evidence, health, rollback, and disable flows.
- **Owned App Capability Standard** covers first-party/operated apps such as Mission Control, Nexius Academy, SGQR/PayNow tools, lead dashboards, and other governed Melverick/Nexius properties.
- **Tools Hub, Skills Hub, Plugins Hub** show available tools, procedural skills, and extension points for agents.
- **Connector/runtime boundaries** clarify which tools are server-side, browser-based, desktop-local, simulated/demo, or blocked pending configuration.

### 9. Admin, users, costs, and model routing

- **Admin Console** centralizes platform setup and runtime governance.
- **Users & Workspaces** supports the multi-user/workspace control-plane model.
- **Workspace Runtime Console** separates runtime readiness from governance/control-plane decisions.
- **Costs / Usage and Usage Remaining** expose model usage, limits, quota, and cost telemetry.
- **Model Router** supports account/model routing policy, allow-listing, and cost-aware route planning.
- **Settings / Profile** manage operator-level preferences and workspace/account configuration surfaces.

## Important safety boundaries

- Secrets, API keys, passwords, session cookies, gateway tokens, and connection strings must stay out of the repository and chat logs.
- Production-affecting external actions such as posting, sending, submitting forms, deleting resources, rotating live secrets, changing DNS, or spending money must go through approval gates.
- Real Browserbase, desktop-browser, or Windows gateway execution is intentionally gated behind connector configuration, redacted credentials, approval, and dry-run readiness checks.
- Demo readiness, simulated browser sessions, and dummy Windows targets must never be described as real local-PC access.
- Live hotfixes should be captured in GitHub promptly through a narrow commit/PR, with build/test/browser evidence and rollback notes.

## Detailed operator documentation

| Document | Purpose |
|---|---|
| [`docs/HERMES_MISSION_CONTROL.md`](docs/HERMES_MISSION_CONTROL.md) | Main operator documentation and phased capability history. |
| [`docs/CAPABILITY_REGISTRY_OPERATOR_GUIDE.md`](docs/CAPABILITY_REGISTRY_OPERATOR_GUIDE.md) | Adding capabilities, assigning agents, approval gates, smoke evidence, rollback, and disable procedures. |
| [`docs/OWNED_APP_CAPABILITY_SPEC.md`](docs/OWNED_APP_CAPABILITY_SPEC.md) | Standard for governed first-party apps and owned operational systems. |
| [`docs/RUNTIME_CONNECTOR_V2.md`](docs/RUNTIME_CONNECTOR_V2.md) | Runtime connector registration, heartbeat, and event ingestion. |
| [`docs/AI_WORKFORCE_TEAM_MAP.md`](docs/AI_WORKFORCE_TEAM_MAP.md) | Melkizac/default and specialist-agent role map, ownership, handoff, and approval boundaries. |
| [`docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md`](docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md) | Research/source-Q&A/deck/report/proposal workflow SOP. |
| [`docs/AGENT_OS_ROLLOUT_OPERATOR_GUIDE.md`](docs/AGENT_OS_ROLLOUT_OPERATOR_GUIDE.md) | Agent OS rollout status, verification checklist, rollback notes, and known limitations. |
| [`docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md`](docs/ADMIN_PLATFORM_MULTI_RUNTIME_DESIGN.md) | Multi-user, multi-workspace, multi-runtime admin platform design. |

## Quick local development

```bash
cd /opt/hermes-mission-control/source
npm install
npm run dev          # http://localhost:5173
npm run build        # production frontend bundle in source/dist
```

The React app can run against `MockHermesClient` for UI-only work. The deployed Mission Control backend is `/opt/hermes-mission-control/app.py`, and the live static bundle is served from `/opt/hermes-mission-control/dist`.

## Production verification commands

```bash
cd /opt/hermes-mission-control/source
python3 -m py_compile /opt/hermes-mission-control/app.py
python3 -m pytest tests -q
npm run build
systemctl is-active hermes-mission-control.service
```

Before any live restart, check active processing state:

```bash
cat /opt/hermes-mission-control/processing-requests.json
```

## Sharing the repository

A source snapshot is safe to share when generated from the GitHub repository after confirming no secrets are present. Prefer a ZIP/source archive when the recipient only needs the current code and does not need git history. A git bundle includes history and should be shared only when commit history is useful.
