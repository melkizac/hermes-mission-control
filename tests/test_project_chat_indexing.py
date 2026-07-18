import importlib.util
import json
import sqlite3
import sys
import time
from pathlib import Path


def load_backend_app(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes-home"
    app_root = tmp_path / "mission-control"
    hermes_home.mkdir()
    app_root.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    monkeypatch.setenv("HMC_APP_ROOT", str(app_root))
    monkeypatch.setenv("HMC_APP_DB", str(app_root / "mission_control.db"))
    monkeypatch.setenv("HMC_PASSWORD_FILE", str(app_root / ".basic-password"))
    backend = Path(__file__).resolve().parents[1] / "backend"
    sys.path.insert(0, str(backend))
    sys.modules.pop("auth", None)
    module_name = f"hmc_backend_project_chat_indexing_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(module_name, backend / "app.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def seed_state_db(app):
    con = sqlite3.connect(app.STATE_DB)
    con.executescript(
        """
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT,
            owner TEXT,
            status TEXT,
            metadata TEXT,
            created_at REAL,
            updated_at REAL
        );
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            source TEXT,
            model TEXT,
            started_at REAL,
            message_count INTEGER,
            tool_call_count INTEGER,
            input_tokens INTEGER,
            output_tokens INTEGER
        );
        CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            role TEXT,
            content TEXT,
            created_at REAL
        );
        """
    )
    now = 1_700_000_000
    con.executemany(
        "INSERT INTO projects (id,name,owner,status,metadata,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
        [
            ("mission-control", "Hermes Mission Control", "", "active", json.dumps({"tags": ["hermes", "hmc"]}), now, now),
            ("nexius-leads", "Nexius Leads", "", "active", json.dumps({"tags": ["nexius", "lead"]}), now, now),
        ],
    )
    con.executemany(
        "INSERT INTO sessions (id,title,source,model,started_at,message_count,tool_call_count,input_tokens,output_tokens) VALUES (?,?,?,?,?,?,?,?,?)",
        [
            ("chat-hmc", "Discuss HMC runs activity", "telegram", "gpt", now + 1, 2, 0, 10, 20),
            ("chat-nexius", "Nexius Academy lead form follow-up", "telegram", "gpt", now + 2, 2, 0, 10, 20),
            ("chat-web-ui", "Mission Control web chat follow-up", "web-ui", "gpt", now + 4, 2, 0, 10, 20),
            ("cron-nightly", "cron_monitor", "cron", "gpt", now + 3, 1, 0, 1, 1),
        ],
    )
    con.executemany(
        "INSERT INTO messages (id,session_id,role,content,created_at) VALUES (?,?,?,?,?)",
        [
            ("m1", "chat-hmc", "user", "Please improve hermes.melverick.com project chat linking", now + 1),
            ("m2", "chat-hmc", "assistant", "Mission Control can index chats by project.", now + 1),
            ("m3", "chat-nexius", "user", "academy.nexiuslabs.com SkillsFuture leads need follow-up", now + 2),
            ("m4", "chat-nexius", "assistant", "Nexius lead operations noted.", now + 2),
            ("m6", "chat-web-ui", "user", "Keep the Hermes Mission Control chat tab active", now + 4),
            ("m7", "chat-web-ui", "assistant", "Pinned chat tabs should show explicit web UI chats.", now + 4),
            ("m5", "cron-nightly", "assistant", "scheduled monitor", now + 3),
        ],
    )
    con.commit()
    con.close()


def admin_identity():
    return {"user": {"email": "melverick", "role": "admin", "name": "Melverick"}, "role": "admin"}


def user_identity():
    return {"user": {"email": "operator@example.com", "role": "user", "name": "Operator"}, "workspace": {"id": "ws_operator"}}


def test_project_chat_linking_supports_many_to_many_canonical_links_and_rejects_runs(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)

    first, status = app.project_chat_link_payload(
        {"project_id": "mission-control", "session_id": "chat-hmc", "relationship_type": "discussion", "summary": "Discussed project chat indexing."},
        admin_identity(),
    )
    second, second_status = app.project_chat_link_payload(
        {"project_id": "nexius-leads", "session_id": "chat-hmc", "relationship_type": "requirements"},
        admin_identity(),
    )
    rejected, rejected_status = app.project_chat_link_payload(
        {"project_id": "mission-control", "session_id": "cron-nightly"},
        admin_identity(),
    )

    assert status == 200
    assert second_status == 200
    assert rejected_status == 400
    assert "human chat" in rejected["error"]
    assert first["link"]["link_source"] == "canonical"
    assert first["link"]["confidence"] == 1.0

    mission = app.project_chat_sessions_payload({"project": ["mission-control"]})
    nexius = app.project_chat_sessions_payload({"project": ["nexius-leads"]})
    all_chats = app.project_chat_sessions_payload({})

    assert "chat-hmc" in [item["id"] for item in mission["sessions"]]
    assert sum(1 for item in mission["sessions"] if item["id"] == "chat-hmc" and item["link_source"] == "canonical") == 1
    assert [item["id"] for item in nexius["sessions"]].count("chat-hmc") == 1
    assert sum(1 for item in all_chats["sessions"] if item["id"] == "chat-hmc" and item["link_source"] == "canonical") == 2
    assert any(item["id"] == "chat-web-ui" for item in all_chats["sessions"])
    assert all(item.get("human_initiated") for item in all_chats["sessions"])
    assert all(item["id"] != "cron-nightly" for item in all_chats["sessions"])


def test_project_chat_confirm_suggestion_promotes_deterministic_suggestion_to_canonical_and_unlink_reverts(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)

    suggested = app.project_chat_sessions_payload({"project": ["nexius-leads"]})
    suggested_link = next(item for item in suggested["sessions"] if item["id"] == "chat-nexius")
    assert suggested_link["link_source"] == "suggested"
    assert 0 < suggested_link["confidence"] < 1

    confirmed, status = app.project_chat_confirm_suggestion_payload(
        {"project_id": "nexius-leads", "session_id": "chat-nexius", "relationship_type": "requirements"},
        admin_identity(),
    )
    assert status == 200
    assert confirmed["link"]["link_source"] == "canonical"
    assert confirmed["link"]["relationship_type"] == "requirements"

    canonical = app.project_chat_sessions_payload({"project": ["nexius-leads"]})
    canonical_link = next(item for item in canonical["sessions"] if item["id"] == "chat-nexius")
    assert canonical_link["link_source"] == "canonical"
    assert canonical_link["confidence"] == 1.0
    assert canonical_link["linked_by"] == "melverick"

    removed, removed_status = app.project_chat_unlink_payload({"project_id": "nexius-leads", "session_id": "chat-nexius"}, admin_identity())
    assert removed_status == 200
    assert removed["ok"] is True

    after = app.project_chat_sessions_payload({"project": ["nexius-leads"]})
    relink_candidate = next(item for item in after["sessions"] if item["id"] == "chat-nexius")
    assert relink_candidate["link_source"] == "suggested"


def test_project_chat_sessions_filter_human_sources_before_recent_limit(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)
    con = sqlite3.connect(app.STATE_DB)
    now = 1_700_000_000
    con.executemany(
        "INSERT INTO sessions (id,title,source,model,started_at,message_count,tool_call_count,input_tokens,output_tokens) VALUES (?,?,?,?,?,?,?,?,?)",
        [(f"cron-crowd-{i}", f"cron_crowd_{i}", "cron", "gpt", now + 100 + i, 1, 0, 1, 1) for i in range(300)],
    )
    con.commit()
    con.close()

    payload = app.project_chat_sessions_payload({})
    ids = [item["id"] for item in payload["sessions"]]

    assert "chat-hmc" in ids
    assert "chat-nexius" in ids
    assert all(not item["id"].startswith("cron-crowd-") for item in payload["sessions"])


def test_project_chat_sessions_return_scoped_human_chats_for_non_admin_user(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)
    monkeypatch.setattr(app, "list_workspace_projects", lambda _filters, _identity: {
        "projects": [{"id": "mission-control", "name": "Hermes Mission Control", "sessions": 0, "status": "active"}],
    })

    payload = app.project_chat_sessions_payload({}, user_identity())
    ids = [item["id"] for item in payload["sessions"]]

    assert "chat-hmc" in ids
    assert "chat-nexius" not in ids
    assert payload["projects"][0]["id"] == "mission-control"
    assert payload["summary"]["sessions"] == len(payload["sessions"])


def test_recent_project_chat_fast_path_is_bounded_and_skips_transcript_analysis(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)
    monkeypatch.setattr(app, "project_session_text_index", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("recent list must not aggregate transcripts")))
    monkeypatch.setattr(app, "session_project_assignments", lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("recent list must not classify every project")))

    payload = app.project_chat_recent_sessions_payload({"limit": ["2"]}, admin_identity())

    assert [item["id"] for item in payload["sessions"]] == ["chat-web-ui", "chat-nexius"]
    assert all(item["human_initiated"] is True for item in payload["sessions"])
    assert all(item["id"] != "cron-nightly" for item in payload["sessions"])
    assert payload["summary"]["sessions"] == 2
    assert payload["summary"]["fast_path"] is True


def test_recent_project_chat_fast_path_does_not_expose_unlinked_sessions_to_workspace_user(tmp_path, monkeypatch):
    app = load_backend_app(tmp_path, monkeypatch)
    seed_state_db(app)
    monkeypatch.setattr(app, "list_workspace_projects", lambda _filters, _identity: {
        "projects": [{"id": "mission-control", "name": "Hermes Mission Control"}],
    })

    payload = app.project_chat_recent_sessions_payload({"limit": ["20"]}, user_identity())

    assert payload["sessions"] == []
    assert payload["summary"]["fast_path"] is True
