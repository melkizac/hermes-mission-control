# Research-to-Deliverable Project Contract

This contract defines the durable Mission Control Project template created or linked when the main chat detects a research-to-deliverable request: learning over sources, source Q&A, synthesis, proposal/report generation, editable PPTX/DOCX creation, training-material generation, artifact revision, or source expansion.

The contract is intentionally implementation-facing. It gives backend, frontend, Kanban, and agent workers a shared shape for project metadata, sources, outputs, evidence, approval gates, task graphs, and API payloads.

Related specs:

- `docs/AGENT_OS_INTENT_ROUTER_SPEC.md`
- `docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md`
- `docs/OPEN_NOTEBOOK_WRAPPER.md`
- `docs/plans/2026-06-08-research-to-deliverable-chat-workflow.md`

## Product boundary

Primary interaction remains chat-triggered:

1. User asks Melkizac for research, learning, source Q&A, deck/report/proposal, training material, or artifact revision.
2. The Agent OS intent router emits a side-effect-free route decision.
3. High-confidence, policy-safe requests create or link a Mission Control Project and queue a dependency-linked Kanban graph.
4. Medium/low-confidence or risky requests show a compact intent card and ask for the missing decision before mutation.
5. The Project stores sources, outputs, evidence, task graph state, and approval policy.
6. The Project-aware drawer becomes the supervision cockpit; final editable artifacts return to chat and are stored under the Project.

Do not implement this as a separate standalone Research Studio/menu-first app. Mission Control is the management, audit, and trust layer; chat is the command layer.

## Canonical identifiers

| Identifier | Format | Required | Notes |
| --- | --- | --- | --- |
| `project_id` | stable string, e.g. `rtd_ai_workforce_for_smes` or UUID | yes after create/link | Mission Control Project id. |
| `tenant` | `project:<project_id>` or workflow-specific key | yes | Kanban task grouping and board/project filtering key. |
| `origin_session_id` | Hermes session id | yes when chat-triggered | Source conversation for traceability. |
| `origin_message_id` | Hermes message id or platform message id | yes when available | User request that caused creation/linking. |
| `route_id` | generated router decision id or hash | recommended | Links side-effect-free route preview to mutation. |
| `lead_agent_id` | `melkizac` by default | yes | Main operator/owner. |
| `workflow_type` | `research_to_deliverable` | yes | Lets project drawer choose the specialized cockpit tabs. |

## Project metadata schema

A Research-to-Deliverable Project must preserve enough context for agents to resume work without asking the user to repeat intent.

```json
{
  "project_id": "rtd_ai_workforce_for_smes",
  "workflow_type": "research_to_deliverable",
  "title": "AI Workforce for SMEs Training Deck",
  "objective": "Create an editable training deck and facilitator briefing from supplied source materials.",
  "status": "active",
  "stage": "sources_collected",
  "tenant": "project:rtd_ai_workforce_for_smes",
  "created_at": "2026-06-08T05:10:00+08:00",
  "updated_at": "2026-06-08T05:12:00+08:00",
  "lead_agent_id": "melkizac",
  "supporting_agents": ["content-ops", "devops"],
  "origin": {
    "source": "mission_control_chat",
    "channel": "web_ui",
    "session_id": "sess_...",
    "message_id": "msg_...",
    "user_id": "melverick",
    "workspace_id": "devops",
    "requested_at": "2026-06-08T05:09:40+08:00"
  },
  "intent": {
    "intent_type": "project",
    "research_deliverable_intent": "generate_training_material",
    "confidence": 0.88,
    "rationale": "User requested an editable deck from multiple source materials.",
    "project_required": true,
    "approval_required": false
  },
  "requirements": {
    "audience": "Singapore SME leaders",
    "tone": "practical, operator-led, anti-fluff",
    "brand": "Nexius Academy",
    "language": "en-SG",
    "deliverable_purpose": "training",
    "citation_required": true,
    "editable_required": true,
    "deadline": null,
    "constraints": ["Do not publish externally without approval"]
  },
  "summary": {
    "current_stage_label": "Sources collected",
    "next_action": "Process sources and generate research notes",
    "progress_percent": 30,
    "needs_human": false,
    "latest_output_id": null
  }
}
```

### Required project metadata fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `project_id` | string | yes | Stable project identifier. |
| `workflow_type` | enum | yes | Must be `research_to_deliverable`. |
| `title` | string | yes | Human-readable project title. |
| `objective` | string | yes | One-sentence outcome. |
| `status` | enum | yes | `draft`, `active`, `waiting_for_user`, `blocked`, `ready_for_review`, `delivered`, `archived`. |
| `stage` | enum | yes | One of the workflow stages below. |
| `tenant` | string | yes | Kanban/project filter key. |
| `lead_agent_id` | string | yes | Defaults to `melkizac`. |
| `origin` | object | yes | Chat/session/message provenance. |
| `intent` | object | yes | Router decision snapshot. |
| `requirements` | object | yes | Audience, brand, output, citation, and policy requirements. |
| `summary` | object | yes | UI summary and next-action state. |

### Optional project metadata fields

| Field | Type | Notes |
| --- | --- | --- |
| `supporting_agents` | string[] | Logical agents/workers involved. |
| `linked_project_ids` | string[] | Existing project records merged or referenced. |
| `selected_model_policy` | object | Model/router hints, cost caps, provider constraints. |
| `workspace_paths` | string[] | Local working dirs or artifact dirs. Never expose secrets. |
| `external_refs` | object[] | Drive folder, CRM/campaign, LMS, or client links. |
| `tags` | string[] | Search/filter labels. |

## Workflow stages

Every stage entry should carry a status, owner/tool, timestamp, and evidence reference when available.

| Stage key | Label | Typical owner | Completion evidence |
| --- | --- | --- | --- |
| `intent_understood` | Intent understood | `melkizac` | Router decision / chat card. |
| `project_linked` | Project created or linked | Mission Control backend | Project id and tenant. |
| `sources_collected` | Sources collected | `melkizac` / user | Source records with checksums/URLs. |
| `sources_processed` | Sources processed | research worker | Extracted text, transcript, parse logs. |
| `research_notes_generated` | Research notes generated | research worker | Notes artifact with citation map. |
| `outline_drafted` | Outline drafted | content worker | Outline artifact / version. |
| `pptx_generated` | Editable PPTX generated | document worker | `.pptx` artifact validation. |
| `docx_generated` | Editable DOCX generated | document worker | `.docx` artifact validation. |
| `qa_complete` | QA/verification complete | QA worker | Verification entries, screenshots/renders. |
| `ready_or_delivered` | Ready for review or delivered | `melkizac` | Chat output card, approval/delivery record. |

Stage status values: `not_started`, `queued`, `running`, `waiting_for_user`, `blocked`, `done`, `skipped`, `failed`.

## Source schema

Sources are first-class records. They must be traceable, reprocessable, and safe to cite.

```json
{
  "source_id": "src_001",
  "project_id": "rtd_ai_workforce_for_smes",
  "kind": "pdf",
  "title": "AI Workforce Workshop Brief.pdf",
  "uri": "mission-control://uploads/2026/06/brief.pdf",
  "origin": "uploaded_file",
  "mime_type": "application/pdf",
  "size_bytes": 482991,
  "checksum_sha256": "...",
  "added_by": "melverick",
  "added_at": "2026-06-08T05:10:12+08:00",
  "processing": {
    "status": "processed",
    "started_at": "2026-06-08T05:11:00+08:00",
    "completed_at": "2026-06-08T05:11:50+08:00",
    "worker_task_id": "t_...",
    "parser": "pymupdf",
    "text_artifact_id": "art_text_001",
    "token_count": 12400,
    "error": null
  },
  "citation": {
    "citation_allowed": true,
    "citation_label": "AI Workforce Workshop Brief, p. 4",
    "coverage": "full",
    "health": "good"
  },
  "security": {
    "sensitivity": "internal",
    "external_provider_allowed": false,
    "redaction_required": false
  }
}
```

### Required source fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `source_id` | string | yes | Stable within project. |
| `kind` | enum | yes | `file`, `pdf`, `docx`, `pptx`, `url`, `youtube`, `audio`, `video`, `text`, `markdown`, `drive_doc`, `other`. |
| `title` | string | yes | Display title. |
| `uri` | string | yes | Internal upload URL/path or external URL. Redact signed URLs. |
| `origin` | enum | yes | `uploaded_file`, `url`, `chat_attachment`, `project_existing`, `generated_artifact`, `manual_note`. |
| `processing.status` | enum | yes | `pending`, `processing`, `processed`, `failed`, `skipped`, `blocked`. |
| `citation.citation_allowed` | boolean | yes | Whether citation may be shown. |
| `security.sensitivity` | enum | yes | `public`, `internal`, `confidential`, `client_sensitive`, `restricted`. |

### Source processing rules

- Do not send `confidential`, `client_sensitive`, or `restricted` sources to external providers unless the approval policy explicitly allows it and an Approval Gate records the decision.
- Store file checksums for uploaded/local files when feasible.
- Preserve a safe extracted-text artifact reference rather than returning full extracted text in list APIs.
- Keep citation labels human-readable and stable enough for artifact footnotes.
- Failed processing must create a task/evidence entry visible in the project drawer, not silently disappear.

## Output and artifact schema

Outputs describe requested deliverables. Artifacts are concrete generated files/records that satisfy outputs.

```json
{
  "output_id": "out_training_deck",
  "type": "pptx",
  "title": "AI Workforce for SMEs Training Deck",
  "requested": true,
  "status": "draft_generated",
  "requirements": {
    "editable": true,
    "target_length": "20-25 slides",
    "brand_template": "nexius_academy",
    "include_citations": true,
    "include_speaker_notes": true
  },
  "artifacts": [
    {
      "artifact_id": "art_pptx_v1",
      "version": 1,
      "type": "pptx",
      "title": "AI Workforce for SMEs Training Deck v1",
      "uri": "mission-control://artifacts/rtd_ai_workforce_for_smes/deck_v1.pptx",
      "mime_type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "size_bytes": 2198831,
      "checksum_sha256": "...",
      "created_at": "2026-06-08T05:30:00+08:00",
      "created_by_task_id": "t_...",
      "source_artifact_ids": ["art_notes_v1", "art_outline_v1"],
      "qa_status": "passed",
      "approval_state": "not_required_for_internal_draft",
      "actions": ["download", "preview", "revise", "view_evidence"]
    }
  ]
}
```

### Output types

Supported `type` values:

- `notes`
- `outline`
- `markdown`
- `pptx`
- `docx`
- `pdf`
- `citation_map`
- `qa_report`
- `drive_folder`
- `chat_summary`

### Output status values

`requested`, `queued`, `generating`, `draft_generated`, `qa_running`, `ready_for_review`, `approved`, `delivered`, `revision_requested`, `failed`, `blocked`, `skipped`.

### Artifact requirements

Every generated artifact should include:

- stable `artifact_id`;
- `type`, `title`, `version`, and `uri`;
- creator task/run id when available;
- checksum and size for local files when feasible;
- source artifact/source references;
- QA state;
- approval state;
- safe UI actions.

Never expose raw local paths, signed URLs, secret-bearing query strings, or private provider payloads to normal user APIs unless the user is authorized and the path is intentionally downloadable through Mission Control.

### Local editable PPTX/DOCX generation wrapper

Mission Control includes a local, stdlib-first wrapper for the editable draft stage:

```bash
python3 scripts/document_artifact_generator.py generate \
  --notes tests/fixtures/research_deliverable_notes.md \
  --out /tmp/hmc-docgen-sample \
  --title "AI Workforce for SMEs" \
  --brand "Nexius Academy" \
  --audience "Singapore SME leaders"
```

The wrapper emits an editable `.pptx`, editable `.docx`, a PNG deck preview/contact sheet, a DOCX text preview, and an artifact manifest with validation evidence. If no Nexius/Melverick Office template file is present in the repository, the wrapper uses a clean Nexius-styled default rather than blocking draft generation.

Validation-only mode is available for artifact QA and worker readbacks:

```bash
python3 scripts/document_artifact_generator.py validate /path/to/deck.pptx --kind pptx
python3 scripts/document_artifact_generator.py validate /path/to/briefing.docx --kind docx
```

## Evidence schema

Evidence records are short, safe, auditable pointers proving what happened. They are not raw logs dumps.

```json
{
  "evidence_id": "ev_source_parse_001",
  "project_id": "rtd_ai_workforce_for_smes",
  "kind": "source_processing_log",
  "title": "Parsed AI Workforce Workshop Brief.pdf",
  "summary": "Extracted 32 pages and 12,400 tokens with pymupdf; no parser errors.",
  "created_at": "2026-06-08T05:11:50+08:00",
  "actor": "research-worker",
  "task_id": "t_...",
  "run_id": "run_...",
  "artifact_id": "art_text_001",
  "source_ids": ["src_001"],
  "uri": "mission-control://evidence/rtd_ai_workforce_for_smes/source_parse_001.json",
  "visibility": "project",
  "redaction_status": "safe_summary",
  "verification": {
    "status": "passed",
    "checks": ["source_exists", "text_extracted", "checksum_recorded"]
  }
}
```

### Evidence kinds

- `router_decision`
- `project_created`
- `source_added`
- `source_processing_log`
- `research_notes`
- `citation_map`
- `outline_version`
- `artifact_generation_log`
- `artifact_validation`
- `qa_screenshot`
- `qa_render`
- `api_response`
- `approval_decision`
- `delivery_record`
- `error_log`
- `blocker`

### Evidence rules

- Evidence list APIs should return summaries and links, not full raw logs by default.
- Secret-like values, tokens, cookies, signed URLs, and credentials must be redacted before storage or display.
- Evidence must include at least one provenance pointer: task id, run id, source id, artifact id, API request id, or chat/session id.
- Verification failures should become visible `Needs you`, `blocked`, or `failed` state depending on ownership.

## Approval policy schema

Approval policy determines when the workflow can proceed automatically versus when Mission Control must create an Approval Gate or Task Board attention item.

```json
{
  "policy_id": "rtd_default_internal_draft",
  "mode": "auto_internal_drafts",
  "auto_proceed": [
    "source_summary",
    "research_notes",
    "outline_draft",
    "local_pptx_draft",
    "local_docx_draft",
    "local_qa",
    "local_revision"
  ],
  "confirm_before": [
    "large_batch_processing",
    "long_media_transcription",
    "high_cost_model_use",
    "many_output_variants",
    "external_provider_for_sensitive_sources"
  ],
  "approval_gate_required": [
    "client_send",
    "public_publish",
    "drive_share_external",
    "delete_sources_or_artifacts",
    "production_system_change",
    "restricted_data_to_external_provider"
  ],
  "needs_you_rules": [
    "missing_required_source",
    "ambiguous_brand_or_audience",
    "missing_artifact_target_for_revision",
    "policy_decision_required",
    "credential_or_access_missing"
  ],
  "default_approval_state_for_internal_drafts": "not_required_for_internal_draft"
}
```

### Approval states

Artifact or action approval states:

- `not_required_for_internal_draft`
- `confirmation_required`
- `approval_required`
- `approval_pending`
- `approved`
- `rejected`
- `changes_requested`
- `superseded`

### Approval routing

Use these Mission Control surfaces:

| Situation | Surface | Reason |
| --- | --- | --- |
| Internal draft generation | No approval; show evidence | Low-risk local artifact. |
| Missing source/brand/audience/artifact target | Task Board / `Needs you` | Human input needed, not approve/reject. |
| Costly/long-running work | Confirmation card or Task Board attention | Human cost/time decision. |
| External send/share/publish/delete | Approval Gate | Protective approve/reject step. |
| Sensitive data to external provider | Approval Gate | Policy-sensitive data movement. |
| Tool credential/access missing | Task Board blocker | Access gap, not content approval. |

Do not overload Approval Gates with normal internal draft work. Do not hide genuine external-facing or destructive actions in generic Task Board items.

## Task graph shape

The default Kanban graph should be created under the Project tenant and adjusted to requested outputs. Task ids below are logical roles, not literal ids.

```json
{
  "tenant": "project:rtd_ai_workforce_for_smes",
  "project_id": "rtd_ai_workforce_for_smes",
  "graph_template": "research_to_deliverable_v1",
  "tasks": [
    {
      "key": "intake_confirm",
      "title": "Confirm research-to-deliverable intake",
      "assignee": "melkizac",
      "status": "done",
      "parents": [],
      "stage": "intent_understood"
    },
    {
      "key": "process_sources",
      "title": "Process sources and extract citation-ready text",
      "assignee": "research-worker",
      "parents": ["intake_confirm"],
      "stage": "sources_processed"
    },
    {
      "key": "synthesize_notes",
      "title": "Generate research notes and citation map",
      "assignee": "content-ops",
      "parents": ["process_sources"],
      "stage": "research_notes_generated"
    },
    {
      "key": "draft_outline",
      "title": "Draft deliverable outline",
      "assignee": "content-ops",
      "parents": ["synthesize_notes"],
      "stage": "outline_drafted"
    },
    {
      "key": "generate_pptx",
      "title": "Generate editable PPTX artifact",
      "assignee": "devops",
      "parents": ["draft_outline"],
      "stage": "pptx_generated",
      "include_when": "outputs contains pptx"
    },
    {
      "key": "generate_docx",
      "title": "Generate editable DOCX artifact",
      "assignee": "devops",
      "parents": ["draft_outline"],
      "stage": "docx_generated",
      "include_when": "outputs contains docx"
    },
    {
      "key": "qa_artifacts",
      "title": "QA generated artifacts and evidence",
      "assignee": "qa-worker",
      "parents": ["generate_pptx", "generate_docx"],
      "stage": "qa_complete"
    },
    {
      "key": "deliver_to_chat",
      "title": "Return artifact cards and evidence to chat",
      "assignee": "melkizac",
      "parents": ["qa_artifacts"],
      "stage": "ready_or_delivered"
    }
  ]
}
```

### Task body requirements

Every generated Kanban task body should include:

- Project id and tenant.
- Objective and requested outputs.
- Required source/artifact/evidence ids.
- Acceptance criteria.
- Verification commands or API/browser checks where relevant.
- Approval/Needs-you policy for the task.
- Safe file/output paths or API references.

### Dependency rules

- `process_sources` waits for required sources or a human source-upload task.
- `synthesize_notes` waits for processed sources.
- `draft_outline` waits for research notes/citation map.
- Artifact-generation tasks wait for outline.
- QA waits for all generated artifacts that are requested and not skipped.
- Delivery waits for QA or explicit override/approval.
- External sharing tasks must wait for Approval Gate approval.

## Project-aware drawer payload shape

The frontend drawer should be able to render the workflow cockpit from one project detail payload.

```json
{
  "project": {},
  "stages": [],
  "sources": [],
  "outputs": [],
  "evidence": [],
  "task_graph": {
    "tenant": "project:rtd_ai_workforce_for_smes",
    "tasks": [],
    "links": []
  },
  "needs_you": [],
  "approval_policy": {},
  "chat_cards": [],
  "permissions": {
    "can_add_sources": true,
    "can_reprocess_sources": true,
    "can_generate_outputs": true,
    "can_share_external": false,
    "can_delete_artifacts": false
  }
}
```

Drawer tabs consume the payload as follows:

| Tab | Required payload slices |
| --- | --- |
| Overview | `project`, `stages`, `needs_you`, latest `outputs`, latest `evidence`. |
| Sources | `sources`, source processing/evidence links, source permissions. |
| Tasks | `task_graph`, task statuses, blockers, dependencies. |
| Outputs | `outputs`, artifacts, QA status, artifact actions. |
| Evidence | `evidence`, verification status, safe links. |
| Settings | `project.requirements`, `approval_policy`, permissions, model/tool hints. |

## Mission Control API payload shapes

These are proposed route shapes. Existing route names may be adapted, but payload semantics should remain stable.

### Create or link Project from route preview

`POST /api/projects/research-to-deliverable`

Request:

```json
{
  "route": {
    "intent_type": "project",
    "research_deliverable_intent": "generate_deck",
    "confidence": 0.91,
    "rationale": "User requested an editable deck from uploaded sources.",
    "project_required": true,
    "suggested_project_id": null,
    "create_project": true,
    "launch_workflow": true,
    "approval_required": false
  },
  "origin": {
    "source": "mission_control_chat",
    "channel": "web_ui",
    "session_id": "sess_...",
    "message_id": "msg_...",
    "workspace_id": "devops"
  },
  "project": {
    "title": "AI Workforce for SMEs Training Deck",
    "objective": "Create editable PPTX and DOCX materials from source uploads.",
    "requirements": {
      "audience": "Singapore SME leaders",
      "brand": "Nexius Academy",
      "tone": "practical, operator-led",
      "citation_required": true
    }
  },
  "sources": [
    {
      "kind": "pdf",
      "title": "Workshop brief.pdf",
      "uri": "mission-control://uploads/...",
      "security": {"sensitivity": "internal"}
    }
  ],
  "requested_outputs": [
    {"type": "pptx", "title": "Training deck", "requirements": {"editable": true}},
    {"type": "docx", "title": "Facilitator briefing", "requirements": {"editable": true}}
  ],
  "approval_policy": {
    "mode": "auto_internal_drafts"
  },
  "options": {
    "create_task_graph": true,
    "return_drawer_payload": true,
    "dry_run": false
  }
}
```

Response:

```json
{
  "project_id": "rtd_ai_workforce_for_smes",
  "tenant": "project:rtd_ai_workforce_for_smes",
  "created": true,
  "linked_existing": false,
  "task_ids": {
    "process_sources": "t_...",
    "synthesize_notes": "t_...",
    "draft_outline": "t_...",
    "generate_pptx": "t_...",
    "generate_docx": "t_...",
    "qa_artifacts": "t_...",
    "deliver_to_chat": "t_..."
  },
  "evidence_ids": ["ev_project_created_001", "ev_router_decision_001"],
  "chat_card": {
    "kind": "research_to_deliverable_project",
    "title": "Research-to-Deliverable Project",
    "detected_intent": "Create editable training deck from source materials",
    "project_title": "AI Workforce for SMEs Training Deck",
    "outputs": ["PPTX deck", "DOCX briefing"],
    "sources_summary": "1 uploaded file",
    "status": "Processing sources",
    "actions": ["open_task_drawer", "add_sources", "change_outputs"]
  },
  "drawer_payload": {}
}
```

### Preview without mutation

`POST /api/projects/research-to-deliverable/preview`

This route must be side-effect free. Use it when confidence is medium, the project target is ambiguous, or the UI needs to render a confirmation card before creating tasks.

Response fields should include:

- normalized route;
- proposed project metadata;
- proposed sources and outputs;
- proposed task graph template;
- approval policy summary;
- missing required decisions;
- mutation eligibility.

### Get Project cockpit details

`GET /api/projects/<project_id>/research-to-deliverable`

Returns the project-aware drawer payload with `project`, `stages`, `sources`, `outputs`, `evidence`, `task_graph`, `needs_you`, `approval_policy`, `chat_cards`, and `permissions`.

### Add source to Project

`POST /api/projects/<project_id>/sources`

Request includes source metadata and optional `process_now`. If source sensitivity or provider policy requires human action, response must create or reference `needs_you`/Approval Gate rather than processing silently.

### Request artifact revision

`POST /api/projects/<project_id>/artifacts/<artifact_id>/revisions`

Request includes revision instruction, expected output type/version behavior, and approval/cost policy. If `artifact_id` is missing or not visible to the user, route to clarification instead of creating ambiguous work.

## Chat card shape

A compact chat card should mirror project state without exposing backend complexity.

```json
{
  "kind": "research_to_deliverable_project",
  "project_id": "rtd_ai_workforce_for_smes",
  "title": "Research-to-Deliverable Project",
  "detected_intent": "Create editable training deck from source materials",
  "project_title": "AI Workforce for SMEs Training Deck",
  "outputs": ["PPTX deck", "DOCX briefing", "citation notes"],
  "sources_summary": "3 uploaded files, 2 URLs",
  "status": "Preparing task plan",
  "confidence_label": "High confidence",
  "needs_you": null,
  "actions": [
    {"id": "review_plan", "label": "Review plan"},
    {"id": "open_task_drawer", "label": "Open task drawer"},
    {"id": "add_sources", "label": "Add sources"},
    {"id": "change_outputs", "label": "Change outputs"}
  ]
}
```

## Validation and invariants

1. `workflow_type` must be `research_to_deliverable` for this template.
2. `origin.session_id` or equivalent provenance is required for chat-triggered creation.
3. `intent.research_deliverable_intent` must be one of the router-supported sub-intents or null only for manual Project creation.
4. Any mutation from chat must preserve the original route decision snapshot.
5. `confidence < 0.6` must not create Projects, tasks, workflows, approvals, files, external messages, or provider calls.
6. External send/share/publish/delete requires an Approval Gate before execution.
7. Sensitive data to external providers requires explicit approval evidence.
8. Every output artifact must reference at least one generating task/run or source artifact.
9. Every generated Kanban task must carry `tenant` and `project_id` context.
10. Drawer list payloads must be safe summaries; raw logs and secrets stay behind authorized detail routes or are redacted.

## Acceptance checklist

A first implementation satisfies this contract when:

- Project creation/linking stores required metadata fields.
- Source records support type, URI, processing status, citation health, and sensitivity.
- Requested outputs and generated artifacts have statuses, versions, URIs, QA status, and evidence links.
- Evidence records include safe summaries plus task/run/source/artifact provenance.
- Approval policy distinguishes internal auto-draft work, costly confirmations, Task Board `Needs you`, and Approval Gates.
- Default Kanban task graph is dependency-linked and scoped by project tenant.
- A project detail API can render Overview, Sources, Tasks, Outputs, Evidence, and Settings tabs.
- Side-effect-free preview exists for ambiguous or medium-confidence requests.
- High-confidence safe requests can return a chat card plus Project/task ids.
- Low-confidence requests and missing artifact/project targets do not mutate state.
