# Research-to-Deliverable Chat Workflow Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let Melkizac detect research, learning, source-Q&A, report, proposal, training-material, and editable-PPTX/DOCX requests directly from the main chat, then automatically create a Mission Control project with Kanban tasks, source processing, evidence, and deliverable artifact cards.

**Architecture:** The main chat remains the command surface. A side-effect-safe intent router classifies the user request, creates or links a Project when confidence and policy allow, then queues a dependency-linked Kanban task graph. Mission Control exposes progress through an improved project-aware task drawer instead of a standalone app/menu page. Open Notebook or another research backend is treated as a governed tool behind Melkizac, while PPTX/DOCX generation remains an artifact/output pipeline with evidence and approval gates.

**Tech Stack:** Hermes Mission Control React/TypeScript frontend, Python backend in `/opt/hermes-mission-control/app.py`, existing Mission Control Project/Task Board APIs, Hermes Kanban, Open Notebook REST/MCP wrapper, local PPTX/DOCX generation tooling, optional Google Workspace integration.

---

## Product decision

This feature must **not** appear primarily as a standalone menu option or separate research app. The primary UX is:

1. User chats with Melkizac.
2. Melkizac detects intent.
3. Melkizac confirms or proceeds based on confidence/risk.
4. Mission Control creates/links a Project and Kanban task graph.
5. User tracks progress through chat cards and the project-aware task drawer.
6. Final editable artifacts are returned to chat and stored under the Project.

Mission Control remains the management, audit, and trust layer; chat remains the user's command layer.

### 2026-06-10 product refinements

Treat Research-to-Deliverable as the general **source-grounded knowledge-work factory**, not only as a research assistant. Research is one input stage; the product pattern is trusted source handling, synthesis, evidence preservation, editable artifact generation, and Mission Control supervision.

Use these defaults unless the user or project policy says otherwise:

- **Positioning:** source-grounded deliverable generation with governed execution.
- **Default source policy:** user-provided sources and KB pages first; live web research only when requested, when sources are insufficient, or when freshness is required.
- **Default project threshold:** auto-create or resume a project when the request has sources plus a deliverable, more than one execution step, citation/evidence requirements, human review, long-running processing, or future reuse value.
- **Default deliverables:** editable PPTX, DOCX, Markdown, citation/evidence notes; add PDF or Google Workspace artifacts when useful or requested.
- **PPTX quality bar:** editable slides, clear structure, speaker/facilitator notes when relevant, source/evidence pack, and QA pass. Nexius-facing decks should use the practical, operator-led Nexius style.
- **Approval gates:** external publishing, client sending, public/Drive sharing outside intended scope, deletion, production changes, sensitive client data sent to external providers, high-cost runs, or unusually long processing.
- **Auto proceed:** internal drafts, summaries, first editable artifact drafts, local QA, local revisions, and evidence capture.

The first flagship workflow should be: **turn source materials into a Nexius Academy training deck + facilitator notes + citation/evidence pack**.

---

## Core user intents

The router must recognize at least these intents:

- `learn_topic`
- `ask_sources`
- `summarize_sources`
- `compare_sources`
- `generate_deck`
- `generate_report`
- `generate_proposal`
- `generate_training_material`
- `revise_artifact`
- `add_sources_to_project`
- `check_project_status`

These can map onto the existing Agent OS router categories such as `one_time_reply`, `project`, `workflow`, `kanban_task`, `status_query`, and `evidence_query`, but the research-to-deliverable sub-intent should be preserved for UI copy, task templates, and audit.

---

## UX contract

### Main chat behavior

When the user asks for research, learning, source Q&A, deck/report/proposal creation, or deliverable generation, Melkizac should show a compact chat intent card, not route the user to a menu page.

Card example:

```text
Research-to-Deliverable Project
Detected intent: Create editable training deck from source materials
Project: AI Workforce for SMEs
Outputs: PPTX deck, DOCX briefing, citation notes
Sources: 3 uploaded files, 2 URLs
Status: Preparing task plan
Actions: Review plan · Open task drawer · Add sources · Change outputs
```

### Project behavior

Create or link a Project automatically when the request has any of:

- multiple sources
- requested deliverable output
- more than one execution step
- citation/evidence requirement
- human review/approval need
- long-running source processing
- future reuse/resume needs

Project metadata should include:

- objective
- detected intent/sub-intent
- requested outputs
- audience
- source list
- originating chat/session/message
- lead agent: `melkizac`
- supporting tools/agents
- Kanban board/tenant key
- artifacts
- evidence log
- approval policy

### Improved project-aware task drawer

The drawer is the primary supervision surface. It should support tabs:

1. **Overview** — objective, current stage, next action, progress timeline, latest output, `Needs you` block.
2. **Sources** — file/URL/video/audio list, type, status, extracted-text preview, citation health, add/remove/reprocess actions.
3. **Tasks** — compact Kanban task graph, dependencies, assignees, blockers, open full board action.
4. **Outputs** — PPTX/DOCX/PDF/Markdown/Drive artifacts, versions, QA status, download/preview/regenerate actions.
5. **Evidence** — source citations, run IDs, API responses, QA screenshots/renders, build logs, verification checks.
6. **Settings** — audience, tone, output type, deck length, brand template, approval policy, citation requirement, advanced model/tool choices.

The drawer must be drawer-first, not a permanent sidebar that shrinks the board/chat.

### Human attention model

Use a `Needs you` section only for genuine human action:

- missing source upload
- choosing brand when ambiguous
- confirming external sharing
- approval for client-facing publication
- expensive/long-running processing confirmation
- business-sensitive scope/audience decision

Melkizac should choose reasonable defaults for ordinary workflow choices and record them as evidence. Do not create approval spam.

### Approval policy

- **Auto proceed:** internal drafts, source summaries, notes, first editable PPTX/DOCX draft, local QA, local revision.
- **Confirm before costly work:** large batch processing, long media transcription, high-cost model usage, many variants.
- **Approval gate:** external publishing, sending to client, sharing Drive links, deleting data, changing production systems, or sending sensitive client data to external providers.

---

## Research-to-deliverable workflow stages

1. Intent understood
2. Project created or linked
3. Sources collected
4. Sources processed
5. Research notes generated
6. Outline drafted
7. Editable PPTX generated
8. Editable DOCX generated
9. QA/verification complete
10. Ready for review or delivered

Each stage should carry status, owner/tool, timestamp, and evidence link where possible.

---

## Current implementation context

Known relevant files/surfaces:

- Existing Agent OS router contract: `docs/AGENT_OS_INTENT_ROUTER_SPEC.md`
- Existing chat intent routing preview plan: `docs/plans/2026-06-05-chat-intent-routing-preview.md`
- Main Mission Control frontend likely routes through `src/views/MissionControl.tsx`
- Existing/expected router service: `src/services/chatIntentRouter.ts`
- Existing chat action card primitive: `src/components/ChatActionCard.tsx`
- Mission Control source directory: `/opt/hermes-mission-control/source`
- Live service path: `/opt/hermes-mission-control/app.py`
- Live static dist: `/opt/hermes-mission-control/dist`

Important repository state at planning time:

- Branch: `main`
- Existing uncommitted changes already present before this plan was added. Do not overwrite them casually; inspect before editing.
- This plan is source/planning only. It does not deploy or change production behavior.

---

## Acceptance criteria

1. Main chat can detect research-to-deliverable intents without the user opening a standalone menu app.
2. High-confidence requests produce a compact chat intent card and create/link a Project according to policy.
3. Medium/low-confidence requests ask a concise clarification before mutating state.
4. A Project is created with objective, sources, outputs, lead agent, task graph, artifacts, and evidence fields.
5. A Kanban task graph is created with dependency links for source ingestion, research synthesis, outline, PPTX generation, DOCX generation, QA, and delivery.
6. The improved task drawer shows Overview, Sources, Tasks, Outputs, Evidence, and Settings tabs.
7. The drawer includes a `Needs you` section only when genuine human action is required.
8. Artifact cards in chat support download/open/revise/evidence actions.
9. External sharing/publishing/deletion and sensitive-data provider use are approval-gated.
10. The implementation has tests or fixture checks for representative prompts and UI state mapping.
11. Build verification uses `npm run build`; backend/API changes include Python tests where feasible.
12. Browser verification confirms chat cards, drawer tabs, and task/project linking render with no console errors.

---

## Task graph

### Task 1: Specify research-to-deliverable intent extensions

**Objective:** Extend the existing Agent OS router contract with research-to-deliverable sub-intents, confidence rules, and project/workflow creation rules.

**Files:**
- Modify: `docs/AGENT_OS_INTENT_ROUTER_SPEC.md`
- Create or modify: `tests/fixtures/agent_os_intent_router_cases.json`
- Modify: existing router tests if present

**Verification:**
- Fixture tests pass for representative prompts covering learning, source-Q&A, deck generation, report/proposal generation, add-sources, revise artifact, and status query.

### Task 2: Define project/template contract

**Objective:** Create the backend/data contract for a Research-to-Deliverable Project template.

**Files:**
- Create: `docs/RESEARCH_TO_DELIVERABLE_PROJECT_CONTRACT.md`
- Modify backend only after contract is approved by implementation task.

**Verification:**
- Contract names required fields, optional fields, approval policy, task graph shape, and artifact/evidence schema.

### Task 3: Implement side-effect-safe route preview

**Objective:** Let chat classify the request and show an intent card before mutation for medium-risk or ambiguous requests.

**Files:**
- Modify: `src/services/chatIntentRouter.ts`
- Modify: `src/views/MissionControl.tsx`
- Reuse/modify: `src/components/ChatActionCard.tsx`

**Verification:**
- `npm run build`
- Browser: entering representative prompts shows correct chat card copy and no console errors.

### Task 4: Implement Project + Kanban creation bridge

**Objective:** When policy allows, create/link a Project and create dependency-linked Kanban cards from the chat workflow.

**Files:**
- Modify: backend Project/Task API surfaces in `/opt/hermes-mission-control/app.py` or existing project/task modules.
- Modify frontend client service methods as needed.

**Verification:**
- API test creates a project/task graph from a fixture route.
- Board API shows created task IDs and dependencies.
- No mutation occurs for low-confidence routes.

### Task 5: Design and implement project-aware task drawer shell

**Objective:** Replace generic task-only drawer behavior for workflow projects with the tabbed cockpit: Overview, Sources, Tasks, Outputs, Evidence, Settings.

**Files:**
- Modify Task Board drawer components after inspecting exact paths.
- Modify CSS in `src/styles/app.css` using existing Mission Control visual grammar.

**Verification:**
- `npm run build`
- Browser: drawer opens without shrinking board lanes; tabs render; close/Escape/outside-click still work.

### Task 6: Implement Sources tab

**Objective:** Show source list, type, processing status, citation health, and source actions.

**Files:**
- Backend source metadata endpoint or project detail payload.
- Frontend drawer tab component.

**Verification:**
- Fixture/project with sample sources renders status chips and source actions.

### Task 7: Implement Outputs tab and artifact cards

**Objective:** Show PPTX/DOCX/Markdown/PDF artifacts, versions, QA status, download/preview/regenerate/revise actions.

**Files:**
- Backend artifact metadata endpoint or project detail payload.
- Frontend drawer tab component.
- Chat artifact card integration.

**Verification:**
- Fixture artifact renders in drawer and chat card.
- Download/open links are present only when artifact exists.

### Task 8: Implement Evidence tab

**Objective:** Surface source citations, run IDs, API responses, QA results, and verification logs without exposing secrets or excessive raw payloads.

**Files:**
- Backend evidence summarization helper.
- Frontend drawer tab component.

**Verification:**
- Evidence entries show timestamp, type, summary, and safe link/reference.
- Secret-like values are redacted/truncated.

### Task 9: Implement Needs-you/human-action UX

**Objective:** Add a clear, non-spammy human attention model in chat cards and drawer overview.

**Files:**
- Router/policy mapping.
- Drawer overview tab.
- Task/Approval integration where needed.

**Verification:**
- Low-confidence brand/audience/source-missing fixtures show `Needs you`.
- Internal draft fixtures do not create unnecessary Approval Gates.

### Task 10: Integrate research backend wrapper

**Objective:** Connect the workflow to Open Notebook or a controlled research backend wrapper for source ingestion, ask/search, notes, and citations.

**Files:**
- New backend/client wrapper path after repository inspection.
- Environment/config docs.

**Verification:**
- Harmless test notebook/source can be created and queried in a dev/smoke environment.
- Missing credentials produce board-visible blocker, not silent failure.

### Task 11: Integrate editable PPTX/DOCX generation

**Objective:** Generate real editable deliverables from research notes and outline, with QA evidence.

**Files:**
- New document-generation worker/wrapper path after repository inspection.
- Artifact metadata storage.

**Verification:**
- Generate sample `.pptx` and `.docx` from fixture research notes.
- Validate PPTX/DOCX and render preview where tooling is available.

### Task 12: End-to-end browser/API smoke test

**Objective:** Verify chat-triggered workflow creates project/tasks, renders drawer state, and returns artifact placeholders or sample artifacts.

**Files:**
- Add Playwright or existing browser smoke test path if available.
- Add backend test fixtures as needed.

**Verification:**
- `npm run build`
- Python tests for backend mutations/policy
- Browser automation for chat card + drawer tabs + no console errors

### Task 13: Documentation and operator SOP

**Objective:** Document how Melkizac should operate the workflow, when to ask for clarification, when to create tasks/projects, and how to handle blockers.

**Files:**
- Create or modify: `docs/RESEARCH_TO_DELIVERABLE_WORKFLOW.md`
- Update Mission Control docs if appropriate.

**Verification:**
- SOP includes examples for learning topic, source Q&A, deck, report, proposal, add sources, revise artifact, and status query.

---

## Rollback notes

- Planning file can be removed without runtime effect.
- UI changes should be behind source-controlled commits and can be reverted normally.
- Backend project/task mutation endpoints must remain policy-gated; if issues occur, disable the chat workflow creation bridge while keeping read-only route preview available.
- Open Notebook/research wrapper should be disabled by config if unhealthy or missing credentials.

---

## Open implementation questions

1. Should generated client-facing first drafts proceed automatically, or should Melkizac pause at outline approval by default?
2. Which default brand should be used when the user says “training deck” but does not specify Nexius Academy vs Nexius Labs?
3. Should Google Workspace upload/share be part of phase 1, or kept as a later approval-gated integration?
4. Should research backend initially be Open Notebook only, or an abstraction that can support NotebookLM/manual sources later?
