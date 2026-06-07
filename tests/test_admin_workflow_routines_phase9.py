from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def setup_phase9_app(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    other = make_user(app, "other@example.com", name="Other")
    result, status = app.admin_set_user_agents(admin, operator["user"]["id"], {"agent_ids": ["devops"]})
    assert status == 200
    return app, admin, operator, other


def test_phase9_routine_inventory_scopes_platform_workspace_and_personal_visibility(tmp_path, monkeypatch):
    app, admin, operator, other = setup_phase9_app(tmp_path, monkeypatch)

    platform, status = app.upsert_workflow_routine(admin, {
        "id": "platform-health",
        "name": "Platform health sweep",
        "routine_type": "platform",
        "runtime_id": "hmc-platform",
        "agent_id": "devops",
        "agent_class": "platform",
        "schedule": "*/15 * * * *",
    })
    assert status == 200
    workspace, status = app.upsert_workflow_routine(admin, {
        "id": "workspace-crm",
        "name": "Workspace CRM monitor",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "runtime_id": "hmc-operator",
        "agent_id": "devops",
        "agent_class": "workspace",
        "schedule": "0 9 * * *",
    })
    assert status == 200
    personal, status = app.upsert_workflow_routine(operator, {
        "id": "personal-digest",
        "name": "Personal digest",
        "routine_type": "personal",
        "agent_id": "personal-assistant",
        "agent_class": "personal",
        "schedule": "0 8 * * *",
    })
    assert status == 200

    denied_platform, status = app.upsert_workflow_routine(operator, {"id": "user-platform", "name": "Bad", "routine_type": "platform"})
    assert status == 403
    assert "admin" in denied_platform["error"].lower()

    admin_ids = {r["id"] for r in app.list_workflow_routines(admin)["routines"]}
    operator_ids = {r["id"] for r in app.list_workflow_routines(operator)["routines"]}
    other_ids = {r["id"] for r in app.list_workflow_routines(other)["routines"]}

    assert {platform["routine"]["id"], workspace["routine"]["id"]} <= admin_ids
    assert personal["routine"]["id"] not in admin_ids
    assert "platform-health" not in operator_ids
    assert "workspace-crm" in operator_ids
    assert "personal-digest" in operator_ids
    assert "workspace-crm" not in other_ids
    assert "personal-digest" not in other_ids


def test_phase9_normal_user_cannot_manage_platform_or_other_workspace_routines(tmp_path, monkeypatch):
    app, admin, operator, other = setup_phase9_app(tmp_path, monkeypatch)
    app.upsert_workflow_routine(admin, {
        "id": "other-workspace-routine",
        "name": "Other workspace routine",
        "routine_type": "workspace",
        "workspace_id": other["workspace_id"],
        "agent_id": "devops",
        "agent_class": "workspace",
    })

    updated, status = app.upsert_workflow_routine(operator, {
        "id": "other-workspace-routine",
        "name": "Hijack routine",
        "routine_type": "workspace",
        "workspace_id": other["workspace_id"],
        "agent_id": "devops",
        "agent_class": "workspace",
    })
    assert status == 403
    assert "workspace" in updated["error"].lower()

    run, status = app.execute_workflow_routine(operator, "other-workspace-routine")
    assert status == 403
    assert run["ok"] is False


def test_phase9_routine_execution_is_blocked_by_connector_approval_or_quota_policy(tmp_path, monkeypatch):
    app, admin, operator, _other = setup_phase9_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "crm-main",
        "name": "Main CRM",
        "connector_type": "crm",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["read", "write"], "approval_required_for": ["write"]},
    })
    app.upsert_workflow_routine(admin, {
        "id": "approval-blocked-routine",
        "name": "Approval blocked routine",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "agent_id": "devops",
        "agent_class": "workspace",
        "connector_dependencies": [{"connector_id": "crm-main", "action": "write"}],
        "approval_policy_dependency": {"require_approval_for": ["routine_execute"]},
    })
    app.upsert_workflow_routine(admin, {
        "id": "quota-blocked-routine",
        "name": "Quota blocked routine",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "agent_id": "devops",
        "agent_class": "workspace",
        "quota_impact": {"runs": 1, "estimated_cost_usd": 0.25},
        "quota_policy": {"remaining_runs": 0},
    })

    approval_blocked, status = app.execute_workflow_routine(operator, "approval-blocked-routine")
    assert status == 202
    assert approval_blocked["status"] == "paused"
    assert approval_blocked["approval_required"] is True
    assert approval_blocked["run"]["status"] == "paused"

    quota_blocked, status = app.execute_workflow_routine(operator, "quota-blocked-routine")
    assert status == 403
    assert quota_blocked["status"] == "blocked"
    assert "quota" in quota_blocked["error"].lower()
    assert quota_blocked["run"]["status"] == "blocked"


def test_phase9_successful_routine_run_links_contextual_evidence_and_research_artifacts(tmp_path, monkeypatch):
    app, admin, operator, _other = setup_phase9_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "crm-main",
        "name": "Main CRM",
        "connector_type": "crm",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["read"]},
    })
    app.upsert_workflow_routine(admin, {
        "id": "research-routine",
        "name": "Research routine",
        "routine_type": "workspace",
        "workspace_id": operator["workspace_id"],
        "runtime_id": "hmc-operator",
        "agent_id": "devops",
        "agent_class": "workspace",
        "connector_dependencies": [{"connector_id": "crm-main", "action": "read"}],
        "quota_impact": {"runs": 1, "estimated_cost_usd": 0.05},
    })

    result, status = app.execute_workflow_routine(operator, "research-routine", {
        "browser_evidence": {"url": "https://example.com", "screenshot": "browser-evidence/run.png"},
        "research_run": {"id": "research-run-1", "title": "Market scan"},
    })

    assert status == 200
    assert result["status"] == "executed"
    run = result["run"]
    assert run["routine_id"] == "research-routine"
    assert run["run_detail_url"] == f"/app?view=audit&run={run['id']}"
    assert run["browser_evidence"]["url"] == "https://example.com"
    assert run["research_run"]["id"] == "research-run-1"
    routine = next(r for r in app.list_workflow_routines(operator)["routines"] if r["id"] == "research-routine")
    assert routine["last_run"]["id"] == run["id"]
    assert routine["run_detail_url"] == run["run_detail_url"]
    assert routine["connector_dependencies"][0]["connector_id"] == "crm-main"
