import json
import sqlite3

from test_multi_user_phase1 import load_app


def test_codex_runtime_accounts_are_derived_from_hermes_auth_labels(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    monkeypatch.setattr(app, "hermes_auth_credentials", lambda: [
        {"provider": "openai-codex", "label": "Codex-Nexius", "auth_type": "oauth", "source": "device_code", "active": True},
        {"provider": "openai-codex", "label": "Codex-Melverick", "auth_type": "oauth", "source": "device_code", "active": False},
    ])
    monkeypatch.setattr(app, "list_agents_payload", lambda identity=None: [])

    payload = app.read_agent_runtime_switcher(None)

    accounts = {item["id"]: item for item in payload["accounts"]}
    assert accounts["codex-nexius"]["configured"] is True
    assert accounts["codex-nexius"]["auth_label"] == "Codex-Nexius"
    assert accounts["codex-melverick"]["configured"] is True
    assert accounts["codex-melverick"]["auth_label"] == "Codex-Melverick"


def test_apply_codex_account_to_profile_reorders_profile_credential_pool(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    monkeypatch.setattr(app, "rate_limit_profile_root", lambda profile_id="default": hermes_home)
    auth_path = hermes_home / "auth.json"
    auth_path.write_text(json.dumps({
        "version": 1,
        "credential_pool": {
            "openai-codex": [
                {"id": "n", "label": "Codex-Nexius", "access_token": "tok-n", "priority": 0},
                {"id": "m", "label": "Codex-Melverick", "access_token": "tok-m", "priority": 1},
            ]
        },
    }), encoding="utf-8")

    ok, message = app.apply_codex_account_to_profile("default", "Codex-Melverick")

    assert ok is True, message
    pool = json.loads(auth_path.read_text())["credential_pool"]["openai-codex"]
    assert [entry["label"] for entry in pool] == ["Codex-Melverick", "Codex-Nexius"]
    assert [entry["priority"] for entry in pool] == [0, 1]


def test_model_usage_all_payload_includes_both_codex_account_windows(tmp_path, monkeypatch):
    hermes_home = tmp_path / "hermes"
    hermes_home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(hermes_home))
    app = load_app(tmp_path, monkeypatch)
    (app.APP_ROOT / "model_router.json").write_text(json.dumps({
        "enabled": True,
        "policy": {"default_planner_model": "gpt-5.5"},
        "models": [{"id": "openai-codex-gpt-5-5", "label": "GPT-5.5", "provider": "openai-codex", "model": "gpt-5.5", "tier": "frontier", "enabled": True}],
    }), encoding="utf-8")

    def fake_codex_usage(profile_id, selected_model, account_label=""):
        if account_label.lower() not in {"codex-nexius", "codex-melverick"}:
            return None
        remaining = 77.0 if account_label.lower() == "codex-nexius" else 44.0
        window = {"label": "5h", "used_seconds": 0, "limit_seconds": 18000, "used_hours": 0, "limit_hours": 5, "remaining_seconds": 0, "remaining_hours": 0, "percent_used": 100 - remaining, "remaining_percent": remaining, "reset_at": "", "reset_label": "soon"}
        return {"daily": window, "weekly": {**window, "label": "Weekly"}, "selected_model": selected_model, "models": [selected_model], "source": "fake", "account_label": account_label, "available": True}

    monkeypatch.setattr(app, "codex_usage_snapshot_payload", fake_codex_usage)
    monkeypatch.setattr(app, "hermes_auth_credentials", lambda: [{"provider": "openai-codex", "label": "Codex-Nexius"}])
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    con.execute("CREATE TABLE sessions (model TEXT, started_at REAL, ended_at REAL)")

    rows = app.model_usage_all_payload(con, "gpt-5.5")

    by_account = {row.get("account_label"): row for row in rows if row.get("account_label")}
    assert by_account["Codex-Nexius"]["daily"]["remaining_percent"] == 77.0
    assert by_account["Codex-Melverick"]["daily"]["remaining_percent"] == 44.0
