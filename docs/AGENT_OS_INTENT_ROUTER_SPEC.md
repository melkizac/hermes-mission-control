# Agent OS Main-Chat Intent Router Contract

This contract defines the side-effect-free routing decision that the main Mission Control chat must produce before it answers, creates work, creates a project, launches a workflow, recommends a routine, or hands work to a logical agent.

Requirement coverage: #6, #7, #8, #9, #11.

## Route schema

The router output is a JSON object with these fields:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `intent_type` | enum | yes | One of `one_time_reply`, `status_query`, `evidence_query`, `kanban_task`, `project`, `workflow`, `routine_recommendation`, `approval_response`, `agent_handoff`, `clarification`. |
| `research_deliverable_intent` | enum or null | yes | Research-to-deliverable sub-intent when applicable: `learn_topic`, `ask_sources`, `summarize_sources`, `compare_sources`, `generate_deck`, `generate_report`, `generate_proposal`, `generate_training_material`, `revise_artifact`, `add_sources_to_project`, or `check_project_status`. Null for non-research routes. |
| `confidence` | number | yes | 0.0–1.0 confidence score for the route. Values below 0.6 must not mutate state. |
| `rationale` | string | yes | Short operator-readable explanation of why this route was selected. |
| `project_required` | boolean | yes | True when safe execution depends on knowing the Project context. |
| `suggested_project_id` | string or null | yes | Selected/inferred Project/tenant id. Null means the router could not safely infer one. |
| `create_task` | boolean | yes | True only when a Task Board/Kanban card should be created or assigned. |
| `create_project` | boolean | yes | True only when a Project container should be created. |
| `launch_workflow` | boolean | yes | True when an existing or ad-hoc multi-step workflow should be launched. |
| `recommend_routine` | boolean | yes | True when the proper next step is to propose a recurring Routine instead of installing it immediately. |
| `one_time_reply` | boolean | yes | True when the main agent can answer directly in chat with no durable work item. |
| `agent_id` | string or null | yes | Logical owner/agent to handle the route, for example `melkizac`, `devops`, `content-ops`, `linkedin-growth`, or `nexius-leads`. |
| `tools_required` | string[] | yes | Toolsets expected for execution, such as `kanban`, `terminal`, `browser`, `cronjob`, `web`, or `session_search`. |
| `skills_required` | string[] | yes | Skills that should be loaded or attached to follow-up work. |
| `evidence_required` | boolean | yes | True when the route must produce run logs, task IDs, deployment proof, API responses, screenshots, or source links. |
| `approval_required` | boolean | yes | True when the next action is external-facing, irreversible, destructive, costly, policy-sensitive, or authority-bound. |

## Decision rules

### Simple one-time answer

Use `intent_type: one_time_reply` when the user asks a bounded question that can be answered from available context without durable state, side effects, project scoping, tool execution, external publication, or follow-up ownership. Set `one_time_reply: true`, all creation/launch booleans false, and `approval_required: false`.

### Status or evidence query

Use `status_query` or `evidence_query` when the user asks what happened, where work stands, or asks for proof. These routes are read-only, should not create tasks by default, and should set `evidence_required: true` because the answer must cite Task Board state, run IDs, logs, artifacts, session history, commits, health checks, or API responses.

### Kanban task

Use `intent_type: kanban_task` and `create_task: true` when the user asks for trackable work, implementation, investigation, review, cleanup, or a durable handoff. If no selected or inferable Project exists, keep `create_task: true` but set `project_required: true`, `suggested_project_id: null`, and ask for clarification or present inferred project choices before mutating the board.

### Project

Use `intent_type: project` and `create_project: true` when the user asks to create a new initiative, container, operating area, or Mission Control Project. A project route may later create child tasks, but the router decision itself should distinguish the project container from a normal one-off Kanban task.

### Workflow

Use `intent_type: workflow` and `launch_workflow: true` when the user asks to run a multi-step operating process, publish externally, execute a known playbook, start a campaign sequence, deploy, or coordinate multiple tools/agents. Set `approval_required: true` when the workflow includes external-facing, irreversible, destructive, costly, policy-sensitive, or authority-bound steps.

### Research-to-deliverable intents

When the main chat request is about learning a topic, asking questions over sources, summarizing/comparing sources, generating editable artifacts, revising artifacts, adding sources, or checking a research/deliverable project's status, preserve the specific sub-intent in `research_deliverable_intent` while still mapping to the core `intent_type` values above.

Supported sub-intents:

| `research_deliverable_intent` | Core route | State mutation policy |
| --- | --- | --- |
| `learn_topic` | `project` | Create/link a Project when the learning request has a durable objective, multiple steps, reusable sources, or requested evidence. |
| `ask_sources` | `one_time_reply` or `workflow` | Read-only source Q&A when sources/project are known; ask clarification before mutation when sources/project are missing. |
| `summarize_sources` | `one_time_reply` or `workflow` | Read-only summary for known sources; launch source-processing workflow only when extraction/synthesis is required. |
| `compare_sources` | `one_time_reply` or `workflow` | Read-only comparison for known processed sources; launch workflow only for multi-source processing/synthesis. |
| `generate_deck` | `project` or `workflow` | Create/link Project and task graph for editable PPTX output, with sources, outputs, artifacts, and evidence. |
| `generate_report` | `project` or `workflow` | Create/link Project and task graph for report output, citations, review, and artifact storage. |
| `generate_proposal` | `project` or `workflow` | Create/link Project and require approval before client-facing sharing or external publication. |
| `generate_training_material` | `project` or `workflow` | Create/link Project and task graph for lesson/deck/workbook outputs and QA evidence. |
| `revise_artifact` | `workflow` | Link to the existing artifact/project before mutation; if the target artifact is unknown, route to `clarification`. |
| `add_sources_to_project` | `workflow` | Link to the existing Project before adding/processing sources; if the Project is unknown, route to `clarification`. |
| `check_project_status` | `status_query` | Read-only status/evidence query; never creates tasks, projects, workflows, routines, or approvals. |

Research-to-deliverable routes should default to `agent_id: melkizac`, include evidence requirements for sources/artifacts/task IDs, and use skills such as `agent-mission-control-ui`, `pdf`, `pptx`, `docx`, or `youtube-content` only when the route needs those tools. High-confidence deliverable generation may set `create_project: true` or `launch_workflow: true`; medium or low-confidence requests should ask one concise clarification and keep every mutation boolean false.

### Routine recommendation

Use `intent_type: routine_recommendation` and `recommend_routine: true` when the user uses recurring schedule language such as daily, weekly, monthly, every Monday, monitor, watchdog, or recurring report. The router must recommend the Routine with schedule, owner, evidence, and silence/noise policy before installing a cron job unless the user explicitly asked to schedule it.

### Approval gate

Use `intent_type: approval_response` for approve, reject, go ahead, changes requested, ship it, or similar approval language. Updating an existing approval is not a new approval request, so `approval_required` is normally false for the router output. If the approval target is not known, use `clarification` instead of guessing.

### Agent handoff

Use `intent_type: agent_handoff` when the user names or implies a logical coworker such as Content Ops, LinkedIn Growth, Nexius Leads, or DevOps. Set `create_task: true` and `agent_id` to the target logical agent so the work becomes visible and auditable.

### Clarification

Use `intent_type: clarification` when confidence is below 0.6, when a terse pronoun command has no selected target, when required project context is missing, or when the requested side effect would require an approval target that cannot be identified. Clarification routes must not create tasks, create projects, launch workflows, install routines, publish, or mutate approvals.

## Acceptance criteria

1. The main chat router can emit every required schema field: `intent_type`, `research_deliverable_intent`, `confidence`, `rationale`, `project_required`, `suggested_project_id`, `create_task`, `create_project`, `launch_workflow`, `recommend_routine`, `one_time_reply`, `agent_id`, `tools_required`, `skills_required`, `evidence_required`, and `approval_required`.
2. At least 23 representative prompts are captured as fixtures in `tests/fixtures/agent_os_intent_router_cases.json`.
3. Fixtures cover simple one-time answer, status query, evidence query, Kanban task, missing-project task, project creation, workflow launch, routine recommendation, approval response, external publish approval, ambiguous pronoun clarification, agent handoff, and every research-to-deliverable sub-intent.
4. Unit/fixture tests validate every fixture includes the complete schema and expected decision booleans.
5. API inspection must be side-effect free: `GET /api/agent-os/intent-router/spec` returns schema, decision rules, fixture count, and representative cases without creating tasks, projects, workflows, routines, approvals, files, or external messages.
6. Any route with `confidence < 0.6` must not mutate state: `create_task`, `create_project`, `launch_workflow`, `recommend_routine`, and `approval_required` must all be false.
7. Any route with `approval_required: true` must produce an Approval Gate or task handoff before external-facing, irreversible, destructive, costly, policy-sensitive, or authority-bound execution.
8. Any route with `evidence_required: true` must tell the executor what evidence must be returned.

## API inspection shape

`GET /api/agent-os/intent-router/spec` returns:

```json
{
  "schema": {"fields": ["intent_type", "research_deliverable_intent", "confidence", "rationale", "project_required", "suggested_project_id", "create_task", "create_project", "launch_workflow", "recommend_routine", "one_time_reply", "agent_id", "tools_required", "skills_required", "evidence_required", "approval_required"]},
  "intent_types": ["one_time_reply", "status_query", "evidence_query", "kanban_task", "project", "workflow", "routine_recommendation", "approval_response", "agent_handoff", "clarification"],
  "research_deliverable_intents": ["learn_topic", "ask_sources", "summarize_sources", "compare_sources", "generate_deck", "generate_report", "generate_proposal", "generate_training_material", "revise_artifact", "add_sources_to_project", "check_project_status"],
  "decision_rules": ["Simple one-time answer", "Kanban task", "Project", "Workflow", "Research-to-deliverable intents", "Routine recommendation", "Approval gate"],
  "fixture_count": 23,
  "cases": []
}
```

The API is inspect-only. It must not call task/project/workflow/routine creation helpers and must be safe to query from tests, browser automation, or Mission Control UI diagnostics.
