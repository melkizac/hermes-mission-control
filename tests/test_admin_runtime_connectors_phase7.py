from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_phase7_connector_scope_defaults_treat_company_systems_as_workspace(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)

    assert app.default_connector_scope_for_type("erp") == "workspace"
    assert app.default_connector_scope_for_type("crm") == "workspace"
    assert app.default_connector_scope_for_type("hr") == "workspace"
    assert app.default_connector_scope_for_type("accounting") == "workspace"
    assert app.default_connector_scope_for_type("personal-calendar") == "personal"


def test_phase7_connector_visibility_by_scope_and_authorized_roles(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    other = make_user(app, "other@example.com", name="Other")

    platform = app.upsert_governed_connector(admin, {"id": "platform-billing", "name": "Platform Billing", "connector_type": "platform-admin", "scope": "platform"})[0]["connector"]
    workspace = app.upsert_governed_connector(admin, {"id": "crm-main", "name": "Main CRM", "connector_type": "crm", "workspace_id": operator["workspace_id"], "policy": {"allowed_roles": ["user"]}})[0]["connector"]
    personal = app.upsert_governed_connector(operator, {"id": "personal-calendar", "name": "Personal Calendar", "connector_type": "personal-calendar", "scope": "personal"})[0]["connector"]

    admin_ids = {c["id"] for c in app.list_governed_connectors(admin)["connectors"]}
    operator_ids = {c["id"] for c in app.list_governed_connectors(operator)["connectors"]}
    other_ids = {c["id"] for c in app.list_governed_connectors(other)["connectors"]}

    assert platform["scope"] == "platform"
    assert workspace["scope"] == "workspace"
    assert personal["scope"] == "personal"
    assert "platform-billing" in admin_ids
    assert "platform-billing" not in operator_ids
    assert "crm-main" in operator_ids
    assert "crm-main" not in other_ids
    assert "personal-calendar" in operator_ids
    assert "personal-calendar" not in other_ids
    assert "personal-calendar" not in admin_ids


def test_phase7_connector_action_policy_allows_workspace_agent_and_rejects_personal_agent(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    set_result, status = app.admin_set_user_agents(admin, operator["id"], {"agent_ids": ["devops"]})
    assert status == 200
    personal_result, status = app.create_personal_agent(operator, {"name": "My Assistant", "capabilities": ["chat", "draft", "crm"]})
    assert status == 201
    personal_agent_id = personal_result["agent"]["id"]
    connector, status = app.upsert_governed_connector(admin, {"id": "crm-main", "name": "Main CRM", "connector_type": "crm", "workspace_id": operator["workspace_id"], "policy": {"allowed_roles": ["user"], "allowed_actions": ["read", "draft"]}})
    assert status == 200

    allowed, status = app.authorize_connector_action(operator, "crm-main", "devops", "read")
    assert status == 200
    assert allowed["ok"] is True
    assert allowed["approval_required"] is False

    denied_action, status = app.authorize_connector_action(operator, "crm-main", "devops", "write")
    assert status == 403
    assert denied_action["ok"] is False
    assert "not allowed" in denied_action["error"].lower()

    denied_personal, status = app.authorize_connector_action(operator, "crm-main", personal_agent_id, "read")
    assert status == 403
    assert denied_personal["ok"] is False
    assert "personal agents cannot access company transaction connectors" in denied_personal["error"].lower()


def test_phase7_backend_rejects_direct_unauthorized_connector_use(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    other = make_user(app, "other@example.com", name="Other")
    app.admin_set_user_agents(admin, operator["id"], {"agent_ids": ["devops"]})
    app.admin_set_user_agents(admin, other["id"], {"agent_ids": ["devops"]})
    app.upsert_governed_connector(admin, {"id": "hr-main", "name": "HR Main", "connector_type": "hr", "workspace_id": operator["workspace_id"], "policy": {"allowed_roles": ["user"], "allowed_actions": ["read"]}})

    result, status = app.authorize_connector_action(other, "hr-main", "devops", "read")

    assert status == 403
    assert result["ok"] is False
    assert "not authorized" in result["error"].lower()


def test_phase7_runtime_connector_api_payload_includes_governance_summary(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    app.upsert_governed_connector(admin, {"id": "crm-main", "name": "Main CRM", "connector_type": "crm", "workspace_id": operator["workspace_id"], "policy": {"allowed_roles": ["user"]}})

    token = app.make_session_token(admin["email"])
    payload = app.list_runtime_connectors({"Cookie": f"{app.SESSION_COOKIE}={token}"})

    assert payload["governance"]["workspace"] == 1
    assert "allowed_agent_classes" in payload["governance"]["policy_dimensions"]
    assert "crm" in payload["governance"]["company_transaction_domains"]
    assert "[REDACTED]" in payload["connect"]["curl_example"]
    assert "Friend OpenClaw" not in payload["connect"]["curl_example"]
