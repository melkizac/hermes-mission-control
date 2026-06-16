# Mission Control Capability Registry Operator Guide

Last verified: 2026-06-08 UTC
Live service: `https://hermes.melverick.com`
Local service: `http://127.0.0.1:19080`
Primary UI: Admin → Capability Registry (`/admin?view=capabilities`)
Backend implementation: `/opt/hermes-mission-control/app.py` and `/opt/hermes-mission-control/capability_registry.py`
Pilot seed file: `docs/capability-registry-pilot-oss-seed.json`

This SOP explains how an operator turns an OSS project, package, service, or local tool into a governed Mission Control capability that agents can discover, request, receive, use, prove, and lose again safely.

## 1. Operating model

Capability Registry is the governed intake and assignment layer for agent abilities.

A capability record answers:

- What is the source? Example: MCP stdio server, CLI tool, Docker service, GitHub project, npm package, Python package, local service, plugin, or skill.
- What risk does it introduce? Example: read-only, local-write, network, secret-access, external-publish, production-control, destructive.
- What approval is required before install, enablement, or assignment?
- Which agent/profile/routine can receive it?
- What smoke evidence proves it is safe enough to trust?
- How do we disable, rollback, uninstall, or archive it?

Important boundary: a registry record is metadata and governance. It does not by itself install third-party software, start a Docker service, add credentials, or grant an agent a new tool. The actual install/enable step must be done by an operator or approved DevOps task, then verified and recorded back into the capability health/evidence fields.

## 2. Roles and authority

| Role | Can do | Must not do without approval |
| --- | --- | --- |
| Admin | Create intake records, assess sources, request approval, approve admin-level risks, run sandbox smoke checks, enable/disable non-Melverick-gated capabilities, assign approved capabilities. | Production control, external publishing, destructive actions, DNS, live secret rotation, or deletion of cloud resources. |
| Melverick | Final approval for external-publish, production-control, and destructive capability use. | N/A — still record decision evidence. |
| DevOps Builder | Prepare intake, install wrappers/services after approval, run smoke checks, update evidence, prepare rollback. | Print secrets, bypass approval gates, or make destructive production changes without explicit approval. |
| Agent profile | Can use only capabilities already exposed through its Hermes profile/tools/plugins/skills and assigned/allowed by Mission Control policy. | Self-install, self-enable, or consume raw secrets unless the capability policy allows it. |

## 3. Source types and examples

Mission Control currently recognizes these durable source types in `CAPABILITY_SOURCE_TYPES`:

- `skill`
- `plugin`
- `mcp-server`
- `cli-tool`
- `github-project`
- `python-package`
- `npm-package`
- `docker-image`
- `local-service`
- `api-connector`
- `internal-tool`

### Example A — MCP stdio server

Use this when a capability is exposed by an MCP server launched by Hermes.

Intake fields:

```json
{
  "title": "Filesystem MCP server for DevOps profile",
  "sourceType": "mcp-server",
  "sourceRef": "@modelcontextprotocol/server-filesystem",
  "sourceUri": "https://github.com/modelcontextprotocol/servers",
  "installMethod": {
    "kind": "npm",
    "commandPreview": "npx -y @modelcontextprotocol/server-filesystem /approved/path",
    "wrapperType": "mcp-stdio",
    "requiresRestart": true
  },
  "riskLevels": ["local-write"],
  "permissions": ["filesystem-read", "filesystem-write", "approved-path:/approved/path"],
  "healthPlan": {
    "smokeTestCommand": "hermes mcp test filesystem",
    "sandboxMode": "dry-run-before-approval"
  },
  "rollbackNotes": {
    "disableSteps": ["Remove or disable the MCP server entry from the target profile config", "Restart the profile/gateway"],
    "uninstallSteps": ["Remove generated wrapper/cache only after confirming no other profile uses it"],
    "restartRequired": true
  }
}
```

Operator steps:

1. Create the intake record in Admin → Capability Registry or via `POST /api/capabilities/intake`.
2. Confirm the approved path is narrow and does not include broad roots such as `/`, `/root`, `/opt`, or all of a user home.
3. Request Admin approval because `local-write` gates install, enable, and assignment.
4. After approval, add the MCP server to the target Hermes profile config.
5. Restart the affected profile/gateway if required.
6. Run `hermes mcp test <name>` and record pass/fail evidence.
7. Assign the registry capability to the intended agent profile only.

### Example B — CLI registry wrapper

Use this when the capability is a command-line tool that Hermes should call through a wrapper.

```json
{
  "title": "Semgrep CLI for security review lane",
  "sourceType": "cli-tool",
  "sourceRef": "semgrep",
  "sourceUri": "https://github.com/semgrep/semgrep",
  "installMethod": {
    "kind": "pipx",
    "commandPreview": "pipx install semgrep",
    "wrapperType": "tool",
    "requiresRestart": false,
    "requiredSecrets": [
      {"name": "SEMGREP_APP_TOKEN", "required": false, "source": "operator-provided", "purpose": "Only for Semgrep Cloud/private rulesets"}
    ]
  },
  "riskLevels": ["network", "local-write", "secret-access"],
  "permissions": ["filesystem-read", "filesystem-write", "network"],
  "healthPlan": {"smokeTestCommand": "semgrep --version"},
  "rollbackNotes": {"uninstallSteps": ["pipx uninstall semgrep", "Remove wrapper and any SEMGREP_APP_TOKEN secret reference"]}
}
```

Do not paste token values into `installMethod`, `permissions`, `evidence`, or comments. Store only the secret reference name and readiness state.

### Example C — Docker/local service

Use this for services that must be started and monitored, such as Firecrawl, Qdrant, or Langfuse.

```json
{
  "title": "Qdrant local vector database",
  "sourceType": "local-service",
  "sourceRef": "qdrant/qdrant",
  "sourceUri": "https://github.com/qdrant/qdrant",
  "installMethod": {
    "kind": "docker",
    "commandPreview": "docker run -p 6333:6333 qdrant/qdrant",
    "wrapperType": "service",
    "requiresRestart": true,
    "requiredSecrets": [
      {"name": "QDRANT_API_KEY", "required": false, "source": "operator-provided", "purpose": "Only if securing endpoints"}
    ]
  },
  "riskLevels": ["network", "local-write", "secret-access", "production-control"],
  "permissions": ["docker", "filesystem-write", "service-port:6333", "network"],
  "healthPlan": {"smokeTestCommand": "curl -fsS http://localhost:6333/healthz"},
  "rollbackNotes": {
    "disableSteps": ["Disable generated tool/API wrapper", "Stop the service/container"],
    "uninstallSteps": ["docker rm the container and docker image rm qdrant/qdrant if unused", "Preserve/archive volumes before deleting data"],
    "restartRequired": true
  }
}
```

Because this includes `production-control`, Melverick approval is required before production enablement or assignment.

### Example D — GitHub project

Use this for OSS projects where the install mode might later become npm, pip, Docker, or a custom wrapper.

```json
{
  "title": "Pilot OSS intake: Playwright",
  "sourceType": "github-project",
  "sourceRef": "microsoft/playwright",
  "sourceUri": "https://github.com/microsoft/playwright",
  "installMethod": {
    "kind": "npm",
    "commandPreview": "npm install -D @playwright/test",
    "wrapperType": "tool",
    "requiresRestart": false
  },
  "riskLevels": ["network", "local-write"],
  "permissions": ["network", "filesystem-write", "browser-control"],
  "healthPlan": {"smokeTestCommand": "npx playwright --version"},
  "assignedAgents": [
    {"id": "devops", "name": "DevOps Builder", "enabled": false, "reason": "Mission Control UI smoke tests and browser QA"}
  ]
}
```

GitHub project source records should include upstream URL evidence and a rollback note before approval.

### Example E — npm package

```json
{
  "title": "Lighthouse web audit package",
  "sourceType": "npm-package",
  "sourceRef": "lighthouse",
  "sourceUri": "https://www.npmjs.com/package/lighthouse",
  "installMethod": {
    "kind": "npm",
    "commandPreview": "npm install -D lighthouse",
    "wrapperType": "tool",
    "requiresRestart": false
  },
  "riskLevels": ["network", "local-write"],
  "permissions": ["browser-control", "network", "filesystem-write"],
  "healthPlan": {"smokeTestCommand": "npx lighthouse --version"},
  "rollbackNotes": {"uninstallSteps": ["npm uninstall lighthouse", "Disable any scheduled audit wrapper"]}
}
```

### Example F — Python package

```json
{
  "title": "Docling document extraction package",
  "sourceType": "python-package",
  "sourceRef": "docling",
  "sourceUri": "https://pypi.org/project/docling/",
  "installMethod": {
    "kind": "pip",
    "commandPreview": "pip install docling",
    "wrapperType": "tool",
    "requiresRestart": false
  },
  "riskLevels": ["network", "local-write"],
  "permissions": ["filesystem-read", "filesystem-write", "network"],
  "healthPlan": {"smokeTestCommand": "docling --help"},
  "rollbackNotes": {"uninstallSteps": ["pip uninstall -y docling", "Remove downloaded model/cache directories only if created for this capability"]}
}
```

### Example G — pilot capabilities

Pilot records are intentionally safe metadata-only entries. The current seed file lives at:

```text
docs/capability-registry-pilot-oss-seed.json
```

The corresponding seed script is:

```text
/opt/hermes-mission-control/scripts/seed_pilot_oss_capabilities.py
```

The script explicitly states that it writes metadata only and does not install, enable, or run any third-party service. Pilot records should remain `awaiting-approval`, `enabled: false`, and `productionInstallPerformed: false` until a separate approved implementation task installs and verifies them.

## 4. Intake SOP: add a new OSS capability

Use this flow whenever an admin wants to add an OSS project/package/service.

1. Identify source type.
   - GitHub repo: `github-project`.
   - PyPI package: `python-package`.
   - npm package: `npm-package`.
   - Docker image or compose stack: `docker-image` or `local-service`.
   - Hermes MCP server: `mcp-server`.
   - Shell command/wrapper: `cli-tool`.
2. Capture source reference.
   - `sourceRef`: concise identifier, e.g. `microsoft/playwright`, `lighthouse`, `qdrant/qdrant`.
   - `sourceUri`: upstream source URL. The registry redacts unsafe query parameters before returning records.
   - `sourceLabel`: `GitHub`, `PyPI`, `npm`, `Docker`, `Hermes profile`, or equivalent.
3. Capture install method.
   - `kind`: `manual`, `npm`, `pip`, `pipx`, `docker`, `docker-compose`, `binary`, `mcp`, or `profile-config`.
   - `commandPreview`: redacted preview only. Do not include raw tokens/passwords.
   - `wrapperType`: `tool`, `mcp-stdio`, `service`, `service-or-api`, `skill-or-library`, etc.
   - `requiresRestart`: true when Hermes profile/gateway/service must restart after enablement.
4. Capture risk levels.
   - Use the risk taxonomy in section 5.
   - If credentials are needed, include `secret-access` even when the secret is optional.
5. Capture required secrets as references only.
   - Good: `{ "name": "LANGFUSE_SECRET_KEY", "required": true, "source": "operator-provided" }`
   - Bad: `{ "value": "sk_live_..." }`
6. Capture health plan.
   - Include a smoke command that proves the wrapper/service is available.
   - Prefer version/help/health endpoints before any write or external action.
7. Capture rollback.
   - Include disable steps, uninstall steps, restart requirement, and data-preservation note.
8. Create the intake record.
   - UI: Admin → Capability Registry → Intake/Add capability.
   - API: `POST /api/capabilities/intake`.
9. Request approval when policy says approval is required.
10. Only after approval, install/enable and run smoke checks.
11. Record smoke evidence and assign to agents.

## 5. Risk taxonomy and approval gates

The registry normalizes risk levels and maps them to approval policy:

| Risk | Approval | Authority | Typical examples |
| --- | --- | --- | --- |
| `read-only` | No gate | none | Docs-only skill, local read-only metadata. |
| `local-write` | Required | Admin | CLI wrapper that writes files, MCP filesystem server. |
| `network` | Required | Admin | Web fetcher, package install, browser automation. |
| `secret-access` | Required | Admin | API connector, hosted service token, private rulesets. |
| `external-publish` | Required | Melverick | LinkedIn/X/email publishing, public website changes. |
| `production-control` | Required | Melverick | Systemd, Docker service controlling production app, database service. |
| `destructive` | Required | Melverick | Delete resources, DNS changes, live secret rotation, irreversible data changes. |

Approval-gated actions include `install`, `enable`, and `assign`. Melverick-level policies also gate `external-publish`, `production-control`, `secret-rotation`, `dns-change`, and `destroy`.

The backend returns blocked responses with HTTP 409 and an `actionableBlocker` explaining the required approver and next action.

## 6. How approvals work

Typical API lifecycle:

1. Create or update the intake record.
   - `POST /api/capabilities/intake`
2. Register the durable capability record if needed.
   - `POST /api/capabilities/<capabilityId>/register`
3. Request approval.
   - `POST /api/capabilities/<capabilityId>/approval-request`
   - Result: status becomes `awaiting-approval`, governance `approvalStatus` becomes `pending`.
4. Approver reviews source, risks, secrets, smoke plan, and rollback notes.
5. Approver approves.
   - `POST /api/capabilities/<capabilityId>/approve`
   - Payload may include `decisionNote` or `reason`.
6. Operator installs/enables/runs smoke checks.
   - `POST /api/capabilities/intake/<intakeId>/sandbox` for intake smoke.
   - `POST /api/capabilities/<capabilityId>/health` for evidence/health update.
7. Assign to agent.
   - `POST /api/capabilities/<capabilityId>/assign`

Important behavior:

- Anonymous API reads and mutations are blocked.
- Non-admin mutation attempts are blocked for admin/platform capabilities.
- Approval requests themselves are allowed to move a record into pending review, but install/enable/assign remain blocked until approved.
- For Melverick-gated risks, Admin is not enough; the required approver remains Melverick.

## 7. How agents receive capabilities

Agents receive capabilities in two layers:

1. Runtime/profile layer: the underlying Hermes profile exposes skills, tools, plugins, MCP servers, wrappers, or service endpoints.
2. Mission Control governance layer: the Capability Registry marks a capability as approved/enabled and assigned to an agent/routine/task.

The matrix endpoint combines both layers:

```text
GET /api/capabilities/matrix?agent=devops
```

The matrix shows:

- profile skills from Hermes skill inventory,
- profile tools/MCP servers,
- profile plugins,
- registry capabilities assigned to or suggested for the agent,
- blocked capabilities with policy evidence.

Assignment endpoint:

```text
POST /api/capabilities/<capabilityId>/assign
```

Example body:

```json
{
  "agentId": "devops",
  "agent": {"id": "devops", "name": "DevOps Builder", "enabled": true},
  "reason": "Approved for Mission Control browser smoke verification"
}
```

Unassignment/disable body:

```json
{
  "action": "unassign",
  "agentId": "devops",
  "reason": "Capability no longer needed for this profile"
}
```

Do not treat assignment as proof that the command exists on disk. Always check runtime smoke evidence before telling an operator the agent can use the capability.

## 8. Smoke evidence: how to interpret it

Smoke evidence is proof that the capability exists and the safe check passed in the expected environment. It is not proof that the capability is production-safe for every use case.

Good smoke evidence includes:

- command run or endpoint checked,
- exit code or HTTP status,
- timestamp,
- actor/profile,
- redacted stdout/stderr or response summary,
- environment boundary: local temp sandbox, profile runtime, Docker service, or production host,
- whether secrets were required and whether readiness was verified without printing them,
- rollback state if install changed runtime.

Common states:

| State | Meaning | Operator action |
| --- | --- | --- |
| `not-run` | No smoke evidence yet. | Do not assign/use for real work. Run dry-run or version check first. |
| `passing` | Smoke command passed in the recorded environment. | May assign if approval and runtime layer are also ready. |
| `failing` | Smoke failed. | Keep disabled/unassigned; fix install or rollback. |
| `degraded` | Works partially or intermittently. | Restrict usage and create remediation. |
| `blocked` | Policy/approval/secrets missing. | Resolve blocker before install/enable/assign. |

Sandbox endpoint:

```text
POST /api/capabilities/intake/<intakeId>/sandbox
```

Recommended sequence:

1. `mode: "dry-run"` before approval to confirm the plan is well-formed. Dry-run should not run unsafe third-party commands.
2. After approval, use a bounded temp command such as `tool --version`, `tool --help`, or a local health endpoint.
3. Inspect result for redaction. Secret-looking output must be replaced with `[REDACTED]`.
4. Persist health evidence to the capability record.

A passing smoke check does not authorize external publishing, production control, destructive actions, or live secret use unless the approval record covers those actions.

## 9. Rollback, disable, and archive SOP

Use rollback when a capability creates risk, fails smoke checks, is no longer needed, or must be removed from an agent.

### Soft disable

Use when the capability may be restored later.

1. Unassign from agents/routines/tasks.
   - `POST /api/capabilities/<capabilityId>/unassign` or assignment body with `action: "unassign"`.
2. Disable the registry record.
   - `POST /api/capabilities/<capabilityId>/disable`.
3. Disable any generated wrapper, MCP config, plugin flag, cron job, or service integration.
4. Restart affected Hermes profile/gateway only if `requiresRestart` is true.
5. Record evidence: disabled timestamp, actor, files/config changed, service status, and any rollback command output.

### Hard rollback/uninstall

Use when a capability should be removed from the runtime.

1. Confirm no active workers/runs depend on it.
2. Stop service/container/process if applicable.
3. Remove wrapper/config/profile entry.
4. Uninstall package only if no other profile or project depends on it.
5. Preserve data volumes or database backups before deleting service data.
6. Restart affected services if needed.
7. Run negative smoke: command absent, service stopped, endpoint unavailable, or registry status disabled.
8. Record rollback evidence.

### Archive

Use when the record should disappear from normal operator views but history should remain durable.

```text
POST /api/capabilities/<capabilityId>/archive
```

Archive should usually happen after disable/unassign, not before, so the operator does not hide an active risky capability.

## 10. Operator checklist

Before approval:

- [ ] Source URL and source reference are present.
- [ ] Source type matches the actual install/run model.
- [ ] Risks are complete and normalized.
- [ ] Required secrets are references only; no raw secret is stored.
- [ ] Install command preview is redacted and bounded.
- [ ] Health/smoke command is safe, preferably version/help/health-only.
- [ ] Rollback/disable steps are specific.
- [ ] Required approver is correct: Admin vs Melverick.

Before assignment:

- [ ] Approval status is `approved` or policy says `not-required`.
- [ ] Runtime layer is actually installed/enabled for the target profile.
- [ ] Smoke evidence is recent and passing in the right environment.
- [ ] The target agent has a clear reason to receive it.
- [ ] Any required restart has been performed.
- [ ] No active blocker remains in the matrix row.

Before reporting complete:

- [ ] Record API/UI evidence.
- [ ] Include rollback notes.
- [ ] Do not print secrets.
- [ ] If code/config changed, provide review handoff or PR/diff path.

## 11. API quick reference

All routes require authentication. Mutation routes require Admin unless noted by policy.

```text
GET  /api/capabilities
GET  /api/capabilities/<capabilityId>
GET  /api/capabilities/sources
GET  /api/capabilities/matrix?agent=<agentId>
GET  /api/capabilities/intake
POST /api/capabilities/assess
POST /api/capabilities/intake
POST /api/capabilities/intake/<intakeId>/sandbox
POST /api/capabilities/<capabilityId>/register
POST /api/capabilities/<capabilityId>/approval-request
POST /api/capabilities/<capabilityId>/approve
POST /api/capabilities/<capabilityId>/install
POST /api/capabilities/<capabilityId>/enable
POST /api/capabilities/<capabilityId>/disable
POST /api/capabilities/<capabilityId>/archive
POST /api/capabilities/<capabilityId>/assign
POST /api/capabilities/<capabilityId>/unassign
POST /api/capabilities/<capabilityId>/health
```

## 12. Troubleshooting

`401 Authentication required`
: Sign in to Mission Control or use an authenticated session/API context.

`403 Admin permission required`
: The actor is not allowed to mutate admin/platform capability records.

`409 Capability approval required`
: The risk policy blocks the attempted action. Request or obtain the required approval, then retry.

Smoke passed but agent still cannot use the tool
: Check the runtime/profile layer. The registry assignment may exist before the CLI/MCP/plugin/service is actually installed or enabled.

Capability appears in matrix as blocked
: Inspect `policyEvidence.actionableBlocker`, approval status, and required approver. Resolve policy before attempting install/enable/assign.

Secret appears in output/evidence
: Treat as incident. Rotate the secret if it was real, remove/redact the stored evidence, and add a regression check before re-enabling.

Pilot seed appears install-ready
: Re-check the record. Pilot seeds are metadata-only. They should remain disabled/unassigned until separate approval, install, smoke, and assignment work is complete.
