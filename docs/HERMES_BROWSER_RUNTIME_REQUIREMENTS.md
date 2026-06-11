# Hermes Browser Runtime Requirements

This document defines the safe first product slice for a Hermes Browser Runtime managed through Hermes Mission Control (HMC). It adapts the useful persistent-browser ideas from the governed software-factory plan into the HMC model: Project → Tasks → Evidence, scoped agent permissions, auditability, and explicit human handoff.

Related artifacts:

- `docs/plans/2026-06-11-hmc-governed-software-factory.md`
- `docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md`
- Kanban task `t_c2349940`

## Product outcome

HMC should let an operator supervise browser-backed work without turning the browser into an unmanaged remote-control surface.

The first slice should support:

1. persistent browser context for approved HMC workflows;
2. per-agent/per-task tab isolation;
3. safe operator handoff when human login, approval, or judgment is required;
4. scoped runtime tokens and least-privilege browser actions;
5. audit records for browser actions, page domains, screenshots/artifacts, and handoff decisions;
6. domain/browser learnings that improve future workflows without storing raw cookies, passwords, or sensitive page contents by default.

## Non-goals and hard boundaries

These are explicitly out of scope for the initial product slice:

- No raw business-account cookie import by default.
- No copying browser profile directories from a human's personal browser into Hermes by default.
- No internet-exposed browser control surface.
- No unauthenticated WebSocket/VNC/CDP endpoint.
- No generic "browse as the user" mode across all accounts/domains.
- No silent posting, purchasing, financial action, account setting changes, credential changes, or destructive operations without a visible approval gate.
- No persistent storage of passwords, MFA codes, session cookies, or full page dumps in Kanban comments, evidence metadata, frontend state, screenshots, or logs.
- No bypassing website terms, anti-bot controls, access controls, paywalls, or rate limits.
- No browser automation against third-party assets unless Melverick/Nexius owns the account or has authorization to operate it.

## Users and operating modes

### Operator

The operator is the human supervising the work in HMC. The operator can:

- start an approved browser-backed workflow;
- view current browser task status and evidence;
- take over when login/MFA/judgment is required;
- approve or reject a proposed browser action;
- stop, archive, or reset a browser task context;
- inspect browser audit history and generated artifacts.

### Agent/runtime

The agent/runtime can:

- open pages within its assigned tab group/context;
- read page text and accessibility tree through approved browser tools;
- click/type only inside an approved workflow boundary;
- produce summaries, screenshots, DOM probes, and structured findings as evidence;
- request operator handoff when login, external posting, irreversible actions, or sensitive workflows appear.

The agent/runtime must not:

- reuse another agent's tabs or authenticated context;
- export cookies/tokens;
- expose browser control ports outside localhost or the internal runtime boundary;
- continue after a handoff-required condition unless the operator approves the continuation.

## Persistent browser sessions

### Requirements

A persistent browser session should be represented as a managed HMC runtime resource, not as a raw browser profile path.

Required fields for a managed browser session:

| Field | Purpose |
| --- | --- |
| `browser_session_id` | Stable runtime identifier. |
| `project_id` / `tenant` | HMC Project/Task Board grouping. |
| `task_id` | Task that owns the session. |
| `agent_id` / `profile` | Agent/profile allowed to control it. |
| `mode` | `observe`, `assist`, or `act-with-approval`. |
| `allowed_domains` | Domain allowlist for the task. |
| `created_at` / `last_active_at` | Audit and cleanup timing. |
| `ttl` / `expires_at` | Prevents abandoned privileged sessions. |
| `handoff_state` | `none`, `requested`, `operator-active`, `returned`, `expired`. |
| `evidence_policy` | Screenshot/text/log retention choices. |
| `secret_policy` | Confirms no raw cookies/passwords are exported. |

Session persistence must be scoped to the HMC task/project. It should preserve useful browser continuity such as tabs, local workflow navigation, and runtime-side state, but it must not make raw browser account cookies portable between unrelated tasks or agents.

### Session lifecycle

1. `created`: Browser context is allocated for a task and linked to Project/Task evidence.
2. `active`: Agent is using allowed domains/actions.
3. `handoff_requested`: Agent hits login/MFA/sensitive decision/action boundary.
4. `operator_active`: Human operates inside a guarded handoff channel.
5. `returned`: Human returns control with an optional note and scope confirmation.
6. `completed`: Task evidence is stored and runtime is stopped or archived.
7. `expired`: TTL reached; context is stopped and privileged state is invalidated where possible.

## Operator handoff

Operator handoff is required when the browser task reaches one of these conditions:

- Login, MFA, CAPTCHA, consent prompt, or account recovery.
- A page requests personal, financial, payment, employee, customer, or legally sensitive information.
- A proposed action would post, submit, send, purchase, delete, change settings, authorize access, or otherwise create an external side effect.
- The domain is outside the task allowlist.
- The agent detects a privacy/security warning, browser download, file upload, unknown extension prompt, or suspicious redirect.

Handoff UI requirements:

- Show Project, task, agent, browser session id, current domain, and requested human action.
- Explain why handoff is required in operator language.
- Let the operator choose: `take over`, `approve one step`, `return to agent`, `stop session`, or `mark blocked`.
- Capture an audit note when control is returned.
- Never display or persist raw cookies, passwords, or MFA values in HMC.

## Per-agent tab isolation

The runtime must isolate browser work at least by agent and task.

Minimum isolation model for the pilot:

- One browser context per `task_id + agent_id` pair.
- One named tab group per task, with all actions tagged by tab id and domain.
- No cross-agent tab discovery by default.
- No shared clipboard, downloads, uploads, or local files unless the task explicitly grants a workspace path.
- Handoff controls must return control to the same task/agent context, not a global browser.

Future stronger isolation options:

- Containerized browser per task.
- Ephemeral context per domain plus separate persistent evidence store.
- Browser broker service that exposes only high-level actions, not CDP/VNC directly.

## Scoped tokens and permissions

A Browser Runtime should use scoped HMC runtime tokens rather than long-lived shared secrets.

Token requirements:

- Issued per browser session or task.
- Bound to `project_id`, `task_id`, `agent_id`, allowed domains, allowed action classes, and TTL.
- Stored server-side or in root/profile-only files, never in frontend local storage as a bearer credential for broad runtime control.
- Redacted in API responses, logs, audit records, screenshots, and DOM.
- Revocable when a task completes, is blocked, or is reassigned.
- Not accepted from arbitrary origins; backend should require authenticated HMC session plus CSRF/origin protection for mutations.

Permission classes:

| Class | Examples | Default |
| --- | --- | --- |
| `observe` | screenshot, accessibility snapshot, text extraction, console read | Allowed for approved task domains. |
| `navigate` | open allowed URL, back/forward, reload | Allowed with domain allowlist. |
| `interact` | click, type, select, upload from approved workspace | Requires task permission and audit. |
| `external_effect` | submit/post/send/purchase/delete/settings change | Approval Gate required. |
| `credential_boundary` | login/MFA/password/cookie/account recovery | Human handoff required; no secret persistence. |
| `admin_runtime` | create/revoke tokens, expose ports, reset contexts | Admin-only. |

## Audit log and evidence

Every browser-backed task should produce evidence compatible with the HMC workflow evidence model in `docs/HMC_SOFTWARE_FACTORY_WORKFLOW.md`.

Required audit fields:

| Field | Purpose |
| --- | --- |
| `browser_session_id` | Runtime session. |
| `project_id` / `tenant` / `task_id` | HMC linkage. |
| `agent_id` / `profile` | Actor. |
| `timestamp` | SGT display in UI; ISO in records. |
| `action_type` | observe/navigate/interact/handoff/approval/stop/error. |
| `domain` / `url_redacted` | Origin evidence without leaking sensitive query params. |
| `tab_id` | Isolation trace. |
| `selector_or_target_redacted` | Enough to debug, not secrets. |
| `artifact_paths` | Screenshots, downloaded reports, generated summaries. |
| `approval_id` / `handoff_id` | Links to Approval Gate or Task Board blocker. |
| `result` | passed/blocked/failed/skipped. |
| `risk_flags` | login, PII, payment, external-effect, off-domain, download, upload. |

Evidence storage in the first slice should use task comments/result metadata with structured `hmc.workflow_evidence.v1` blocks. A first-class browser audit table/endpoint can come later when retention, filtering, and concurrent writes justify it.

Do not store:

- raw cookies or browser storage;
- passwords or MFA values;
- full unredacted page HTML;
- screenshots of secret-bearing pages unless the operator explicitly captures and accepts the risk;
- raw customer/lead/financial records unless the task requires it and retention is defined.

## Domain/browser learnings

The runtime may record safe, reusable browser learnings that improve future task execution:

- stable public URLs and navigation paths;
- safe selectors for public/non-sensitive controls;
- known login boundary indicators;
- approval-required action markers;
- rate-limit or anti-automation warnings;
- download/export flow notes;
- known blocked domains or off-limits actions.

Learnings must be scoped by domain, project, and confidence level. They should not include credentials, account-specific cookies, private page contents, raw contact lists, or screenshots of sensitive data.

Recommended learning record:

```json
{
  "schema": "hmc.browser_learning.v1",
  "domain": "example.com",
  "project_id": "hmc-governed-software-factory",
  "source_task_id": "t_c2349940",
  "kind": "login_boundary|safe_selector|approval_boundary|download_flow|warning",
  "summary": "Operator handoff required when MFA screen appears after email submit.",
  "confidence": "observed-once|validated|stale",
  "last_observed_at": "2026-06-11T16:54:18+08:00",
  "sensitive": false
}
```

## Threat and safety notes

### Main risks

1. Session hijack: a leaked browser token, CDP endpoint, VNC port, or profile directory could grant account access.
2. Cross-agent contamination: one agent may see or act through another agent's authenticated tabs.
3. Silent external actions: browser automation could publish, send, buy, delete, or change settings without human review.
4. Secret capture: screenshots, logs, DOM snapshots, selectors, downloads, or audit metadata may leak credentials or private records.
5. Overbroad persistence: keeping browser profiles alive too long increases blast radius.
6. Web-origin attacks: malicious pages may try to trick the browser runtime or HMC frontend into unsafe navigation, downloads, clipboard use, or token exfiltration.
7. Internet-exposed control: exposing CDP/VNC/browser-control endpoints publicly is equivalent to exposing an account-control plane.
8. Compliance drift: browser evidence can accidentally store PII or customer data beyond the task's need.

### Required mitigations

- Bind browser contexts to task + agent + domain scope.
- Keep browser control endpoints on localhost/internal service boundaries only.
- Require authenticated HMC session plus CSRF/origin checks for browser mutations.
- Use short-lived, revocable scoped tokens.
- Gate external-effect actions through Approval Gates.
- Trigger operator handoff for credential/MFA/payment/admin boundaries.
- Redact URLs, DOM, logs, screenshots, and artifact filenames where needed.
- Use TTL cleanup for browser contexts and tokens.
- Record audit events for all navigation, interaction, handoff, approval, and stop actions.
- Store browser learnings as sanitized domain knowledge, not account state.
- Default to observe/assist before act-with-approval.

## Safe pilot using existing Hermes browser tools

The first pilot should use existing Hermes browser tools and HMC task evidence before adding a long-running browser daemon.

### Pilot scope

Use an HMC Project/Task Board task to run a browser-assisted workflow in `observe` mode:

- Launch/use the existing Hermes browser automation session for one approved task.
- Restrict the task to allowed public or operator-owned domains.
- Capture accessibility snapshots, selected screenshots, console errors, and final findings.
- Route login/MFA/external-effect moments to a Task Board blocker or Approval Gate instead of continuing automatically.
- Store structured evidence in the task comment/result metadata.

Good pilot candidates:

- HMC UI QA browser smoke checks.
- Public documentation/source review.
- Nexius/HMC owned website verification with no login-required writes.
- Form-flow dry runs that stop before final submit.

Bad pilot candidates:

- LinkedIn live posting/commenting.
- Banking, payment, brokerage, payroll, or personal finance sites.
- Admin setting changes in third-party SaaS.
- Any workflow requiring raw cookie import.

### Pilot acceptance criteria

- Operator can see which Project/task owns the browser session.
- Browser evidence includes visited domains, high-level actions, screenshots or DOM checks where useful, and console/page errors when applicable.
- Any login/MFA/external-effect condition blocks or requests approval.
- No raw cookies, passwords, MFA codes, or private browser profile paths are stored.
- Browser session is stopped or expired at task end.
- Follow-up implementation work is represented as narrow, auditable cards.

## Implementation roadmap

### Slice 1: Requirements and evidence contract

Status: this document.

Deliverable:

- Browser Runtime requirements artifact.
- Threat/safety notes.
- Safe pilot proposal.

Verification:

- Commit the document.
- Run docs/source-safe checks.
- No production deploy.

### Slice 2: Browser session registry API (narrow)

Purpose: make browser sessions visible without granting broad control.

Proposed backend endpoints:

- `GET /api/browser-sessions` — list redacted session summaries.
- `GET /api/browser-sessions/<id>` — detail with audit summary and artifacts.
- `POST /api/browser-sessions/<id>/stop` — admin/task-owner stop action.

Constraints:

- Read-only list/detail first.
- Stop action only; no arbitrary browse/control action.
- Admin/task-owner permission checks.
- Redacted tokens/URLs.

### Slice 3: Task evidence integration

Purpose: make browser evidence useful in existing Project/Task drawers.

Scope:

- Parse browser evidence from `hmc.workflow_evidence.v1` comments/metadata.
- Show browser artifacts under Task Board drawer Sources/Evidence.
- Show handoff/approval state in the Overview.

### Slice 4: Operator handoff prototype

Purpose: safe human-in-the-loop handoff.

Scope:

- Add handoff request object and UI card.
- Support `take over`, `return to agent`, `stop session`, and `mark blocked`.
- Do not expose CDP/VNC publicly.
- Keep credentials outside logs/evidence.

### Slice 5: Controlled action broker

Purpose: allow approved high-level browser actions without raw endpoint exposure.

Scope:

- Server-side action broker validates session token, task, domain, action class, and approval state.
- External-effect actions require Approval Gate reference.
- Audit every action.

## Follow-up implementation card recommendation

The next implementation card should be narrow:

Title: `Build: Browser session registry read-only API`

Acceptance criteria:

- Add a redacted `/api/browser-sessions` list and detail endpoint backed by current/placeholder browser session evidence.
- Include fields: session id, project/task/agent, mode, allowed domains, status, handoff state, last activity, artifact count, risk flags.
- Do not add remote browser control actions beyond an authorized stop/reset stub.
- Add tests or API probes proving secrets/tokens are redacted.
- Surface the data in a Task Board or Project drawer only after API behavior is verified.

## Rollback notes

This requirements slice is documentation only. Rollback is to revert the commit adding `docs/HERMES_BROWSER_RUNTIME_REQUIREMENTS.md`. It does not deploy production code, modify databases, create browser sessions, expose ports, import cookies, or change live HMC behavior.
