from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def test_phase4_shared_directory_exposes_read_only_capabilities_for_normal_users(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")
    admin = app.authenticate_user("melverick", "admin-secret")
    result, status = app.admin_set_user_agents(admin, user["id"], {"agent_ids": ["devops"]})
    assert status == 200

    user_agent = next(a for a in app.list_agent_directory(user)["agents"] if a["id"] == "devops")
    admin_agent = next(a for a in app.list_agent_directory(admin)["agents"] if a["id"] == "devops")

    assert user_agent["permissions"] == {
        "can_select": False,
        "can_assign_to_own_projects": True,
        "can_assign_to_users": False,
        "can_edit_global_definition": False,
        "can_manage_runtime": False,
    }
    assert user_agent["management_scope"] == "workspace-preference"
    assert admin_agent["permissions"]["can_edit_global_definition"] is True
    assert admin_agent["permissions"]["can_manage_runtime"] is True


def test_phase4_global_mutation_routes_are_admin_only(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")
    admin = app.authenticate_user("melverick", "admin-secret")

    protected = [
        ("POST", "/api/runtime-connect/tokens"),
        ("POST", "/api/runtime-connect/tokens/token123/revoke"),
        ("POST", "/api/windows-gateway/config"),
        ("POST", "/api/agent-org/agents/devops/action"),
        ("POST", "/api/agent-org/agents/devops/goals"),
        ("POST", "/api/model-router"),
    ]

    for method, path in protected:
        result, status = app.global_mutation_permission(identity=user, method=method, path=path)
        assert status == 403, path
        assert result["ok"] is False
        assert "admin" in result["error"].lower()

        result, status = app.global_mutation_permission(identity=admin, method=method, path=path)
        assert status == 200, path
        assert result["ok"] is True


def test_phase4_workspace_agent_preference_routes_remain_allowed_for_normal_users(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    user = make_user(app, "operator@example.com", name="Operator")

    allowed = [
        ("POST", "/api/user/agents/devops/select"),
        ("DELETE", "/api/user/agents/devops/select"),
        ("POST", "/api/projects/my-project/agents/devops/assign"),
        # Chat runtime mutations pass the broad gate so the runtime resolver can
        # return assignment/class-specific errors instead of a generic Admin guard.
        ("POST", "/api/agents/devops/messages"),
        ("POST", "/api/agents/devops/attachments"),
    ]

    for method, path in allowed:
        result, status = app.global_mutation_permission(identity=user, method=method, path=path)
        assert status == 200, path
        assert result["ok"] is True
