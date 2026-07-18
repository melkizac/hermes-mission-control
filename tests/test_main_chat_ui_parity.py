from pathlib import Path

PRODUCTION_ROOT = Path('/opt/hermes-mission-control/source')
ROOT = PRODUCTION_ROOT if PRODUCTION_ROOT.exists() else Path(__file__).resolve().parents[1]
MISSION_PATH = ROOT / 'src/views/MissionControl.tsx'


def test_main_chat_default_load_keeps_hero_unless_user_or_backend_starts_chat():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'void refreshAgent(activeChatAgentId).catch(() => undefined);' in mission
    assert 'const shouldShowMainChatTranscript = hasStartedMainChat || Boolean(visiblePendingMainMessage) || Boolean(activeMainBackendRequestId);' in mission
    assert 'hasStartedMainChat || mainChatMessages.length > 0' not in mission
    assert 'return !shouldShowMainChatTranscript ? (' in mission
    assert 'displayedMainChatMessages.map((message) => {' in mission
    assert 'className={`main-chat-row ${isUser ? "user" : "agent"}`}' in mission


def test_main_chat_processing_reconciles_backend_requests_like_agent_chat():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'const activeMainBackendRequestId = useMemo(() => {' in mission
    assert 'const activeIds = new Set(activeChatAgent?.processingRequests ?? []);' in mission
    assert 'message.requestId === userMessage.requestId && (message.role === "agent" || message.role === "system")' in mission
    assert 'const isMainChatProcessing = sending || Boolean(routingActionBusy) || Boolean(activeMainBackendRequestId);' in mission
    assert 'const effectiveProcessingStartedAt = processingStartedAt ?? activeMainBackendStartedAt;' in mission
    assert 'if (!activeMainBackendRequestId || sending) return;' in mission
    assert 'window.setInterval(() => void refreshAgent(activeChatAgentId).catch(() => undefined), 3000)' in mission
    assert 'through /messages/status; this fallback detail refresh is only for an' in mission
    assert '{activeChatAgentName} is processing…' in mission


def test_main_chat_stop_and_transient_errors_match_agent_chat_reconciliation():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'const requestId = active?.id ?? activeMainBackendRequestId ?? undefined;' in mission
    assert 'await stopProcessingForAgent(activeChatAgentId, requestId);' in mission
    assert 'await refreshAgent(activeChatAgentId).catch(() => undefined);' in mission
    assert 'bad gateway|gateway|timeout|network|failed to fetch|502|503|504' in mission
    assert 'Connection dropped while Melkizac was processing. Refreshing the latest chat instead of putting the sent message back in the composer…' in mission
    assert 'for (const delay of [1200, 3000, 6000, 10000])' in mission


def test_main_chat_normal_agent_send_keeps_success_status_silent():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    send_branch = mission[mission.index('if (action === "send_to_agent")'):mission.index('if (action === "start_research_deliverable")')]
    assert 'setRoutingActionMessage(' not in send_branch
    assert 'Message sent to Melkizac.' not in mission


def test_main_chat_defaults_conversational_and_goal_messages_to_agent_owned_intent():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    assert 'function shouldUseMissionControlRouter(instruction: string, hasAttachments: boolean)' in mission
    assert 'const shouldUseRouter = shouldUseMissionControlRouter(instruction, attachments.length > 0);' in mission
    assert 'if (!shouldUseRouter) {' in mission
    assert 'Direct agent conversation; Melkizac owns intent and next-action selection.' in mission
    assert 'intentType: "one_time_reply"' in mission


def test_main_chat_router_is_reserved_for_explicit_operational_phrases():
    mission = MISSION_PATH.read_text(encoding='utf-8')
    helper = mission[mission.index('function shouldUseMissionControlRouter'):mission.index('function formatBytes')]
    assert 'create task' in helper
    assert 'start project' in helper
    assert 'launch workflow' in helper
    assert 'research deliverable' in helper
    assert 'schedule routine' in helper
    assert 'return explicitOperationPattern.test(normalized);' in helper
