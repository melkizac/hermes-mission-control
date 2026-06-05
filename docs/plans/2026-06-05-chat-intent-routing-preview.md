# Chat Intent Routing Preview Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** After a user submits a main Chat request, show a short operator-facing routing preview before/while the request is handed to Melkizac, so Chat becomes the Mission router instead of only a message box.

**Architecture:** Reuse the existing `chatIntentRouter.ts` foundation, but convert it from hidden prompt context into a visible, typed preview state in `MissionControl.tsx`. Add a compact `ChatIntentRoutingPreview` component that explains what Mission Control detected, what context it will link to, and what action is about to happen. Keep the preview calm and lightweight: visible only after submit, no permanent extra chrome before typing.

**Tech Stack:** React 18, TypeScript, existing Vite app, existing Mission Control CSS tokens in `src/styles/app.css`, existing `/api/projects`, `/api/approvals`, `/api/board`, `/api/automations`, `/api/workflows` client methods where available.

---

## Current Codebase Findings

- Main chat lives in `src/views/MissionControl.tsx`.
- Hidden routing already exists in `src/services/chatIntentRouter.ts`.
- `MissionControl.tsx` currently calls `routeChatIntent()` inside `composeInstructionContext()` but only serializes it into the agent prompt.
- Existing hidden policy line says: `UI Policy: Keep the Chat UI clean; do not expose routing cards by default.` This phase should replace that with an explicit, controlled preview policy.
- Existing visual action-card primitive: `src/components/ChatActionCard.tsx`.
- Store send path: `src/services/store.tsx` → `sendToAgent()` → `HttpHermesClient.sendMessage()`.
- There is no test script in `package.json`; verification should use `npm run build` plus browser checks unless a test harness is added.

---

## UX Contract

### Preview states to support

1. **Starting new goal**
   - Trigger: explicit “start/create/new goal/mission/project/initiative”.
   - UI copy: “Starting a new goal”.
   - Primary action: continue/send.
   - Secondary action: edit request.

2. **Linked to existing mission**
   - Trigger: selected project/mission/task context or high-confidence continuation/update.
   - UI copy: “Linked to existing work”.
   - Show matched project/task/mission if available.

3. **Possible match found**
   - Trigger: medium confidence match to a task/approval/routine/project.
   - UI copy: “Possible match found”.
   - Let user confirm or send as new request.

4. **Needs clarification**
   - Trigger: low confidence, terse pronouns, missing context for “do this/approve it/continue that”.
   - UI copy: “Needs clarification”.
   - Do not send immediately; keep user in chat with a suggested clarifying question.

5. **Approval response detected**
   - Trigger: approve/reject/changes requested/go ahead/ship it.
   - UI copy: “Approval response detected”.
   - Show target approval if matched; otherwise ask which approval.

6. **Routine/workflow change detected**
   - Trigger: weekly/daily/monthly/schedule/automation/routine/workflow/playbook language.
   - UI copy: “Routine or workflow change detected”.
   - Show whether this appears to create a new routine or modify an existing one.

---

## Phase 1 — Make routing decisions UI-ready

### Task 1: Extend routing types with preview status

**Objective:** Add a UI-facing preview shape without changing send behavior yet.

**Files:**
- Modify: `src/services/chatIntentRouter.ts`

**Implementation:**
Add:

```ts
export type ChatIntentPreviewKind =
  | "starting_new_goal"
  | "linked_existing_mission"
  | "possible_match_found"
  | "needs_clarification"
  | "approval_response_detected"
  | "routine_workflow_change_detected";

export interface ChatIntentPreview {
  kind: ChatIntentPreviewKind;
  title: string;
  detail: string;
  confidence: ChatIntentConfidence;
  canProceed: boolean;
  suggestedQuestion?: string;
  primaryAction: string;
  secondaryAction?: string;
}
```

Add a pure function:

```ts
export function buildChatIntentPreview(decision: ChatIntentDecision): ChatIntentPreview {
  // map intentType + confidence + nextAction into the six UX states
}
```

**Verification:**
- Run: `npm run build`
- Expected: TypeScript passes.

---

### Task 2: Update prompt serialization policy

**Objective:** Align hidden prompt context with the new visible preview.

**Files:**
- Modify: `src/services/chatIntentRouter.ts`

**Implementation:**
Replace:

```ts
"UI Policy: Keep the Chat UI clean; do not expose routing cards by default."
```

with:

```ts
"UI Policy: Mission Control may show a compact routing preview before/while sending; treat it as user-facing routing evidence, not as final truth."
```

**Verification:**
- Run: `npm run build`
- Expected: TypeScript passes.

---

## Phase 2 — Add real context for matching

### Task 3: Load task/approval/routine/workflow context in main Chat

**Objective:** Give the router enough context to detect existing work instead of only selected project.

**Files:**
- Modify: `src/views/MissionControl.tsx`
- Possibly modify: `src/services/hermesClient.ts`
- Possibly modify: `src/services/httpHermesClient.ts`

**Implementation notes:**
- Reuse existing client methods if already present for board/routines/workflows.
- Load only lightweight summaries:
  - recent/open board tasks
  - pending approvals
  - active routines/workflows where API exists
- Keep failure non-blocking. If context fetch fails, route with available context and mark confidence lower.

**Verification:**
- Browser: open Chat; no visible loading clutter.
- Console: no errors if any context endpoint fails.
- Build: `npm run build` passes.

---

### Task 4: Pass loaded context into `routeChatIntent()`

**Objective:** Replace placeholder empty arrays with real summaries.

**Files:**
- Modify: `src/views/MissionControl.tsx`

**Current code:**

```ts
routeChatIntent({
  instruction,
  selectedProject,
  selectedMission: null,
  visibleMissions: [],
  tasks: [],
});
```

**Target behavior:**
- `tasks` receives recent/open board tasks.
- `selectedMission` remains null until Mission objects exist in the app state.
- `visibleMissions` can be derived from task `mission_result.workItem` when present.

**Verification:**
- Enter “continue this” with no project: preview should say clarification needed.
- Select a project and enter “continue the latest task”: preview should link to existing work if a task is available.

---

## Phase 3 — Build the visible preview component

### Task 5: Create `ChatIntentRoutingPreview` component

**Objective:** Render the preview as a compact, calm operator card after submit.

**Files:**
- Create: `src/components/ChatIntentRoutingPreview.tsx`
- Modify: `src/styles/app.css`

**Component props:**

```ts
type ChatIntentRoutingPreviewProps = {
  preview: ChatIntentPreview;
  decision: ChatIntentDecision;
  sending: boolean;
  onProceed?: () => void;
  onEdit?: () => void;
};
```

**Design rules:**
- Do not add a big animated card.
- Use one small card above the transcript/pending message.
- Show:
  - route title
  - confidence chip
  - matched context line
  - next action line
  - primary/secondary action only when not auto-sending
- Keep copy operator-clear, not technical.

**Verification:**
- Browser: preview is visible after submit.
- Browser: card does not push the composer out of view.
- Console: no errors.

---

### Task 6: Style preview with existing light Mission Control grammar

**Objective:** Make it look like the rest of the app, not a new dark/gradient component.

**Files:**
- Modify: `src/styles/app.css`

**CSS targets:**
- `.chat-intent-preview`
- `.chat-intent-preview-head`
- `.chat-intent-preview-kicker`
- `.chat-intent-preview-confidence`
- `.chat-intent-preview-context`
- `.chat-intent-preview-actions`

**Rules:**
- White panel.
- `1px solid var(--line)`.
- Subtle shadow.
- Compact typography.
- Distinct but calm chips for: high/medium/low confidence.

**Verification:**
- Desktop and mobile browser screenshots.
- No horizontal overflow at mobile width.

---

## Phase 4 — Wire into submit flow

### Task 7: Add preview state in `MissionControl.tsx`

**Objective:** Show the route result tied to the submitted message.

**Files:**
- Modify: `src/views/MissionControl.tsx`

**State:**

```ts
const [routingPreview, setRoutingPreview] = useState<{
  instruction: string;
  decision: ChatIntentDecision;
  preview: ChatIntentPreview;
} | null>(null);
```

**Behavior:**
- On submit, compute decision once.
- Set preview immediately.
- Use the same decision for prompt serialization so UI and agent context never disagree.

**Verification:**
- Submit “start a new goal to improve onboarding”.
- Preview says “Starting a new goal”.
- Agent prompt context contains the same route.

---

### Task 8: Gate low-confidence clarification before send

**Objective:** Prevent ambiguous “approve it / continue that / do this” messages from being sent without target context.

**Files:**
- Modify: `src/views/MissionControl.tsx`

**Behavior:**
- If `preview.canProceed === false`, do not call `sendToAgent()`.
- Keep draft text or transform it into a clarification prompt area.
- Show suggested question from preview.
- Let user edit and submit again.

**Verification examples:**
- “Approve it” with no selected project/approval → no send; preview asks which approval.
- “Continue that” with no selected context → no send; preview asks which mission/task.
- “Start a new goal: improve lead follow-up” → sends normally.

---

### Task 9: Preserve clean initial Chat screen

**Objective:** Keep the current clean input-first UX before any message is sent.

**Files:**
- Modify: `src/views/MissionControl.tsx`

**Behavior:**
- No routing preview before submit.
- No route dropdown before submit.
- Preview appears only after submit/clarification state.

**Verification:**
- Fresh `/app` Chat screen visually matches current clean Chat except no regression from existing UI.

---

## Phase 5 — Map the six requested cases

### Task 10: Implement exact preview mapping

**Objective:** Ensure the six product cases are represented exactly.

**Files:**
- Modify: `src/services/chatIntentRouter.ts`

**Mapping:**

- `new_goal` → `starting_new_goal`
- `continue_mission`, `update_task`, `resolve_blocker`, `status_query`, `evidence_query` with context → `linked_existing_mission`
- Any medium confidence match with non-empty matched context but uncertain next action → `possible_match_found`
- `ambiguous` or any `ask_clarifying_question` without matched context → `needs_clarification`
- `approval_response` → `approval_response_detected`
- `modify_routine` or workflow/routine keywords → `routine_workflow_change_detected`

**Verification:**
Manually test these six prompts in browser:

```txt
Start a new goal to improve onboarding
Continue the deployment task
Can you do that one?
Approve it
Make this weekly
Update me on proof for the latest task
```

---

### Task 11: Add workflow keyword coverage

**Objective:** Ensure workflow/playbook changes are detected, not only routines.

**Files:**
- Modify: `src/services/chatIntentRouter.ts`

**Implementation:**
Expand routine detection regex to include:

```txt
workflow, playbook, template, operating loop, SOP, recurring workflow
```

**Verification:**
- “Turn this into a workflow” → routine/workflow change preview.
- “Use the lead follow-up playbook” → possible/linked workflow route if context exists.

---

## Phase 6 — Verification and deploy

### Task 12: Build and deploy safely

**Objective:** Ship the static UI without interrupting active chat workers.

**Files:**
- Built output: `source/dist` → `/opt/hermes-mission-control/dist`

**Commands:**

```bash
cd /opt/hermes-mission-control/source
npm run build
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/opt/hermes-mission-control/processing-requests.json')
print(json.loads(p.read_text()) if p.exists() else {'requests': []})
PY
TS=$(date -u +%Y%m%dT%H%M%SZ)
cp -a /opt/hermes-mission-control/dist "/opt/hermes-mission-control/dist.backup.$TS"
rsync -a --delete /opt/hermes-mission-control/source/dist/ /opt/hermes-mission-control/dist/
```

**Verification:**
- Build succeeds.
- Browser opens `/app`.
- No console errors.
- Chat still sends normal requests.
- Low-confidence request does not send.
- Six preview states render correctly.

---

## Acceptance Criteria

- Chat remains clean before submit.
- After submit, the user sees what Mission Control thinks the request is about.
- The six requested routing outcomes are supported:
  - Starting new goal
  - Linked to existing mission/work
  - Possible match found
  - Needs clarification
  - Approval response detected
  - Routine/workflow change detected
- Low-confidence ambiguous commands are paused for clarification instead of blindly sent.
- UI route preview and hidden prompt routing use the same `ChatIntentDecision` object.
- No new Admin-only dependency; this is a user-side Chat feature.
- `npm run build` passes.
- Browser verification confirms no console errors and no mobile overflow.

---

## Open Product Decisions

1. Should medium-confidence “possible match found” auto-send with context, or require one click confirmation?
   - Recommended: auto-send only when selected project is explicit; otherwise ask confirmation.

2. Should approval responses directly call the approval API, or route to Melkizac first?
   - Recommended for this phase: preview + route to Melkizac. Direct approval mutation should be a later explicit safety phase.

3. Should the preview remain in transcript history or disappear after the assistant responds?
   - Recommended: keep it as lightweight routing evidence above/near the submitted user message for auditability.

4. Should the preview be shown before submit while typing?
   - Recommended: no. Keep clean Chat; route only after submit to avoid noisy prediction UX.
