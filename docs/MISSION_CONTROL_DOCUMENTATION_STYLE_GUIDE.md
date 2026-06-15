# Mission Control Documentation Style Guide

Last verified: 2026-06-10 SGT
Product: Hermes Mission Control
Primary audience: operators, builders, admins, and future AI coworkers maintaining the system
Reference styles: Hermes Agent documentation + OpenClaw operational documentation

## 1. Documentation intent

Mission Control documentation should feel like **operator-grade product documentation**, not scattered engineering notes.

The style should combine:

- **Hermes Agent docs style**: clear product explanation, quick start, CLI/API examples, conceptual reference, warnings, troubleshooting, and exact commands.
- **OpenClaw docs style**: gateway/control-plane-first mental model, explicit entities, claims/evidence, implications, routing/session/node concepts, and operational follow-up actions.
- **Mission Control voice**: practical, trust-first, audit-aware, clear enough for SME operators and precise enough for builders.

The core promise:

> Mission Control is the management, audit, and trust layer for operating digital coworkers.

Every document should help the reader answer at least one of these questions:

1. **What is this?**
2. **When should I use it?**
3. **How do I operate it safely?**
4. **What proof/evidence should I expect?**
5. **What do I do when it breaks?**

---

## 2. Information architecture

Organize docs into six families.

### A. Start here

Purpose: orient a new operator quickly.

Recommended pages:

- `README.md` — product overview, major surfaces, local dev, production checks.
- `docs/HERMES_MISSION_CONTROL.md` — canonical operator guide.
- `docs/GLOSSARY.md` or glossary section — canonical terms and relationship map.
- `docs/ARCHITECTURE.md` — system map and runtime boundaries.

### B. Operator guides

Purpose: day-to-day use.

Pattern:

- What this surface does
- When to use it
- Common workflows
- Approval/evidence expectations
- Troubleshooting

Examples:

- Task Board
- Agents / AI Workforce
- Routines
- Approval Gates
- Browser Activity
- Research-to-deliverable workflow
- Capability Registry

### C. Concepts

Purpose: explain the mental model.

Examples:

- Project vs Goal vs Mission vs Task
- Workflow vs Routine vs Automation
- Skill vs Tool vs Connector vs Runtime
- Evidence vs Output vs Audit Log
- Human-in-the-loop approval boundaries
- Agent org chart / AI workforce taxonomy

### D. Reference

Purpose: exact fields, API routes, commands, schemas, and states.

Examples:

- API endpoint reference
- DB table/state reference
- Capability manifest schema
- Runtime connector event schema
- Task state machine
- Cron/Routine status reference

### E. Runbooks

Purpose: concrete operational procedures.

Examples:

- Reset login credentials
- Repair missing cron profile-local scripts
- Rebuild/deploy frontend bundle
- Restart Mission Control safely
- Roll back a runtime connector
- Disable a misbehaving agent/capability

### F. Troubleshooting

Purpose: diagnose failures quickly.

Organize by symptom:

- Login fails
- Routines not firing
- Agent does not respond
- Task stuck in running
- Approval gate missing
- Evidence artifact missing
- Browser runtime unavailable
- API returns stale data

---

## 3. Page types and templates

### 3.1 Concept page template

Use for mental models such as Project/Goal/Mission/Task.

```markdown
# [Concept Name]

## Summary
[One paragraph in plain English.]

## Why it matters
- [Operational reason]
- [Trust/audit reason]
- [User-facing reason]

## Core model
```text
[Small relationship diagram]
```

## Definitions
- **Term**: Definition.
- **Term**: Definition.

## Example
```text
Intent: ...
Project: ...
Goal: ...
Mission: ...
Tasks: ...
Evidence: ...
```

## Common mistakes
- **Mistake**: Correction.
- **Mistake**: Correction.

## Related docs
- [Doc](./DOC.md)
```

### 3.2 Operator guide template

Use for UI surfaces and daily workflows.

```markdown
# [Surface / Workflow] Operator Guide

Last verified: YYYY-MM-DD SGT
Surface: Mission Control > [Page]
Audience: [operator/admin/builder]

## What this is
[Explain in 2-4 sentences.]

## When to use it
- [Use case]
- [Use case]

## What good looks like
- [Visible state]
- [Evidence expected]
- [Approval boundary]

## Standard workflow
1. [Step]
2. [Step]
3. [Step]

## Evidence checklist
- [ ] Final artifact path / URL
- [ ] Screenshot or source record
- [ ] Approval record if needed
- [ ] Run/task ID
- [ ] Failure or retry notes if any

## Troubleshooting
### Symptom: [X]
Likely cause: [Y]
Check:
```bash
[command]
```
Fix:
```bash
[command]
```

## Related docs
- [Doc](./DOC.md)
```

### 3.3 Reference page template

Use for exact contracts.

```markdown
# [Feature] Reference

## Scope
This reference covers [what] and does not cover [what].

## Entities
- **Entity**: Purpose.
- **Entity**: Purpose.

## State model
```text
new → ready → running → review → done
              ↓
           blocked
```

## Fields
- `field_name`: type, required/optional, meaning.

## Commands / API
```bash
[exact command]
```

```http
GET /api/example
```

## Error cases
- `error_code`: Meaning and operator response.

## Verification
```bash
[command]
```
Expected:
```text
[output shape]
```
```

### 3.4 Runbook template

Use for operational repair and admin procedures.

```markdown
# Runbook: [Action]

## Use this when
- [Symptom]
- [Scenario]

## Safety rules
- Do not print secrets or PII.
- Back up before mutation.
- Prefer read-only checks before writes.

## Prerequisites
```bash
[read-only check]
```

## Procedure
1. Check current state:
   ```bash
   [command]
   ```
2. Apply repair:
   ```bash
   [command]
   ```
3. Verify:
   ```bash
   [command]
   ```

## Rollback
```bash
[rollback command]
```

## Evidence to record
- Timestamp
- Command/output summary
- Affected job/task/runtime ID
- Before/after status
```

### 3.5 OpenClaw-style source note template

Use when ingesting external docs or decisions into the second brain.

```markdown
# [System] Docs: [Topic]

## Metadata
- Type: documentation
- Date: YYYY-MM-DD
- Author / origin: [source]
- Raw file / URL: [path or URL]

## Summary
[Short summary.]

## Key takeaways
- [Takeaway]
- [Takeaway]

## Entities mentioned
- [Entity]
- [Entity]

## Claims / evidence
- [Claim backed by source]
- [Claim backed by source]

## Implications for Mission Control
- [What this changes in design/docs/ops]

## Follow-up actions
- [Action]
```

---

## 4. Writing style rules

### 4.1 Use operator-first language

Prefer:

- “Use this when…”
- “Check…”
- “Expected…”
- “If this fails…”
- “Record this evidence…”

Avoid:

- vague roadmap language
- unexplained internal code names
- “should just work”
- claims without verification

### 4.2 Keep the Mission Control mental model consistent

Use the canonical relationship:

```text
Intent → Project → Goal → Mission → Tasks → Outputs / Evidence

If repeatable:
Goal → Workflow → Routine → Runs
```

Short version:

```text
Project = the folder / operating space
Goal = the desired result
Mission = the campaign/run to achieve the result
Task = the individual action
Evidence = proof it happened
```

### 4.3 Separate user-facing terms from technical implementation

Examples:

- User-facing: **Routine**
- Technical: cron job, webhook, background worker

- User-facing: **Agent** / digital coworker
- Technical: Hermes profile, model provider, toolset, runtime process

- User-facing: **Approval Gate**
- Technical: approval DB row, policy check, platform callback

### 4.4 Every important claim needs proof

When documenting a behavior, include at least one of:

- command output
- API route
- file path
- screenshot requirement
- test name
- database table/state
- run/task/job ID shape

Example:

```markdown
Verify the scheduler is alive:

```bash
hermes cron status
```

Expected: gateway running, active job count, next run timestamp.
```

### 4.5 Make failures first-class

For each major feature, document:

- common failure mode
- likely cause
- read-only check
- safe fix
- rollback
- evidence to capture

Mission Control docs should make stuck work visible rather than hiding it.

---

## 5. Recommended documentation set for Mission Control

Create or maintain these canonical pages.

### Product / overview

- `README.md`
- `docs/HERMES_MISSION_CONTROL.md`
- `docs/ARCHITECTURE.md`
- `docs/GLOSSARY.md`

### Operator guides

- `docs/TASK_BOARD_OPERATOR_GUIDE.md`
- `docs/AGENTS_OPERATOR_GUIDE.md`
- `docs/ROUTINES_OPERATOR_GUIDE.md`
- `docs/APPROVAL_GATES_OPERATOR_GUIDE.md`
- `docs/BROWSER_ACTIVITY_OPERATOR_GUIDE.md`
- `docs/CAPABILITY_REGISTRY_OPERATOR_GUIDE.md`
- `docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md`

### Reference

- `docs/API_REFERENCE.md`
- `docs/TASK_STATE_REFERENCE.md`
- `docs/RUNTIME_CONNECTOR_V2.md`
- `docs/OWNED_APP_CAPABILITY_SPEC.md`
- `docs/AGENT_OS_INTENT_ROUTER_SPEC.md`

### Runbooks

- `docs/runbooks/RESET_LOGIN.md`
- `docs/runbooks/REPAIR_CRON_SCRIPT_PATH.md`
- `docs/runbooks/RESTART_MISSION_CONTROL.md`
- `docs/runbooks/REBUILD_FRONTEND.md`
- `docs/runbooks/ROLLBACK_CAPABILITY.md`
- `docs/runbooks/DISABLE_AGENT_OR_ROUTINE.md`

### Troubleshooting

- `docs/TROUBLESHOOTING.md`
- `docs/KNOWN_LIMITATIONS.md`

---

## 6. Documentation page structure for the in-app Docs surface

The in-app docs page should behave like a product manual, not a code dump.

Recommended left-nav groups:

1. **Start here**
   - Overview
   - Glossary
   - Architecture
   - Quick operator flow

2. **Operate**
   - Chat command center
   - Dashboard
   - Task Board
   - Approvals
   - Agents / AI Workforce
   - Routines
   - Browser Activity
   - Knowledge / Sources

3. **Govern**
   - Permission modes
   - Approval gates
   - Evidence and audit logs
   - Capability Registry
   - Runtime Connectors
   - Costs / usage

4. **Build**
   - Local development
   - Backend routes
   - Frontend bundle
   - Test suite
   - Deployment

5. **Fix**
   - Troubleshooting
   - Runbooks
   - Rollback

Each in-app page should include:

- one-sentence summary
- “When to use this” bullets
- “What good looks like” bullets
- related commands/API paths when useful
- related docs links

---

## 7. Tone examples

### Weak

> The task board lets you manage tasks.

### Strong

> The Task Board is the operational queue for agent work, human tasks, blockers, result review, artifacts, evidence, approval gates, and next actions. Use it when work must survive chat context, involve multiple agents, or require visible proof before completion.

### Weak

> Cron jobs run automatically.

### Strong

> Routines are scheduled Mission Control work. The technical implementation may be Hermes cron, a webhook, or a background worker. A healthy routine shows its schedule, last run, next run, last status, output location, and failure evidence.

### Weak

> Approvals are for important things.

### Strong

> Approval Gates are human approve/reject checkpoints before external-facing, destructive, costly, policy-sensitive, or authority-bound actions. A completed approval should record who approved, what was approved, when, and the evidence/result of the subsequent action.

---

## 8. Documentation quality checklist

Before considering a page complete, check:

- [ ] The audience is clear: operator, admin, builder, or agent maintainer.
- [ ] The first paragraph explains what the feature is.
- [ ] There is a “when to use this” section.
- [ ] There is an evidence/audit expectation where relevant.
- [ ] Commands, paths, API routes, or test names are exact.
- [ ] Failure modes are documented.
- [ ] User-facing terms are separated from technical implementation.
- [ ] No secrets, raw PII, private holdings, or credentials are included.
- [ ] Related docs are linked.
- [ ] The doc matches the canonical terminology map.

---

## 9. Suggested next implementation steps

1. Split the current large `docs/HERMES_MISSION_CONTROL.md` into smaller pages while keeping it as the canonical index.
2. Add `docs/GLOSSARY.md` from the existing glossary section.
3. Add `docs/ARCHITECTURE.md` using the OpenClaw-style control-plane model:
   - Mission Control as operator cockpit
   - Hermes as worker/runtime layer
   - Gateway as messaging/runtime bridge
   - Kanban/Cron/Sessions/Profiles as durable work substrate
4. Add runbooks for the recurring repairs already seen in operations:
   - missing profile-local cron scripts
   - failed routine recovery
   - stuck Kanban task recovery
   - safe Mission Control restart/rebuild
5. Update the in-app `MissionControlDocs.tsx` to mirror the doc family navigation.
6. Add regression tests that assert the docs contain the canonical glossary, evidence checklist, and routine/approval definitions.

---

## 10. North star

Mission Control documentation should make the system feel like an **AI operations manual**:

- understandable by SME operators
- precise enough for engineers
- explicit about trust boundaries
- evidence-backed
- failure-aware
- organized around operating digital coworkers, not just using a chat UI
