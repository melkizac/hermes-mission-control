import json

from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


SENSITIVE_KEYS = {"temporary_password", "password", "password_hash", "token", "secret", "secret_path"}


def audit_rows(app, action=None, resource_id=None):
    con = app.auth_db_connect()
    where = []
    params = []
    if action:
        where.append("action=?")
        params.append(action)
    if resource_id:
        where.append("resource_id=?")
        params.append(resource_id)
    sql = "SELECT * FROM audit_events"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY created_at ASC"
    rows = [dict(row) for row in con.execute(sql, params).fetchall()]
    con.close()
    return rows


def evidence(row):
    return json.loads(row["evidence"] or "{}")


def assert_no_secrets(value):
    blob = json.dumps(value, sort_keys=True).lower()
    for key in SENSITIVE_KEYS:
        assert key not in blob
    assert "display_once" in blob or "returned_once" not in blob


def test_user_access_invite_reset_disable_enable_role_workspace_lifecycle_is_audited(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")

    created, status = app.admin_create_user(admin, {"email": "audit-lifecycle@example.com", "name": "Audit User", "role": "user"})
    assert status == 201
    user_id = created["user"]["id"]
    workspace_id = created["user"]["workspace"]["id"]
    profile_id = created["user"]["hermes_profile"]["id"]
    assert created.get("temporary_password")

    updated, status = app.admin_update_user(admin, user_id, {"role": "viewer", "status": "disabled", "workspaceName": "Audit Workspace Renamed", "resetPassword": True})
    assert status == 200
    assert updated["user"]["role"] == "viewer"
    assert updated["user"]["status"] == "disabled"
    assert updated.get("temporary_password")

    enabled, status = app.admin_update_user(admin, user_id, {"status": "active"})
    assert status == 200
    assert enabled["user"]["status"] == "active"

    actions = [row["action"] for row in audit_rows(app, resource_id=user_id)]
    for expected in [
        "user_access_invited",
        "user_access_role_changed",
        "user_access_disabled",
        "user_access_password_reset",
        "user_access_profile_workspace_changed",
        "user_access_enabled",
    ]:
        assert expected in actions

    for row in audit_rows(app, resource_id=user_id):
        body = evidence(row)
        assert body["schema_version"] == 1
        assert body["actor"]["user_id"] == admin["user"]["id"]
        assert body["target_user"]["id"] == user_id
        assert body["workspace"]["id"] == workspace_id
        assert body["hermes_profile"]["id"] == profile_id
        assert body["result"] == "success"
        assert body["occurred_at_sgt"].endswith("SGT")
        assert body["correlation_id"].startswith("user-access-")
        assert_no_secrets(body)


def test_user_access_agent_assignment_and_role_grants_are_audited_and_visible_via_api(tmp_path, monkeypatch):
    monkeypatch.setenv("HMC_USER_RUNTIME_AUTO_START", "0")
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "audit-agents@example.com", password="agent-secret", name="Audit Agents")
    user_id = user["user"]["id"]
    workspace_id = user["workspace_id"]

    app.seed_agent_directory()
    assigned, status = app.admin_set_user_agents(admin, user_id, {"agent_ids": ["default", "devops"]})
    assert status == 200
    assert assigned["assigned_agent_ids"] == ["default", "devops"]

    role_result, status = app.admin_set_role_agents(admin, "viewer", {"agent_ids": ["default"]})
    assert status == 200
    assert role_result["assigned_agent_ids"] == ["default"]

    user_events = app.list_workspace_audit_events({"workspace_id": [workspace_id]}, admin)
    user_actions = [event["action"] for event in user_events["events"]]
    assert "user_access_agents_changed" in user_actions

    role_events = app.list_workspace_audit_events({"action": ["user_access_role_agents_changed"]}, admin)
    assert any(event["resource_id"] == "viewer" for event in role_events["events"])

    assignment_event = next(event for event in user_events["events"] if event["action"] == "user_access_agents_changed")
    assert assignment_event["evidence"]["target_user"]["id"] == user_id
    assert assignment_event["evidence"]["workspace"]["id"] == workspace_id
    assert assignment_event["evidence"]["changes"]["agent_ids"] == ["default", "devops"]
    assert_no_secrets(assignment_event["evidence"])
