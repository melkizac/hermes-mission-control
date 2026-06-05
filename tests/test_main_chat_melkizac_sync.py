from pathlib import Path

ROOT = Path('/opt/hermes-mission-control/source')
MISSION = (ROOT / 'src/views/MissionControl.tsx').read_text(encoding='utf-8')
STORE = (ROOT / 'src/services/store.tsx').read_text(encoding='utf-8')
HERMES = (ROOT / 'src/services/hermesClient.ts').read_text(encoding='utf-8')


def test_main_chat_sends_to_canonical_melkizac_default_agent_and_stays_on_chat_page():
    assert 'sendToAgent' in STORE
    assert 'sendToAgent: (agentId: string' in STORE
    assert 'sendToAgent("default", composeInstructionContext(instruction)' in MISSION
    assert 'setView("agents")' not in MISSION


def test_main_chat_mirrors_agents_melkizac_conversation_layout():
    assert 'const melkizac = agents.find((agent) => agent.id === "default")' in MISSION
    assert 'const [hasStartedMainChat, setHasStartedMainChat] = useState(false);' in MISSION
    assert '!hasStartedMainChat ? (' in MISSION
    assert '<section className="clean-chat-shell"' in MISSION
    assert 'main-chat-surface' in MISSION
    assert 'main-chat-header' in MISSION
    assert 'Melkizac — All Groups Agent' in MISSION
    assert 'main-chat-history' in MISSION
    assert 'main-chat-row ${isUser ? "user" : "agent"}' in MISSION
    assert 'main-chat-bubble' in MISSION
    assert 'Send a task or message to Melkizac...' in MISSION
    assert 'main-chat-thread' not in MISSION


def test_main_chat_keyboard_scroll_and_visible_text_hygiene():
    assert 'function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>)' in MISSION
    assert 'event.key === "Enter" && !event.shiftKey' in MISSION
    assert 'event.preventDefault();' in MISSION
    assert 'void submit();' in MISSION
    assert 'latestMessageRef' in MISSION
    assert 'scrollIntoView({ block: "end"' in MISSION
    assert 'function visibleChatText(message: Message)' in MISSION
    assert 'const marker = "[Mission Control Chat Context]";' in MISSION
    assert 'raw.indexOf(marker)' in MISSION
    assert '<p>{visibleChatText(message)}</p>' in MISSION


def test_melkizac_send_helper_does_not_depend_on_currently_selected_agent():
    assert 'const sendToAgent = useCallback(' in STORE
    assert 'if (!agentId || (!text.trim() && attachments.length === 0)) return;' in STORE
    assert 'const requestId = options.requestId ?? `ui-${agentId}-${Date.now()}`;' in STORE
    assert 'agent.id === agentId' in STORE
    assert 'client.sendMessage(agentId, text.trim(), attachments, { ...options, requestId })' in STORE
    assert 'sendToAgent: (agentId: string' in STORE
    assert 'sendToAgent,' in STORE
