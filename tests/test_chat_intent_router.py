from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
ROUTER_PATH = ROOT / 'src/services/chatIntentRouter.ts'
MISSION_PATH = ROOT / 'src/views/MissionControl.tsx'
PREVIEW_PATH = ROOT / 'src/components/ChatIntentRoutingPreview.tsx'
CSS_PATH = ROOT / 'src/styles/app.css'


def test_chat_intent_router_module_defines_universal_input_taxonomy():
    assert ROUTER_PATH.exists(), 'Chat Intent Routing Layer should live in a dedicated service module'
    router = ROUTER_PATH.read_text(encoding='utf-8')
    for intent in [
        'new_goal',
        'continue_mission',
        'update_task',
        'approval_response',
        'resolve_blocker',
        'modify_routine',
        'create_one_time_task',
        'status_query',
        'evidence_query',
        'ambiguous',
    ]:
        assert f'"{intent}"' in router
    assert 'export function routeChatIntent' in router
    assert 'matchedContext' in router
    assert 'confidence' in router
    assert 'nextAction' in router


def test_chat_intent_router_handles_core_main_chat_phrases_and_silent_default_routing():
    router = ROUTER_PATH.read_text(encoding='utf-8')
    mission = MISSION_PATH.read_text(encoding='utf-8')
    preview = PREVIEW_PATH.read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')
    # These are the product-rule phrases from the main-chat universal input model.
    for phrase in ['Do this', 'Continue that', 'Make it weekly', 'Approve it', 'Show me proof', 'Start a new goal']:
        assert phrase in router
    assert 'ChatIntentRoutingPreview' not in mission
    assert 'Keep the router silent by default' in mission
    assert 'main-chat-route-status' in mission
    assert 'aria-label="Mission Control router recommendation"' in preview
    assert 'aria-label="Router action controls"' in preview
    assert '.chat-intent-action.primary' in css
    assert '.chat-intent-action.safe' in css


def test_main_chat_appends_structured_hidden_intent_routing_context():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'routeChatIntent' in mission
    assert '/api/intent/route' in mission
    assert 'serializeChatIntentDecision' in mission
    assert 'const intentDecision = await routeInstruction(instruction, controller.signal);' in mission
    assert '[Mission Control Intent Routing]' in mission
    assert 'serializeChatIntentDecision(intentDecision)' in mission
    assert 'sendToAgent("default", composeInstructionContext(current.instruction, current.decision), [], sendOptions)' in mission


def test_visible_router_policy_keeps_actions_safe_and_uses_selected_project_as_scope():
    router = ROUTER_PATH.read_text(encoding='utf-8')
    mission = MISSION_PATH.read_text(encoding='utf-8')
    preview = PREVIEW_PATH.read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')
    assert 'UI Policy: Mission Control may show a compact routing preview before/while sending; treat it as user-facing routing evidence, not as final truth.' in router
    assert 'Clarification Policy: If confidence is low or the route is unsafe/ambiguous, ask the user in chat before acting.' in router
    assert 'Project Scope: The selected Project is the user-declared context for this Chat message.' in router
    assert 'Selected Project Scope:' in router
    assert 'defaultRoutingAction' in mission
    assert 'composeClarificationContext' in mission
    assert 'Do not expose router internals' in mission
    assert '/api/intent/create-kanban' in mission
    assert 'agentOsRoutePayload(current.instruction, current.decision' in mission
    assert '/api/workflows/${encodeURIComponent(workflowId)}/launch' in mission
    assert 'create_project' in mission
    assert 'create_task' in mission
    assert 'create_routine_draft' in mission
    assert 'send_to_agent' in mission
    assert 'ChatIntentPlanner' in router
    assert 'Data Required:' in router
    assert 'Mission Control Capabilities:' in router
    assert 'Execution planner' in preview
    assert 'aria-label="Tools, skills, data, and access planner"' in preview
    assert '.chat-intent-planner-grid' in css
    assert 'Evidence checklist' in preview
    assert 'Clarify first — no side effects are enabled for this route.' in preview



def test_chat_intent_router_policy_distinguishes_internal_drafts_from_approval_gates():
    router = ROUTER_PATH.read_text(encoding='utf-8')
    preview = PREVIEW_PATH.read_text(encoding='utf-8')
    task_board = (ROOT / 'src/views/TaskBoard.tsx').read_text(encoding='utf-8')
    css = CSS_PATH.read_text(encoding='utf-8')
    assert 'function inferApprovalPolicy' in router
    assert 'internalDraftAutoProceed' in router
    assert 'External publishing/posting/sending requires an Approval Gate.' in router
    assert 'Deletion, purge, removal, or production-destructive work requires an Approval Gate.' in router
    assert 'Sensitive provider/account use requires an Approval Gate.' in router
    assert 'Needs Approval Gate:' in router
    assert 'Approval Gate required —' in preview
    assert 'shouldSurfaceNeedsYou' in task_board
    assert 'A genuine human decision, Approval Gate, access fix, or manual outcome is required' in task_board
    assert '.needs-you-badge' in css
    assert '.agent-assignment-panel' in css
