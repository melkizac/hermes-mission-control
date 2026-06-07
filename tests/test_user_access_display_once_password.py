import json

from test_multi_user_phase1 import load_app


def _as_json(payload):
    return json.dumps(payload, sort_keys=True)


def test_admin_create_user_returns_generated_password_once_only(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")

    created, status = app.admin_create_user(admin, {
        "email": "display-once@example.com",
        "name": "Display Once",
        "role": "user",
        "status": "active",
    })

    assert status == 201
    temp_password = created.pop("temporary_password")
    assert isinstance(temp_password, str)
    assert len(temp_password) >= 24
    assert created["temporary_password_display_once"] is True
    assert created["user"]["email"] == "display-once@example.com"
    assert "password" not in _as_json(created["user"]).lower()

    assert app.authenticate_user("display-once@example.com", temp_password) is not None

    access, access_status = app.admin_access_payload(admin)
    assert access_status == 200
    access_json = _as_json(access)
    assert temp_password not in access_json
    assert "temporary_password" not in access_json

    detail_row = next(user for user in access["users"] if user["email"] == "display-once@example.com")
    assert temp_password not in _as_json(detail_row)

    con = app.auth_db_connect()
    row = con.execute("SELECT password_hash FROM users WHERE email=?", ("display-once@example.com",)).fetchone()
    events = con.execute("SELECT action,evidence FROM audit_events WHERE resource_id=?", (created["user"]["id"],)).fetchall()
    con.close()
    assert row["password_hash"].startswith("pbkdf2_sha256$")
    assert row["password_hash"] != temp_password
    events_json = _as_json([dict(event) for event in events])
    assert temp_password not in events_json
    assert "credential_delivery" in events_json
    assert "display_once" in events_json


def test_admin_reset_password_returns_new_password_only_in_action_response(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    created, create_status = app.admin_create_user(admin, {
        "email": "reset-display-once@example.com",
        "name": "Reset Display Once",
        "role": "user",
        "status": "active",
    })
    assert create_status == 201
    initial_password = created["temporary_password"]

    reset, reset_status = app.admin_update_user(admin, created["user"]["id"], {"resetPassword": True})

    assert reset_status == 200
    reset_password = reset.pop("temporary_password")
    assert reset_password != initial_password
    assert reset["temporary_password_display_once"] is True
    assert app.authenticate_user("reset-display-once@example.com", initial_password) is None
    assert app.authenticate_user("reset-display-once@example.com", reset_password) is not None

    access, access_status = app.admin_access_payload(admin)
    assert access_status == 200
    access_json = _as_json(access)
    assert reset_password not in access_json
    assert initial_password not in access_json
    assert "temporary_password" not in access_json

    con = app.auth_db_connect()
    row = con.execute("SELECT password_hash FROM users WHERE email=?", ("reset-display-once@example.com",)).fetchone()
    events = con.execute("SELECT action,evidence FROM audit_events WHERE resource_id=?", (created["user"]["id"],)).fetchall()
    con.close()
    assert row["password_hash"] != reset_password
    events_json = _as_json([dict(event) for event in events])
    assert reset_password not in events_json
    assert initial_password not in events_json
    assert "credential_delivery" in events_json
    assert "display_once" in events_json
