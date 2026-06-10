# Melkizac Research-to-Deliverable Operator SOP

This SOP tells Melkizac how to operate the Mission Control research-to-deliverable workflow from normal chat. It is the operator-facing companion to:

- `docs/AGENT_OS_INTENT_ROUTER_SPEC.md`
- `docs/RESEARCH_TO_DELIVERABLE_PROJECT_CONTRACT.md`
- `docs/OPEN_NOTEBOOK_WRAPPER.md`
- `docs/plans/2026-06-08-research-to-deliverable-chat-workflow.md`

Mission Control remains the management, audit, and trust layer. Chat remains the command layer. Melkizac should not send the user to a standalone research app as the primary experience.

## 1. Operating principles

1. Detect the user's real intent from chat, attachments, selected Project, selected Mission, permission mode, and any referenced sources/artifacts.
2. Decide before mutating. Produce a side-effect-free route decision first.
3. Create or link a Mission Control Project when the work has durable context, multiple steps, source material, citations, artifacts, review, or future reuse.
4. Create dependency-linked Task Board/Kanban tasks for multi-step work. Do not hide long-running work inside a single chat answer.
5. Preserve source, artifact, task, run, approval, and evidence references so the operator can inspect what happened.
6. Use `Needs you` only for genuine human action: missing source, ambiguous Project/artifact, business decision, access gap, cost/time confirmation, or approval boundary.
7. Auto-proceed for low-risk internal drafts when the user has asked for the work and enough context is available.
8. Require Approval Gates for external send/share/publish, deleting data, production changes, and sensitive data movement to external providers.
9. Return outputs in chat as artifact cards and store them under the Project.
10. Never print secrets, signed URLs, raw credentials, or sensitive source text in chat, task comments, or evidence summaries.

## 2. Detection and routing checklist

For every chat request, classify these fields before acting:

```text
intent_type: one_time_reply | status_query | evidence_query | kanban_task | project | workflow | clarification
research_deliverable_intent: learn_topic | ask_sources | summarize_sources | compare_sources | generate_deck | generate_report | generate_proposal | generate_training_material | revise_artifact | add_sources_to_project | check_project_status | null
confidence: 0.0-1.0
project_required: true/false
suggested_project_id: known project id or null
create_project: true/false
launch_workflow: true/false
create_task: true/false
approval_required: true/false
evidence_required: true/false
```

Use this routing table:

| User asks for | Sub-intent | Default route | Mutation policy |
| --- | --- | --- | --- |
| Learn a topic for future use | `learn_topic` | `project` | Create/link Project if durable objective, sources, or evidence are needed. |
| Ask a question over known sources | `ask_sources` | `one_time_reply` or `workflow` | Answer read-only if Project/sources are known and processed; clarify if missing; workflow if source processing is needed. |
| Summarize sources | `summarize_sources` | `one_time_reply` or `workflow` | Read-only for processed sources; workflow for extraction/synthesis. |
| Compare sources | `compare_sources` | `one_time_reply` or `workflow` | Read-only for processed sources; workflow for multi-source processing. |
| Create a deck | `generate_deck` | `project` or `workflow` | Create/link Project and task graph for PPTX plus evidence. |
| Create a report | `generate_report` | `project` or `workflow` | Create/link Project and task graph for DOCX/Markdown/PDF plus evidence. |
| Create a proposal | `generate_proposal` | `project` or `workflow` | Create/link Project; require approval before client-facing sharing. |
| Create lesson/training materials | `generate_training_material` | `project` or `workflow` | Create/link Project and task graph for deck/workbook/facilitator notes. |
| Revise an existing artifact | `revise_artifact` | `workflow` | Link exact artifact first; clarify when artifact is unknown. |
| Add sources to existing work | `add_sources_to_project` | `workflow` | Link exact Project first; clarify when Project is unknown. |
| Ask what is happening | `check_project_status` | `status_query` | Read-only; never create tasks/projects. |

Confidence rules:

- `confidence >= 0.8` and policy-safe: proceed with Project/workflow creation when required context exists.
- `0.6 <= confidence < 0.8`: show a compact intent card and ask one concise confirmation or missing decision before mutation.
- `confidence < 0.6`: ask clarification and keep all mutation booleans false.

## 3. Clarification rules

Ask one concise question when the answer changes the task graph, source set, artifact target, approval policy, or external side effect.

Clarify when:

- The target Project is missing and cannot be inferred from selected Project/chat context.
- The user says “revise this” but no artifact is selected or named.
- The user asks source Q&A but no sources are known or processed.
- Brand/audience/output type is ambiguous enough to change the artifact materially.
- Source sensitivity requires a provider/data movement decision.
- The request implies external delivery, publication, or client sending without an approval target.
- The user asks for a large/costly/long-running job without enough scope.

Do not clarify when Melkizac can choose a safe default and record it as evidence. Examples:

- Default to Nexius Academy brand for training/course materials unless the selected Project or user says otherwise.
- Default to practical, operator-led, anti-fluff tone for Melverick/Nexius outputs.
- Default to internal draft, not external publication.
- Default to citations/evidence for source-based deliverables.

## 4. Project creation and task graph SOP

Create or link a Research-to-Deliverable Project when any of these are true:

- Multiple sources are involved.
- The user requested a deliverable artifact: PPTX, DOCX, report, proposal, workbook, PDF, or briefing.
- The workflow has more than one execution step.
- Sources must be processed, cited, compared, or reused later.
- Human review, QA, or approval is needed.
- Work may continue across sessions.

Project metadata must include at minimum:

```text
project_id
tenant = project:<project_id>
workflow_type = research_to_deliverable
title
objective
origin session/message
lead_agent_id = melkizac
intent snapshot
requirements: audience, tone, brand, outputs, citation requirement, editable requirement, constraints
summary: stage, next action, progress, needs_human, latest output
```

Default dependency graph:

```text
intake_confirm          -> done by Melkizac / router
process_sources         -> research worker / Open Notebook wrapper or parser
synthesize_notes        -> content worker / citation map
 draft_outline          -> content worker
 generate_pptx          -> document worker / DevOps when PPTX requested
 generate_docx          -> document worker / DevOps when DOCX/report requested
 qa_artifacts           -> QA worker
 deliver_to_chat        -> Melkizac
```

Adjust the graph to the requested outputs. For a simple source Q&A over already processed sources, do not create the full artifact graph; use a read-only answer with citations and evidence links.

Every task body should include:

- Project id and tenant.
- Objective and requested output(s).
- Source ids/artifact ids needed for the task.
- Acceptance criteria.
- Verification commands or expected evidence.
- Approval/Needs-you policy.
- Safe output path or Mission Control artifact reference.

## 5. Source processing SOP

Sources may be uploaded files, chat attachments, URLs, YouTube videos, audio/video, Drive docs, generated artifacts, text snippets, or existing Project sources.

For each source:

1. Create a source record with title, kind, URI/reference, origin, sensitivity, citation permission, and checksum when feasible.
2. Validate access and safety before ingestion.
3. Use the controlled wrapper for Open Notebook actions when configured: `scripts/open_notebook_wrapper.py`.
4. Use local parsers where appropriate for files and safe text extraction.
5. Store extracted text as an artifact/reference; do not dump full raw extracted text into chat or task comments.
6. Create evidence for processing: parser/wrapper, status, token/page count when available, source id, task id, and safe summary.
7. If processing fails, create a visible failed/blocker state with a short reason and next required action.

Safety rules:

- Reject source URLs with embedded credentials.
- Do not expose signed URLs or private file paths to unauthorized users.
- Do not send confidential, client-sensitive, restricted, or personally sensitive sources to external providers unless approval evidence exists.
- Use safe summaries in evidence; raw logs stay behind authorized detail routes.

## 6. Artifact generation and QA SOP

For deliverables, generate editable artifacts when requested and feasible:

- PPTX for decks/training slides.
- DOCX for reports, proposals, facilitator notes, workbooks, and briefings.
- Markdown/notes/citation map as intermediate and reviewable artifacts.
- PDF only as a final export or convenience copy; never as the only editable output when editability was requested.

Document-generation workers should use the local wrapper when appropriate:

```bash
python3 scripts/document_artifact_generator.py generate \
  --notes tests/fixtures/research_deliverable_notes.md \
  --out /tmp/hmc-docgen-sample \
  --title "AI Workforce for SMEs" \
  --brand "Nexius Academy" \
  --audience "Singapore SME leaders"
```

QA must verify:

- Artifact exists and has non-zero size.
- Artifact is editable/openable for its type.
- Manifest/checksum/size exists when feasible.
- Source/citation references are preserved.
- Preview/render or text extraction is usable when tooling is available.
- No secrets, signed URLs, or private credentials appear in output/evidence.
- Approval state is correct.

Return artifact cards to chat with safe actions:

```text
Open / Download
Preview
Revise
View evidence
```

## 7. Blockers, Needs-you, and approvals

Use the right surface:

| Situation | Surface | Example |
| --- | --- | --- |
| Missing source upload | Task Board `Needs you` | “Please upload the workbook source before source processing can start.” |
| Ambiguous Project/artifact | Chat clarification or `Needs you` | “Which project/artifact should I revise?” |
| Credential/runtime missing | Task Board blocker | “Open Notebook runtime is not reachable at configured base URL.” |
| Long/costly processing | Confirmation card | “Transcribing 6 hours of video may take time/cost; proceed?” |
| External send/share/publish | Approval Gate | “Approve sending proposal to client?” |
| Deletion or production change | Approval Gate | “Approve deleting source records?” |
| Sensitive provider use | Approval Gate | “Approve sending client-sensitive sources to external model provider?” |

Blocker messages must be ready-to-act: one sentence naming the exact decision or access needed. Add longer diagnostic context in task comments/evidence, not the blocker title.

Do not mark human execution cards blocked just because a human will eventually need to act. If Melkizac still owes exact copy, artifact links, or instructions, keep the human card dependency-waiting until the agent handoff is complete.

## 8. Return-output SOP

When work is complete or needs review, Melkizac should return a chat message/card with:

```text
Project: <project title>
Status: Ready for review | Delivered | Blocked | Needs you
Outputs: <artifact cards with type/version/actions>
Evidence: <task ids, source ids, QA checks, citation map, run id>
Next action: <what the user can do now>
```

For completed drafts, include:

- What was produced.
- Where it is stored in Mission Control.
- Artifact version(s).
- Source/citation coverage summary.
- QA status.
- Approval state.
- Revision action.

For blocked work, include:

- What is blocked.
- The exact missing input/access/decision.
- What will resume after the blocker is resolved.

For status queries, include evidence-backed stage and task statuses; do not create new work unless the user asks for next-step execution.

## 9. Flow examples

### Example A — learn a topic

User:

```text
Melkizac, learn everything useful about AI workforce design for SMEs and keep it for our training work.
```

Route:

```text
intent_type: project
research_deliverable_intent: learn_topic
create_project: true
launch_workflow: true
approval_required: false
evidence_required: true
```

Action:

1. Create/link Project: `AI Workforce Design for SMEs`.
2. Ask for sources only if none are available and external research is not enough.
3. Create tasks for source collection, source processing, research notes, and citation map.
4. Store notes and evidence under the Project.
5. Return: “I created the Project and started research notes. Open Task Board for progress.”

Clarify only if the Project boundary or source policy is ambiguous.

### Example B — source Q&A

User:

```text
In the SkillsFuture source files, what are the grant eligibility requirements?
```

If selected Project and processed sources exist:

```text
intent_type: one_time_reply
research_deliverable_intent: ask_sources
create_project: false
launch_workflow: false
evidence_required: true
```

Action:

1. Search processed source records.
2. Answer with citations/source labels.
3. Link evidence/citation map.
4. Do not create new tasks.

If sources are missing or unprocessed:

1. Ask which Project/source set to use, or
2. Create a source-processing workflow only after the user confirms the source set.

### Example C — deck/report/proposal generation

User:

```text
Create an editable Nexius Academy training deck and facilitator report from these uploaded AI workforce materials.
```

Route:

```text
intent_type: project
research_deliverable_intent: generate_training_material
create_project: true
launch_workflow: true
approval_required: false for internal draft
evidence_required: true
```

Action:

1. Create/link Project.
2. Register uploaded sources.
3. Create dependency-linked task graph: process sources -> notes -> outline -> PPTX/DOCX -> QA -> deliver.
4. Generate editable PPTX and DOCX.
5. QA artifacts and evidence.
6. Return artifact cards with View evidence and Revise actions.

If the user says “send this to client,” add an Approval Gate before sending/sharing.

### Example D — add source to existing Project

User:

```text
Add this YouTube video to the AI Workforce deck project and update the citations.
```

Route when Project is known:

```text
intent_type: workflow
research_deliverable_intent: add_sources_to_project
create_project: false
launch_workflow: true
evidence_required: true
```

Action:

1. Add source record with URL, title, sensitivity, and citation permission.
2. Process/transcribe if allowed.
3. Update citation map/research notes.
4. Queue revision tasks only if outputs must change.
5. Return updated Project/source status.

Clarify when multiple AI Workforce projects match or the Project is not selected.

### Example E — revise artifact

User:

```text
Make the deck more practical for Singapore SME owners and shorten it to 12 slides.
```

If an artifact is selected or clearly latest deck in selected Project:

```text
intent_type: workflow
research_deliverable_intent: revise_artifact
suggested_project_id: <selected project>
launch_workflow: true
evidence_required: true
```

Action:

1. Link the existing artifact id and version.
2. Create revision task with exact instruction, target length, audience, and brand.
3. Generate new version, not overwrite v1 silently.
4. QA new artifact.
5. Return v2 artifact card and explain what changed.

Clarify when the artifact target is unknown.

### Example F — status query

User:

```text
Where is the AI Workforce deck now?
```

Route:

```text
intent_type: status_query
research_deliverable_intent: check_project_status
create_project: false
launch_workflow: false
create_task: false
evidence_required: true
```

Action:

1. Read Project stage, task graph, blockers, latest outputs, and evidence.
2. Return a concise status with task IDs/artifact IDs.
3. If blocked, name the exact next action.
4. Do not create new tasks unless the user asks to proceed.

## 10. Operator verification checklist

A Melkizac run is acceptable when:

- Route decision matches the user's intent and policy.
- Project creation/linking happened only when justified.
- Task graph has dependencies and correct assignees.
- Sources have records, processing status, sensitivity, and citation health.
- Outputs have artifact versions, QA state, and safe actions.
- Evidence records cite task/run/source/artifact ids.
- `Needs you` and Approval Gates are used only for genuine human action.
- Chat response gives the operator a clear current status and next action.
- No secret, raw credential, or sensitive source dump appears in user-visible text.

## 11. Rollback / disable notes

If the workflow misroutes or creates incorrect work:

1. Disable or bypass the mutation bridge while keeping side-effect-free preview available.
2. Archive incorrect Task Board cards with an audit comment explaining why.
3. Keep generated artifacts but mark them superseded unless the user approves deletion.
4. Re-run from the corrected Project/source/artifact context.

If Open Notebook or artifact generation is unavailable:

1. Leave source/project records intact.
2. Block the relevant processing/generation task with the exact missing runtime/tool/credential.
3. Do not fabricate research notes, citations, previews, or artifact validation evidence.
