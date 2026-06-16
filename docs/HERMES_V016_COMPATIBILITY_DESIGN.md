# Hermes v0.16 Compatibility Design for Mission Control

Last verified: 2026-06-16 SGT

Source impact note: `/root/.hermes/output/hmc-hermes-updates-impact-2026-06-16.md`

## Product boundary

Hermes v0.16 strengthens native runtime surfaces: Dashboard/Desktop, remote gateway, profile-aware sessions, managed file APIs, dashboard auth, cron, Kanban, approval/security gates, and async/background execution.

Mission Control should not duplicate those low-level runtime consoles. The boundary is:

```text
Hermes Dashboard/Desktop = native runtime console for profiles/runtimes
Hermes Gateway/Kanban/Cron = execution substrate
HMC = governance/control plane across users, workspaces, agents, approvals, evidence, and audit
```

HMC may launch or deep-link to native Hermes consoles, but HMC remains the higher-level policy, assignment, evidence, and audit layer.

## Runtime registry additions

Runtime records should support native Hermes profile/dashboard fields without assuming a single local process:

- `native_console_url`: URL to open the runtime's native Hermes Dashboard/Desktop console.
- `remote_gateway_url`: URL used by HMC/server-side adapter to reach the runtime gateway.
- `dashboard_auth_mode`: `loopback | basic | oidc | portal | token | unknown`.
- `hermes_version`: runtime-reported Hermes version, e.g. `0.16.0`.
- `hermes_release_date`: release date when available.
- `capabilities`: versioned feature flags such as `profiles`, `managed_files`, `kanban`, `cron`, `async_delegation`, `dashboard_auth`, `approvals`, `remote_artifacts`.
- `profile_id` / `profile_name`: Hermes execution boundary for the runtime.
- `console_mode_policy`: allowed launch modes such as `supervise`, `manage`, or explicitly audited `operate_as_user`.

The native console is an operator surface, not proof of business authority. HMC still owns workspace access, assignment, approval, and audit policy.

## Versioned HermesRuntimeAdapter boundary

HMC UI/domain code should not call unstable upstream dashboard routes directly. Use a versioned adapter boundary such as:

```text
HermesRuntimeAdapter
  - getHealth(runtime_id)
  - listProfiles(runtime_id)
  - listSessions(runtime_id, profile_id)
  - listKanbanTasks(runtime_id, profile_id)
  - listCronJobs(runtime_id, profile_id)
  - listArtifacts(runtime_id, profile_id, locator)
  - listApprovals(runtime_id, profile_id)
  - openNativeConsole(runtime_id, mode)
```

Adapter responses should be normalized into HMC types and include upstream version/capability evidence so HMC can degrade gracefully when a runtime is older than v0.16.

## Task/run model additions

Hermes v0.16 async/background delegation means one HMC task can spawn child work that outlives the initiating turn. HMC task/run records should support run trees:

- `parent_run_id`
- `child_run_ids`
- `spawned_by`: tool/event/session reference that created the child run
- `async_status`: `queued | running | completed | failed | cancelled | detached | unknown`
- `completion_cause`: `normal | user_stopped | timeout | policy_blocked | runtime_lost | error | unknown`
- `runtime_id` / `profile_id` for every run node
- child evidence/artifact linkage

Existing HMC `RunTreePayload` direction is aligned; the next step is to preserve upstream async completion causes and runtime/profile ownership instead of flattening them into generic task status.

## Evidence and artifact locator model

HMC must stop assuming every artifact is a local server path such as `/root/.hermes/output/...`. Remote profiles and managed Hermes file APIs require runtime-scoped locators.

Recommended locator shape:

```text
kind: local_path | hermes_managed_file | runtime_file | external_url
runtime_id: string
profile_id?: string
download_url?: string
path?: string
evidence_hash?: string
redaction_status?: redacted | safe | sensitive | unknown
metadata?: object
```

Rules:

- `local_path` is valid only when the artifact is on the HMC host and the path is safe to reveal to the operator.
- `hermes_managed_file` uses Hermes managed file/download APIs and should prefer authenticated server-side retrieval.
- `runtime_file` means the path is local to the remote runtime, not necessarily readable from HMC.
- `external_url` must preserve provenance and verification status.
- `evidence_hash` should be captured when practical for audit/replay.

## Routine and scheduler ownership

Hermes v0.16 makes cron more profile-aware and can be ticked by gateway/dashboard/desktop contexts depending on deployment.

HMC Routine records should store:

- owning `runtime_id` and `profile_id`
- `scheduler_source`: `hmc | hermes_cron | gateway | dashboard | desktop | external`
- upstream Hermes cron `job_id`
- `delivery_target`
- `last_run_evidence`
- `duplicate_execution_guard`: stable key used to prevent duplicate ticks/runs
- scheduler health and last tick source

Before enabling a routine, HMC should check whether another scheduler already owns that profile/job. If multiple schedulers exist, HMC should report the risk instead of silently creating duplicate work.

## Approval policy categories

HMC approval policy should include Hermes v0.16 governance-sensitive operations:

- `memory_write`
- `skill_create`
- `skill_update`
- `skill_delete`
- `connector_credential_change`
- `model_provider_change`
- `external_send`
- `external_post`
- `external_purchase`
- `external_delete`
- `destructive_system_action`
- `sensitive_file_edit`

Memory and skill changes affect future agent behavior, so customer workspaces should default these to approval-required or at least audit-required until workspace policy says otherwise.

## Status taxonomy

HMC should preserve why work could not proceed:

- `blocked_by_policy`: Hermes/HMC policy blocked the action.
- `requires_policy_approval`: work is waiting on an approval gate.
- `auth_blocked`: connector/session/token/auth mode prevents execution.
- `runtime_offline`: target runtime/profile is unreachable.
- `execution_failed`: action ran and failed.

Do not collapse policy/security blocks into generic `error` states; operators need to distinguish safety working as designed from runtime failure.

## Operational upgrade caution

Do not run `hermes update` blindly on this host. The local Hermes checkout has uncommitted changes in gateway, dashboard/web server, state, WhatsApp bridge, and related tests. Preserve or review those changes before updating from v0.15.1 to v0.16.0.

Safe upgrade sequence:

1. Review local Hermes diffs.
2. Save a patch bundle or preservation branch.
3. Upgrade Hermes.
4. Re-apply only required local fixes.
5. Verify Telegram gateway, HMC `/v1`, cron, Kanban, profile handling, and managed artifact access.
