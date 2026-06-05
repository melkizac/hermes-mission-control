import importlib.util
import json
import os
import sys
import time
from pathlib import Path


def load_app(tmp_path, monkeypatch):
    password_file = tmp_path / "admin-password"
    password_file.write_text("admin-secret\n", encoding="utf-8")
    app_root = tmp_path / "mission-control"
    app_root.mkdir()
    monkeypatch.setenv("HMC_APP_ROOT", str(app_root))
    monkeypatch.setenv("HMC_APP_DB", str(app_root / "mission_control.db"))
    monkeypatch.setenv("HMC_PASSWORD_FILE", str(password_file))
    monkeypatch.setenv("HMC_USER", "melverick")
    monkeypatch.setenv("HMC_DEMO_USER", "demo")
    monkeypatch.setenv("HMC_DEMO_PASSWORD", "demo-pass")
    module_name = f"hmc_app_under_test_{time.time_ns()}"
    spec = importlib.util.spec_from_file_location(module_name, "/opt/hermes-mission-control/app.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_phase1_bootstraps_admin_user_and_workspace_from_existing_basic_password(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    identity = app.authenticate_user("melverick", "admin-secret")

    assert identity["email"] == "melverick"
    assert identity["role"] == "admin"
    assert identity["workspace_id"] == "ws_melverick"
    assert identity["workspace"]["slug"] == "melverick"
    assert identity["password_hash"].startswith("pbkdf2_sha256$")
    assert identity["password_hash"] != "admin-secret"


def test_phase1_session_token_resolves_user_role_and_workspace(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    identity = app.authenticate_user("melverick", "admin-secret")

    token = app.make_session_token(identity["email"])
    resolved = app.resolve_session_token(token)

    assert resolved["ok"] is True
    assert resolved["user"]["email"] == "melverick"
    assert resolved["user"]["role"] == "admin"
    assert resolved["workspace"]["id"] == "ws_melverick"


def test_phase1_api_me_returns_current_user_workspace_and_role(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    identity = app.authenticate_user("melverick", "admin-secret")
    token = app.make_session_token(identity["email"])

    payload, status = app.me_payload_from_cookie(f"{app.SESSION_COOKIE}={token}")

    assert status == 200
    assert payload["ok"] is True
    assert payload["user"] == {
        "id": "user_melverick",
        "email": "melverick",
        "name": "melverick",
        "role": "admin",
        "status": "active",
    }
    assert payload["workspace"] == {
        "id": "ws_melverick",
        "name": "melverick Workspace",
        "slug": "melverick",
    }


def test_phase1_demo_user_still_logs_in_as_viewer_workspace(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    identity = app.authenticate_user("demo", "demo-pass")

    assert identity["email"] == "demo"
    assert identity["role"] == "viewer"
    assert identity["workspace_id"] == "ws_demo"


def test_ui_overlay_rows_are_hidden_once_same_api_reply_is_in_state_db(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    messages = [
        {"id": "db-user-1", "role": "user", "text": "hi", "source": "api_server", "ts": 1005.0},
        {"id": "db-agent-1", "role": "agent", "text": "Hi Melverick — I’m here.", "source": "api_server", "ts": 1005.2},
    ]
    overlay = [
        {"id": "ui-user-1", "role": "user", "text": "hi", "requestId": "ui-default-1", "ts": 1000.0},
        {"id": "ui-agent-1", "role": "agent", "text": "Hi Melverick — I’m here.", "requestId": "ui-default-1", "ts": 1005.1},
        {"id": "ui-user-2", "role": "user", "text": "still pending", "requestId": "ui-default-2", "ts": 1010.0},
    ]

    filtered = app.dedupe_ui_overlay_against_db(messages, overlay)

    assert filtered == [overlay[2]]


def test_append_ui_chat_messages_is_idempotent_by_message_id(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    msg = {"id": "ui-user-1", "role": "user", "text": "hello", "requestId": "ui-default-1", "ts": 1000.0}

    app.append_ui_chat_messages("default", [msg])
    app.append_ui_chat_messages("default", [msg])

    rows = app.load_ui_chat_overlays()["default"]
    assert rows == [msg]
