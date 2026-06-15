from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_realtime_refresh_hook_supports_polling_focus_events_and_staleness():
    source = read("src/hooks/useRealtimeRefresh.ts")
    assert "setInterval" in source
    assert 'refresh("poll")' in source
    assert 'refresh("focus")' in source
    assert 'refresh("event")' in source
    assert "document.hidden" in source
    assert "staleAfterMs" in source
    assert "statusLabel" in source
    assert "Loading real backend data" in source
    assert "Live · last" in source
    assert "Stale · last" in source


def test_runtime_surfaces_use_realtime_refresh_and_visible_status():
    surfaces = {
        "src/views/TaskBoard.tsx": ["client.listBoard", "Refresh task board"],
        "src/views/AgentOrg.tsx": ["/api/agent-org", "Refresh agent org"],
        "src/views/Automations.tsx": ["client.listAutomations", "Refresh routines"],
        "src/views/ResearchRuns.tsx": ["client.listResearchRuns", "Refresh research runs"],
    }
    for relative, expected in surfaces.items():
        source = read(relative)
        assert "useRealtimeRefresh" in source, relative
        assert "refreshState.statusLabel" in source, relative
        assert "realtime-status" in source, relative
        assert "refreshState.initialLoading" in source or "const loading = refreshState.initialLoading" in source, relative
        assert "refreshState.error" in source, relative
        assert "refreshState.refresh(\"manual\")" in source, relative
        assert "pollMs" in source and "staleAfterMs" in source, relative
        for marker in expected:
            assert marker in source, f"{relative} missing {marker}"


def test_realtime_status_css_shared_by_runtime_surfaces():
    css = read("src/styles/app.css")
    assert "Real-data refresh status shared by Task Board, Agent Org, Routines, and output/research surfaces" in css
    assert ".realtime-status" in css
    assert ".realtime-status.refreshing::before" in css
    assert ".realtime-status.stale" in css
    assert ".realtime-status.stale::before" in css
