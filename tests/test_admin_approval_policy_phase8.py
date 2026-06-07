from test_multi_user_phase1 import load_app
from test_multi_user_phase2_phase3 import make_user


def setup_phase8_app(tmp_path, monkeypatch):
    app = load_app(tmp_path, monkeypatch)
    admin = app.authenticate_user("melverick", "admin-secret")
    operator = make_user(app, "operator@example.com", name="Operator")
    result, status = app.admin_set_user_agents(admin, operator["id"], {"agent_ids": ["devops"]})
    assert status == 200
    return app, admin, operator


def test_phase8_allowed_action_executes_without_approval(tmp_path, monkeypatch):
    app, admin, operator = setup_phase8_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "crm-main",
        "name": "Main CRM",
        "connector_type": "crm",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["read", "draft", "write"], "approval_required_for": ["write"]},
    })
    calls = []

    result, status = app.run_policy_guarded_action(operator, {
        "action": "read",
        "agent_id": "devops",
        "connector_id": "crm-main",
        "resource_type": "crm_record",
        "resource_id": "lead-1",
    }, lambda: calls.append("executed") or {"ok": True, "value": "read-complete"})

    assert status == 200
    assert result["status"] == "executed"
    assert result["approval_required"] is False
    assert result["execution"] == {"ok": True, "value": "read-complete"}
    assert calls == ["executed"]
    audit = app.list_workspace_audit_events(identity=operator)["events"]
    assert [e["action"] for e in audit] == ["approval_policy.action_executed"]


def test_phase8_approval_required_action_pauses_and_creates_approval_with_browser_evidence(tmp_path, monkeypatch):
    app, admin, operator = setup_phase8_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "crm-main",
        "name": "Main CRM",
        "connector_type": "crm",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["read", "write"], "approval_required_for": ["write"]},
    })
    calls = []
    browser_evidence = {"url": "https://example.com/lead", "screenshot": "browser-evidence/run-1.png"}

    result, status = app.run_policy_guarded_action(operator, {
        "action": "write",
        "agent_id": "devops",
        "connector_id": "crm-main",
        "resource_type": "crm_record",
        "resource_id": "lead-1",
        "browser_evidence": browser_evidence,
    }, lambda: calls.append("executed"))

    assert status == 202
    assert result["status"] == "paused"
    assert result["approval_required"] is True
    assert result["approval_request"]["status"] == "drafted"
    assert result["approval_request"]["metadata"]["browser_evidence"] == browser_evidence
    assert calls == []
    inbox = app.list_inbox(identity=admin)
    assert inbox["summary"]["total"] == 1
    assert inbox["items"][0]["metadata"]["browser_evidence"] == browser_evidence
    audit_actions = [e["action"] for e in app.list_workspace_audit_events(identity=operator)["events"]]
    assert audit_actions == ["approval_policy.request_created"]


def test_phase8_denied_action_stays_blocked_and_does_not_execute(tmp_path, monkeypatch):
    app, admin, operator = setup_phase8_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "hr-main",
        "name": "HR Main",
        "connector_type": "hr",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["read"]},
    })
    calls = []

    result, status = app.run_policy_guarded_action(operator, {
        "action": "write",
        "agent_id": "devops",
        "connector_id": "hr-main",
        "resource_type": "hr_record",
        "resource_id": "employee-1",
    }, lambda: calls.append("executed"))

    assert status == 403
    assert result["status"] == "blocked"
    assert result["ok"] is False
    assert calls == []
    assert app.list_inbox(identity=admin)["summary"]["total"] == 0
    audit_actions = [e["action"] for e in app.list_workspace_audit_events(identity=operator)["events"]]
    assert audit_actions == ["approval_policy.action_denied"]


def test_phase8_policy_hierarchy_supports_browser_research_and_restricted_extract(tmp_path, monkeypatch):
    app, _admin, operator = setup_phase8_app(tmp_path, monkeypatch)

    browser = app.evaluate_approval_policy(operator, {
        "action": "browser_research",
        "resource_type": "research_run",
        "platform_policy": {"require_approval_for": ["browser_research"]},
    })
    extract = app.evaluate_approval_policy(operator, {
        "action": "download_extract",
        "resource_type": "file_extract",
        "platform_policy": {"require_approval_for": ["browser_research"]},
        "workspace_policy": {"deny_actions": ["download_extract"]},
        "action_policy": {"require_approval_for": ["download_extract"]},
    })

    assert browser["decision"] == "approval_required"
    assert browser["matched_level"] == "platform"
    assert extract["decision"] == "denied"
    assert extract["matched_level"] == "workspace"


def test_phase8_inbox_approval_and_rejection_emit_audit_events(tmp_path, monkeypatch):
    app, admin, operator = setup_phase8_app(tmp_path, monkeypatch)
    app.upsert_governed_connector(admin, {
        "id": "crm-main",
        "name": "Main CRM",
        "connector_type": "crm",
        "workspace_id": operator["workspace_id"],
        "policy": {"allowed_roles": ["user"], "allowed_actions": ["write"], "approval_required_for": ["write"]},
    })
    request, status = app.run_policy_guarded_action(operator, {
        "action": "write",
        "agent_id": "devops",
        "connector_id": "crm-main",
        "resource_type": "crm_record",
        "resource_id": "lead-1",
    }, lambda: {"ok": True})
    assert status == 202

    approved, status = app.inbox_action(request["approval_request"]["id"], "approve", {"note": "approved by admin"})

    assert status == 200
    assert approved["item"]["status"] == "sent"
    audit_actions = [e["action"] for e in app.list_workspace_audit_events(identity=operator)["events"]]
    assert "approval_policy.request_approved" in audit_actions

    request2, status = app.run_policy_guarded_action(operator, {
        "action": "write",
        "agent_id": "devops",
        "connector_id": "crm-main",
        "resource_type": "crm_record",
        "resource_id": "lead-2",
    }, lambda: {"ok": True})
    assert status == 202
    rejected, status = app.inbox_action(request2["approval_request"]["id"], "reject", {"note": "not safe"})

    assert status == 200
    assert rejected["item"]["status"] == "rejected"
    audit_actions = [e["action"] for e in app.list_workspace_audit_events(identity=operator)["events"]]
    assert "approval_policy.request_denied" in audit_actions
