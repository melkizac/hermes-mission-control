from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user
from test_admin_agent_class_policy_primitives import insert_platform_agent


def agent_ids(payload):
    return {agent["id"] for agent in payload["agents"]}


def test_phase3_direct_user_assignment_controls_directory_and_runtime(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")

    before = app.list_agent_directory(user)
    assert "devops" not in agent_ids(before)
    denied, denied_status = app.resolve_agent_runtime_route(user, "devops")
    assert denied_status == 403
    assert "assigned" in denied["error"].lower() or "select" in denied["error"].lower()

    assigned, status = app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops"]})
    assert status == 200
    assert assigned["assigned_agent_ids"] == ["devops"]

    directory = app.list_agent_directory(user)["agents"]
    devops = next(agent for agent in directory if agent["id"] == "devops")
    assert devops["selected"] is True
    assert devops["access_sources"] == ["user"]
    assert devops["access_source_label"] == "Direct user assignment"

    route, route_status = app.resolve_agent_runtime_route(user, "devops")
    assert route_status == 200
    assert route["agent_id"] == "devops"


def test_phase3_role_assignment_grants_effective_access_and_revocation_falls_back(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator", role="user")

    role_result, role_status = app.admin_set_role_agents(admin, "user", {"agent_ids": ["research-analyst"]})
    assert role_status == 200
    assert role_result["assigned_agent_ids"] == ["research-analyst"]

    directory = app.list_agent_directory(user)["agents"]
    research = next(agent for agent in directory if agent["id"] == "research-analyst")
    assert research["selected"] is True
    assert research["access_sources"] == ["role"]
    assert research["access_source_label"] == "Role assignment: user"

    app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops"]})
    with_direct = {agent["id"]: agent for agent in app.list_agent_directory(user)["agents"]}
    assert with_direct["devops"]["access_sources"] == ["user"]
    assert with_direct["research-analyst"]["access_sources"] == ["role"]

    revoked, revoke_status = app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": []})
    assert revoke_status == 200
    assert revoked["assigned_agent_ids"] == []
    after_revoke = {agent["id"]: agent for agent in app.list_agent_directory(user)["agents"]}
    assert "devops" not in after_revoke
    assert after_revoke["research-analyst"]["access_sources"] == ["role"]

    role_revoked, role_revoke_status = app.admin_set_role_agents(admin, "user", {"agent_ids": []})
    assert role_revoke_status == 200
    assert role_revoked["assigned_agent_ids"] == []
    assert "research-analyst" not in agent_ids(app.list_agent_directory(user))


def test_phase3_normal_user_cannot_self_assign_workspace_agent(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")

    result, status = app.select_user_agent(user, "devops", {})

    assert status == 403
    assert "admin" in result["error"].lower()
    assert "devops" not in agent_ids(app.list_agent_directory(user))


def test_phase3_platform_and_unassigned_denials_are_authoritative(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")
    insert_platform_agent(app)

    app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops"]})

    unassigned, unassigned_status = app.resolve_agent_runtime_route(user, "research-analyst")
    platform, platform_status = app.resolve_agent_runtime_route(user, "platform-supervisor")

    assert unassigned_status == 403
    assert "assigned" in unassigned["error"].lower()
    assert platform_status == 403
    assert "platform" in platform["error"].lower()


def test_phase3_attachment_route_reuses_runtime_assignment_enforcement(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")

    result, status = app.save_agent_attachment_for_identity(user, "devops", {"filename": "note.txt", "content": "hello"})

    assert status == 403
    assert "assigned" in result["error"].lower()


def test_phase3_runtime_agent_post_routes_are_not_blocked_by_global_admin_gate(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")

    attachment_permission, attachment_status = app.global_mutation_permission(user, "POST", "/api/agents/devops/attachments")
    message_permission, message_status = app.global_mutation_permission(user, "POST", "/api/agents/devops/messages")

    assert attachment_status == 200
    assert attachment_permission["ok"] is True
    assert message_status == 200
    assert message_permission["ok"] is True


def test_phase3_assignment_changes_are_audited(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    user = make_user(app, "operator@example.com", name="Operator")

    app.admin_set_user_agents(admin, user["user"]["id"], {"agent_ids": ["devops"]})
    app.admin_set_role_agents(admin, "user", {"agent_ids": ["research-analyst"]})

    events = app.list_workspace_audit_events({}, admin)["events"]
    actions = [event["action"] for event in events]
    assert "admin_assign_user_agents" in actions
    assert "admin_assign_role_agents" in actions
