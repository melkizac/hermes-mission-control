from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def insert_platform_agent(app):
    app.seed_agent_directory()
    con = app.auth_db_connect()
    con.execute(
        """
        INSERT OR REPLACE INTO agent_directory
            (id, name, description, category, capabilities, shared_agent_ref, status, admin_managed_only, agent_class, policy_metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "platform-supervisor",
            "Platform Runtime Supervisor",
            "Admin-only runtime governance agent.",
            "platform",
            '["runtime-supervision", "audit"]',
            "platform-supervisor",
            "active",
            1,
            "platform",
            '{"connector_policy":{"transaction_domains":["erp","crm","hr","accounting"],"approval_required_for":["external_write","financial_transaction"]}}',
        ),
    )
    con.commit()
    con.close()


def test_phase1_seeded_templates_serialize_as_workspace_agents_with_policy_metadata(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")

    payload = app.list_agent_directory(admin)
    devops = next(agent for agent in payload["agents"] if agent["id"] == "devops")

    assert app.is_workspace_agent(devops) is True
    assert devops["agent_class"] == "workspace"
    assert devops["scope"] == "workspace"
    assert devops["visibility"] == "workspace-assigned"
    assert devops["policy_metadata"]["policy_source"] == ["workspace", "role", "connector"]
    assert devops["policy_metadata"]["connector_policy"]["transaction_domains"] == ["erp", "crm", "hr", "accounting"]
    assert devops["policy_metadata"]["approval_gates"]


def test_phase1_permission_helpers_hide_platform_agents_from_normal_users(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")
    admin = app.authenticate_user("melverick", "admin-secret")
    insert_platform_agent(app)

    platform_row = next(agent for agent in app.admin_agent_templates_payload(admin)[0]["templates"] if agent["id"] == "platform-supervisor")
    workspace_row = next(agent for agent in app.admin_agent_templates_payload(admin)[0]["templates"] if agent["id"] == "devops")

    assert app.is_platform_agent(platform_row) is True
    assert app.can_user_see_agent(user, platform_row) is False
    assert app.can_user_run_agent(user, platform_row, selected=True) is False
    assert app.can_admin_assign_agent(admin, platform_row) is False
    assert app.can_admin_assign_agent(admin, workspace_row) is True

    user_directory = app.list_agent_directory(user)["agents"]
    admin_directory = app.list_agent_directory(admin)["agents"]
    assert "platform-supervisor" not in {agent["id"] for agent in user_directory}
    assert "platform-supervisor" in {agent["id"] for agent in admin_directory}


def test_phase1_normal_user_cannot_select_or_run_platform_agent(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")
    admin = app.authenticate_user("melverick", "admin-secret")
    insert_platform_agent(app)

    result, status = app.select_user_agent(user, "platform-supervisor", {})
    assert status == 403
    assert "platform" in result["error"].lower()

    route, route_status = app.resolve_agent_runtime_route(user, "platform-supervisor")
    assert route_status == 403
    assert "platform" in route["error"].lower()

    admin_route, admin_status = app.resolve_agent_runtime_route(admin, "platform-supervisor")
    assert admin_status == 200
    assert admin_route["agent_id"] == "platform-supervisor"


def test_phase1_admin_assignment_rejects_platform_agents(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")
    admin = app.authenticate_user("melverick", "admin-secret")
    insert_platform_agent(app)

    result, status = app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops", "platform-supervisor"]})

    assert status == 400
    assert result["ok"] is False
    assert "workspace agent" in result["error"].lower()


def test_phase2_admin_payload_exposes_agent_class_and_assignment_policy(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    insert_platform_agent(app)

    access_payload, access_status = app.admin_access_payload(admin)
    assert access_status == 200
    access_agents = {agent["id"]: agent for agent in access_payload["agent_templates"]}

    platform = access_agents["platform-supervisor"]
    workspace = access_agents["devops"]

    assert platform["agent_class"] == "platform"
    assert platform["visibility"] == "admin-only"
    assert platform["assignment_policy"] == {
        "assignable_to_users": False,
        "assignment_scope": "admin-only",
        "label": "Platform (Admin-only)",
        "reason": "Platform agents govern Mission Control and cannot be assigned into normal user workspaces.",
    }
    assert platform["permissions"]["can_assign_to_users"] is False

    assert workspace["agent_class"] == "workspace"
    assert workspace["visibility"] == "workspace-assigned"
    assert workspace["assignment_policy"]["assignable_to_users"] is True
    assert workspace["assignment_policy"]["label"] == "Workspace (assignable to users/roles)"
    assert workspace["permissions"]["can_assign_to_users"] is True

    platform_payload, platform_status = app.admin_agent_platform_payload(admin)
    assert platform_status == 200
    class_counts = platform_payload["agent_class_summary"]
    assert class_counts["platform"]["assignable_to_users"] is False
    assert class_counts["workspace"]["assignable_to_users"] is True
