from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
ROUTER_PATH = ROOT / 'src/services/chatIntentRouter.ts'
MISSION_PATH = ROOT / 'src/views/MissionControl.tsx'


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


def test_chat_intent_router_handles_core_main_chat_phrases_without_ui_changes():
    router = ROUTER_PATH.read_text(encoding='utf-8')
    # These are the product-rule phrases from the main-chat universal input model.
    for phrase in ['Do this', 'Continue that', 'Make it weekly', 'Approve it', 'Show me proof', 'Start a new goal']:
        assert phrase in router
    # No visible JSX/CSS routing card should be introduced in this slice.
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'RoutingDecisionCard' not in mission
    assert 'chat-intent' not in mission


def test_main_chat_appends_structured_hidden_intent_routing_context():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'import { routeChatIntent, serializeChatIntentDecision } from "../services/chatIntentRouter";' in mission
    assert 'const intentDecision = routeChatIntent({' in mission
    assert '[Mission Control Intent Routing]' in mission
    assert 'serializeChatIntentDecision(intentDecision)' in mission
    assert 'sendToAgent("default", composeInstructionContext(instruction)' in mission


def test_hidden_routing_policy_keeps_ui_clean_and_uses_selected_project_as_scope():
    router = ROUTER_PATH.read_text(encoding='utf-8')
    assert 'UI Policy: Keep the Chat UI clean; do not expose routing cards by default.' in router
    assert 'Clarification Policy: If confidence is low or the route is unsafe/ambiguous, ask the user in chat before acting.' in router
    assert 'Project Scope: The selected Project is the user-declared context for this Chat message.' in router
    assert 'Selected Project Scope:' in router
