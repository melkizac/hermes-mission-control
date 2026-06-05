# Mission Control Outstanding Build Plan

Saved for future continuation after the browser/runtime/mobile hardening checkpoint.

## Current checkpoint status

The core delegation/runtime/browser/mobile foundation is largely shipped:

- Phase 0 — Foundation primitives: shared evidence/artifact/result/approval primitives and drawer/result UI patterns.
- Phase 1 — Delegate Work: front-door work delegation, task creation, and routing into Mission Control.
- Phase 2 — Artifact/evidence result view: Task Board result drawer, artifacts, evidence, approval gates, and next actions.
- Phase 3 — Packaged SME workflows: Workflow Library and SME workflow launch into Task Board/result contracts.
- Phase 4 — Runtime Readiness: runtime/desktop gateway readiness surfaces; Windows-local remains blocked until real gateway details exist.
- Phase 5 — Browser operation visibility: Browser Activity, session cards/drawer, current domain/site, screenshot evidence, action log, status, risk/account-sensitive indicators, approval boundary, stop/takeover controls, final evidence slots, safe browser probe path, and blocked production submit/post/send/purchase.
- Phase 6 — Mobile operator hardening: mobile responsiveness, deep links for task/approval/agent/result contexts, Telegram/operator handoff links.
- Browser runtime safety track through Phase 25: connector gate, safe NO_SUBMIT probe, probe history/archive, evidence drill-through, production enablement policy, and explicit “ready for supervised dry-runs, not account-sensitive autonomy” status.

## Outstanding roadmap

### 1. Phase 7 — Wide Research / parallel agent runs

Goal: let Mission Control orchestrate many workers for research or batch tasks with visible progress and consolidation.

Outstanding capabilities:

- Launch a parallel research/batch mission from UI.
- Choose topic or item list, worker count, source constraints, output format, cost/time cap, and consolidation agent.
- Show worker lanes/progress.
- Show partial outputs.
- Show failures/retries.
- Produce final consolidated report.
- Attach citations/evidence.
- Convert findings into Task Board actions.

Planned API shape:

```text
POST /api/parallel-runs
GET /api/parallel-runs/<id>
GET /api/parallel-runs/<id>/children
```

Current note: Some Research Runs visibility may exist, but the full “launch parallel mission → monitor workers → consolidate output → convert findings to tasks” loop is still outstanding.

### 2. Phase 8 — Workflow-specific model compare

Goal: make model evaluation operational, not a generic playground.

Outstanding capabilities:

- Pick a workflow.
- Compare two or more models on that actual workflow.
- Score quality, cost, latency, instruction following, structured output validity, brand fit, tool reliability, and hallucination/risk.
- Show side-by-side outputs.
- Save recommendation into Model Router / workflow routing policy.
- Keep comparison history per workflow.

Planned API shape:

```text
POST /api/model-compare
GET /api/model-compare/<id>
POST /api/model-router/policies
```

Current note: model routing may exist, but workflow-specific benchmark/evaluation evidence is still outstanding.

### 3. Phase 9 — Team collaboration around tasks/artifacts

Goal: move Mission Control from single-operator cockpit into team operations.

Outstanding capabilities:

- Comment on task/result/approval.
- Assign human or agent.
- Request changes.
- Mention collaborator.
- See decision/activity history.
- Shared review links with auth boundaries.
- Notifications/delivery hooks later.

Planned API shape:

```text
GET/POST /api/tasks/<id>/comments
POST /api/tasks/<id>/assign
POST /api/results/<id>/request-changes
```

### 4. Phase 10 — Unified intake from Telegram/email/forms

Goal: convert external signals into structured Mission Control work.

Outstanding capabilities:

- One Intake queue for Telegram requests, email tasks, website form leads, Supabase lead captures, meeting transcripts, and manual Delegate Work submissions.
- Classify each item into task, approval gate, project update, workflow launch, or FYI/evidence.
- Route intake items into Task Board / Workflow Library / Approvals.
- Deduplicate similar signals.
- Preserve source provenance.

Planned API shape:

```text
GET /api/intake
POST /api/intake/<id>/route
```

This is especially relevant for Nexius lead ops, Telegram operator requests, and website funnel/lead capture workflows.

### 5. Phase 11 — Public/demo storytelling page

Goal: explain and sell Mission Control without exposing private runtime data.

Outstanding capabilities:

- Safe public/demo route boundary.
- Marketing/demo landing page.
- Feature tour.
- Screenshot/demo-data mode only.
- Privacy/data-boundary explanation.
- SME-friendly explanation: “Hermes is the worker layer. Mission Control is the management, audit, and trust layer.”

Acceptance requirements:

- no private runtime data
- no secrets
- no finance data
- no private tasks/logs
- understandable to SME clients

### 6. Phase 26 — Supervised production connector enablement policy

This is intentionally separate from the canonical 0–11 roadmap because production browser execution is safety-sensitive.

Still not enabled:

- Browserbase production actions
- desktop-browser production actions
- Windows-local browser execution
- LinkedIn/account-sensitive browser flows
- submit/post/send/purchase automation
- account-sensitive autonomy

Recommended constraints:

- one connector only
- one safe public target only
- keep NO_SUBMIT
- require operator approval before every external action
- no LinkedIn/account-sensitive domains yet
- verify stop/takeover under real connector execution

### 7. Checkpoint/archive/commit

Before starting another major phase, create a checkpoint archive or commit because many phases have accumulated source changes across frontend, backend, docs, tests, scripts, and live deployment.

Outstanding housekeeping:

- create checkpoint archive or commit
- capture current tested state
- preserve recovery point before starting Phase 7 or Phase 26

## Recommended next options

### Option A — Continue product roadmap

Next phase: Phase 7 — Wide Research / parallel agent runs.

Best if the goal is for Mission Control to manage multi-agent research and batch work.

### Option B — Harden runtime/browser execution

Next phase: Phase 26 — Supervised production connector enablement.

Best if the goal is to move from safe browser dry-runs toward real controlled browser execution.

### Option C — Freeze and package

Next phase: checkpoint archive + documentation/demo packaging.

Best if the goal is a stable recovery point and a clean explanation of what has been built before continuing.

## Continuation rule

When resuming this plan, first load the `agent-mission-control-ui` skill and inspect current repo/live state. Do not assume phase completion from this plan alone; verify with focused tests, full pytest, frontend build, service status, and browser/API smoke checks.
