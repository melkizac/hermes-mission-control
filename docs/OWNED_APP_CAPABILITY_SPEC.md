# Owned App Capability Standard

Last updated: 2026-06-08 SGT
Owner: Mission Control / DevOps Builder
Status: Phase 4 adapter path defined and registry-backed

This specification defines `source_type: owned_app` for Mission Control Capability Registry ingestion. It is the standard for representing apps and app-like systems owned or operated by Melverick/Nexius Labs as governed capabilities that agents can discover, request, use, prove, monitor, and roll back safely.

Examples of owned apps include:

- NetWorth Tracker (`mez.melverick.com`) — personal finance dashboard and APIs. This spec must never store or expose private holdings, account balances, raw positions, raw prices, or financial credentials.
- Hermes Mission Control (`hermes.melverick.com`) — operator cockpit, API, UI, task board, approvals, audit/evidence surfaces, and runtime controls.
- Nexius Academy site/funnel (`academy.nexiuslabs.com`) — course pages, lead capture, SkillsFuture/WSQ-style funnel assets, tracking, and conversion evidence.
- Nexius Labs site (`nexiuslabs.com`) — public company site, landing pages, forms, lead dashboards, and content operations.
- SGQR/PayNow tools — internal or public payment/QR-generation utilities and validation scripts.
- Lead dashboards — internal lead review, qualification, reporting, and follow-up surfaces backed by approved data stores.

## 1. Why `owned_app` exists

A Mission Control capability may come from many source types. `owned_app` covers systems where the operator owns or controls the application boundary and the agent may interact with the app as a business system, not only as code or a generic connector.

`source_type: owned_app` means:

- the capability represents a named first-party app, site, dashboard, or product surface;
- Mission Control can track app-specific data boundaries, action policy, health checks, rollback steps, and evidence requirements;
- agents may need both UI/browser actions and API/CLI/backend actions against the same owned system;
- changes or actions may affect real users, leads, payments, financial data, public content, or production operations;
- app-specific governance is required even if the underlying technical access is provided by a tool, plugin, workflow, cron job, or Kanban board.

## 2. Difference from existing source types

| Source type | Represents | Different from `owned_app` |
| --- | --- | --- |
| `skill` | Reusable agent procedure or operating playbook. | A skill tells an agent how to act. An owned app is the governed business system the agent acts on. |
| `tool` / `cli-tool` / `internal-tool` | Callable command, API wrapper, browser tool, or script. | A tool is an execution primitive. An owned app may expose multiple tools/API routes/UI actions and needs app-level policy. |
| `plugin` | Hermes extension that registers tools, prompts, or runtime integrations. | A plugin extends Hermes. An owned app is a target/control surface that may be accessed by plugins but is governed separately. |
| `oss_project` / `github-project` | Third-party or open-source repo/package to evaluate, install, or wrap. | An owned app is first-party/operated by Melverick/Nexius Labs. Upstream supply-chain risk is not the only concern; production/user/data impact is central. |
| `workflow` | Repeatable process template. | A workflow may use an owned app, but the owned app defines system boundaries, action types, evidence, health, and rollback. |
| `cron_job` | Scheduled/routine execution instance. | A cron job may monitor or act on an owned app. The owned app capability defines what the job is allowed to do and how it proves it. |
| `kanban_board` | Durable task/project coordination store. | A board tracks work. An owned app capability describes an operational system and its allowed agent interactions. |

Implementation note: current registry constants may use hyphenated legacy values such as `github-project`. For this standard, the canonical manifest value is snake_case: `owned_app`. Registry ingestion should normalize aliases but persist/display `owned_app`.

## 3. Capability manifest schema

A manifest is the ingestion contract for `owned_app` records. It should be JSON or YAML and stored as metadata, not as executable configuration.

Required top-level fields:

```yaml
schema_version: "owned-app-capability/v1"
source_type: owned_app
id: networth-tracker
name: NetWorth Tracker
owner: Melverick Ng
operator_profile: devops
business_domain: personal-finance
status: active
canonical_url: https://mez.melverick.com
environments: []
sensitivity_levels: []
action_types: []
approval_policy: {}
evidence_requirements: {}
audit_log_requirements: {}
health_checks: []
rollback: {}
mission_control_display: {}
```

### 3.1 Field reference

| Field | Required | Type | Purpose |
| --- | --- | --- | --- |
| `schema_version` | yes | string | Must start at `owned-app-capability/v1`. Allows safe future migrations. |
| `source_type` | yes | string | Must be `owned_app`. |
| `id` | yes | slug | Stable registry key, e.g. `networth-tracker`, `mission-control`, `nexius-academy-funnel`. |
| `name` | yes | string | Operator-facing app name. |
| `owner` | yes | string | Business owner or accountable person/team. |
| `operator_profile` | yes | string | Hermes profile or agent role responsible for operations, e.g. `devops`, `nexius-leads`. |
| `business_domain` | yes | enum/string | `mission-control`, `personal-finance`, `education-funnel`, `payments`, `lead-operations`, `marketing-site`, etc. |
| `status` | yes | enum | `proposed`, `active`, `restricted`, `disabled`, `archived`. |
| `canonical_url` | no | URL | Primary public/internal URL. Omit if app is CLI-only/internal. |
| `source_repo` | no | object | Repo host/path/branch. Do not include tokens. |
| `runtime_paths` | no | array | Server paths, service names, dist/build roots, config paths. Mark sensitive paths. |
| `environments` | yes | array | `production`, `staging`, `local`, `sandbox` with URLs/services and data policy. |
| `data_boundaries` | yes | object | What data may be read, what is forbidden, and how secrets/PII are referenced. |
| `sensitivity_levels` | yes | array | Sensitivity classes present in the app. |
| `action_types` | yes | array | Allowed and gated actions. |
| `approval_policy` | yes | object | Who approves what before an agent acts. |
| `evidence_requirements` | yes | object | Required proof for reads/writes/deployments/monitoring. |
| `audit_log_requirements` | yes | object | Minimum logging fields and retention expectations. |
| `health_checks` | yes | array | Safe probes that establish readiness without leaking secrets. |
| `rollback` | yes | object | Disable, restore, revert, and emergency-stop instructions. |
| `mission_control_display` | yes | object | How the app appears in Capability Registry, Projects, Agents, Task Board, Audit/Evidence, and Health. |

### 3.2 Environment entries

Each environment entry should include:

```yaml
- name: production
  url: https://example.com
  service_name: example.service
  data_policy: real-user-data
  access_mode: browser-and-api
  change_window: approval-required
  notes: Production user-impacting environment.
```

`data_policy` values:

- `synthetic-only`
- `anonymized-data`
- `real-user-data`
- `financial-sensitive`
- `payment-sensitive`
- `public-content`
- `internal-ops`

## 4. Sensitivity levels

Sensitivity levels determine default visibility and approval gates. A single app can contain multiple levels.

| Level | Meaning | Examples | Default handling |
| --- | --- | --- | --- |
| `public` | Already public or safe to display. | Public landing-page copy, public health page. | Agents may read; writes still require content/deploy policy. |
| `internal` | Internal operational context, not public. | Admin dashboards, build logs, task status, non-secret config. | Agents may read if assigned; summarize rather than dump raw logs. |
| `customer_pii` | Personal or contact data. | Lead names, emails, phone numbers, course enquiries. | Read only through approved APIs; redact in chat/evidence; approval for export. |
| `financial_private` | Personal or company finance data. | Portfolio summaries, account names, transaction records, prices, holdings. | Strongest privacy. No raw state in manifests, comments, screenshots, or chat unless explicitly requested by owner. |
| `payment_sensitive` | Payment rails or payment identifiers. | SGQR/PayNow payloads, merchant IDs, payment status. | Require validation evidence and approval before production publish/change. |
| `secret` | Credentials, tokens, private keys, cookies, DB URLs. | API keys, session cookies, Supabase service keys. | Never store raw values in manifest. Store secret reference names/readiness only. |
| `production_control` | Actions can change live service behavior. | Deploy, restart, disable funnel, edit auth, rotate live config. | DevOps gate plus Melverick approval for destructive/high-impact changes. |

Rules:

1. Manifest fields must store secret references, not secret values.
2. Evidence must prove success without exposing sensitive raw data.
3. For NetWorth Tracker, manifests and evidence must not include private holdings, raw financial state, account balances, raw positions, raw price feeds, or credential values.
4. For lead dashboards and course funnels, screenshots/logs must redact or summarize lead PII unless the operator explicitly requests raw lead inspection.

## 5. Action types

Action types define what agents can request or perform. Each action type must declare approval, evidence, audit, and rollback expectations.

| Action type | Description | Examples | Default approval |
| --- | --- | --- | --- |
| `read_status` | Safe status/metadata read. | Health page, version, uptime, count-only metrics. | No approval if assigned and no sensitive raw data. |
| `read_data` | Read app data. | Lead summaries, task rows, finance summaries, course funnel counts. | Approval if PII/finance/payment data may be exposed; otherwise assigned-agent policy. |
| `export_data` | Produce file/report from app data. | CSV lead export, PDF report, financial summary. | Approval required for PII/finance/payment/internal exports. |
| `create_record` | Add a record without external publication. | Add lead note, create task, create draft content. | Usually no approval if reversible and assigned. |
| `update_record` | Modify existing operational records. | Change lead status, edit course page draft, update app config. | Approval required when user-facing, financial, payment, or production-impacting. |
| `delete_record` | Delete/archive records. | Delete test lead, remove draft, purge cache. | Approval required; hard delete requires explicit operator approval and backup evidence. |
| `publish_content` | Make content externally visible. | Site deploy, public course page update, LinkedIn embed, pricing copy. | Approval required unless a pre-approved routine/policy exists. |
| `send_message` | Send outbound communication. | Lead follow-up email/SMS/Telegram. | Approval gate unless explicitly delegated by a workflow policy. |
| `trigger_payment` | Generate, modify, or submit payment-related action. | SGQR/PayNow payload change, payment status action. | Melverick approval required; validation evidence mandatory. |
| `deploy` | Build/copy/restart/release app code. | Deploy Mission Control or Nexius site build. | DevOps approval/evidence; public or risky changes need Melverick approval if not explicitly requested. |
| `restart_service` | Restart/stop/start live service. | `hermes-mission-control.service`, site server. | DevOps may do when task explicitly asks; otherwise check active runs and approval. |
| `change_secrets` | Add/rotate/remove credentials. | API key, DB password, OAuth token. | Explicit approval required. Never print secrets. |
| `change_dns` | Modify DNS/cert/routing. | Hostname changes, TLS routing. | Explicit approval required. |
| `run_destructive` | Irreversible or broad destructive action. | DB truncate, cloud resource deletion, hard purge. | Explicit Melverick approval plus backup/rollback plan. |

## 6. Approval policy

`approval_policy` must be machine-readable enough for Mission Control to route actions to Approval Gates or Task Board items.

```yaml
approval_policy:
  default_mode: ask_before_critical_actions
  approvers:
    owner: Melverick
    devops: Andrej
  rules:
    - match:
        action_types: [read_status]
        sensitivity_levels: [public, internal]
      decision: allow_if_assigned
    - match:
        action_types: [read_data]
        sensitivity_levels: [customer_pii, financial_private, payment_sensitive]
      decision: require_approval
      approver: owner
    - match:
        action_types: [publish_content, send_message, trigger_payment, change_dns, change_secrets, run_destructive]
      decision: require_approval
      approver: owner
    - match:
        action_types: [deploy, restart_service]
        environments: [production]
      decision: require_task_or_explicit_user_request
      approver: devops
  emergency_stop:
    supported: true
    action: disable_capability_and_revoke_assignments
```

Policy decisions:

- `allow_if_assigned` — assigned agent may act without a gate, but must still log evidence.
- `draft_only` — agent may prepare output but not execute.
- `require_approval` — create Approval Gate with approve/reject/edit context.
- `require_task_or_explicit_user_request` — allowed only when a Kanban/task/request explicitly asks for it or an operator approves.
- `deny` — never allow through Mission Control.

## 7. Evidence requirements

Evidence should prove the action happened while minimizing sensitive exposure.

Minimum evidence by action class:

| Action class | Required evidence |
| --- | --- |
| Reads/status | Endpoint URL or command, timestamp, HTTP/status code, redacted result summary. |
| Data reads | Query/filter scope, row counts, redaction statement, no raw sensitive data unless explicitly approved. |
| Data exports | Destination path, checksum, recipient/access policy, redaction/PII classification, approval ID. |
| Record writes | Before/after summary, record ID or stable handle, validation query, rollback path. |
| Public publish/deploy | Git branch/commit if applicable, build output, deploy target, service restart status, browser/API health check, rollback notes. |
| Payment/SGQR | Validation command/output, generated payload hash/ID, approval ID, no secret merchant credentials in logs. |
| Secret changes | Secret reference name, storage location class, verification result, no value. |
| Destructive changes | Backup path/checksum, explicit approval ID, affected scope, restore test or restore procedure. |

Evidence records should support these fields:

```yaml
evidence:
  required: true
  accepted_types:
    - api_response_summary
    - browser_screenshot_redacted
    - build_log
    - deploy_log
    - health_check
    - database_count_check
    - approval_record
    - checksum
  minimum_fields:
    - timestamp_sgt
    - actor
    - action_type
    - target_environment
    - command_or_endpoint
    - result_status
    - redaction_applied
    - rollback_reference
```

## 8. Audit log requirements

Every owned-app action must be reconstructable from Mission Control Audit/Evidence without exposing secrets.

Minimum audit fields:

- `event_id`
- `timestamp_sgt`
- `actor_type`: `human`, `agent`, `routine`, `system`
- `actor_id`
- `capability_id`
- `source_type: owned_app`
- `app_environment`
- `action_type`
- `request_context`: chat/session/task/cron/run ID
- `approval_id` when applicable
- `policy_decision`: allow, draft_only, approval_required, denied
- `tool_or_connector_used`
- `target_resource`: URL/record ID/path, redacted where needed
- `result`: success, failure, blocked, partial, rolled_back
- `evidence_ids`
- `sensitivity_levels`
- `redaction_summary`
- `rollback_reference`
- `error_summary` and retry count when applicable
- `cost_tokens` where model/tool usage is known

Retention guidance:

- Keep metadata/evidence summaries durably.
- Do not persist raw sensitive payloads in the manifest or general audit log.
- Keep raw logs/files only in restricted storage with short retention and explicit paths.

## 9. Health checks

Health checks are safe, repeatable probes that prove app readiness without modifying production state.

Health check types:

| Type | Purpose | Examples |
| --- | --- | --- |
| `http_status` | Public/private URL responds. | `GET /`, `GET /api/status`, `GET /healthz`. |
| `auth_probe` | Login/session or token works without printing token. | `POST /api/login` with secret reference; verify 200 only. |
| `api_read_probe` | Read-only count/metadata query. | lead count, version endpoint, status snapshot. |
| `browser_smoke` | Browser-visible route renders. | Load `/app`, verify title/selector, console has no errors. |
| `service_status` | systemd/container/process health. | `systemctl is-active`, container health. |
| `build_check` | Code builds. | `npm run build`, pytest target, py_compile. |
| `data_freshness` | Dashboard data is not stale. | newest lead timestamp, cron last-run age. |
| `backup_check` | Backups exist before risky action. | DB backup path/checksum. |

Health entries should include:

```yaml
health_checks:
  - id: public-homepage
    type: http_status
    environment: production
    command: curl -fsS https://example.com/
    expected: HTTP 200
    frequency: on_demand
    sensitivity: public
    evidence: status_code_and_timestamp_only
```

## 10. Rollback requirements

Every owned-app capability must define rollback for the app and for the capability assignment itself.

Required rollback fields:

```yaml
rollback:
  disable_capability:
    - Mark capability status `disabled`.
    - Revoke agent assignments.
    - Disable related routines/cron jobs if they depend on the app.
  app_rollback:
    - Revert to previous git commit or deploy bundle.
    - Restore service config from backup if changed.
    - Restart service only after checking active sessions/runs.
  data_rollback:
    - Restore from timestamped backup for DB changes.
    - For irreversible external actions, create compensating follow-up task instead of claiming rollback.
  emergency_stop:
    - Disable UI/API action buttons in Mission Control.
    - Pause routines that can mutate this app.
    - Block new agent tasks using this capability until reviewed.
  verification:
    - Run health checks after rollback.
    - Record rollback evidence and affected scope.
```

Rollback notes must say when rollback is not possible. For example, a sent message, public post, payment submission, or external form submission may require a compensating action instead of reversal.

## 11. Mission Control display model

Owned apps should appear as first-class operational systems, not only hidden registry rows.

### 11.1 Capability Registry

Show:

- source type pill: `Owned App`
- app name, domain, owner, status
- sensitivity chips
- allowed/gated action types
- assigned agents/routines
- health summary and last verified time
- latest evidence and rollback readiness
- links to app URL, repo, Project, Task Board tenant, Audit/Evidence records

### 11.2 Project Hub

If the owned app maps to a business initiative or operating space, create or link a Project:

- NetWorth Tracker → personal app/project, domain `personal-finance`, not shown in default Work-only dashboards unless Personal scope is selected.
- Hermes Mission Control → platform/admin project.
- Nexius Academy site/funnel → work project under Nexius Academy growth/lead operations.
- SGQR/PayNow tools → payments/tooling project with payment-sensitive gates.
- Lead dashboards → lead operations project.

### 11.3 Agents / Agent Org

Show which agents can use the app and at what action level:

- `read_status` only
- `read_data` with redaction
- `draft_only`
- `mutate_records`
- `deploy_restart`
- `admin_control`

Do not imply an agent can control an app unless the registry assignment, tool access, approval policy, and health checks all support it.

### 11.4 Task Board / Needs Attention

Create Task Board items when:

- an app action is blocked by missing access;
- an approval is needed but no approval gate exists yet;
- a health check fails;
- rollback readiness is missing;
- evidence is incomplete;
- a human-only app action is required.

Human tasks must include exact action, target app, link, expected output, and what to report back.

### 11.5 Approval Gates

Create Approval Gate cards for:

- external publication;
- outbound messaging;
- payment/SGQR/PayNow changes;
- finance/PII export;
- production deploy/restart not explicitly requested;
- DNS/secret/destructive operations.

Approval cards must show proposed action, source app, sensitivity level, risk, rollback/compensation note, and evidence that will be captured after approval.

### 11.6 Audit / Evidence

Audit records should be filterable by:

- `source_type = owned_app`
- app ID/name
- action type
- sensitivity level
- actor/agent
- Project/tenant
- approval ID
- evidence result

### 11.7 Health / Dashboard

Dashboard health cards should summarize:

- last successful health check;
- failing probes;
- stale data risks;
- missing credential/access warnings;
- open approvals/blockers;
- routines touching the app;
- rollback readiness.

## 12. Example manifest: NetWorth Tracker

This example intentionally avoids holdings, balances, raw positions, raw prices, account identifiers, API keys, session cookies, and financial state.

```yaml
schema_version: owned-app-capability/v1
source_type: owned_app
id: networth-tracker
name: NetWorth Tracker
owner: Melverick Ng
operator_profile: devops
business_domain: personal-finance
status: restricted
canonical_url: https://mez.melverick.com
source_repo:
  provider: local-git
  path_ref: /opt/networth-tracker
  default_branch: main
  secret_refs: []
runtime_paths:
  - path_ref: /opt/networth-tracker
    purpose: app_source_and_runtime
    sensitivity: financial_private
  - path_ref: systemd:networth-tracker.service
    purpose: production_service
    sensitivity: production_control
environments:
  - name: production
    url: https://mez.melverick.com
    service_name: networth-tracker.service
    data_policy: financial-sensitive
    access_mode: browser-and-api
    change_window: explicit-owner-request-required
  - name: local
    url: http://127.0.0.1:PORT_PLACEHOLDER
    service_name: local-dev
    data_policy: synthetic-or-redacted-only
    access_mode: local-dev
    change_window: devops-task
data_boundaries:
  may_read_without_approval:
    - app_health_status
    - service_active_state
    - public_homepage_status
    - version_or_build_metadata
  approval_required_to_read:
    - financial_summaries
    - account_or_asset_metadata
    - transaction_or_price_data
  never_store_in_manifest_or_general_audit:
    - private_holdings
    - raw_financial_state
    - account_balances
    - raw_positions
    - raw_price_feed_payloads
    - credential_values
    - session_cookies
  secret_refs:
    - name: NETWORTH_TRACKER_ENV_FILE
      purpose: root-only runtime env file path/reference
      value_stored_here: false
sensitivity_levels:
  - internal
  - financial_private
  - secret
  - production_control
action_types:
  - type: read_status
    allowed_for_assigned_agents: true
    approval: none
    evidence: status_code_or_service_state_only
  - type: read_data
    allowed_for_assigned_agents: false
    approval: owner_required
    evidence: redacted_summary_only
  - type: export_data
    allowed_for_assigned_agents: false
    approval: owner_required
    evidence: checksum_and_destination_without_raw_values
  - type: update_record
    allowed_for_assigned_agents: false
    approval: owner_required
    evidence: before_after_summary_redacted
  - type: deploy
    allowed_for_assigned_agents: false
    approval: explicit_owner_request_or_devops_task
    evidence: git_commit_build_log_service_status_browser_health
  - type: restart_service
    allowed_for_assigned_agents: false
    approval: explicit_owner_request_or_incident_response
    evidence: active_run_check_service_status_health_probe
  - type: change_secrets
    allowed_for_assigned_agents: false
    approval: owner_required
    evidence: secret_ref_and_verification_only
approval_policy:
  default_mode: draft_only_for_sensitive_data
  approvers:
    owner: Melverick
    devops: Andrej
  rules:
    - match:
        action_types: [read_status]
        sensitivity_levels: [internal]
      decision: allow_if_assigned
    - match:
        action_types: [read_data, export_data, update_record]
        sensitivity_levels: [financial_private]
      decision: require_approval
      approver: owner
    - match:
        action_types: [deploy, restart_service]
        environments: [production]
      decision: require_task_or_explicit_user_request
      approver: devops
    - match:
        action_types: [change_secrets, delete_record, run_destructive]
      decision: require_approval
      approver: owner
evidence_requirements:
  required: true
  redaction_required: true
  accepted_types:
    - service_status
    - http_status
    - browser_health_redacted
    - build_log
    - deploy_log
    - approval_record
    - checksum
  forbidden_evidence_content:
    - holdings
    - balances
    - raw_positions
    - raw_prices
    - credentials
  minimum_fields:
    - timestamp_sgt
    - actor
    - action_type
    - target_environment
    - command_or_endpoint
    - result_status
    - redaction_applied
    - rollback_reference
audit_log_requirements:
  enabled: true
  retention: durable_metadata_only
  raw_sensitive_payloads: forbidden
  minimum_fields:
    - event_id
    - timestamp_sgt
    - actor_type
    - actor_id
    - capability_id
    - app_environment
    - action_type
    - request_context
    - approval_id
    - policy_decision
    - result
    - evidence_ids
    - redaction_summary
health_checks:
  - id: service-active
    type: service_status
    environment: production
    command: systemctl is-active networth-tracker.service
    expected: active
    frequency: on_demand
    sensitivity: internal
    evidence: active_inactive_only
  - id: public-http
    type: http_status
    environment: production
    command: curl -fsS -o /dev/null -w '%{http_code}' https://mez.melverick.com/
    expected: "200"
    frequency: on_demand
    sensitivity: public
    evidence: status_code_only
  - id: browser-smoke
    type: browser_smoke
    environment: production
    command: load homepage and verify title/root element without opening holdings views
    expected: page_loads_no_console_errors
    frequency: before_and_after_deploy
    sensitivity: public
    evidence: redacted_screenshot_or_dom_summary
rollback:
  disable_capability:
    - Set capability status to restricted or disabled.
    - Revoke non-owner agent assignments.
    - Pause routines that inspect or modify financial data.
  app_rollback:
    - Revert to previous git commit or deployment bundle.
    - Restart service only after checking active sessions and pending jobs.
    - Verify public HTTP and browser smoke checks.
  data_rollback:
    - Use timestamped DB/app backup if a data mutation was explicitly approved.
    - Do not claim rollback for external financial provider state unless provider confirms reversal.
  emergency_stop:
    - Disable Mission Control actions for this capability.
    - Block new NetWorth Tracker tasks until owner review.
  verification:
    - Record service status, HTTP status, and redacted browser check after rollback.
mission_control_display:
  label: NetWorth Tracker
  source_type_label: Owned App
  domain: Personal Finance
  default_scope: personal
  show_in_work_dashboard: false
  primary_routes:
    - Capability Registry
    - Project Hub: Personal / NetWorth Tracker
    - Audit / Evidence
    - Health
  badges:
    - Financial private
    - Owner approval required
    - Production control
  allowed_agent_summary:
    devops: read_status_and_deploy_when_explicitly_tasked
    other_agents: no_default_access
```

## 13. Example app classification checklist

Use this checklist before ingesting any owned app:

1. Identify canonical app name, owner, URL, source repo/path, and runtime/service names.
2. Classify domain and default Mission Control scope: Work, Personal, Admin/Platform, or Payments.
3. Mark all sensitivity levels present.
4. List allowed action types and denial boundaries.
5. Define approval policy in machine-readable rules.
6. Define safe health checks that avoid sensitive data exposure.
7. Define evidence that proves success without leaking secrets/PII/financial state.
8. Define audit fields and retention/redaction policy.
9. Define rollback/disable/emergency-stop steps.
10. Link to Project Hub, Task Board tenant, Audit/Evidence filters, and agent assignments.
11. Run a smoke check and record the evidence before marking `status: active`.

## 14. Phase 4 adapter path: local-script first, Hermes tool/MCP as gated wrappers

Decision: owned app adapters remain registry-governed app records with local-script/runbook execution as the default adapter path. They should not become broad Hermes write tools by default.

Default path:

1. Ingest an `owned_app` registry record or intake assessment.
2. Store adapter metadata in `installMethod.adapterPath` and `governance.adapterPolicy`.
3. Expose only allowlisted read-only health/status probes without additional approval.
4. Route sensitive reads, exports, production mutations, secret changes, public publishing, payment actions, and destructive work through an approval/task gate.
5. Require dry-run capability, audit/evidence capture, rollback/compensation notes, and least-privilege scopes before any write-capable wrapper can be enabled.

Wrapper policy:

| Wrapper type | Default | Use when | Constraints |
| --- | --- | --- | --- |
| `local_script` | yes | App-specific health/status probes, deploy runbooks, redacted CLI scripts, or operator-owned automation under the app workspace. | Script must be narrow, reviewable, dry-run capable for writes, and emit redacted evidence. |
| `hermes_tool_readonly` | optional | A thin Hermes tool wrapper improves repeatability for safe status probes. | Read-only by default; no ambient secrets; no broad filesystem/network mutation surface. |
| `mcp_readonly` | optional | A profile/runtime already exposes an MCP surface and Mission Control can list exact tools/actions. | Read-only or explicit approval-gated actions only; no ungated write tools. |
| `broad_write_tool` / `ungated_mcp_write` | forbidden by default | Not a default path for owned apps. | Requires a new explicit approval/design task and registry policy update before consideration. |

Registry representation:

```yaml
installMethod:
  kind: owned-app-adapter
  wrapperType: local_script
  adapterPath:
    decision: local_script_first
    hermesToolPolicy: read_only_probe_or_approval_gate_front_door_only
    mcpPolicy: optional_read_only_or_gated_adapter_after_registry_policy
    broadWritesAllowedByDefault: false
    dryRunRequiredForWrites: true
    auditRequired: true
governance:
  adapterPolicy:
    defaultWrapper: local_script
    allowedWrapperTypes: [local_script, hermes_tool_readonly, mcp_readonly]
    forbiddenWrapperTypes: [broad_write_tool, ungated_mcp_write, ambient_secret_tool]
    writeRule: Writes remain task/approval gated, audited, dry-run capable, and least-privilege.
    secretRule: Adapters receive secret references/readiness only; raw values are not stored in registry records.
  blockedActions:
    - broad-write-tool
    - sensitive-write-without-approval
    - raw-sensitive-export
    - secret-value-exposure
    - production-mutation-without-task-or-approval
```

Implementation implications for registry ingestion:

- `owned_app` assessments normalize aliases such as `owned-app` and return `suggestedWrapperType: local_script`.
- Capability records should show the adapter path and adapter policy alongside approval/health/evidence state.
- Existing read-only health checks can be implemented as local scripts or thin read-only Hermes tools, but they must return status summaries only.
- Write-capable adapters must be separate, named, least-privilege actions with approval IDs and rollback/evidence requirements. Do not attach a generic “write to app” tool.
- Personal-domain apps such as NetWorth Tracker stay out of default Work dashboards unless the operator selects Personal or All scope.
- Evidence/audit summaries must reference redacted proof and must not copy sensitive payloads into the registry.

## 15. Earlier implementation implications for registry ingestion

Completed/retained requirements:

- add `owned_app` to the accepted Capability Registry `source_type` set;
- support manifests under a predictable registry path, for example `docs/capabilities/owned-apps/*.yaml` or a root-only runtime inventory path for sensitive local apps;
- validate required fields and reject manifests containing secret-looking values in forbidden fields;
- normalize app IDs into Project/Task Board tenant keys such as `owned-app:networth-tracker`;
- render `Owned App` as a distinct source label in Admin → Capability Registry;
- map sensitivity levels into Approval Gate defaults;
- expose health/evidence/rollback readiness in the app detail drawer;
- keep Personal-domain apps such as NetWorth Tracker out of default Work dashboards unless the operator selects Personal or All scope;
- require explicit approval or task context before production mutation actions;
- ingest evidence/audit summaries by reference rather than copying sensitive payloads into the registry.

## 16. Non-goals for phase 4

This document does not:

- grant agents access to NetWorth Tracker, Mission Control, Nexius Academy, SGQR/PayNow, or lead dashboards;
- create broad write-capable Hermes tools or MCP servers for owned apps;
- move or expose credentials;
- publish or deploy any app;
- store private holdings, raw financial state, lead PII, payment secrets, or other sensitive raw data.
