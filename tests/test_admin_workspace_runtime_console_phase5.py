from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_phase5_admin_runtime_console_payload_is_supervision_safe(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")
    app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops"]})
    created, status = app.create_personal_agent(user, {"name": "Private Planner", "requested_company_access": ["crm"]})
    assert status == 201

    payload, payload_status = app.admin_workspace_runtime_console_payload(admin, user["workspace"]["id"], {"mode": "supervise"})

    assert payload_status == 200
    assert payload["ok"] is True
    assert payload["mode"] == "supervise"
    assert payload["workspace"]["id"] == user["workspace"]["id"]
    assert payload["runtime"]["container_name"].startswith("hmc-user-")
    assert payload["hermes_profile"]["profile_name"].startswith("mc-")
    assert payload["assigned_workspace_agents"][0]["id"] == "devops"
    assert payload["personal_agent_policy"]["visibility"] == "metadata-only"
    assert payload["personal_agent_policy"]["count"] == 1
    assert payload["personal_agent_policy"]["names_hidden"] is True
    assert "Private Planner" not in str(payload)
    assert "chat" not in payload
    assert "memory" not in payload
    assert payload["links"]["audit"].endswith("workspace_id=" + user["workspace"]["id"])
    assert payload["links"]["logs"].endswith("runtime_id=" + payload["runtime"]["id"])


def test_phase5_manage_mode_exposes_only_safe_admin_controls(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")

    payload, status = app.admin_workspace_runtime_console_payload(admin, user["workspace"]["id"], {"mode": "manage"})

    assert status == 200
    assert payload["mode"] == "manage"
    control_ids = {control["id"] for control in payload["manage_controls"]}
    assert {"edit_user_access", "assign_workspace_agents", "reset_password", "open_audit_log"}.issubset(control_ids)
    assert "restart_runtime" not in control_ids
    assert all(control["safe"] is True for control in payload["manage_controls"])


def test_phase5_impersonation_mode_requires_explicit_reason_and_audits_before_context_action(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")

    denied, denied_status = app.admin_workspace_runtime_console_mode_action(admin, user["workspace"]["id"], {"mode": "impersonate"})
    assert denied_status == 400
    assert "reason" in denied["error"].lower()

    result, status = app.admin_workspace_runtime_console_mode_action(admin, user["workspace"]["id"], {"mode": "impersonate", "reason": "Support ticket T-1"})

    assert status == 200
    assert result["mode"] == "impersonate"
    assert result["audit_event_id"]
    assert result["warning"].startswith("You are about to operate inside")
    events = app.list_workspace_audit_events({}, admin)["events"]
    event = next(event for event in events if event["id"] == result["audit_event_id"])
    assert event["action"] == "admin_runtime_console_impersonation_started"
    assert event["resource_type"] == "workspace"
    assert event["resource_id"] == user["workspace"]["id"]
    assert event["evidence"]["target_workspace_id"] == user["workspace"]["id"]
    assert event["evidence"]["reason"] == "Support ticket T-1"


def test_phase5_normal_user_cannot_access_another_workspace_runtime_console(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    operator = make_user(app, "operator@example.com", name="Operator")
    other = make_user(app, "other@example.com", name="Other")

    payload, status = app.admin_workspace_runtime_console_payload(operator, other["workspace"]["id"], {"mode": "supervise"})

    assert status == 403
    assert "admin" in payload["error"].lower()
