from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_backend_tracks_and_exposes_request_progress_events():
    app = read("backend/app.py")
    assert "def append_processing_progress" in app
    assert "progress_events" in app
    assert "progressEvents" in app
    assert "processing_events_for_request(request_id)" in app
    assert "'progressEvents': progress_events[-12:]" in app
    assert "Contacting agent runtime" in app
    assert "Receiving assistant response" in app
    assert "Writing final answer" in app


def test_agent_chat_renders_live_progress_stack():
    chat_thread = read("src/components/ChatThread.tsx")
    types = read("src/types.ts")
    css = read("src/styles/app.css")
    assert "ProcessingProgressEvent" in types
    assert "progressEvents?: ProcessingProgressEvent[]" in types
    assert "activeProgressEvents" in chat_thread
    assert "processing-progress-list" in chat_thread
    assert "Live progress updates" in chat_thread
    assert "formatProgressEventAge" in chat_thread
    assert ".processing-progress-list" in css
    assert ".processing-inline-head" in css
