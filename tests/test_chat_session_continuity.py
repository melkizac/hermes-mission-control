import importlib.util
import sqlite3
import sys
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))
spec = importlib.util.spec_from_file_location("chat_session_continuity_app", BACKEND / "app.py")
app = importlib.util.module_from_spec(spec)
sys.modules["chat_session_continuity_app"] = app
spec.loader.exec_module(app)


def make_session_db(path: Path, session_id: str = "session-1", title=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT UNIQUE)")
    con.execute("INSERT INTO sessions(id,title) VALUES (?,?)", (session_id, title))
    con.commit()
    con.close()


def test_cli_resume_uses_hermes_session_and_returns_machine_id(monkeypatch):
    captured = {}

    def fake_run(command, **kwargs):
        captured["command"] = command
        return SimpleNamespace(returncode=0, stdout="Continued reply\n", stderr="\nsession_id: session-123\n")

    monkeypatch.setattr(app, "resolve_hermes_cli_bin", lambda: "hermes")
    monkeypatch.setattr(app, "configured_env_value", lambda _name: "")
    monkeypatch.setattr(app.subprocess, "run", fake_run)

    result = app.profile_cli_chat_completion(
        [{"role": "user", "content": "Continue"}],
        runtime_route={"profile_name": "melkizac"},
        session_id="session-123",
    )

    assert captured["command"][-2:] == ["--resume", "session-123"]
    assert result["session_id"] == "session-123"
    assert result["choices"][0]["message"]["content"] == "Continued reply"


def test_first_message_title_is_fast_readable_and_bounded():
    title = app.provisional_chat_title("# Please investigate why the desktop chat keeps disconnecting after several minutes. Extra detail follows.")
    assert title == "Please investigate why the desktop chat keeps disconnecting…"
    assert len(title) <= 60


def test_title_write_preserves_existing_title_and_manual_rename_overwrites(tmp_path, monkeypatch):
    db_path = tmp_path / "profiles" / "melkizac" / "state.db"
    make_session_db(db_path)
    monkeypatch.setattr(app, "state_db_for_profile", lambda _profile: db_path)

    assert app.set_profile_session_title("melkizac", "session-1", "First message title") == "First message title"
    assert app.set_profile_session_title("melkizac", "session-1", "Later automatic title") == "First message title"
    assert app.set_profile_session_title("melkizac", "session-1", "My renamed chat", overwrite=True) == "My renamed chat"


def test_desktop_and_mobile_send_selected_session_and_offer_rename():
    chat = (ROOT / "src" / "components" / "ChatThread.tsx").read_text(encoding="utf-8")
    mobile = (ROOT / "src" / "views" / "MissionControl.tsx").read_text(encoding="utf-8")
    client = (ROOT / "src" / "services" / "httpHermesClient.ts").read_text(encoding="utf-8")

    assert "sessionId, conversationTitle" in chat
    assert "sessionId: mobileSelectedSession?.id" in mobile
    assert "Active conversation · replies continue here" in mobile
    assert "renameMobileConversation" in mobile
    assert "conversationTitle: options.conversationTitle" in client
    assert "/rename" in client
