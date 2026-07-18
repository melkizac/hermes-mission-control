import importlib.util
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
spec = importlib.util.spec_from_file_location("reliable_chat_app", ROOT / "backend" / "app.py")
app = importlib.util.module_from_spec(spec)
sys.modules["reliable_chat_app"] = app
spec.loader.exec_module(app)


def test_delivery_registration_is_durable_and_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "CHAT_DELIVERY_DB", tmp_path / "chat-delivery.db")
    first = app.register_chat_delivery("req-1", "agent-a", {"text": "hello"})
    second = app.register_chat_delivery("req-1", "agent-a", {"text": "duplicate"})
    assert first["created"] is True
    assert second["created"] is False
    assert app.chat_delivery("req-1")["payload"]["text"] == "hello"


def test_restart_reconciliation_marks_running_delivery_interrupted(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "CHAT_DELIVERY_DB", tmp_path / "chat-delivery.db")
    app.register_chat_delivery("req-2", "agent-a", {"text": "hello"})
    app.update_chat_delivery("req-2", "running")
    assert app.reconcile_chat_deliveries_after_restart() == 1
    assert app.chat_delivery("req-2")["status"] == "interrupted"


def test_concurrent_overlay_appends_preserve_all_messages(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "UI_CHAT_FILE", tmp_path / "chat-overlays.json")
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(lambda i: app.append_ui_chat_messages("agent-a", [{"id": f"m-{i}", "role": "agent", "text": str(i)}]), range(40)))
    ids = {row["id"] for row in app.ui_chat_messages("agent-a")}
    assert ids == {f"m-{i}" for i in range(40)}


def test_request_and_attachment_limits_are_explicit():
    assert 0 < app.MAX_HTTP_BODY_BYTES <= 80 * 1024 * 1024
    assert 0 < app.MAX_ATTACHMENT_BYTES < app.MAX_HTTP_BODY_BYTES


def test_mobile_and_pwa_contract_is_present():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "src" / "styles" / "app.css").read_text(encoding="utf-8")
    chat = (ROOT / "src" / "components" / "ChatThread.tsx").read_text(encoding="utf-8")
    assert "viewport-fit=cover" in html
    assert 'rel="manifest"' in html
    assert "env(safe-area-inset-bottom)" in css
    assert "Accepted · {agent.name} is working" in chat
