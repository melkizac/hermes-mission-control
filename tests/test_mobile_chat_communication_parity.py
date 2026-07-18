from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MISSION_CONTROL = ROOT / "src" / "views" / "MissionControl.tsx"
APP_CSS = ROOT / "src" / "styles" / "app.css"


def test_mobile_chat_restores_history_and_navigation_contract() -> None:
    source = MISSION_CONTROL.read_text(encoding="utf-8")

    assert 'window.matchMedia("(max-width: 760px)")' in source
    assert "refreshAgent(activeChatAgentId)" in source
    assert 'aria-label="Open conversations and agents"' in source
    assert 'aria-label="Mobile conversations and agents"' in source
    assert "/api/project-chats" in source
    assert "/messages?${query.toString()}`" in source


def test_mobile_chat_uses_selected_agent_for_communication() -> None:
    source = MISSION_CONTROL.read_text(encoding="utf-8")

    assert 'sendToAgent(activeChatAgentId,' in source
    assert 'uploadAttachmentToAgent(activeChatAgentId,' in source
    assert 'stopProcessingForAgent(activeChatAgentId,' in source
    assert 'placeholder={`Send a task or message to ${activeChatAgentName}...`}' in source


def test_mobile_navigation_is_safe_area_aware_and_does_not_overflow() -> None:
    css = APP_CSS.read_text(encoding="utf-8")

    assert ".mobile-chat-navigator" in css
    assert "env(safe-area-inset-top" in css
    assert "overflow-x: hidden" in css
    assert "min(88vw, 360px)" in css
