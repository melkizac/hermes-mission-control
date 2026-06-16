# Hermes Mission Control

Hermes Mission Control is the operator cockpit for Melverick's Hermes-based digital coworker system.

Hermes is the worker layer. **Mission Control is the management, audit, and trust layer**: the control room that makes autonomous agent work visible, accountable, governable, and trustworthy instead of scattered across chats, cron jobs, Kanban records, browser sessions, runtime logs, and tool traces.

## What Mission Control does

Mission Control helps an operator answer:

- **What needs me now?** Approval gates, blockers, failed routines, and runtime warnings.
- **What is running?** Active agents, tasks, browser sessions, routines, and runtime connectors.
- **What did agents produce?** Task results, artifacts, screenshots, links, evidence, and audit traces.
- **Can I trust it?** Human-in-the-loop approvals, proof of work, execution boundaries, source data, and cost telemetry.

## Major revamp status

The current build includes the phased Mission Control revamp through Browser Activity and mobile/deep-link hardening:

- **Mission Control** — daily operator cockpit for attention, running work, outputs, system health, and next actions.
- **Delegate Work** — front door for routing a plain instruction into a project/agent task.
- **Workflow Library** — packaged SME workflows such as Nexius Academy lead intake and LinkedIn content operating loop.
- **Task Board** — operational queue for agent tasks, human-only tasks, blockers, comments, result review, artifacts, evidence, approval gates, and next actions.
- **Needs Attention / Approval Gates** — human-in-the-loop queue for approve/reject decisions before external-facing, destructive, costly, or policy-sensitive actions.
- **Agents** — profile-backed agent chat and runtime context.
- **Agent Org / AI Workforce** — registry-backed digital coworker map with goals, flows, queues, outputs, permissions, and health.
- **Routines** — Hermes cron jobs with schedule, status, outputs, and controls.
- **Browser Activity** — browser session visibility with current domain/URL, screenshot slot, action log, account-sensitive and approval indicators, stop/takeover controls, and final evidence.
- **Runtime Connectors / Desktop Gateway** — runtime readiness, connector tokens, execution boundaries, and delayed Windows-local enablement.
- **Workspace Knowledge / Second Brain** — Karpathy-style LLM Wiki and source context browser.
- **Audit / Evidence** — session/run trace inspection backed by Hermes state.
- **Costs / Model Router** — usage visibility and cost-aware model routing policy.
- **Mobile / Telegram handoff** — deep links for task, approval, agent, and task-result contexts.

## Detailed operator documentation

The major-revamp documentation is here:

```text
docs/HERMES_MISSION_CONTROL.md
```

The Capability Registry operator SOP is here:

```text
docs/CAPABILITY_REGISTRY_OPERATOR_GUIDE.md
```

It explains how admins add OSS projects and package/service capabilities, how agents receive capabilities, how approval gates and smoke evidence work, and how to rollback or disable a capability.

The Owned App Capability Standard is here:

```text
docs/OWNED_APP_CAPABILITY_SPEC.md
```

It defines `source_type: owned_app` for first-party/operated apps such as NetWorth Tracker, Mission Control, Nexius Academy site/funnel, SGQR/PayNow tools, and lead dashboards, including manifest schema, approvals, evidence, audit, health, rollback, and Mission Control display rules.

The Melkizac research-to-deliverable operator SOP is here:

```text
docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md
```

It explains how Melkizac detects learning/source-Q&A/deck/report/proposal/revision/status intents from chat, creates Projects and Task Board graphs, processes sources, handles blockers/approvals, and returns editable artifacts with evidence.

The Agent OS rollout, admin verification, and rollback guide is here:

```text
docs/AGENT_OS_ROLLOUT_OPERATOR_GUIDE.md
```

It records the verified rollout evidence, day-to-day operator flow, admin checks, DB/migration notes, rollback plan, and known limitations for the intelligent operating layer.

## Canonical work terminology

Use this simple relationship when explaining or designing Mission Control work:

```text
Project = the folder / operating space
Goal = the desired result
Mission = the campaign/run to achieve the result
Task = the individual action
Evidence = proof it happened
```

Example:

```text
Project: Nexius Academy Course Growth
Goal: Increase qualified AI course signups
Mission: Run this month’s signup campaign
Tasks: Check funnel, draft posts, monitor leads, prepare follow-up
Evidence: Screenshots, drafts, lead records, approval trail
```

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

Before any live restart, check:

```bash
cat /opt/hermes-mission-control/processing-requests.json
```

## Safety notes

- Do not print or commit passwords, API keys, tokens, session cookies, or connection strings.
- Real Windows-local execution is not enabled until `WINDOWS_HERMES_GATEWAY_URL`, token, approved folders, and a connection probe are configured.
- Demo readiness and simulated browser/Windows sessions must not be described as real local-PC access.
- External submit/post/send/purchase actions should go through approval gates.
