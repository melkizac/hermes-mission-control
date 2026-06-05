import importlib.util
import sys
from pathlib import Path

CHAT_THREAD = Path('/opt/hermes-mission-control/source/src/components/ChatThread.tsx').read_text(encoding='utf-8')
STORE = Path('/opt/hermes-mission-control/source/src/services/store.tsx').read_text(encoding='utf-8')
HTTP_CLIENT = Path('/opt/hermes-mission-control/source/src/services/httpHermesClient.ts').read_text(encoding='utf-8')

spec = importlib.util.spec_from_file_location('mission_control_app', '/opt/hermes-mission-control/app.py')
app = importlib.util.module_from_spec(spec)
sys.modules['mission_control_app'] = app
spec.loader.exec_module(app)


def test_chat_thread_keeps_pending_bubble_until_request_user_row_is_renderable():
    """The local pending bubble must not vanish before a visible backend/overlay user row replaces it."""
    assert 'const pendingBackendUserVisible = useMemo(' in CHAT_THREAD
    assert 'm.role === "user" && m.requestId === activeRequestRef.current?.id' in CHAT_THREAD
    assert 'Boolean(m.text?.trim() || m.attachments?.length)' in CHAT_THREAD
    assert 'const visiblePendingMessage = pendingBackendUserVisible ? null : pendingMessage;' in CHAT_THREAD
    assert '{visiblePendingMessage && (' in CHAT_THREAD


def test_store_inserts_optimistic_user_message_before_network_polling_can_delay_display():
    assert 'const optimisticUserMessage: Message = {' in STORE
    assert 'id: `pending-${requestId}`' in STORE
    assert 'role: "user"' in STORE
    assert 'source: "web-ui"' in STORE
    assert 'messages: mergeMessages(agent.messages, [optimisticUserMessage])' in STORE


def test_profile_backed_chat_uses_fast_streaming_api_before_cli_fallback():
    source = Path('/opt/hermes-mission-control/app.py').read_text(encoding='utf-8')
    assert 'def profile_streaming_chat_completion(messages, model=\'hermes-agent\', request_id=None, runtime_route=None):' in source
    assert 'Mission Control profile-backed agent identity:' in source
    assert 'Keep this identity distinct from Melkizac/default' in source
    assert 'return profile_streaming_chat_completion(messages, model=model, request_id=request_id, runtime_route=runtime_route)' in source
    assert "except Exception:" in source
    assert "return profile_cli_chat_completion(messages, model=model, request_id=request_id, runtime_route=runtime_route)" in source


def test_http_client_fast_polls_and_accepts_profile_backed_cli_reply_without_request_id():
    assert 'const pollDelays = [250, 750, 1500, 3000];' in HTTP_CLIENT
    assert 'const requestedUser = requestMessages.find((m) => m.role === "user");' in HTTP_CLIENT
    assert 'const replyAnchorTs = requestedUser?.ts ?? startedAt;' in HTTP_CLIENT
    assert 'const profileBackedReply = (agent?.messages ?? []).find(' in HTTP_CLIENT
    assert 'm.source === "cli"' in HTTP_CLIENT
    assert '(m.ts ?? 0) >= replyAnchorTs - 2' in HTTP_CLIENT
    assert 'if (profileBackedReply) return [requestedUser, profileBackedReply].filter(Boolean) as Message[];' in HTTP_CLIENT


def test_visible_prompt_sanitizer_handles_user_prefixed_mission_control_context_leaks():
    leaked = 'hello Mission Control context:\nMission Control runtime routing context:\n- workspace = hidden'
    assert app.visible_user_message_from_cli_prompt(leaked) == 'hello'
    wrapped = 'Mission Control context:\nsecret\n\n---\n\nUser message:\nhi'
    assert app.visible_user_message_from_cli_prompt(wrapped) == 'hi'


def test_profile_backed_cli_reply_dedupes_web_ui_overlay_pair_against_state_db_pair():
    reply = 'Hi Melverick — Andrej here.\n\nWorkspace context noted.'
    messages = [
        {'id': 'db-user', 'role': 'user', 'source': 'cli', 'text': 'hello', 'ts': 100.0},
        {'id': 'db-agent', 'role': 'agent', 'source': 'cli', 'text': reply, 'ts': 100.1},
    ]
    overlay = [
        {'id': 'ui-user', 'role': 'user', 'source': 'web-ui', 'text': 'hello', 'requestId': 'req-1', 'ts': 99.0},
        {'id': 'ui-agent', 'role': 'agent', 'source': 'web-ui', 'text': reply, 'requestId': 'req-1', 'ts': 101.0},
    ]

    assert app.dedupe_ui_overlay_against_db(messages, overlay) == []


def test_overlay_user_is_not_deduped_while_request_has_no_matching_db_reply_yet():
    overlay = [{'id': 'ui-user', 'role': 'user', 'source': 'web-ui', 'text': 'hello', 'requestId': 'req-1', 'ts': 99.0}]
    assert app.dedupe_ui_overlay_against_db([], overlay) == overlay
