from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_admin_invite_user_creates_pending_account_with_display_once_credentials_and_agent_assignment(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    access, access_status = app.admin_access_payload(admin)
    assert access_status == 200
    assignable = [agent for agent in access["agent_templates"] if agent["assignment_policy"]["assignable_to_users"]]
    agent_ids = [assignable[0]["id"]] if assignable else []

    result, status = app.admin_create_user(admin, {
        "email": "invited-operator@example.com",
        "name": "Invited Operator",
        "workspaceName": "Invited Operator Workspace",
        "role": "user",
        "status": "invited",
        "agent_ids": agent_ids,
    })

    assert status == 201
    assert result["ok"] is True
    assert result["user"]["email"] == "invited-operator@example.com"
    assert result["user"]["status"] == "invited"
    assert result["user"]["lifecycle"]["pending_activation"] is True
    assert result["user"]["lifecycle"]["can_login"] is False
    assert result["user"]["workspace"]["name"] == "Invited Operator Workspace"
    assert result["temporary_password"]
    assert result["temporary_password_display_once"] is True
    assert result["invitation"]["email_sent"] is False
    assert result["assigned_agent_ids"] == agent_ids
    assert app.authenticate_user("invited-operator@example.com", result["temporary_password"]) is None

    reloaded, reloaded_status = app.admin_access_payload(admin)
    assert reloaded_status == 200
    row = next(user for user in reloaded["users"] if user["email"] == "invited-operator@example.com")
    assert row["status"] == "invited"
    assert row["lifecycle"]["label"] == "Invited / pending activation"
    assert set(row["agent_access"]["assigned_agent_ids"]) == set(agent_ids)
    assert reloaded["summary"]["invited"] >= 1
    assert "invited" in reloaded["statuses"]


def test_non_admin_cannot_invite_users(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    normal = make_user(app, "normal-inviter@example.com", password="normal-secret", name="Normal Inviter")

    result, status = app.admin_create_user(normal, {
        "email": "should-not-create@example.com",
        "name": "No Create",
        "role": "user",
    })

    assert status == 403
    assert result["ok"] is False
