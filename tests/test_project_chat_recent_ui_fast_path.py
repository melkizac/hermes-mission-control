from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_left_rail_and_mobile_drawer_use_bounded_recent_chat_endpoint() -> None:
    nav = read("src/components/NavRail.tsx")
    mission = read("src/views/MissionControl.tsx")

    assert "/api/project-chats?mode=recent&limit=20" in nav
    assert "/api/project-chats?mode=recent&limit=20" in mission
    assert "prefetchMobileConversationIndex" in mission


def test_backend_dispatches_recent_mode_without_full_project_chat_index() -> None:
    backend = read("backend/app.py")

    assert "def project_chat_recent_sessions_payload(" in backend
    assert "if chat_mode == 'recent':" in backend
    assert "project_chat_recent_sessions_payload(q, identity)" in backend


def test_conversation_open_uses_cache_touch_prefetch_and_cursor_pagination() -> None:
    mission = read("src/views/MissionControl.tsx")
    types = read("src/types.ts")
    css = read("src/styles/app.css")

    assert "mobileConversationCacheRef" in mission
    assert "prefetchMobileConversation" in mission
    assert "onPointerDown={() => void prefetchMobileConversation(session)}" in mission
    assert 'new URLSearchParams({ limit: "50" })' in mission
    assert "mobileSessionPagination?.next_before" in mission
    assert "Load earlier messages" in mission
    assert "pagination?:" in types
    assert "content-visibility: auto" in css
