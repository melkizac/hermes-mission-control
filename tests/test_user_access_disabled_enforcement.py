from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_disabled_user_session_login_and_workspace_mutations_are_denied(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "disabled-operator@example.com", password="user-secret", name="Disabled Operator")

    token = app.make_session_token(user["email"])
    before, before_status = app.me_payload_from_cookie(f"{app.SESSION_COOKIE}={token}")
    assert before_status == 200
    assert before["user"]["status"] == "active"

    result, status = app.admin_update_user(admin, user["user"]["id"], {"status": "disabled", "disabledReason": "offboarding test"})
    assert status == 200
    assert result["user"]["status"] == "disabled"
    assert result["user"]["disabled_at"]
    assert result["user"]["status_updated_at"]
    assert result["user"]["disabled_reason"] == "offboarding test"
    assert result["user"]["disabled_by"] == admin["user"]["id"]
    assert result["user"]["runtime_cleanup_policy"]["session_policy"] == "existing session cookies are invalidated by active-user resolution"

    assert app.authenticate_user("disabled-operator@example.com", "user-secret") is None
    after, after_status = app.me_payload_from_cookie(f"{app.SESSION_COOKIE}={token}")
    assert after_status == 401
    assert after["ok"] is False

    denied, denied_status = app.create_workspace_project(None, {"id": "should-not-write", "name": "Should not write"})
    assert denied_status == 401
    assert denied["ok"] is False


def test_disabled_user_can_be_reenabled_and_metadata_is_safe(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "reenable-operator@example.com", password="user-secret", name="Re Enable")

    disabled, status = app.admin_update_user(admin, user["user"]["id"], {"status": "disabled", "disabled_reason": "temporary hold"})
    assert status == 200
    assert disabled["user"]["disabled_reason"] == "temporary hold"

    enabled, status = app.admin_update_user(admin, user["user"]["id"], {"status": "active"})
    assert status == 200
    assert enabled["user"]["status"] == "active"
    assert enabled["user"]["disabled_at"] is None
    assert enabled["user"]["disabled_by"] is None
    assert enabled["user"]["disabled_reason"] is None
    assert enabled["user"]["status_updated_at"]

    identity = app.authenticate_user("reenable-operator@example.com", "user-secret")
    assert identity is not None
    assert identity["user"]["status"] == "active"


def test_admin_access_exposes_disabled_summary_and_policy(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "summary-disabled@example.com", password="user-secret", name="Summary Disabled")
    app.admin_update_user(admin, user["user"]["id"], {"status": "disabled", "disabledReason": "contract ended"})

    access, status = app.admin_access_payload(admin)
    assert status == 200
    row = next(u for u in access["users"] if u["email"] == "summary-disabled@example.com")
    assert row["status"] == "disabled"
    assert row["disabled_reason"] == "contract ended"
    assert row["disabled_at"]
    assert access["summary"]["disabled"] >= 1
    assert access["policy"]["disabled_user_enforcement"] == "login, session, runtime, and workspace mutation routes require active users"


def test_non_admin_cannot_disable_or_enable_users(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    normal = make_user(app, "normal@example.com", password="normal-secret", name="Normal")
    target = make_user(app, "target@example.com", password="target-secret", name="Target")

    result, status = app.admin_update_user(normal, target["user"]["id"], {"status": "disabled"})

    assert status == 403
    assert result["ok"] is False
